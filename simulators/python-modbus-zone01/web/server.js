import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";
import { ModbusTCPClient } from "./modbus-client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HOST = process.env.WEB_HOST ?? "127.0.0.1";
const PORT = Number(process.env.WEB_PORT ?? 3000);
const MODBUS_HOST = process.env.MODBUS_HOST ?? "127.0.0.1";
const MODBUS_PORT = Number(process.env.MODBUS_PORT ?? 1502);
const MODBUS_UNIT_ID = Number(process.env.MODBUS_UNIT_ID ?? 1);
const POLL_MS = Number(process.env.POLL_MS ?? 500);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const modbus = new ModbusTCPClient({
  host: MODBUS_HOST,
  port: MODBUS_PORT,
  unitId: MODBUS_UNIT_ID,
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  res.json({
    web: "ok",
    modbus: modbus.connected ? "connected" : "disconnected",
    modbusEndpoint: `${MODBUS_HOST}:${MODBUS_PORT}`,
  });
});

app.get("/api/zone01", async (_req, res) => {
  try {
    const snapshot = await modbus.readSnapshot();
    res.json(snapshot);
  } catch (error) {
    res.status(503).json({
      error: "Modbus simulator unavailable",
      detail: error.message,
    });
  }
});

app.post("/api/zone01/command", async (req, res) => {
  try {
    const result = await modbus.command(req.body ?? {});
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

wss.on("connection", (socket) => {
  socket.send(JSON.stringify({
    type: "status",
    connected: modbus.connected,
  }));
});

let pollInProgress = false;

async function broadcastSnapshot() {
  if (pollInProgress) return;
  pollInProgress = true;

  try {
    const snapshot = await modbus.readSnapshot();
    const message = JSON.stringify({
      type: "telemetry",
      data: snapshot,
    });

    for (const client of wss.clients) {
      if (client.readyState === 1) client.send(message);
    }
  } catch (error) {
    const message = JSON.stringify({
      type: "status",
      connected: false,
      error: error.message,
    });

    for (const client of wss.clients) {
      if (client.readyState === 1) client.send(message);
    }
  } finally {
    pollInProgress = false;
  }
}

setInterval(broadcastSnapshot, POLL_MS);

server.listen(PORT, HOST, () => {
  console.log(`Zone 01 Web GUI: http://${HOST}:${PORT}`);
  console.log(`Modbus target: ${MODBUS_HOST}:${MODBUS_PORT}, Unit ID ${MODBUS_UNIT_ID}`);
});
