import opcua from "node-opcua-client";

const {
    OPCUAClient,
    MessageSecurityMode,
    SecurityPolicy
} = opcua;

const endpointUrl =
    "opc.tcp://DESKTOP-TUFM4GA:4840";

const applicationUri =
    "urn:DESKTOP-TUFM4GA:Building-Irrigation-Web-SCADA";

async function main() {

    let client = null;
    let session = null;

    try {

        // =====================================================
        // 1. CREATE CLIENT
        // =====================================================

        console.log("=================================");
        console.log("CODESYS OPC UA SESSION TEST");
        console.log("=================================");

        console.log("");
        console.log("[1] Creating OPC UA client...");

        client = OPCUAClient.create({

            applicationName:
                "Building-Irrigation-Web-SCADA",

            applicationUri,

            endpointMustExist: false,

            securityMode:
                MessageSecurityMode.None,

            securityPolicy:
                SecurityPolicy.None,

            connectionStrategy: {
                initialDelay: 1000,
                maxRetry: 1,
                maxDelay: 2000
            }
        });

        console.log("Client created.");


        // =====================================================
        // 2. CONNECT
        // =====================================================

        console.log("");
        console.log("[2] Connecting...");

        await client.connect(endpointUrl);

        console.log("CONNECTED");


        // =====================================================
        // 3. GET ENDPOINTS
        // =====================================================

        console.log("");
        console.log("[3] Getting endpoints...");

        const endpoints =
            await client.getEndpoints();

        console.log(
            `Received ${endpoints.length} endpoints.`
        );


        // =====================================================
        // 4. SELECT ENDPOINT #1
        // =====================================================

        const endpoint = endpoints[0];

        console.log("");
        console.log("[4] Selected endpoint:");

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

        console.log("");
        console.log("User Identity Tokens:");

        console.dir(
            endpoint.userIdentityTokens,
            { depth: null }
        );


        // =====================================================
        // 5. CREATE ANONYMOUS SESSION
        // =====================================================

        console.log("");
        console.log("[5] Creating Anonymous session...");

        const userIdentity = {
            type: "Anonymous"
        };

        console.log(
            "User identity:"
        );

        console.dir(
            userIdentity,
            { depth: null }
        );

        console.log("");
        console.log("Calling client.createSession()...");


        session =
            await client.createSession(
                userIdentity
            );


        // =====================================================
        // 6. SESSION SUCCESS
        // =====================================================

        console.log("");
        console.log("=================================");
        console.log("SESSION CREATED SUCCESSFULLY");
        console.log("=================================");

        console.log(
            "Session ID:",
            session.sessionId.toString()
        );

        console.log(
            "Authentication Token:",
            session.authenticationToken.toString()
        );


        // =====================================================
        // 7. READ SERVER STATUS
        // =====================================================

        console.log("");
        console.log("[7] Reading ServerStatus...");

        const nodeId =
            "ns=0;i=2256";

        const dataValue =
            await session.readVariableValue(
                nodeId
            );

        console.log("");
        console.log("ServerStatus value:");

        console.dir(
            dataValue,
            { depth: null }
        );


        // =====================================================
        // 8. CLOSE SESSION
        // =====================================================

        console.log("");
        console.log("[8] Closing session...");

        await session.close();

        session = null;

        console.log("Session closed.");


        // =====================================================
        // 9. DISCONNECT
        // =====================================================

        console.log("");
        console.log("[9] Disconnecting...");

        await client.disconnect();

        client = null;

        console.log("Disconnected.");


        console.log("");
        console.log("=================================");
        console.log("TEST COMPLETED SUCCESSFULLY");
        console.log("=================================");

    }

    catch (err) {

        console.log("");
        console.log("=================================");
        console.log("TEST FAILED");
        console.log("=================================");

        console.error("");
        console.error("Error name:");
        console.error(err?.name);

        console.error("");
        console.error("Error message:");
        console.error(err?.message);

        console.error("");
        console.error("Error stack:");
        console.error(err?.stack);

        console.error("");
        console.error("Full error object:");

        console.dir(
            err,
            { depth: null }
        );


        // =====================================================
        // CLEANUP
        // =====================================================

        try {

            if (session) {
                await session.close();
            }

        } catch (e) {

            console.error(
                "Session close error:",
                e
            );
        }


        try {

            if (client) {
                await client.disconnect();
            }

        } catch (e) {

            console.error(
                "Disconnect error:",
                e
            );
        }
    }
}

main();