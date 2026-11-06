import net from "net";

const COILS = 5;
const DISCRETE_INPUTS = 14;
const HOLDING_REGISTERS = 5;
const INPUT_REGISTERS = 6;

const coil = {
  auto: 0,
  start: 1,
  stop: 2,
  faultReset: 3,
  reenable: 4,
};

const discrete = {
  runFeedback: 0,
  running: 1,
  fault: 2,
  permissive: 3,
  manual: 4,
  autoActive: 5,
  flowOk: 6,
  lowFlow: 7,
  processOk: 8,
  pumpFault: 9,
  tankLow: 10,
  tankHigh: 11,
  valveOpenFeedback: 12,
  operatorStopLatched: 13,
};

const holding = {
  pumpSpeedSp: 0,
  valvePositionSp: 1,
  flowLowSp: 2,
  tankLevelLowSp: 3,
  tankLevelHighSp: 4,
};

const input = {
  tankLevel: 0,
  flow: 1,
  pumpFrequency: 2,
  pumpSpeed: 3,
  valve: 4,
  pumpCurrent: 5,
};

function readBit(bits, index) {
  return Boolean(bits[index]);
}

function scaled(value) {
  return value / 10;
}

export class ModbusTCPClient {
  constructor({ host, port, unitId }) {
    this.host = host;
    this.port = port;
    this.unitId = unitId;
    this.socket = null;
    this.transactionId = 0;
    this.connected = false;
    this.queue = Promise.resolve();
  }

  async execute(pdu) {
    const job = this.queue.then(() => this.#request(pdu));
    this.queue = job.catch(() => {});
    return job;
  }

  #request(pdu) {
    return new Promise((resolve, reject) => {
      const transactionId = (this.transactionId = (this.transactionId + 1) & 0xffff);
      const payload = Buffer.concat([
        Buffer.from([transactionId >> 8, transactionId & 0xff, 0, 0]),
        Buffer.from([0, pdu.length + 1, this.unitId]),
        Buffer.from(pdu),
      ]);

      const socket = new net.Socket();
      let buffer = Buffer.alloc(0);
      let settled = false;

      const cleanup = () => {
        socket.removeAllListeners();
        socket.destroy();
      };

      const fail = (error) => {
        if (settled) return;
        settled = true;
        this.connected = false;
        cleanup();
        reject(error);
      };

      socket.setTimeout(3000);
      socket.on("timeout", () => fail(new Error("Modbus TCP request timed out")));
      socket.on("error", fail);
      socket.on("close", () => {
        this.connected = false;
      });

      socket.on("data", (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        if (buffer.length < 7) return;

        const length = buffer.readUInt16BE(4);
        const frameLength = 6 + length;
        if (buffer.length < frameLength) return;

        const frame = buffer.subarray(0, frameLength);
        const responsePdu = frame.subarray(7);

        if (responsePdu[0] & 0x80) {
          const code = responsePdu[1];
          fail(new Error(`Modbus exception response: function ${responsePdu[0] & 0x7f}, code ${code}`));
          return;
        }

        settled = true;
        this.connected = true;
        cleanup();
        resolve(responsePdu);
      });

      socket.connect(this.port, this.host, () => {
        this.connected = true;
        socket.write(payload);
      });
    });
  }

  async readBits(functionCode, quantity) {
    const pdu = Buffer.from([functionCode, 0, 0, quantity >> 8, quantity & 0xff]);
    const response = await this.execute(pdu);
    const byteCount = response[1];
    const bytes = response.subarray(2, 2 + byteCount);
    const bits = [];
    for (let i = 0; i < quantity; i++) {
      bits.push(Boolean(bytes[Math.floor(i / 8)] & (1 << (i % 8))));
    }
    return bits;
  }

  async readRegisters(functionCode, quantity) {
    const pdu = Buffer.from([functionCode, 0, 0, quantity >> 8, quantity & 0xff]);
    const response = await this.execute(pdu);
    const byteCount = response[1];
    const registers = [];
    for (let i = 0; i < quantity; i++) {
      registers.push(response.readUInt16BE(2 + i * 2));
    }
    return registers;
  }

  async writeCoil(address, value) {
    const pdu = Buffer.from([
      5, address >> 8, address & 0xff,
      value ? 0xff : 0,
      0,
    ]);
    await this.execute(pdu);
  }

  async writeRegister(address, value) {
    const pdu = Buffer.from([
      6, address >> 8, address & 0xff,
      value >> 8, value & 0xff,
    ]);
    await this.execute(pdu);
  }

  async readSnapshot() {
    const [coils, status, setpoints, measurements] = await Promise.all([
      this.readBits(1, COILS),
      this.readBits(2, DISCRETE_INPUTS),
      this.readRegisters(3, HOLDING_REGISTERS),
      this.readRegisters(4, INPUT_REGISTERS),
    ]);

    return {
      timestamp: new Date().toISOString(),
      connected: true,
      mode: readBit(coils, coil.auto) ? "AUTO" : "MANUAL",
      commands: {
        auto: readBit(coils, coil.auto),
      },
      status: {
        runFeedback: readBit(status, discrete.runFeedback),
        running: readBit(status, discrete.running),
        fault: readBit(status, discrete.fault),
        permissive: readBit(status, discrete.permissive),
        manual: readBit(status, discrete.manual),
        autoActive: readBit(status, discrete.autoActive),
        flowOk: readBit(status, discrete.flowOk),
        lowFlow: readBit(status, discrete.lowFlow),
        processOk: readBit(status, discrete.processOk),
        pumpFault: readBit(status, discrete.pumpFault),
        tankLow: readBit(status, discrete.tankLow),
        tankHigh: readBit(status, discrete.tankHigh),
        valveOpenFeedback: readBit(status, discrete.valveOpenFeedback),
        operatorStopLatched: readBit(status, discrete.operatorStopLatched),
      },
      measurements: {
        tankLevel: scaled(measurements[input.tankLevel]),
        flow: scaled(measurements[input.flow]),
        pumpFrequency: scaled(measurements[input.pumpFrequency]),
        pumpSpeed: scaled(measurements[input.pumpSpeed]),
        valve: scaled(measurements[input.valve]),
        pumpCurrent: scaled(measurements[input.pumpCurrent]),
      },
      setpoints: {
        pumpSpeed: scaled(setpoints[holding.pumpSpeedSp]),
        valvePosition: scaled(setpoints[holding.valvePositionSp]),
        flowLow: scaled(setpoints[holding.flowLowSp]),
        tankLevelLow: scaled(setpoints[holding.tankLevelLowSp]),
        tankLevelHigh: scaled(setpoints[holding.tankLevelHighSp]),
      },
    };
  }

  async command(body) {
    const allowed = new Set(["start", "stop", "faultReset", "reenable", "auto"]);
    const commands = Object.keys(body).filter((key) => body[key] !== undefined && allowed.has(key));

    if (commands.length === 0 && !body.setpoints) {
      throw new Error("No supported command or setpoint was provided");
    }

    for (const key of commands) {
      if (key === "auto") {
        await this.writeCoil(coil.auto, Boolean(body.auto));
      } else {
        await this.writeCoil(coil[key], true);
      }
    }

    if (body.setpoints) {
      const map = {
        pumpSpeed: holding.pumpSpeedSp,
        valvePosition: holding.valvePositionSp,
        flowLow: holding.flowLowSp,
        tankLevelLow: holding.tankLevelLowSp,
        tankLevelHigh: holding.tankLevelHighSp,
      };

      for (const [key, address] of Object.entries(map)) {
        if (body.setpoints[key] === undefined) continue;
        const value = Number(body.setpoints[key]);
        if (!Number.isFinite(value) || value < 0 || value > 6553.5) {
          throw new Error(`Invalid setpoint: ${key}`);
        }
        await this.writeRegister(address, Math.round(value * 10));
      }
    }

    return await this.readSnapshot();
  }
}
