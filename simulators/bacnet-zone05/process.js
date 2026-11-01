const LOW_MOISTURE_SP = 30;
const HIGH_MOISTURE_SP = 55;
const MIN_TANK_LEVEL = 20;
const SIMULATED_FLOW_GPM = 4.9;

const state = {
  mode: 'AUTO',
  moisture: 56,
  tankLevel: 78,
  valvePosition: 0,
  flow: 0,
  pumpRunning: false,
  fault: false,
  stopInhibit: false,
  lastCommand: null,
  lastCommandAt: null,
  updatedAt: new Date().toISOString(),
};

function reject(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function command(name) {
  switch (name) {
    case 'auto':
      state.mode = 'AUTO';
      state.stopInhibit = false;
      break;
    case 'manual':
      state.mode = 'MANUAL';
      state.pumpRunning = false;
      break;
    case 'start':
      if (state.mode !== 'MANUAL') reject(409, 'START is available only in MANUAL mode');
      if (state.fault || state.tankLevel < MIN_TANK_LEVEL) {
        reject(409, 'START blocked: process permissive is not satisfied');
      }
      state.stopInhibit = false;
      state.pumpRunning = true;
      break;
    case 'stop':
      state.pumpRunning = false;
      state.stopInhibit = true;
      break;
    case 'faultreset':
      state.fault = false;
      break;
    default:
      reject(400, 'Unsupported Zone 05 command');
  }

  state.lastCommand = name.toUpperCase();
  state.lastCommandAt = new Date().toISOString();
  return snapshot();
}

function tick() {
  const permissive = !state.fault && state.tankLevel >= MIN_TANK_LEVEL;

  if (state.mode === 'AUTO') {
    if (!permissive || state.stopInhibit) {
      state.pumpRunning = false;
    } else if (!state.pumpRunning && state.moisture <= LOW_MOISTURE_SP) {
      state.pumpRunning = true;
    } else if (state.pumpRunning && state.moisture >= HIGH_MOISTURE_SP) {
      state.pumpRunning = false;
    }
  } else if (!permissive) {
    state.pumpRunning = false;
  }

  state.valvePosition = state.pumpRunning ? 100 : 0;
  state.flow = state.pumpRunning ? SIMULATED_FLOW_GPM : 0;

  if (state.pumpRunning) {
    state.moisture = Math.min(100, state.moisture + 0.65);
    state.tankLevel = Math.max(0, state.tankLevel - 0.035);
  } else {
    state.moisture = Math.max(0, state.moisture - 0.025);
  }

  state.updatedAt = new Date().toISOString();
  return snapshot();
}

function snapshot() {
  return {
    ...state,
    permissive: !state.fault && state.tankLevel >= MIN_TANK_LEVEL,
    lowMoistureSetpoint: LOW_MOISTURE_SP,
    highMoistureSetpoint: HIGH_MOISTURE_SP,
    minimumTankLevel: MIN_TANK_LEVEL,
  };
}

module.exports = { state, command, tick, snapshot };
