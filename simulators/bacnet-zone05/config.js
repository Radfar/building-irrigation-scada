const DEVICE_INSTANCE = Number(process.env.ZONE05_BACNET_DEVICE_INSTANCE || 10005);
const BACNET_PORT = Number(process.env.ZONE05_BACNET_PORT || 47809);
const BACNET_INTERFACE = process.env.ZONE05_BACNET_INTERFACE || '0.0.0.0';
const VENDOR_ID = 999;
const TICK_MS = 1000;

const OBJECTS = {
  moisture: { type: 0, instance: 1, name: 'Zone05_Moisture', unit: 98 },
  flow:     { type: 0, instance: 2, name: 'Zone05_Flow', unit: 76 },
  valve:    { type: 0, instance: 3, name: 'Zone05_ValvePosition', unit: 98 },
  tank:     { type: 0, instance: 4, name: 'Zone05_TankLevel', unit: 98 },
  running:  { type: 3, instance: 1, name: 'Zone05_PumpRunning' },
  fault:    { type: 3, instance: 2, name: 'Zone05_PumpFault' },
  auto:     { type: 4, instance: 1, name: 'Zone05_AutoMode' },
  start:    { type: 4, instance: 2, name: 'Zone05_StartRequest' },
  stop:     { type: 4, instance: 3, name: 'Zone05_StopRequest' },
  reset:    { type: 4, instance: 4, name: 'Zone05_FaultReset' },
};

module.exports = {
  DEVICE_INSTANCE, BACNET_PORT, BACNET_INTERFACE, VENDOR_ID, TICK_MS, OBJECTS
};
