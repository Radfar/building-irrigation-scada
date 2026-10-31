const bacnet = require('node-bacnet');
const client = new bacnet({ port: 47810 }); // SCADA client binds here

const SERVER_IP = process.env.ZONE05_BACNET_IP || '127.0.0.1';
const SERVER_PORT = process.env.ZONE05_BACNET_PORT || 47809;

let zone05State = {
  Z05_FLOW: 0,
  Z05_MOISTURE: 0,
  Z05_AUTO: false,
  status: 'DISCONNECTED'
};

// 1-second Poll Loop
setInterval(() => {
  // ReadProperty for Flow (AI:1)
  client.readProperty(SERVER_IP + ':' + SERVER_PORT, {type: 0, instance: 1}, 85, (err, value) => {
    if (!err) {
      zone05State.Z05_FLOW = value.values[0].value;
      zone05State.status = 'GOOD';
    } else {
      zone05State.status = 'UNCERTAIN';
    }
  });
  // Repeat readProperty for Moisture (AI:2) and Auto (BO:1) status
}, 1000);

// Command execution function
const writeZone05Command = (value, priority = 16) => {
  return new Promise((resolve, reject) => {
    client.writeProperty(
      SERVER_IP + ':' + SERVER_PORT,
      { type: 4, instance: 1 }, // Binary Output 1
      85, // Present_Value
      [{ type: bacnet.enum.ApplicationTags.ENUMERATED, value: value ? 1 : 0 }],
      { priority: priority },
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
};

module.exports = { zone05State, writeZone05Command };
