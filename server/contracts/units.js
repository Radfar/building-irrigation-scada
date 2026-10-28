// Canonical engineering units: US customary, per project decision.
const CANONICAL = {
  moisture: '%', level: '%', position: '%', speed: '%',
  flow: 'gpm', volume: 'gal', pressure: 'psi', temperature: '°F',
  duration: 's', frequency: 'Hz',
};

// Tag names are Z{nn}_{SIGNAL}; map the SIGNAL part to a quantity.
const SIGNAL_QUANTITY = {
  MOISTURE: 'moisture', LEVEL: 'level', VALVE: 'position', PUMP_SPD: 'speed',
  FLOW: 'flow', PRESSURE: 'pressure', TOTAL_RUNTIME_SEC: 'duration',
};

// Source unit -> canonical unit
const TO_CANONICAL = {
  flow:        { gpm: v => v, 'L/min': v => v * 0.264172, 'm3/h': v => v * 4.40287 },
  volume:      { gal: v => v, L: v => v * 0.264172, m3: v => v * 264.172 },
  pressure:    { psi: v => v, bar: v => v * 14.5038, kPa: v => v * 0.145038 },
  temperature: { '°F': v => v, '°C': v => v * 9 / 5 + 32 },
};

function quantityOf(tagName) {
  const m = /^Z\d+_(.+)$/.exec(tagName);
  return m ? SIGNAL_QUANTITY[m[1]] ?? null : null;
}

const unitFor = tagName => CANONICAL[quantityOf(tagName)] ?? null;

function toCanonical(tagName, value, sourceUnit) {
  const fn = TO_CANONICAL[quantityOf(tagName)]?.[sourceUnit];
  return fn ? fn(value) : value;   // already canonical, or not convertible
}

module.exports = { CANONICAL, unitFor, toCanonical };
