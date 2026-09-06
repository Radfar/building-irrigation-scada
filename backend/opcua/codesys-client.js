import opcua from "node-opcua-client";

const {
    OPCUAClient,
    MessageSecurityMode,
    SecurityPolicy,
    UserTokenType
} = opcua;

const endpointUrl = "opc.tcp://DESKTOP-TUFM4GA:4840";

const applicationUri =
    "urn:DESKTOP-TUFM4GA:Building-Irrigation-Web-SCADA";

console.log("=================================");
console.log("CODESYS OPC UA NODE.JS DIAGNOSTIC");
console.log("=================================");
console.log(`Endpoint: ${endpointUrl}`);
console.log(`Application URI: ${applicationUri}`);
console.log("---------------------------------");


async function main() {

    let client = null;
    let session = null;

    try {

        // =========================================================
        // STEP 1 - Discover endpoints
        // =========================================================

        console.log("");
        console.log("[1] Discovering OPC UA endpoints...");

        client = OPCUAClient.create({
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

        const endpoints =
            await client.getEndpoints({
                endpointUrl
            });

        console.log("");
        console.log(`Found ${endpoints.length} endpoints.`);

        endpoints.forEach((endpoint, index) => {

            console.log("");
            console.log(`--- Endpoint ${index + 1} ---`);

            console.log(
                "Endpoint URL:",
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
                "User Identity Tokens:"
            );

            if (!endpoint.userIdentityTokens) {

                console.log("  NONE");

            } else {

                endpoint.userIdentityTokens.forEach(
                    (token, tokenIndex) => {

                        console.log(
                            `  Token ${tokenIndex + 1}:`
                        );

                        console.log(
                            "    policyId:",
                            token.policyId
                        );

                        console.log(
                            "    tokenType:",
                            token.tokenType
                        );

                        console.log(
                            "    securityPolicyUri:",
                            token.securityPolicyUri
                        );

                    }
                );
            }
        });


        // =========================================================
        // STEP 2 - Find the exact None + Anonymous endpoint
        // =========================================================

        console.log("");
        console.log("[2] Selecting None + Anonymous endpoint...");

        const anonymousEndpoint =
            endpoints.find(endpoint => {

                const securityNone =
                    endpoint.securityMode ===
                    MessageSecurityMode.None;

                const policyNone =
                    endpoint.securityPolicy ===
                    SecurityPolicy.None;

                const anonymousToken =
                    endpoint.userIdentityTokens?.some(
                        token =>
                            token.tokenType ===
                            UserTokenType.Anonymous
                    );

                return (
                    securityNone &&
                    policyNone &&
                    anonymousToken
                );
            });


        if (!anonymousEndpoint) {

            throw new Error(
                "Could not find a None + Anonymous OPC UA endpoint."
            );
        }


        console.log("");
        console.log("SELECTED ENDPOINT");
        console.log("-----------------");

        console.log(
            "Endpoint URL:",
            anonymousEndpoint.endpointUrl
        );

        console.log(
            "Security Mode:",
            anonymousEndpoint.securityMode
        );

        console.log(
            "Security Policy:",
            anonymousEndpoint.securityPolicy
        );

        console.log(
            "User Identity Tokens:"
        );

        console.dir(
            anonymousEndpoint.userIdentityTokens,
            { depth: null }
        );


        // =========================================================
        // STEP 3 - Disconnect discovery client
        // =========================================================

        console.log("");
        console.log("[3] Disconnecting discovery client...");

        await client.disconnect();

        client = null;

        console.log("Discovery client disconnected.");


        // =========================================================
        // STEP 4 - Create client for selected endpoint
        // =========================================================

        console.log("");
        console.log("[4] Creating OPC UA client...");

        client = OPCUAClient.create({

            applicationName:
                "Building-Irrigation-Web-SCADA",

            applicationUri,

            endpointMustExist: false,

            connectionStrategy: {
                initialDelay: 1000,
                maxRetry: 1,
                maxDelay: 2000
            },

            securityMode:
                MessageSecurityMode.None,

            securityPolicy:
                SecurityPolicy.None
        });


        console.log("Client created.");


        // =========================================================
        // STEP 5 - Connect
        // =========================================================

        console.log("");
        console.log("[5] Connecting to selected endpoint...");

        await client.connect(
            anonymousEndpoint.endpointUrl
        );

        console.log("");
        console.log("CONNECTION SUCCESSFUL");

        console.log(
            "Client endpoint:",
            client.endpointUrl
        );

        console.log(
            "Client security mode:",
            client.securityMode
        );

        console.log(
            "Client security policy:",
            client.securityPolicy
        );


        // =========================================================
        // STEP 6 - Create Anonymous session
        // =========================================================

        console.log("");
        console.log("[6] Creating Anonymous OPC UA session...");

        const userIdentity = {
            type: "Anonymous"
        };

        console.log("");
        console.log("User Identity:");

        console.dir(
            userIdentity,
            { depth: null }
        );


        session =
            await client.createSession(
                userIdentity
            );


        // =========================================================
        // STEP 7 - Session successful
        // =========================================================

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


        // =========================================================
        // STEP 8 - Close session
        // =========================================================

        console.log("");
        console.log("[8] Closing session...");

        await session.close();

        session = null;

        console.log("Session closed.");


        // =========================================================
        // STEP 9 - Disconnect
        // =========================================================

        console.log("");
        console.log("[9] Disconnecting client...");

        await client.disconnect();

        client = null;

        console.log("Client disconnected.");

        console.log("");
        console.log("=================================");
        console.log("TEST COMPLETED SUCCESSFULLY");
        console.log("=================================");

    }

    catch (err) {

        console.log("");
        console.log("=================================");
        console.log("OPC UA TEST FAILED");
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


        // =========================================================
        // Cleanup
        // =========================================================

        try {

            if (session) {
                await session.close();
            }

        } catch (closeError) {

            console.error(
                "Session close error:",
                closeError
            );
        }


        try {

            if (client) {
                await client.disconnect();
            }

        } catch (disconnectError) {

            console.error(
                "Disconnect error:",
                disconnectError
            );
        }

    }

}


main();