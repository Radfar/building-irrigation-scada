import opcua from "node-opcua-client";
const { OPCUAClient, MessageSecurityMode, SecurityPolicy, UserTokenType } = opcua;

const client = OPCUAClient.create({
  applicationName: "Test",
  securityMode: MessageSecurityMode.None,
  securityPolicy: SecurityPolicy.None,
  endpointMustExist: false,
  connectionStrategy: { maxRetry: 0 }
});

await client.connect("opc.tcp://127.0.0.1:4840");
const session = await client.createSession({ type: UserTokenType.Anonymous });
console.log("OK", session.sessionId.toString());
await session.close();
await client.disconnect();