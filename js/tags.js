// ============================================================
// Building Irrigation SCADA
// Simulated Tag Database
// ============================================================

const tags = {

    // Water system
    waterTank: {
        level: 78,
        capacity: 20000
    },

    mainHeader: {
        flow: 42.6,
        pressure: 4.2
    },

    // Pump station
    pump01: {

    // Commands
    startCommand: true,
    stopCommand: false,

    // Operating mode
    mode: "AUTO",

    // Status
    runCommand: true,
    runFeedback: true,
    fault: false,

    // Process values
    speed: 62,
    frequency: 62,

    // Permissives
    permissives: {
        tankLevelOK: true,
        emergencyStopOK: true,
        noFault: true
    }
    },

    // Irrigation zones
    zone01: {
        moisture: 48,
        flow: 21.3,
        valve: 100,
        status: "RUNNING"
    },

    zone02: {
        moisture: 42,
        flow: 21.3,
        valve: 100,
        status: "RUNNING"
    },

    zone03: {
        moisture: 24,
        flow: 0,
        valve: 0,
        status: "LOW MOISTURE"
    },

    zone04: {
        moisture: 61,
        flow: 0,
        valve: 0,
        status: "STANDBY"
    },

    zone05: {
        moisture: 56,
        flow: 0,
        valve: 0,
        status: "STANDBY"
    },

    zone06: {
        moisture: 52,
        flow: 0,
        valve: 0,
        status: "STANDBY"
    },

    // Alarm system
    alarms: {
        active: 1
    }
};


// ============================================================
// HMI UPDATE FUNCTION
// ============================================================

function updateHMI() {

    // Water tank
    document.getElementById("tank").textContent =
        `${tags.waterTank.level}%`;

    const tankLitres =
        tags.waterTank.level * tags.waterTank.capacity / 100;

    document.getElementById("tank2").textContent =
        `${tags.waterTank.level}% • ${tankLitres.toLocaleString()} L`;


    // Main flow
    document.getElementById("flow").textContent =
        `${tags.mainHeader.flow.toFixed(1)} L/min`;


    // Active zones
    let activeZones = 0;

    Object.keys(tags).forEach(key => {

        if (key.startsWith("zone")) {

            if (tags[key].status === "RUNNING") {
                activeZones++;
            }

        }

    });

    document.getElementById("activeZones").textContent =
        `${activeZones} / 8`;


    // Alarm count
    document.getElementById("alarmCount").textContent =
        tags.alarms.active;
}


// ============================================================
// SIMULATION
// ============================================================

function simulateProcess() {

    // Small random variation in water flow
    const variation = (Math.random() - 0.5) * 2;

    tags.mainHeader.flow =
        Math.max(0, tags.mainHeader.flow + variation);


    // Water consumption
    if (tags.pump01.status === "RUNNING") {

        tags.waterTank.level -= 0.02;

        if (tags.waterTank.level < 20) {
            tags.waterTank.level = 20;
        }

    }


    updateHMI();
}
// ============================================================
// PUMP CONTROL
// ============================================================

function startPump() {

    const pump = tags.pump01;

    // Check permissives before starting
    if (!pump.permissives.tankLevelOK) {
        alert("P-01 cannot start: Water tank level is too low.");
        return;
    }

    if (!pump.permissives.emergencyStopOK) {
        alert("P-01 cannot start: Emergency stop is active.");
        return;
    }

    if (pump.fault) {
        alert("P-01 cannot start: Pump fault is active.");
        return;
    }

    pump.startCommand = true;
    pump.stopCommand = false;

    // Simulate motor starting
    pump.runCommand = true;
    pump.runFeedback = true;
    pump.status = "RUNNING";

    updatePumpFaceplate();
    updateHMI();
}


function stopPump() {

    const pump = tags.pump01;

    pump.startCommand = false;
    pump.stopCommand = true;

    // Simulate motor stopping
    pump.runCommand = false;
    pump.runFeedback = false;
    pump.status = "STOPPED";

    updatePumpFaceplate();
    updateHMI();
}


function togglePumpMode() {

    const pump = tags.pump01;

    if (pump.mode === "AUTO") {
        pump.mode = "MANUAL";
    } else {
        pump.mode = "AUTO";
    }

    updatePumpFaceplate();
}


// ============================================================
// PUMP FACEPLATE DISPLAY
// ============================================================

function updatePumpFaceplate() {

    const pump = tags.pump01;

    const modeElement =
        document.getElementById("pump-mode");

    const statusElement =
        document.getElementById("pump-status");

    const feedbackElement =
        document.getElementById("pump-feedback");

    const speedElement =
        document.getElementById("pump-speed");

    const frequencyElement =
        document.getElementById("pump-frequency");

    if (!modeElement) return;

    modeElement.textContent = pump.mode;

    statusElement.textContent =
        pump.runCommand ? "RUNNING" : "STOPPED";

    feedbackElement.textContent =
        pump.runFeedback ? "RUN" : "OFF";

    speedElement.textContent =
        `${pump.speed}%`;

    frequencyElement.textContent =
        `${pump.frequency} Hz`;
}
function openPumpFaceplate() {

    document.getElementById(
        "pump-faceplate"
    ).style.display = "block";

    updatePumpFaceplate();
}


function closePumpFaceplate() {

    document.getElementById(
        "pump-faceplate"
    ).style.display = "none";
}
// ============================================================
// INITIALIZE
// ============================================================

updateHMI();
updatePumpFaceplate();

// Simulate the process every 2 seconds
setInterval(simulateProcess, 2000);