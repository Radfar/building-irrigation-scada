const connectionEl = document.querySelector("#connection");
const modeEl = document.querySelector("#mode");
const tankFill = document.querySelector("#tank-fill");
const tankLevel = document.querySelector("#tank-level");
const tankState = document.querySelector("#tank-state");
const flowValue = document.querySelector("#flow-value");
const pumpState = document.querySelector("#pump-state");
const pumpFrequency = document.querySelector("#pump-frequency");
const valveValue = document.querySelector("#valve-value");
const autoEl = document.querySelector("#auto");
const messageEl = document.querySelector("#message");
const lastUpdateEl = document.querySelector("#last-update");

const statusLabels = {
  runFeedback: "Run feedback",
  running: "Controller running",
  fault: "Fault",
  permissive: "Permissive",
  manual: "Manual mode",
  autoActive: "Auto active",
  flowOk: "Flow OK",
  lowFlow: "Low-flow trip",
  processOk: "Process OK",
  pumpFault: "Pump fault",
  tankLow: "Tank low",
  tankHigh: "Tank high",
  valveOpenFeedback: "Valve open feedback",
  operatorStopLatched: "Operator stop latch",
};

function setConnection(connected) {
  connectionEl.textContent = connected ? "● Connected" : "● Disconnected";
  connectionEl.className = `status-pill ${connected ? "online" : "offline"}`;
}

function setMessage(text, error = false) {
  messageEl.hidden = !text;
  messageEl.textContent = text;
  messageEl.style.borderColor = error ? "#8b3b47" : "#2d617e";
}

function fmt(value, digits = 1) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "--";
}

function render(snapshot) {
  setConnection(snapshot.connected);
  modeEl.textContent = snapshot.mode;
  autoEl.checked = snapshot.commands.auto;

  const m = snapshot.measurements;
  tankLevel.textContent = `${fmt(m.tankLevel)}%`;
  tankFill.style.height = `${Math.max(0, Math.min(100, m.tankLevel))}%`;
  tankState.textContent = m.tankLevel <= snapshot.setpoints.tankLevelLow ? "LOW" : m.tankLevel >= snapshot.setpoints.tankLevelHigh ? "HIGH" : "NORMAL";
  flowValue.textContent = `${fmt(m.flow)} L/min`;
  pumpState.textContent = snapshot.status.running ? "RUNNING" : "STOPPED";
  pumpFrequency.textContent = `${fmt(m.pumpFrequency)} Hz`;
  valveValue.textContent = `${fmt(m.valve)}%`;

  document.querySelector("#m-level").textContent = fmt(m.tankLevel);
  document.querySelector("#m-flow").textContent = fmt(m.flow);
  document.querySelector("#m-frequency").textContent = fmt(m.pumpFrequency);
  document.querySelector("#m-speed").textContent = fmt(m.pumpSpeed);
  document.querySelector("#m-valve").textContent = fmt(m.valve);
  document.querySelector("#m-current").textContent = fmt(m.pumpCurrent);

  const grid = document.querySelector("#status-grid");
  grid.innerHTML = "";
  for (const [key, label] of Object.entries(statusLabels)) {
    const value = Boolean(snapshot.status[key]);
    const item = document.createElement("div");
    item.className = "status-item";
    item.innerHTML = `<span>${label}</span><strong class="${value ? "good" : "bad"}">${value ? "YES" : "NO"}</strong>`;
    grid.appendChild(item);
  }

  // WebSocket telemetry arrives every 500 ms. Do not overwrite a setpoint
  // while the operator is editing it; otherwise the live refresh would put
  // the previous server value back into the input before Submit is pressed.
  const setpointFields = {
    pumpSpeed: snapshot.setpoints.pumpSpeed,
    valvePosition: snapshot.setpoints.valvePosition,
    flowLow: snapshot.setpoints.flowLow,
    tankLevelLow: snapshot.setpoints.tankLevelLow,
    tankLevelHigh: snapshot.setpoints.tankLevelHigh,
  };

  for (const [name, value] of Object.entries(setpointFields)) {
    const input = document.querySelector(`input[name="${name}"]`);
    if (document.activeElement !== input) {
      input.value = fmt(value);
    }
  }

  lastUpdateEl.textContent = `Last update: ${new Date(snapshot.timestamp).toLocaleTimeString()}`;
}

async function postCommand(body) {
  setMessage("Sending command…");
  try {
    const response = await fetch("/api/zone01/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Command failed");
    render(result);
    setMessage("Command accepted");
  } catch (error) {
    setMessage(error.message, true);
  }
}

document.querySelectorAll("[data-command]").forEach((button) => {
  button.addEventListener("click", () => postCommand({ [button.dataset.command]: true }));
});

autoEl.addEventListener("change", () => postCommand({ auto: autoEl.checked }));

document.querySelector("#setpoints").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const setpoints = Object.fromEntries(form.entries());
  for (const key of Object.keys(setpoints)) setpoints[key] = Number(setpoints[key]);
  postCommand({ setpoints });
});

const wsProtocol = location.protocol === "https:" ? "wss:" : "ws:";
const ws = new WebSocket(`${wsProtocol}//${location.host}`);

ws.addEventListener("open", () => setConnection(true));
ws.addEventListener("close", () => setConnection(false));
ws.addEventListener("error", () => setConnection(false));
ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.type === "telemetry") render(message.data);
  if (message.type === "status") {
    setConnection(message.connected);
    if (message.error) setMessage(message.error, true);
  }
});
