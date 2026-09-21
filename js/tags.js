/* ================================================================
   BUILDING IRRIGATION SCADA
   TAG LAYER

   - PostgreSQL tags via REST API (port 3000)
   - Zone 03 live data from CODESYS via Node.js OPC UA (/api/zone3)
   - All other values are still simulated locally
================================================================ */

const API_BASE = "http://localhost:3000";


/* ================================================================
   POSTGRESQL TAGS
================================================================ */

async function loadDatabaseTags() {
    try {
        const response = await fetch(`${API_BASE}/api/tags`);

        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const dbTags = await response.json();

        console.log("PostgreSQL SCADA tags:", dbTags);
        console.log(`Loaded ${dbTags.length} tags from PostgreSQL`);

        return dbTags;
    }
    catch (error) {
        console.error("Unable to load SCADA tags:", error);
        return [];
    }
}


async function getTagValue(tagName) {
    try {
        const response = await fetch(
            `${API_BASE}/api/tags/${encodeURIComponent(tagName)}/value`
        );

        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const tag = await response.json();

        return { ...tag, value: Number(tag.value) };
    }
    catch (error) {
        console.error(`Unable to load tag ${tagName}:`, error);
        return null;
    }
}


/* ================================================================
   TAG DATABASE (local / simulated)
================================================================ */

const tags = {

    waterTank: {
        level: 78.0,
        capacity: 20000,
        lowLevelSetpoint: 20
    },

    mainHeader: {
        flow: 42.6
    },

    pump01: {
        startCommand: false,
        stopCommand: false,
        mode: "AUTO",
        runCommand: true,
        runFeedback: true,
        fault: false,
        speed: 62,
        frequency: 62,
        permissives: {
            tankLevelOK: true,
            emergencyStopOK: true,
            noFault: true
        }
    },

    zones: {
        zone01: { name: "Main Entrance",     moisture: 48, flow: 21.3, valve: 100, running: true  },
        zone02: { name: "Courtyard",         moisture: 42, flow: 21.3, valve: 100, running: true  },
        zone03: { name: "Roof Garden",       moisture: 24, flow: 0,    valve: 0,   running: false },
        zone04: { name: "East Garden",       moisture: 61, flow: 0,    valve: 0,   running: false },
        zone05: { name: "West Garden",       moisture: 56, flow: 0,    valve: 0,   running: false },
        zone06: { name: "Parking Landscape", moisture: 52, flow: 0,    valve: 0,   running: false }
    }
};


/* ================================================================
   PUMP PERMISSIVES
================================================================ */

function evaluatePumpPermissives() {
    const pump = tags.pump01;

    pump.permissives.tankLevelOK =
        tags.waterTank.level >= tags.waterTank.lowLevelSetpoint;

    pump.permissives.emergencyStopOK = true;

    pump.permissives.noFault = !pump.fault;

    return (
        pump.permissives.tankLevelOK &&
        pump.permissives.emergencyStopOK &&
        pump.permissives.noFault
    );
}


/* ================================================================
   PUMP COMMANDS
================================================================ */

function startPump() {
    const pump = tags.pump01;

    /* AUTO mode: the automatic sequence owns the command */
    if (pump.mode === "AUTO") {
        showOperatorMessage(
            "P-01 is in AUTO mode. " +
            "The automatic irrigation sequence controls the pump."
        );
        return;
    }

    if (!evaluatePumpPermissives()) {
        showOperatorMessage(
            "P-01 cannot start. " +
            "One or more permissives are not satisfied."
        );
        updatePumpFaceplate();
        return;
    }

    pump.startCommand = true;
    pump.stopCommand = false;
    pump.runCommand = true;

    /* Simulated VFD response */
    pump.runFeedback = true;
    pump.speed = 62;
    pump.frequency = 62;

    updatePumpFaceplate();
    updateHMI();
}


function stopPump() {
    const pump = tags.pump01;

    pump.startCommand = false;
    pump.stopCommand = true;
    pump.runCommand = false;

    /* Simulated feedback */
    pump.runFeedback = false;
    pump.speed = 0;
    pump.frequency = 0;

    updatePumpFaceplate();
    updateHMI();
}


function togglePumpMode() {
    const pump = tags.pump01;

    if (pump.mode === "AUTO") {
        pump.mode = "MANUAL";
    }
    else {
        pump.mode = "AUTO";
        /* Returning to AUTO removes the manual start command */
        pump.startCommand = false;
    }

    updatePumpFaceplate();
}


/* ================================================================
   PUMP FACEPLATE
================================================================ */

function updatePumpFaceplate() {
    const pump = tags.pump01;

    evaluatePumpPermissives();

    const modeElement       = document.getElementById("pump-mode");
    const statusElement     = document.getElementById("pump-status");
    const feedbackElement   = document.getElementById("pump-feedback");
    const speedElement      = document.getElementById("pump-speed");
    const frequencyElement  = document.getElementById("pump-frequency");
    const flowElement       = document.getElementById("pump-flow");
    const startButton       = document.getElementById("pump-start-button");
    const stopButton        = document.getElementById("pump-stop-button");
    const modeButton        = document.getElementById("pump-mode-button");
    const tankPermissive    = document.getElementById("pump-tank-permissive");
    const estopPermissive   = document.getElementById("pump-estop-permissive");
    const faultPermissive   = document.getElementById("pump-fault-permissive");
    const nodeStatus        = document.getElementById("pump-node-status");

    /* Faceplate may not exist yet */
    if (!modeElement) {
        return;
    }

    /* Status */
    modeElement.textContent = pump.mode;

    statusElement.textContent = pump.runFeedback ? "RUNNING" : "STOPPED";
    statusElement.className   = pump.runFeedback ? "running-text" : "stopped-text";

    feedbackElement.textContent = pump.runFeedback ? "RUN" : "OFF";
    feedbackElement.className   = pump.runFeedback ? "running-text" : "stopped-text";

    /* Process values */
    speedElement.textContent     = `${pump.speed.toFixed(0)}%`;
    frequencyElement.textContent = `${pump.frequency.toFixed(0)} Hz`;

    flowElement.textContent = pump.runFeedback
        ? `${tags.mainHeader.flow.toFixed(1)} L/min`
        : "0.0 L/min";

    /* Permissives */
    setPermissiveDisplay(tankPermissive,  pump.permissives.tankLevelOK,     "OK",       "LOW LEVEL");
    setPermissiveDisplay(estopPermissive, pump.permissives.emergencyStopOK, "OK",       "ACTIVE");
    setPermissiveDisplay(faultPermissive, pump.permissives.noFault,         "NO FAULT", "FAULT");

    /* Start button */
    startButton.disabled = !(
        pump.mode === "MANUAL" &&
        !pump.runFeedback &&
        evaluatePumpPermissives()
    );

    /* Stop button */
    stopButton.disabled = !pump.runFeedback;

    /* Button visual state */
    startButton.classList.remove("pump-running");
    stopButton.classList.remove("pump-stopped");

    if (pump.runFeedback) {
        stopButton.classList.add("pump-stopped");
    }
    else {
        startButton.classList.add("pump-running");
    }

    /* Mode button */
    modeButton.textContent = pump.mode;
    modeButton.classList.add("mode-selected");

    /* System schematic */
    if (nodeStatus) {
        nodeStatus.textContent = pump.runFeedback
            ? `RUN • ${pump.frequency.toFixed(0)} Hz`
            : "STOPPED";
    }
}


function setPermissiveDisplay(element, condition, goodText, badText) {
    if (!element) {
        return;
    }

    element.textContent = condition ? goodText : badText;
    element.className   = condition ? "good" : "bad";
}


/* ================================================================
   HMI UPDATE
================================================================ */

function updateHMI() {
    evaluatePumpPermissives();

    /* Tank */
    const tankLevel = Number(tags.waterTank.level.toFixed(1));

    const tankLitres = Math.round(
        tankLevel * tags.waterTank.capacity / 100
    );

    const tankElement  = document.getElementById("tank");
    const tank2Element = document.getElementById("tank2");

    if (tankElement) {
        tankElement.textContent = `${tankLevel.toFixed(1)}%`;
    }

    if (tank2Element) {
        tank2Element.textContent =
            `${tankLevel.toFixed(1)}% • ${tankLitres.toLocaleString()} L`;
    }

    /* Main flow */
    const flow = tags.pump01.runFeedback ? tags.mainHeader.flow : 0;
    const flowText = `${flow.toFixed(1)} L/min`;

    const flowElement       = document.getElementById("flow");
    const headerFlowElement = document.getElementById("header-flow");

    if (flowElement) {
        flowElement.textContent = flowText;
    }

    if (headerFlowElement) {
        headerFlowElement.textContent = flowText;
    }

    /* Active zones */
    let activeZones = 0;

    Object.values(tags.zones).forEach(zone => {
        if (zone.running) {
            activeZones++;
        }
    });

    const activeZonesElement = document.getElementById("activeZones");

    if (activeZonesElement) {
        activeZonesElement.textContent = `${activeZones} / 8`;
    }

    /* Daily water */
    const dailyWater = document.getElementById("dailyWater");

    if (dailyWater) {
        dailyWater.textContent = "3,840 L";
    }

    updatePumpFaceplate();
}


/* ================================================================
   OPERATOR MESSAGE
================================================================ */

function showOperatorMessage(message) {
    alert(message);
}


/* ================================================================
   ZONE DEMO CONTROL
================================================================ */

function toggle(button) {
    const zone   = button.closest(".zone");
    const status = zone.querySelector(".status");

    if (button.textContent.trim() === "Stop") {
        button.textContent = "Start";
        status.textContent = "STANDBY";
        status.classList.remove("ok");
        status.classList.add("warn");
    }
    else {
        button.textContent = "Stop";
        status.textContent = "RUNNING";
        status.classList.remove("warn");
        status.classList.add("ok");
    }
}


function startAll() {
    showOperatorMessage(
        "Demo command: automatic irrigation sequence started."
    );
}


function ack() {
    const alarmCount = document.getElementById("alarmCount");

    if (alarmCount) {
        alarmCount.textContent = "0";
    }

    const alarm = document.querySelector(".alarm-row .sev.low");

    if (alarm) {
        alarm.textContent = "ACK";
        alarm.classList.remove("low");
    }
}


/* ================================================================
   FACEPLATE OPEN / CLOSE
================================================================ */

function openPumpFaceplate() {
    document.getElementById("pump-faceplate").style.display = "block";
    document.getElementById("faceplate-overlay").style.display = "block";

    updatePumpFaceplate();
}


function closePumpFaceplate() {
    document.getElementById("pump-faceplate").style.display = "none";
    document.getElementById("faceplate-overlay").style.display = "none";
}


/* ================================================================
   CLOCK
================================================================ */

function updateClock() {
    const clock = document.getElementById("clock");

    if (clock) {
        clock.textContent = new Date().toLocaleTimeString();
    }
}


/* ================================================================
   ZONE 03 - LIVE DATA FROM CODESYS (OPC UA via Node.js)
================================================================ */

function fmt(value, unit) {
    return typeof value === "number"
        ? value.toFixed(1) + unit
        : "--";
}


async function updateZone3() {
    const badge    = document.getElementById("z3-status");
    const moisture = document.getElementById("z3-moisture");
    const flow     = document.getElementById("z3-flow");
    const valve    = document.getElementById("z3-valve");
    const bar      = document.getElementById("z3-bar");

    /* IDs not added to index.html yet */
    if (!badge) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/zone3`);

        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const z = await response.json();

        if (!z.connected) {
            throw new Error("OPC UA not connected");
        }

        /* PLC moisture is a 0-1 fraction, HMI shows percent */
        const moisturePct = (Number(z.MOISTURE) || 0) * 100;

        if (moisture) moisture.textContent = fmt(moisturePct, "%");
        if (flow)     flow.textContent     = fmt(z.FLOW, " L/min");
        if (valve)    valve.textContent    = fmt(z.VALVE, "%");
        if (bar)      bar.style.width      = moisturePct + "%";

        /* Keep the local tag database in sync (active zones count) */
        tags.zones.zone03.moisture = moisturePct;
        tags.zones.zone03.flow     = Number(z.FLOW) || 0;
        tags.zones.zone03.valve    = Number(z.VALVE) || 0;
        tags.zones.zone03.running  = Number(z.FLOW) > 0;

        if (z.FAULT) {
            badge.textContent = "FAULT";
            badge.className   = "status alarm";
        }
        else if (Number(z.FLOW) > 0) {
            badge.textContent = "RUNNING";
            badge.className   = "status ok";
        }
        else {
            badge.textContent = "STANDBY";
            badge.className   = "status warn";
        }
    }
    catch (error) {
        badge.textContent = "NO DATA";
        badge.className   = "status alarm";
    }
}


/* ================================================================
   INITIALIZATION
================================================================ */

document.addEventListener("DOMContentLoaded", function () {
    updateClock();
    updateHMI();
    updateZone3();
});

setInterval(updateClock, 1000);
setInterval(updateZone3, 1000);


/* ================================================================
   PROCESS SIMULATION (tank level only)

   Later this section will be replaced by real backend data.
================================================================ */

setInterval(function () {

    if (tags.pump01.runFeedback && tags.waterTank.level > 0) {
        tags.waterTank.level -= 0.02;
    }

    if (tags.waterTank.level < 0) {
        tags.waterTank.level = 0;
    }

    updateHMI();

}, 1000);


loadDatabaseTags();
