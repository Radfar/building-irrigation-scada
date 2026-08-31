import {
    OPCUAClient
} from "node-opcua-client";

const endpointUrl = "opc.tcp://localhost:4840";

console.log("=================================");
console.log("CODESYS OPC UA ENDPOINT TEST");
console.log("=================================");
console.log("Endpoint:", endpointUrl);

const client = OPCUAClient.create({
    applicationName: "Building-Irrigation-Web-SCADA",
    clientName: "Building-Irrigation-Web-SCADA",
    endpointMustExist: false,
    requestedSessionTimeout: 60000
});

async function main() {
    try {
        console.log("\nConnecting to CODESYS...");

        await client.connect(endpointUrl);

        console.log("CONNECTED!");

        const endpoints = await client.getEndpoints();

        console.log("\nCODESYS ENDPOINTS:");
        console.log("=================");

        for (const endpoint of endpoints) {
            console.log("");
            console.log("Endpoint URL:", endpoint.endpointUrl);
            console.log("Security Mode:", endpoint.securityMode);
            console.log("Security Policy:", endpoint.securityPolicyUri);
            console.log("User Tokens:");

            for (const token of endpoint.userIdentityTokens) {
                console.log("  -", token.tokenType, token.policyId);
            }
        }

        await client.disconnect();

        console.log("\nDisconnected.");
    } catch (error) {
        console.error("\nCONNECTION FAILED");
        console.error("=================");
        console.error(error);
    }
}

main();