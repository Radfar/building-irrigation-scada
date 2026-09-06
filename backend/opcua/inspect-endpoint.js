import opcua from "node-opcua-client";

const {
    OPCUAClient,
    MessageSecurityMode,
    SecurityPolicy
} = opcua;

const endpointUrl = "opc.tcp://DESKTOP-TUFM4GA:4840";

const client = OPCUAClient.create({
    applicationName: "Building-Irrigation-Web-SCADA",
    applicationUri:
        "urn:DESKTOP-TUFM4GA:Building-Irrigation-Web-SCADA",

    endpointMustExist: false,

    securityMode: MessageSecurityMode.None,
    securityPolicy: SecurityPolicy.None
});

async function main() {

    try {

        console.log("=================================");
        console.log("CODESYS OPC UA ENDPOINT INSPECTOR");
        console.log("=================================");
        console.log(`Endpoint: ${endpointUrl}`);
        console.log("");

        await client.connect(endpointUrl);

        console.log("Connected.");
        console.log("");

        const endpoints = await client.getEndpoints();

        console.log(`Found ${endpoints.length} endpoints.`);
        console.log("");

        for (const [index, endpoint] of endpoints.entries()) {

            console.log("---------------------------------");
            console.log(`ENDPOINT ${index + 1}`);
            console.log("---------------------------------");

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
                endpoint.securityPolicyUri
            );

            console.log("");
            console.log("USER TOKEN POLICIES:");

            if (!endpoint.userIdentityTokens ||
                endpoint.userIdentityTokens.length === 0) {

                console.log("  NONE");

            } else {

                for (const token of endpoint.userIdentityTokens) {

                    console.log("");
                    console.log("  Token Type:",
                        token.tokenType);

                    console.log("  Policy ID:",
                        token.policyId);

                    console.log("  Security Policy:",
                        token.securityPolicyUri);

                    console.log("  Issued Token Type:",
                        token.issuedTokenType);

                    console.log("  Issuer Endpoint:",
                        token.issuerEndpointUrl);
                }
            }

            console.log("");
        }

        await client.disconnect();

        console.log("---------------------------------");
        console.log("Disconnected.");
        console.log("=================================");

    } catch (err) {

        console.error("");
        console.error("ERROR:");
        console.error(err);

        try {
            await client.disconnect();
        } catch {}
    }
}

main();