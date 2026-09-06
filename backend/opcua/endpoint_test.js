import opcua from "node-opcua-client";

const {
    OPCUAClient
} = opcua;

const endpointUrl = "opc.tcp://DESKTOP-TUFM4GA:4840";

const applicationUri =
    "urn:DESKTOP-TUFM4GA:Building-Irrigation-Web-SCADA";

async function main() {

    console.log("=================================");
    console.log("NODE OPC UA ENDPOINT TEST");
    console.log("=================================");

    const client = OPCUAClient.create({

        applicationName:
            "Building-Irrigation-Web-SCADA",

        applicationUri,

        endpointMustExist: false,

        connectionStrategy: {
            initialDelay: 1000,
            maxRetry: 1,
            maxDelay: 2000
        }
    });

    try {

        console.log("");
        console.log("Connecting to:");
        console.log(endpointUrl);

        await client.connect(endpointUrl);

        console.log("");
        console.log("CONNECTED");

        console.log("");
        console.log("Requesting endpoints...");

        const endpoints =
            await client.getEndpoints();

        console.log("");
        console.log("ENDPOINTS RECEIVED:");
        console.log(
            `Number of endpoints: ${endpoints.length}`
        );

        endpoints.forEach((endpoint, index) => {

            console.log("");
            console.log(`========== ENDPOINT ${index + 1} ==========`);

            console.log(
                "URL:",
                endpoint.endpointUrl
            );

            console.log(
                "Security Mode:",
                endpoint.securityMode
            );

            console.log(
                "Security Policy:",
                endpoint.securityPolicy
            );

            console.log(
                "Security Level:",
                endpoint.securityLevel
            );

            console.log(
                "User Tokens:"
            );

            console.dir(
                endpoint.userIdentityTokens,
                { depth: null }
            );
        });

        await client.disconnect();

        console.log("");
        console.log("=================================");
        console.log("TEST SUCCESSFUL");
        console.log("=================================");

    } catch (err) {

        console.log("");
        console.log("=================================");
        console.log("TEST FAILED");
        console.log("=================================");

        console.error(err);

        try {
            await client.disconnect();
        } catch {}
    }
}

main();