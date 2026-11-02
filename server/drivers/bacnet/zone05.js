const Bacnet = require('node-bacnet');
const os = require('node:os');
const { persistObservations } = require('../../historian/historian');

const DEVICE_PORT = Number(process.env.ZONE05_BACNET_PORT || 47809);
const DEVICE_INSTANCE = Number(process.env.ZONE05_BACNET_DEVICE_INSTANCE || 10005);
const CLIENT_PORT = Number(process.env.ZONE05_BACNET_CLIENT_PORT || 47810);
const POLL_MS = Number(process.env.ZONE05_BACNET_POLL_MS || 1000);
const DISCOVERY_TIMEOUT_MS = Number(process.env.ZONE05_BACNET_DISCOVERY_TIMEOUT_MS || 3000);
const DISCOVERY_RETRY_MS = Number(process.env.ZONE05_BACNET_DISCOVERY_RETRY_MS || 5000);
const CONFIGURED_IP = process.env.ZONE05_BACNET_IP || '';
const CONFIGURED_BROADCAST = process.env.ZONE05_BACNET_BROADCAST || '';
const PRIORITY = 8;
const DEVICE_ID_FILTER = { lowLimit: DEVICE_INSTANCE, highLimit: DEVICE_INSTANCE };

const objects = {
  Z05_MOISTURE: { type: 0, instance: 1, unit: '%' },
  Z05_FLOW: { type: 0, instance: 2, unit: 'gpm' },
  Z05_VALVE: { type: 0, instance: 3, unit: '%' },
  Z05_TANK_LEVEL: { type: 0, instance: 4, unit: '%' },
  Z05_RUNNING: { type: 3, instance: 1, unit: '' },
  Z05_FAULT: { type: 3, instance: 2, unit: '' },
  Z05_AUTO: { type: 4, instance: 1, unit: '' },
};

const state = {
  connected: false,
  discovering: false,
  deviceInstance: DEVICE_INSTANCE,
  address: null,
  timestamp: null,
  values: {},
};
let client = null;
let timer = null;
let discoveryTimer = null;
let discoveryRetryTimer = null;
let pollLock = Promise.resolve();
let stopped = true;
let discoveryInProgress = false;

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getBroadcastAddresses() {
  const addresses = new Set();
  if (CONFIGURED_BROADCAST) addresses.add(CONFIGURED_BROADCAST);

  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family !== 'IPv4' || entry.internal || !entry.netmask) continue;
      const ip = entry.address.split('.').map(Number);
      const mask = entry.netmask.split('.').map(Number);
      if (ip.length !== 4 || mask.length !== 4) continue;
      const broadcast = ip.map((octet, index) =>
        (octet & mask[index]) | (255 ^ mask[index])
      ).join('.');
      if (broadcast !== '255.255.255.255') addresses.add(broadcast);
    }
  }

  if (!addresses.size) addresses.add('255.255.255.255');
  return [...addresses];
}

function readProperty(address, objectId, propertyId = Bacnet.enum.PropertyIdentifier.PRESENT_VALUE) {
  return new Promise((resolve, reject) => {
    client.readProperty(address, objectId, propertyId, (err, value) => {
      if (err) return reject(err);
      resolve(value);
    });
  });
}

function writeBinaryOutput(instance, active) {
  const address = state.address;
  if (!address) return Promise.reject(httpError(503, 'Zone 05 BACnet device has not been discovered'));
  return new Promise((resolve, reject) => {
    const values = [{ type: Bacnet.enum.ApplicationTag.ENUMERATED, value: active ? 1 : 0 }];
    client.writeProperty(
      address,
      { type: Bacnet.enum.ObjectType.BINARY_OUTPUT, instance },
      Bacnet.enum.PropertyIdentifier.PRESENT_VALUE,
      values,
      { priority: PRIORITY },
      err => err ? reject(err) : resolve()
    );
  });
}

function decode(response) {
  const item = response?.values?.[0];
  if (!item) throw new Error('BACnet Present_Value response was empty');
  return item.value;
}

async function poll() {
  const run = pollLock.then(async () => {
    if (!client || stopped || !state.address) return;
    const next = {};
    for (const [tag, object] of Object.entries(objects)) {
      const value = await readProperty(state.address, { type: object.type, instance: object.instance });
      next[tag] = decode(value);
    }
    state.values = next;
    state.connected = true;
    state.timestamp = new Date().toISOString();
    persistObservations('zone05-bacnet-device-10005', getObservations()).catch(error =>
      console.error('[zone05-bacnet] historian write failed:', error.message)
    );
  });
  pollLock = run.catch(() => {});
  return run;
}

function schedulePoll() {
  if (stopped || !state.address) return;
  poll().catch(error => {
    state.connected = false;
    console.warn('[zone05-bacnet] poll failed:', error.message);
  }).finally(() => {
    if (!stopped && state.address) timer = setTimeout(schedulePoll, POLL_MS);
  });
}

function scheduleDiscoveryRetry() {
  if (stopped || discoveryRetryTimer) return;
  discoveryRetryTimer = setTimeout(() => {
    discoveryRetryTimer = null;
    discover();
  }, DISCOVERY_RETRY_MS);
}

function discover() {
  if (stopped || !client || discoveryInProgress) return;
  discoveryInProgress = true;
  state.discovering = true;
  console.log(
    `[zone05-bacnet] discovering device ${DEVICE_INSTANCE} via Who-Is; broadcast UDP port ${DEVICE_PORT}`
  );

  // node-bacnet's default broadcast destination is UDP 47808. The simulator
  // listens on 47809, so send one directed broadcast per local IPv4 subnet.
  for (const broadcast of getBroadcastAddresses()) {
    client.whoIs(`${broadcast}:${DEVICE_PORT}`, DEVICE_ID_FILTER);
  }

  // A fixed IP may be supplied as a commissioning fallback, but discovery is
  // always attempted first. Never silently poll the old hard-coded address.
  if (CONFIGURED_IP) {
    console.log(`[zone05-bacnet] configured fallback IP: ${CONFIGURED_IP}`);
  }

  clearTimeout(discoveryTimer);
  discoveryTimer = setTimeout(() => {
    discoveryInProgress = false;
    state.discovering = false;
    if (!state.address) {
      console.warn(
        `[zone05-bacnet] device ${DEVICE_INSTANCE} not discovered; retrying in ${DISCOVERY_RETRY_MS} ms`
      );
      scheduleDiscoveryRetry();
    }
  }, DISCOVERY_TIMEOUT_MS);
}

function handleIAm(data) {
  const deviceId = data?.payload?.deviceId;
  if (deviceId !== DEVICE_INSTANCE || stopped) return;

  const sender = data?.header?.sender?.address;
  if (!sender) return;
  const address = sender.includes(':') ? sender : `${sender}:${DEVICE_PORT}`;

  clearTimeout(discoveryTimer);
  clearTimeout(discoveryRetryTimer);
  discoveryTimer = null;
  discoveryRetryTimer = null;
  discoveryInProgress = false;
  state.discovering = false;

  if (state.address !== address) {
    state.address = address;
    state.connected = false;
    state.values = {};
    console.log(`[zone05-bacnet] discovered device ${deviceId} at ${address}`);
  }

  clearTimeout(timer);
  schedulePoll();
}

function start() {
  if (client) return;
  stopped = false;
  state.address = null;
  state.connected = false;
  client = new Bacnet({
    port: CLIENT_PORT,
    interface: '0.0.0.0',
    broadcastAddress: `255.255.255.255:${DEVICE_PORT}`,
    apduTimeout: 3000,
    reuseAddr: true,
  });
  client.on('iAm', handleIAm);
  client.on('error', error => {
    state.connected = false;
    console.error('[zone05-bacnet] client error:', error.message);
  });
  client.on('listening', () => {
    console.log(`[zone05-bacnet] BACnet client listening on UDP ${CLIENT_PORT}`);
    discover();
  });
}

function stop() {
  stopped = true;
  clearTimeout(timer);
  clearTimeout(discoveryTimer);
  clearTimeout(discoveryRetryTimer);
  discoveryInProgress = false;
  state.discovering = false;
  if (client) {
    try { client.close(); } catch (_) {}
    client = null;
  }
  state.connected = false;
}

function getObservations() {
  return Object.entries(objects).map(([tagName, object]) => {
    const value = state.values[tagName] ?? null;
    const quality = !state.connected ? 'BAD' : value === null ? 'UNCERTAIN' : 'GOOD';
    return {
      tagName,
      value,
      engineeringUnit: object.unit,
      sourceSystemId: 'zone05-bacnet-device-10005',
      protocol: 'BACnet/IP',
      sourceTimestamp: null,
      receivedTimestamp: state.timestamp,
      quality,
      qualityReason: quality === 'BAD'
        ? (state.address ? 'BACNET_DEVICE_UNREACHABLE' : 'BACNET_DEVICE_NOT_DISCOVERED')
        : quality === 'UNCERTAIN' ? 'NO_VALUE_YET' : null,
    };
  });
}

async function command(name) {
  if (!client || stopped) throw httpError(503, 'BACnet client is not running');
  if (!state.address) throw httpError(503, 'Zone 05 BACnet device has not been discovered');
  const commands = {
    auto: [1, true], manual: [1, false],
    start: [2, true], stop: [3, true], faultreset: [4, true],
  };
  const action = commands[String(name || '').toLowerCase()];
  if (!action) throw httpError(400, 'Unsupported Zone 05 command');
  try {
    await writeBinaryOutput(action[0], action[1]);
    // START, STOP and FAULT_RESET are action requests: clear their BO slot
    // after the write so the same action can be issued again later.
    if ([2, 3, 4].includes(action[0]) && action[1]) {
      await new Promise(resolve => setTimeout(resolve, 250));
      await writeBinaryOutput(action[0], false);
    }
    return { accepted: true, command: String(name).toLowerCase(), priority: PRIORITY };
  } catch (error) {
    throw httpError(502, `BACnet command write failed: ${error.message}`);
  }
}

module.exports = {
  start,
  stop,
  getObservations,
  getSnapshot: () => ({ ...state, values: { ...state.values } }),
  command,
};
