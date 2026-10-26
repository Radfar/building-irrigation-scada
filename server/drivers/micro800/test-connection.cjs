
const { Controller, Tag } = require("ethernet-ip");

const PLC_IP = process.argv[2];

if (!PLC_IP) {
  console.error(
    "Usage: node test-micro850.cjs <PLC_IP>"
  );
  process.exit(1);
}

const plc = new Controller();

async function main() {
  try {
    console.log(`Connecting to Micro850 at ${PLC_IP}...`);

    await plc.connect(PLC_IP, 0);

    console.log("Connection established.");
    console.log("Controller properties:", plc.properties);

    // Replace this with an actual CCW global variable name.
    const testTag = new Tag("P02_RUN_FB");

    await plc.readTag(testTag);

    console.log(`P02_RUN_FB = ${testTag.value}`);
  } catch (error) {
    console.error("Connection/read test failed:");
    console.error(error);
    process.exitCode = 1;
  }
}

main();
