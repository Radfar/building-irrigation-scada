# Zone 01 Web GUI

A browser-based engineering/test interface for the Zone 01 Python water-process simulator, included here as a synchronized copy of the standalone simulator's Web GUI.

## Architecture

```
Browser
   │
   │ HTTP REST + WebSocket
   ▼
Node.js + Express
   │
   │ Modbus TCP
   ▼
Python Zone 01 Simulator
127.0.0.1:1502
```

The Python simulator remains authoritative for the water-process model and control logic. The web application is a Modbus TCP client and does not reproduce the process model.

## Requirements

- Node.js 20+ recommended
- Python simulator running from the repository root
- Python dependencies installed

## Run

Terminal 1:

```powershell
.\.venv\Scripts\Activate.ps1
python -m src.main
```

Terminal 2:

```powershell
cd simulators/python-modbus-zone01/web
npm install
$env:WEB_PORT = "3001"
npm start
```

Open:

```
http://127.0.0.1:3001
```

The browser receives live telemetry over WebSocket. Operator commands and setpoints use REST POST requests.

## Configuration

Environment variables:

| Variable | Default |
|---|---|
| WEB_HOST | 127.0.0.1 |
| WEB_PORT | 3001 (when run with Web SCADA) |
| MODBUS_HOST | 127.0.0.1 |
| MODBUS_PORT | 1502 |
| MODBUS_UNIT_ID | 1 |
| POLL_MS | 500 |

The Web SCADA backend already uses port 3000, so this standalone GUI is configured for port 3001 in the combined repository. This is a development/test GUI. It is not a safety-rated operator station and should not be exposed to an untrusted network.
