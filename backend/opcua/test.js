import {
  OPCUAClient,
  AttributeIds,
  DataValue,
} from "node-opcua-client";

(async () => {
  // 1. Create a client and connect to an OPC UA server
  const client = OPCUAClient.create({ endpointMustExist: false });
  await client.connect("opc.tcp://DESKTOP-TUFM4GA:4840");

  // 2. Create a session
  const session = await client.createSession();

 
  // 4. Clean up
  await session.close();
  await client.disconnect();
})();