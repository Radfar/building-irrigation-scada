const net = require("node:net");
const { persistObservations } = require("../../historian/historian");

const HOST = process.env.ZONE01_MODBUS_HOST || "127.0.0.1";
const PORT = Number(process.env.ZONE01_MODBUS_PORT || 1502);
const UNIT_ID = Number(process.env.ZONE01_MODBUS_UNIT_ID || 1);
const POLL_MS = Number(process.env.ZONE01_MODBUS_POLL_MS || 1000);
const TIMEOUT_MS = Number(process.env.ZONE01_MODBUS_TIMEOUT_MS || 2000);

class ModbusTcpClient {
  constructor() {
    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.transactionId = 0;
    this.pending = new Map();
    this.connecting = null;
  }

  connect() {
    if (this.socket && !this.socket.destroyed) return Promise.resolve();
    if (this.connecting) return this.connecting;
    this.connecting = new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: HOST, port: PORT });
      const onInitialError = error => {
        socket.destroy();
        this.connecting = null;
        reject(error);
      };
      socket.setNoDelay(true);
      socket.once("error", onInitialError);
      socket.once("connect", () => {
        socket.removeListener("error", onInitialError);
        this.socket = socket;
        this.connecting = null;
        socket.on("data", chunk => this.onData(chunk));
        socket.on("error", error => this.failAll(error));
        socket.on("close", () => {
          this.socket = null;
          this.failAll(new Error("Modbus TCP connection closed"));
        });
        resolve();
      });
    });
    return this.connecting;
  }

  onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 7) {
      const length = this.buffer.readUInt16BE(4);
      const frameLength = 6 + length;
      if (this.buffer.length < frameLength) return;
      const frame = this.buffer.subarray(0, frameLength);
      this.buffer = this.buffer.subarray(frameLength);
      const id = frame.readUInt16BE(0);
      const pending = this.pending.get(id);
      if (!pending) continue;
      this.pending.delete(id);
      clearTimeout(pending.timer);
      const pdu = frame.subarray(7);
      if (pdu[0] & 0x80) {
        pending.reject(new Error("Modbus exception response: " + (pdu[1] ?? "unknown")));
      } else {
        pending.resolve(pdu);
      }
    }
  }

  failAll(error) {
    for (const item of this.pending.values()) {
      clearTimeout(item.timer);
      item.reject(error);
    }
    this.pending.clear();
  }

  async request(pdu) {
    await this.connect();
    const id = (this.transactionId = (this.transactionId + 1) & 0xffff);
    const frame = Buffer.alloc(7 + pdu.length);
    frame.writeUInt16BE(id, 0);
    frame.writeUInt16BE(0, 2);
    frame.writeUInt16BE(1 + pdu.length, 4);
    frame.writeUInt8(UNIT_ID, 6);
    Buffer.from(pdu).copy(frame, 7);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("Modbus TCP request timed out"));
      }, TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.write(frame, error => {
        if (error) {
          clearTimeout(timer);
          this.pending.delete(id);
          reject(error);
        }
      });
    });
  }

  async readBits(functionCode, address, quantity) {
    const pdu = await this.request([functionCode, address >> 8, address & 255, quantity >> 8, quantity & 255]);
    const byteCount = pdu[1];
    const bytes = pdu.subarray(2, 2 + byteCount);
    return Array.from({ length: quantity }, (_, i) => Boolean((bytes[i >> 3] >> (i & 7)) & 1));
  }

  async readRegisters(functionCode, address, quantity) {
    const pdu = await this.request([functionCode, address >> 8, address & 255, quantity >> 8, quantity & 255]);
    const byteCount = pdu[1];
    const bytes = pdu.subarray(2, 2 + byteCount);
    return Array.from({ length: quantity }, (_, i) => bytes.readUInt16BE(i * 2));
  }

  async writeCoil(address, value) {
    await this.request([5, address >> 8, address & 255, value ? 0xff : 0, 0]);
  }

  close() {
    this.failAll(new Error("Modbus TCP client stopped"));
    if (this.socket) this.socket.destroy();
    this.socket = null;
    this.buffer = Buffer.alloc(0);
  }
}

const client = new ModbusTcpClient();
const state = { connected: false, timestamp: null, values: {}, error: null };
let timer = null;
let stopped = true;
let polling = false;

const scaled = raw => raw / 10;
function getObservations() {
  const map = {
    T01_LEVEL: ["tankLevel", "%"],
    P01_FLOW: ["flow", "L/min"],
    P01_FREQUENCY: ["pumpFrequency", "Hz"],
    P01_SPEED: ["pumpSpeed", "%"],
    P01_RUN_FEEDBACK: ["runFeedback", ""],
    P01_FAULT: ["pumpFault", ""],
    Z01_OPERATOR_STOP_LATCHED: ["operatorStopLatched", ""],
    V01_POSITION: ["valvePosition", "%"]
  };
  return Object.entries(map).map(([tagName, [key, engineeringUnit]]) => ({
    tagName,
    value: state.values[key] ?? null,
    engineeringUnit,
    sourceSystemId: "zone01-python-modbus-tcp",
    protocol: "Modbus TCP",
    sourceTimestamp: null,
    receivedTimestamp: state.timestamp,
    quality: state.connected && state.values[key] !== undefined ? "GOOD" : "BAD",
    qualityReason: state.connected ? null : "MODBUS_DEVICE_UNREACHABLE"
  }));
}

async function poll() {
  if (polling || stopped) return;
  polling = true;
  try {
    // Keep requests sequential on this TCP connection. Some Modbus TCP
    // servers do not reliably handle multiple outstanding requests per client.
    const coils = await client.readBits(1, 0, 5);
    const discreteInputs = await client.readBits(2, 0, 14);
    const holding = await client.readRegisters(3, 0, 5);
    const input = await client.readRegisters(4, 0, 6);
    const next = {
      auto: coils[0],
      runFeedback: discreteInputs[0],
      running: discreteInputs[1],
      fault: discreteInputs[2],
      permissive: discreteInputs[3],
      manual: discreteInputs[4],
      autoActive: discreteInputs[5],
      flowOk: discreteInputs[6],
      lowFlow: discreteInputs[7],
      processOk: discreteInputs[8],
      pumpFault: discreteInputs[9],
      tankLow: discreteInputs[10],
      tankHigh: discreteInputs[11],
      valveOpenFeedback: discreteInputs[12],
      operatorStopLatched: discreteInputs[13],
      pumpFrequencySetpoint: scaled(holding[0]),
      valvePositionSetpoint: scaled(holding[1]),
      flowLowSetpoint: scaled(holding[2]),
      tankLevelLowSetpoint: scaled(holding[3]),
      tankLevelHighSetpoint: scaled(holding[4]),
      tankLevel: scaled(input[0]),
      flow: scaled(input[1]),
      pumpFrequency: scaled(input[2]),
      pumpSpeed: scaled(input[3]),
      valvePosition: scaled(input[4]),
      pumpCurrent: scaled(input[5])
    };
    state.values = next;
    state.connected = true;
    state.timestamp = new Date().toISOString();
    state.error = null;
    persistObservations("zone01-python-modbus-tcp", getObservations()).catch(error =>
      console.error("[zone01-modbus] historian write failed:", error.message)
    );
  } catch (error) {
    state.connected = false;
    state.error = error.message;
    console.warn("[zone01-modbus] poll failed:", error.message);
    client.close();
  } finally {
    polling = false;
    if (!stopped) timer = setTimeout(poll, POLL_MS);
  }
}

async function command(name) {
  if (!state.connected) {
    const error = new Error("Zone 01 Modbus device is not connected");
    error.status = 503;
    throw error;
  }
  const commands = {
    auto: [0, true],
    manual: [0, false],
    start: [1, true],
    stop: [2, true],
    faultreset: [3, true],
    "fault-reset": [3, true],
    reenable: [4, true],
    "re-enable": [4, true]
  };
  const action = commands[String(name || "").toLowerCase()];
  if (!action) {
    const error = new Error("Unsupported Zone 01 command");
    error.status = 400;
    throw error;
  }
  try {
    await client.writeCoil(action[0], action[1]);
    return { accepted: true, command: String(name).toLowerCase(), protocol: "Modbus TCP" };
  } catch (cause) {
    const error = new Error("Modbus command write failed: " + cause.message);
    error.status = 502;
    throw error;
  }
}

function start() {
  if (!stopped) return;
  stopped = false;
  poll();
  console.log(`[zone01-modbus] client configured for ${HOST}:${PORT}, unit ${UNIT_ID}`);
}

function stop() {
  stopped = true;
  clearTimeout(timer);
  client.close();
  state.connected = false;
}

module.exports = {
  start,
  stop,
  command,
  getObservations,
  getSnapshot: () => ({ ...state, quality: state.connected ? "GOOD" : "BAD", protocol: "Modbus TCP", sourceSystemId: "zone01-python-modbus-tcp", values: { ...state.values } })
};