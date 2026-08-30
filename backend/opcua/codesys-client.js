import {
    OPCUAClient,
    AttributeIds,
    MessageSecurityMode,
    SecurityPolicy
} from "node-opcua-client";

const endpointUrl = "opc.tcp://localhost:4840";

const client = OPCUAClient.create({
    applicationName: "Building-Irrigation-Web-SCADA",
    clientName: "Building-Irrigation-Web-SCADA",
    securityMode: MessageSecurityMode.SignAndEncrypt,
    securityPolicy: SecurityPolicy.Basic256Sha256,
    endpointMustExist: false,
    requestedSessionTimeout: 60000
});

async function main() {
    try {
        console.log("Connecting to CODESYS OPC UA server...");
        console.log(endpointUrl);

        await client.connect(endpointUrl);

        console.log("OPC UA connection established.");

        const endpoints = await client.getEndpoints();

        console.log("\nAvailable endpoints:");

        for (const endpoint of endpoints) {
            console.log(
                `Security: ${endpoint.securityPolicyUri} | Mode: ${endpoint.securityMode}`
            );
        }

        const session = await client.createSession();

        console.log("\nOPC UA session created.");

        await session.close();
        await client.disconnect();

        console.log("Disconnected.");
    } catch (error) {
        console.error("\nOPC UA connection failed:");
        console.error(error);
    }
}

main();