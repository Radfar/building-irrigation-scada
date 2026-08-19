/*
 * Load real SCADA tags from PostgreSQL
 * through the Node.js REST API.
 */

async function loadDatabaseTags() {

    try {

        const response = await fetch(
            "http://localhost:3000/api/tags"
        );

        if (!response.ok) {

            throw new Error(
                `HTTP error: ${response.status}`
            );

        }

        const tags = await response.json();

        console.log(
            "PostgreSQL SCADA tags:",
            tags
        );

        console.log(
            `Loaded ${tags.length} tags from PostgreSQL`
        );

        return tags;

    }

    catch (error) {

        console.error(
            "Unable to load SCADA tags:",
            error
        );

        return [];

    }

}
/* ================================================================
   BUILDING IRRIGATION SCADA
   TAG DATABASE / PROCESS SIMULATION

   This file represents the SCADA tag layer.

   In a real system these values would eventually come from:

       PLC
        ↓
       OPC UA / Modbus / Ethernet/IP / BACnet
        ↓
       SCADA

   For this project they are simulated locally.
================================================================ */


/* ================================================================
   TAG DATABASE
================================================================ */

const tags = {

    /* ============================================================
       WATER TANK
    ============================================================ */

    waterTank: {

        level: 78.0,

        capacity: 20000,

        lowLevelSetpoint: 20

    },


    /* ============================================================
       MAIN HEADER
    ============================================================ */

    mainHeader: {

        flow: 42.6

    },


    /* ============================================================
       PUMP P-01
    ============================================================ */

    pump01: {

        /* --------------------------------------------------------
           COMMANDS
        -------------------------------------------------------- */

        startCommand: false,

        stopCommand: false,


        /* --------------------------------------------------------
           OPERATING MODE
        -------------------------------------------------------- */

        mode: "AUTO",


        /* --------------------------------------------------------
           STATUS
        -------------------------------------------------------- */

        runCommand: true,

        runFeedback: true,

        fault: false,


        /* --------------------------------------------------------
           VFD / PROCESS VALUES
        -------------------------------------------------------- */

        speed: 62,

        frequency: 62,


        /* --------------------------------------------------------
           PERMISSIVES
        -------------------------------------------------------- */

        permissives: {

            tankLevelOK: true,

            emergencyStopOK: true,

            noFault: true

        }

    },


    /* ============================================================
       ZONES
    ============================================================ */

    zones: {

        zone01: {

            name: "Main Entrance",

            moisture: 48,

            flow: 21.3,

            valve: 100,

            running: true

        },


        zone02: {

            name: "Courtyard",

            moisture: 42,

            flow: 21.3,

            valve: 100,

            running: true

        },


        zone03: {

            name: "Roof Garden",

            moisture: 24,

            flow: 0,

            valve: 0,

            running: false

        },


        zone04: {

            name: "East Garden",

            moisture: 61,

            flow: 0,

            valve: 0,

            running: false

        },


        zone05: {

            name: "West Garden",

            moisture: 56,

            flow: 0,

            valve: 0,

            running: false

        },


        zone06: {

            name: "Parking Landscape",

            moisture: 52,

            flow: 0,

            valve: 0,

            running: false

        }

    }

};


/* ================================================================
   PUMP PERMISSIVE EVALUATION
================================================================ */

function evaluatePumpPermissives() {

    const pump = tags.pump01;


    /* Tank level permissive */

    pump.permissives.tankLevelOK =
        tags.waterTank.level >=
        tags.waterTank.lowLevelSetpoint;


    /* Emergency stop */

    pump.permissives.emergencyStopOK =
        true;


    /* Fault */

    pump.permissives.noFault =
        !pump.fault;


    return (

        pump.permissives.tankLevelOK &&

        pump.permissives.emergencyStopOK &&

        pump.permissives.noFault

    );

}


/* ================================================================
   START PUMP
================================================================ */

function startPump() {

    const pump = tags.pump01;


    /*
     * AUTO mode:
     *
     * Operator START is not allowed.
     * The automatic control sequence owns the command.
     */

    if (pump.mode === "AUTO") {

        showOperatorMessage(
            "P-01 is in AUTO mode. " +
            "The automatic irrigation sequence controls the pump."
        );

        return;

    }


    /*
     * Evaluate permissives
     */

    if (!evaluatePumpPermissives()) {

        showOperatorMessage(
            "P-01 cannot start. " +
            "One or more permissives are not satisfied."
        );

        updatePumpFaceplate();

        return;

    }


    /*
     * Issue command
     */

    pump.startCommand = true;

    pump.stopCommand = false;

    pump.runCommand = true;


    /*
     * Simulated VFD response
     */

    pump.runFeedback = true;

    pump.speed = 62;

    pump.frequency = 62;


    updatePumpFaceplate();

    updateHMI();

}


/* ================================================================
   STOP PUMP
================================================================ */

function stopPump() {

    const pump = tags.pump01;


    pump.startCommand = false;

    pump.stopCommand = true;

    pump.runCommand = false;


    /*
     * Simulated feedback
     */

    pump.runFeedback = false;

    pump.speed = 0;

    pump.frequency = 0;


    updatePumpFaceplate();

    updateHMI();

}


/* ================================================================
   TOGGLE AUTO / MANUAL
================================================================ */

function togglePumpMode() {

    const pump = tags.pump01;


    if (pump.mode === "AUTO") {

        pump.mode = "MANUAL";

    }

    else {

        pump.mode = "AUTO";


        /*
         * Returning to AUTO removes
         * the manual start command.
         */

        pump.startCommand = false;

    }


    updatePumpFaceplate();

}


/* ================================================================
   UPDATE PUMP FACEPLATE
================================================================ */

function updatePumpFaceplate() {

    const pump = tags.pump01;


    /*
     * Always evaluate current conditions first.
     */

    evaluatePumpPermissives();


    /* ------------------------------------------------------------
       ELEMENT REFERENCES
    ------------------------------------------------------------ */

    const modeElement =
        document.getElementById(
            "pump-mode"
        );


    const statusElement =
        document.getElementById(
            "pump-status"
        );


    const feedbackElement =
        document.getElementById(
            "pump-feedback"
        );


    const speedElement =
        document.getElementById(
            "pump-speed"
        );


    const frequencyElement =
        document.getElementById(
            "pump-frequency"
        );


    const flowElement =
        document.getElementById(
            "pump-flow"
        );


    const startButton =
        document.getElementById(
            "pump-start-button"
        );


    const stopButton =
        document.getElementById(
            "pump-stop-button"
        );


    const modeButton =
        document.getElementById(
            "pump-mode-button"
        );


    const tankPermissive =
        document.getElementById(
            "pump-tank-permissive"
        );


    const estopPermissive =
        document.getElementById(
            "pump-estop-permissive"
        );


    const faultPermissive =
        document.getElementById(
            "pump-fault-permissive"
        );


    const nodeStatus =
        document.getElementById(
            "pump-node-status"
        );


    /*
     * Faceplate may not exist yet.
     */

    if (!modeElement) {

        return;

    }


    /* ------------------------------------------------------------
       STATUS
    ------------------------------------------------------------ */

    modeElement.textContent =
        pump.mode;


    statusElement.textContent =
        pump.runFeedback
            ? "RUNNING"
            : "STOPPED";


    statusElement.className =
        pump.runFeedback
            ? "running-text"
            : "stopped-text";


    feedbackElement.textContent =
        pump.runFeedback
            ? "RUN"
            : "OFF";


    feedbackElement.className =
        pump.runFeedback
            ? "running-text"
            : "stopped-text";


    /* ------------------------------------------------------------
       PROCESS VALUES
    ------------------------------------------------------------ */

    speedElement.textContent =
        `${pump.speed.toFixed(0)}%`;


    frequencyElement.textContent =
        `${pump.frequency.toFixed(0)} Hz`;


    flowElement.textContent =
        pump.runFeedback
            ? `${tags.mainHeader.flow.toFixed(1)} L/min`
            : "0.0 L/min";


    /* ------------------------------------------------------------
       PERMISSIVES
    ------------------------------------------------------------ */

    setPermissiveDisplay(

        tankPermissive,

        pump.permissives.tankLevelOK,

        "OK",

        "LOW LEVEL"

    );


    setPermissiveDisplay(

        estopPermissive,

        pump.permissives.emergencyStopOK,

        "OK",

        "ACTIVE"

    );


    setPermissiveDisplay(

        faultPermissive,

        pump.permissives.noFault,

        "NO FAULT",

        "FAULT"

    );


    /* ------------------------------------------------------------
       START BUTTON
    ------------------------------------------------------------ */

    if (

        pump.mode === "MANUAL" &&

        !pump.runFeedback &&

        evaluatePumpPermissives()

    ) {

        startButton.disabled = false;

    }

    else {

        startButton.disabled = true;

    }


    /* ------------------------------------------------------------
       STOP BUTTON
    ------------------------------------------------------------ */

    stopButton.disabled =
        !pump.runFeedback;


    /* ------------------------------------------------------------
       START BUTTON VISUAL STATE
    ------------------------------------------------------------ */

    startButton.classList.remove(
        "pump-running"
    );


    stopButton.classList.remove(
        "pump-stopped"
    );


    if (pump.runFeedback) {

        stopButton.classList.add(
            "pump-stopped"
        );

    }

    else {

        startButton.classList.add(
            "pump-running"
        );

    }


    /* ------------------------------------------------------------
       MODE BUTTON
    ------------------------------------------------------------ */

    modeButton.textContent =
        pump.mode;


    modeButton.classList.add(
        "mode-selected"
    );


    /* ------------------------------------------------------------
       SYSTEM SCHEMATIC STATUS
    ------------------------------------------------------------ */

    if (nodeStatus) {

        nodeStatus.textContent =
            pump.runFeedback

                ? `RUN • ${pump.frequency.toFixed(0)} Hz`

                : "STOPPED";

    }

}


/* ================================================================
   PERMISSIVE DISPLAY HELPER
================================================================ */

function setPermissiveDisplay(

    element,

    condition,

    goodText,

    badText

) {

    if (!element) {

        return;

    }


    element.textContent =
        condition
            ? goodText
            : badText;


    element.className =
        condition
            ? "good"
            : "bad";

}


/* ================================================================
   HMI UPDATE
================================================================ */

function updateHMI() {

    /*
     * Evaluate pump permissives
     */

    evaluatePumpPermissives();


    /* ------------------------------------------------------------
       TANK
    ------------------------------------------------------------ */

    const tankLevel =
        Number(
            tags.waterTank.level.toFixed(1)
        );


    const tankLitres =
        Math.round(
            tankLevel *
            tags.waterTank.capacity /
            100
        );


    const tankElement =
        document.getElementById(
            "tank"
        );


    const tank2Element =
        document.getElementById(
            "tank2"
        );


    if (tankElement) {

        tankElement.textContent =
            `${tankLevel.toFixed(1)}%`;

    }


    if (tank2Element) {

        tank2Element.textContent =
            `${tankLevel.toFixed(1)}% • ` +
            `${tankLitres.toLocaleString()} L`;

    }


    /* ------------------------------------------------------------
       MAIN FLOW
    ------------------------------------------------------------ */

    const flow =
        tags.pump01.runFeedback
            ? tags.mainHeader.flow
            : 0;


    const flowText =
        `${flow.toFixed(1)} L/min`;


    const flowElement =
        document.getElementById(
            "flow"
        );


    const headerFlowElement =
        document.getElementById(
            "header-flow"
        );


    if (flowElement) {

        flowElement.textContent =
            flowText;

    }


    if (headerFlowElement) {

        headerFlowElement.textContent =
            flowText;

    }


    /* ------------------------------------------------------------
       ACTIVE ZONES
    ------------------------------------------------------------ */

    let activeZones = 0;


    Object.values(tags.zones)
        .forEach(zone => {

            if (zone.running) {

                activeZones++;

            }

        });


    const activeZonesElement =
        document.getElementById(
            "activeZones"
        );


    if (activeZonesElement) {

        activeZonesElement.textContent =
            `${activeZones} / 8`;

    }


    /* ------------------------------------------------------------
       DAILY WATER
    ------------------------------------------------------------ */

    const dailyWater =
        document.getElementById(
            "dailyWater"
        );


    if (dailyWater) {

        dailyWater.textContent =
            "3,840 L";

    }


    /* ------------------------------------------------------------
       PUMP FACEPLATE
    ------------------------------------------------------------ */

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

    const zone =
        button
            .closest(".zone");


    const status =
        zone.querySelector(
            ".status"
        );


    if (
        button.textContent
        .trim()
        === "Stop"
    ) {

        button.textContent =
            "Start";


        status.textContent =
            "STANDBY";


        status.classList.remove(
            "ok"
        );


        status.classList.add(
            "warn"
        );

    }

    else {

        button.textContent =
            "Stop";


        status.textContent =
            "RUNNING";


        status.classList.remove(
            "warn"
        );


        status.classList.add(
            "ok"
        );

    }

}


/* ================================================================
   START ALL
================================================================ */

function startAll() {

    showOperatorMessage(
        "Demo command: automatic irrigation sequence started."
    );

}


/* ================================================================
   ACKNOWLEDGE ALARMS
================================================================ */

function ack() {

    const alarmCount =
        document.getElementById(
            "alarmCount"
        );


    if (alarmCount) {

        alarmCount.textContent =
            "0";

    }


    const alarm =
        document.querySelector(
            ".alarm-row .sev.low"
        );


    if (alarm) {

        alarm.textContent =
            "ACK";

        alarm.classList.remove(
            "low"
        );

    }

}


/* ================================================================
   OPEN FACEPLATE
================================================================ */

function openPumpFaceplate() {

    const faceplate =
        document.getElementById(
            "pump-faceplate"
        );


    const overlay =
        document.getElementById(
            "faceplate-overlay"
        );


    faceplate.style.display =
        "block";


    overlay.style.display =
        "block";


    updatePumpFaceplate();

}


/* ================================================================
   CLOSE FACEPLATE
================================================================ */

function closePumpFaceplate() {

    const faceplate =
        document.getElementById(
            "pump-faceplate"
        );


    const overlay =
        document.getElementById(
            "faceplate-overlay"
        );


    faceplate.style.display =
        "none";


    overlay.style.display =
        "none";

}


/* ================================================================
   CLOCK
================================================================ */

function updateClock() {

    const clock =
        document.getElementById(
            "clock"
        );


    if (clock) {

        clock.textContent =
            new Date().toLocaleTimeString();

    }

}


/* ================================================================
   INITIALIZATION
================================================================ */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        updateClock();

        updateHMI();

    }
);


/* ================================================================
   CLOCK TIMER
================================================================ */

setInterval(
    updateClock,
    1000
);


/* ================================================================
   PROCESS SIMULATION

   This deliberately runs slowly.

   Later this section will be replaced by
   real data coming from the backend/API.
================================================================ */

setInterval(
    function () {

        /*
         * Simulate tank consumption only
         * while the pump is running.
         */

        if (
            tags.pump01.runFeedback &&
            tags.waterTank.level > 0
        ) {

            tags.waterTank.level -= 0.02;

        }


        /*
         * Prevent negative values.
         */

        if (
            tags.waterTank.level < 0
        ) {

            tags.waterTank.level = 0;

        }


        updateHMI();

    },

    1000
);
loadDatabaseTags();