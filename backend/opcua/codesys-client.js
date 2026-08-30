import {
    OPCUAClient,
    MessageSecurityMode,
    SecurityPolicy
} from "node-opcua-client";

const endpointUrl = "opc.tcp://localhost:4840";

console.log("=================================");
console.log("CODESYS OPC UA CLIENT");
console.log("=================================");

console.log("Endpoint:", endpointUrl);
console.log("Security: Basic256Sha256");
console.log("Mode: Sign & Encrypt");
console.log("");

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

        console.log("Connecting to CODESYS...");

        await client.connect(endpointUrl);

        console.log("CONNECTED!");
        console.log("Secure OPC UA channel established.");

        await client.disconnect();

        console.log("Disconnected.");

    } catch (error) {

        console.error("");
        console.error("OPC UA CONNECTION FAILED");
        console.error("--------------------------------");
        console.error(error);

    }
}

main();