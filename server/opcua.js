const opcua = require("node-opcua-client");

const {
  OPCUAClient,
  MessageSecurityMode,
  SecurityPolicy,
  UserTokenType,
  AttributeIds
} = opcua;

const ENDPOINT = "opc.tcp://127.0.0.1:4840";
const NS_URI = "CODESYSSPV3/3S/IecVarAccess";
const GVL_PATH = "|var|CODESYS Control Win V3 x64.Application.GVL_SCADA";
const POLL_MS = 1000;

/* All live tags from GVL_SCADA: { connected, tags: { NAME: value } } */
const live = { connected: false, tags: {} };

/* Kept for the existing /api/zone3 route: { connected, FLOW, MOISTURE, ... } */
const zone3 = { connected: false };


/* Browse GVL_SCADA and return every variable inside it */
async function discoverTags(session, ns) {
  const result = await session.browse({
    nodeId: `ns=${ns};s=${GVL_PATH}`,
    referenceTypeId: "HierarchicalReferences",
    browseDirection: 0,      // Forward
    includeSubtypes: true,
    nodeClassMask: 2,        // Variable
    resultMask: 63
  });

  return result.references.map(ref => ({
    name: ref.browseName.name,
    nodeId: ref.nodeId.toString()
  }));
}


async function startOpcua() {
  const client = OPCUAClient.create({
    applicationName: "Building-Irrigation-Web-SCADA",
    applicationUri: "urn:DESKTOP-TUFM4GA:Building-Irrigation-Web-SCADA",
    securityMode: MessageSecurityMode.None,
    securityPolicy: SecurityPolicy.None,
    endpointMustExist: false
  });

  await client.connect(ENDPOINT);
  const session = await client.createSession({ type: UserTokenType.Anonymous });

  const ns = (await session.readNamespaceArray()).indexOf(NS_URI);
  if (ns < 0) throw new Error("CODESYS namespace not found");

  const found = await discoverTags(session, ns);
  if (found.length === 0) throw new Error("No variables found in GVL_SCADA");

  console.log(`Found ${found.length} tags in GVL_SCADA:`);
  console.log(found.map(t => t.name).join(", "));

  const nodes = found.map(t => ({
    nodeId: t.nodeId,
    attributeId: AttributeIds.Value
  }));

  setInterval(async () => {
    try {
      const res = await session.read(nodes);

      found.forEach((t, i) => {
        const good = res[i].statusCode.isGood();
        const value = good ? res[i].value.value : null;

        live.tags[t.name] = value;

        /* Zone 03 compatibility: Z03_FLOW -> zone3.FLOW */
        if (t.name.startsWith("Z03_")) {
          zone3[t.name.slice(4)] = value;
        }
      });

      live.connected = true;
      zone3.connected = true;
    }
    catch (e) {
      live.connected = false;
      zone3.connected = false;
      console.error("OPC UA read failed:", e.message);
    }
  }, POLL_MS);

  console.log("OPC UA connected, polling GVL_SCADA");
}

module.exports = { startOpcua, zone3, live };