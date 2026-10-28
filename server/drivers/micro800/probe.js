const { Controller, Tag } = require('st-ethernet-ip');
const IP = '192.168.203.1';

// [label, connectedMessaging, slot, setup]
const variants = [
  ['unconnected, empty path, setup off', false, Buffer.alloc(0), false],
  ['unconnected, empty path',            false, Buffer.alloc(0), true],
  ['unconnected, slot 0, setup off',     false, 0, false],
  ['connected, empty path',              true,  Buffer.alloc(0), true],
  ['connected, slot 0',                  true,  0, true],
];

(async () => {
  for (const [label, connected, slot, setup] of variants) {
    const plc = new Controller(connected);
    plc.on('error', e => console.log('  event error:', e.message));
    try {
      await plc.connect(IP, slot, setup);
      const t = new Tag('Z02_MOISTURE');
      await plc.readTag(t);
      console.log('OK  ', label, '->', t.value);
      if (plc.destroy) plc.destroy();
      process.exit(0);
    } catch (e) {
      console.log('FAIL', label, '->', e.message);
      if (plc.destroy) plc.destroy();
    }
  }
  process.exit(1);
})();