const { Controller, Tag } = require('st-ethernet-ip');
const PLC_IP = '127.0.0.1';          // same host as your Node-RED CIP config
const plc = new Controller(false);   // unconnected messaging (my guess for Micro800)
const names = ['Z02_MOISTURE', 'Z02_FLOW', 'Z02_AUTO',
               'Z02_RUNNING', 'Z02_VALVE', 'Z02_FAULT'];
const tags = names.map(n => new Tag(n));
(async () => {
  try {
    await plc.connect(PLC_IP, null);   // Micro800 has no backplane slot
    console.log('connected');
    setInterval(async () => {
      for (const t of tags) await plc.readTag(t);   // one tag at a time, safest on Micro800
      console.log(tags.map(t => `${t.name}=${t.value}`).join('  '));
    }, 1000);
  } catch (e) {
    console.error('failed:', e.message);
  }
})();
