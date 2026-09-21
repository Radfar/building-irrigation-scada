const opcua = require("node-opcua-client");

const {
  OPCUAClient,
  MessageSecurityMode,
  SecurityPolicy,
  UserTokenType,
  AttributeIds,
  DataType
} = opcua;

const ENDPOINT = "opc.tcp://127.0.0.1:4840";
const NS_URI = "CODESYSSPV3/3S/IecVarAccess";
const GVL_PATH = "|var|CODESYS Control Win V3 x64.Application.GVL_SCADA";
const POLL_MS = 1000;
const PULSE_MS = 300;   // must be longer than a few PLC scans (R_TRIG needs a rising edge)

/* All live tags from GVL_SCADA: { connected, tags: { NAME: value } } */
const live = { connected: false, tags: {} };

/* Flat Zone 03 view for the HMI: { connected, FLOW, MOISTURE, ... } */
const zone3 = { connected: false };

let client = null;
let session = null;
let pollTimer = null;
const nodeIds = {};   // tag name -> node id string


/* ---------------------------------------------------------------
   COMMAND WHITELIST
   Only these tags can ever be written from the web API.
   PLC logic: Start/Stop/FaultReset are edge-detected (R_TRIG),
   so they are sent as a pulse. Mode is a held value on Z03_AUTO
   (Z03_MANUAL is a PLC output = NOT xAuto, never written).
--------------------------------------------------------------- */
const COMMANDS = {
  start:      { tag: "Z03_START",       pulse: true },
  stop:       { tag: "Z03_STOP",        pulse: true },
  faultReset: { tag: "Z03_FAULT_RESET", pulse: true },
  auto:       { tag: "Z03_AUTO",        value: true },
  manual:     { tag: "Z03_AUTO",        value: false }
};


function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}


/* Server-side interlocks: same rules as the PLC, so the API
   gives a clear message instead of a silently ignored command */
function checkInterlock(command) {
  const t = live.tags;

  if (command === "start") {
    if (t.Z03_AUTO)      return "Start is only allowed in MANUAL mode";
    if (!t.Z03_PERMISSIVE) return "Start blocked: permissive not satisfied";
    if (t.Z03_RUNNING)   return "Zone 03 is already running";
  }

  return null;   // Stop, Fault Reset and mode changes are always allowed
}


async function writeBool(tagName, value) {
  const status = await session.write({
    nodeId: nodeIds[tagName],
    attributeId: AttributeIds.Value,
    value: { value: { dataType: DataType.Boolean, value } }
  });

  if (!status.isGood()) {
    throw httpError(502, `Write ${tagName} failed: ${status.toString()}`);
  }
}


async function sendCommand(command) {
  const def = COMMANDS[command];

  if (!def) {
    throw httpError(400, "Unknown command");
  }

  if (!session || !live.connected) {
    throw httpError(503, "OPC UA not connected");
  }

  const blocked = checkInterlock(command);
  if (blocked) {
    throw httpError(409, blocked);
  }

  if (def.pulse) {
    try {
      await writeBool(def.tag, true);
      await new Promise(resolve => setTimeout(resolve, PULSE_MS));
    }
    finally {
      /* always try to release the pulse */
      try { await writeBool(def.tag, false); }
      catch (e) { console.error("Pulse release failed:", e.message); }
    }
  }
  else {
    await writeBool(def.tag, def.value);
  }

  console.log(`Zone 03 command sent: ${command}`);
}


/* Browse GVL_SCADA and return every variable inside it */
async function discoverTags(ns) {
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
  client = OPCUAClient.create({
    applicationName: "Building-Irrigation-Web-SCADA",
    applicationUri: "urn:DESKTOP-TUFM4GA:Building-Irrigation-Web-SCADA",
    securityMode: MessageSecurityMode.None,
    securityPolicy: SecurityPolicy.None,
    endpointMustExist: false
  });

  await client.connect(ENDPOINT);
  session = await client.createSession({ type: UserTokenType.Anonymous });

  const ns = (await session.readNamespaceArray()).indexOf(NS_URI);
  if (ns < 0) throw new Error("CODESYS namespace not found");

  const found = await discoverTags(ns);
  if (found.length === 0) throw new Error("No variables found in GVL_SCADA");

  found.forEach(t => { nodeIds[t.name] = t.nodeId; });

  console.log(`Found ${found.length} tags in GVL_SCADA:`);
  console.log(found.map(t => t.name).join(", "));

  const nodes = found.map(t => ({
    nodeId: t.nodeId,
    attributeId: AttributeIds.Value
  }));

  pollTimer = setInterval(async () => {
    try {
      const res = await session.read(nodes);

      found.forEach((t, i) => {
        const good = res[i].statusCode.isGood();
        const value = good ? res[i].value.value : null;

        live.tags[t.name] = value;

        /* Z03_FLOW -> zone3.FLOW */
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

/* Close the OPC UA session cleanly (avoids stale sessions in CODESYS) */
async function stopOpcua() {
  try {
    if (pollTimer) clearInterval(pollTimer);
    if (session) await session.close();
    if (client) await client.disconnect();
    console.log("OPC UA session closed");
  }
  catch (e) {
    console.error("OPC UA shutdown error:", e.message);
  }
}

module.exports = { startOpcua, stopOpcua, sendCommand, zone3, live };