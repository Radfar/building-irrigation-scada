const { Controller, Tag } = require('st-ethernet-ip');
const { unitFor } = require('../../contracts/units');
const PLC_IP   = process.env.ZONE02_PLC_IP || '192.168.203.1';
const POLL_MS  = 1000;
const RETRY_MS = 5000;
const PULSE_MS = 300;   // how long a momentary command (Start/Stop/Reset) stays TRUE
// Tags to poll. A name that doesn't exist in the PLC is skipped with a warning.
const READ_TAGS = [
  'Z02_MOISTURE', 'Z02_FLOW', 'Z02_AUTO', 'Z02_RUNNING', 'Z02_VALVE', 'Z02_FAULT',
  'Z02_AUTO_ACTIVE', 'Z02_PERMISSIVE', 'Z02_COMMANDED', 'Z02_PUMP_RUN', 'Z02_PUMP_SPD',
  'Z02_SIM_ENABLE', 'Z02_LOW_FLOW', 'Z02_FLOW_OK', 'Z02_PROCESS_OK', 'Z02_COMM_OK',
  'Z02_TOTAL_RUNTIME_SEC',
];
const LEVEL_CMDS = ['Z02_AUTO', 'Z02_SIM_ENABLE'];                    // write TRUE/FALSE and hold
const PULSE_CMDS = ['Z02_START', 'Z02_STOP', 'Z02_FAULT_RESET'];      // edge-detected in the PLC

const ALL = [...new Set([...READ_TAGS, ...LEVEL_CMDS, ...PULSE_CMDS])];

let plc = null;
let tags = {};
let timer = null;
let lock = Promise.resolve();          // one PLC request at a time
const skipped = new Set();
const state = { connected: false, timestamp: null, tags: {} };

function enqueue(fn) {
  const run = lock.then(fn, fn);
  lock = run.catch(() => {});
  return run;
}

function teardown() {
  clearTimeout(timer);
  try { if (plc && plc.destroy) plc.destroy(); } catch (e) {}
  plc = null;
  state.connected = false;
}

function scheduleReconnect() {
  setTimeout(connect, RETRY_MS);
}

async function connect() {
  plc = new Controller(true);          // connected messaging (what worked on the simulator)
  plc.on('error', e => console.error('[zone02] plc error:', e.message));
  try {
    await plc.connect(PLC_IP, Buffer.alloc(0));   // empty path = no slot routing (Micro800)
    tags = {};
    ALL.forEach(n => { tags[n] = new Tag(n); });
    state.connected = true;
    console.log('[zone02] connected to', PLC_IP);
    poll();
  } catch (e) {
    console.error('[zone02] connect failed:', e.message);
    teardown();
    scheduleReconnect();
  }
}

function poll() {
  enqueue(async () => {
    for (const name of ALL) {
      if (skipped.has(name)) continue;
      try {
        await plc.readTag(tags[name]);
        state.tags[name] = tags[name].value;
      } catch (e) {
        if (/timeout|socket/i.test(e.message)) throw e;   // connection problem
        skipped.add(name);                                // tag problem
        console.warn(`[zone02] skipping ${name}: ${e.message}`);
      }
    }
    state.timestamp = new Date().toISOString();
  }).then(() => {
    timer = setTimeout(poll, POLL_MS);
  }).catch(e => {
    console.error('[zone02] poll failed, reconnecting:', e.message);
    teardown();
    scheduleReconnect();
  });
}

async function writeBool(name, value) {
  const tag = tags[name];
  tag.value = value;
  await plc.writeTag(tag);
}

function command(name, value) {
  const isLevel = LEVEL_CMDS.includes(name);
  const isPulse = PULSE_CMDS.includes(name);
  if (!isLevel && !isPulse) return Promise.reject(httpError(400, 'Invalid command'));
  if (!state.connected)     return Promise.reject(httpError(503, 'PLC unavailable'));

  return enqueue(async () => {
    if (name === 'Z02_START') {
      await plc.readTag(tags.Z02_PERMISSIVE);   // fresh read, not the last poll
      if (tags.Z02_PERMISSIVE.value === false)
        throw httpError(409, 'Interlock: permissive not satisfied');
    }
    try {
      if (isLevel) return await writeBool(name, !!value);
      await writeBool(name, true);
      await new Promise(r => setTimeout(r, PULSE_MS));
      await writeBool(name, false);
    } catch (e) {
      console.error('[zone02] write failed:', e.message);
      throw httpError(502, 'PLC rejected command');
    }
  });
}


function getObservations() {
  return READ_TAGS.map(name => {
    let value = state.tags[name] ?? null, quality = 'GOOD', qualityReason = null;
    if (!state.connected)        { quality = 'BAD';       qualityReason = 'PLC_DISCONNECTED'; }
    else if (skipped.has(name))  { quality = 'BAD';       qualityReason = 'TAG_NOT_FOUND'; value = null; }
    else if (value === null)     { quality = 'UNCERTAIN'; qualityReason = 'NO_VALUE_YET'; }
    return {
      tagName: name, value,
      engineeringUnit: unitFor(name),
      sourceSystemId: 'zone02-micro850',
      protocol: 'EtherNet/IP',
      sourceTimestamp: null,               // the PLC doesn't timestamp values
      receivedTimestamp: state.timestamp,  // time of the last successful poll
      quality, qualityReason,
    };
  });
}

function httpError(status, message) {
  const e = new Error(message); e.status = status; return e;
}

module.exports = { 
    start: connect, 
    stop: teardown, 
    getSnapshot: () => ({ ...state }), 
    getObservations, command };