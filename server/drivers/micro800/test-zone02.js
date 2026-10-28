const { Controller, Tag } = require('st-ethernet-ip');

const PLC_IP = '192.168.203.1';
const plc = new Controller(true);   // connected messaging (this is what worked)

const names = ['Z02_MOISTURE', 'Z02_FLOW', 'Z02_AUTO',
               'Z02_RUNNING', 'Z02_VALVE', 'Z02_FAULT'];
const tags = names.map(n => new Tag(n));

plc.on('error', e => console.error('plc error:', e.message));

function shutdown() {
  try { if (plc.destroy) plc.destroy(); } catch (e) {}
  process.exit(0);
}
process.on('SIGINT', shutdown);   // Ctrl+C closes the session cleanly

(async () => {
  try {
    await plc.connect(PLC_IP, Buffer.alloc(0));   // empty path = no slot routing
    console.log('connected');
    setInterval(async () => {
      try {
        for (const t of tags) await plc.readTag(t);
        console.log(tags.map(t => `${t.name}=${t.value}`).join('  '));
      } catch (e) {
        console.error('read failed:', e.message);
      }
    }, 1000);
  } catch (e) {
    console.error('failed:', e.message);
    shutdown();
  }
})();