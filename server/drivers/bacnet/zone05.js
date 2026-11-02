const Bacnet = require('node-bacnet');
const { persistObservations } = require('../../historian/historian');

const DEVICE_IP = process.env.ZONE05_BACNET_IP || '192.168.186.224';
const DEVICE_PORT = Number(process.env.ZONE05_BACNET_PORT || 47809);
const DEVICE_INSTANCE = Number(process.env.ZONE05_BACNET_DEVICE_INSTANCE || 10005);
const CLIENT_PORT = Number(process.env.ZONE05_BACNET_CLIENT_PORT || 47810);
const POLL_MS = Number(process.env.ZONE05_BACNET_POLL_MS || 1000);
const PRIORITY = 8;
const ADDRESS = `${DEVICE_IP}:${DEVICE_PORT}`;

const objects = {
  Z05_MOISTURE: { type: 0, instance: 1, unit: '%' },
  Z05_FLOW: { type: 0, instance: 2, unit: 'gpm' },
  Z05_VALVE: { type: 0, instance: 3, unit: '%' },
  Z05_TANK_LEVEL: { type: 0, instance: 4, unit: '%' },
  Z05_RUNNING: { type: 3, instance: 1, unit: '' },
  Z05_FAULT: { type: 3, instance: 2, unit: '' },
  Z05_AUTO: { type: 4, instance: 1, unit: '' },
};

const state = { connected: false, deviceInstance: DEVICE_INSTANCE, timestamp: null, values: {} };
let client = null;
let timer = null;
let pollLock = Promise.resolve();
let stopped = true;

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function readProperty(objectId, propertyId = Bacnet.enum.PropertyIdentifier.PRESENT_VALUE) {
  return new Promise((resolve, reject) => {
    client.readProperty(ADDRESS, objectId, propertyId, (err, value) => {
      if (err) return reject(err);
      resolve(value);
    });
  });
}

function writeBinaryOutput(instance, active) {
  return new Promise((resolve, reject) => {
    const values = [{ type: Bacnet.enum.ApplicationTag.ENUMERATED, value: active ? 1 : 0 }];
    client.writeProperty(
      ADDRESS,
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
    if (!client || stopped) return;
    const next = {};
    for (const [tag, object] of Object.entries(objects)) {
      const value = await readProperty({ type: object.type, instance: object.instance });
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
  if (stopped) return;
  poll().catch(error => {
    state.connected = false;
    console.warn('[zone05-bacnet] poll failed:', error.message);
  }).finally(() => {
    if (!stopped) timer = setTimeout(schedulePoll, POLL_MS);
  });
}

function start() {
  if (client) return;
  stopped = false;
  client = new Bacnet({ port: CLIENT_PORT, interface: '0.0.0.0', apduTimeout: 3000, reuseAddr: true });
  client.on('error', error => {
    state.connected = false;
    console.error('[zone05-bacnet] client error:', error.message);
  });
  console.log(`[zone05-bacnet] BACnet client targeting ${ADDRESS}, device ${DEVICE_INSTANCE}`);
  schedulePoll();
}

function stop() {
  stopped = true;
  clearTimeout(timer);
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
      qualityReason: quality === 'BAD' ? 'BACNET_DEVICE_UNREACHABLE' : quality === 'UNCERTAIN' ? 'NO_VALUE_YET' : null,
    };
  });
}

async function command(name) {
  if (!client || stopped) throw httpError(503, 'BACnet client is not running');
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

module.exports = { start, stop, getObservations, getSnapshot: () => ({ ...state, values: { ...state.values } }), command };
