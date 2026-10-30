/*
 * Zone 04 supervisory process simulation.
 *
 * Real input:
 *   Soil moisture from ESP8266 over MQTT (server/mqtt.js).
 *
 * Simulated outputs:
 *   Valve command and flow. This module does not communicate with
 *   the ESP8266 and must not be used to drive physical hardware.
 */

const AUTO_MOISTURE_LOW_SP = 30; // percent; aligned with the HMI strategy
const SIMULATED_FLOW_LPM = 18.5;

const state = {
    mode: "AUTO",
    manualStartRequest: false,
    stopInhibit: false,
    fault: false,
    lastCommand: null,
    lastCommandAt: null
};

function getState(mqttLive) {
    const moisture = Number(mqttLive?.moisture);
    const moistureValid =
        Number.isFinite(moisture) &&
        moisture >= 0 &&
        moisture <= 100;

    const commOk =
        mqttLive?.connected === true &&
        mqttLive?.quality === "GOOD" &&
        moistureValid;

    const activeMode =
        ["AUTO", "MANUAL"].includes(mqttLive?.deviceMode)
            ? mqttLive.deviceMode
            : state.mode;

    if (activeMode !== state.mode) {
        state.mode = activeMode;
        if (activeMode === "AUTO") state.manualStartRequest = false;
    }

    const permissive = commOk && !state.fault;
    const autoDemand =
        activeMode === "AUTO" &&
        moistureValid &&
        moisture < AUTO_MOISTURE_LOW_SP;

    const wateringActive =
        permissive &&
        !state.stopInhibit &&
        (activeMode === "AUTO" ? autoDemand : state.manualStartRequest);

    return {
        zone: 4,
        mode: activeMode,
        deviceMode: mqttLive?.deviceMode ?? null,
        deviceOnline: mqttLive?.deviceOnline ?? null,
        mqttBrokerConnected: mqttLive?.brokerConnected === true,
        moisture: moistureValid ? moisture : null,
        moistureSource: "mqtt",
        moistureQuality: mqttLive?.quality ?? null,
        moistureConnected: commOk,
        moistureAgeSeconds: mqttLive?.ageSeconds ?? null,
        permissive,
        autoMoistureLowSetpoint: AUTO_MOISTURE_LOW_SP,
        autoDemand,
        wateringActive,
        valveCommand: wateringActive ? 100 : 0,
        valveCommandSource: "simulation",
        flow: wateringActive ? SIMULATED_FLOW_LPM : 0,
        flowUnit: "L/min",
        flowSource: "simulation",
        fault: state.fault,
        stopInhibit: state.stopInhibit,
        status: state.fault
            ? "FAULT"
            : !commOk
                ? "NO DATA"
                : wateringActive
                    ? "RUNNING"
                    : activeMode === "AUTO" && moistureValid && !autoDemand
                        ? "STANDBY"
                        : "STOPPED",
        lastCommand: state.lastCommand,
        lastCommandAt: state.lastCommandAt
    };
}

function command(commandName, mqttLive) {
    const command = String(commandName || "").toLowerCase();
    const current = getState(mqttLive);

    if (!["start", "stop", "auto", "manual", "faultreset"].includes(command)) {
        const error = new Error("Unsupported Zone 04 command");
        error.status = 400;
        throw error;
    }

    if (command === "start") {
        if (state.mode !== "MANUAL") {
            const error = new Error("Start is available only in MANUAL mode");
            error.status = 409;
            throw error;
        }
        if (!current.permissive) {
            const error = new Error("Start blocked: MQTT moisture data is unavailable or stale");
            error.status = 409;
            throw error;
        }
        state.manualStartRequest = true;
        state.stopInhibit = false;
    }

    if (command === "stop") {
        state.manualStartRequest = false;
        state.stopInhibit = true;
    }

    if (command === "auto") {
        state.mode = "AUTO";
        state.manualStartRequest = false;
        // An explicit mode command is the operator's re-enable action
        // after a previous STOP; the automatic moisture demand is reevaluated.
        state.stopInhibit = false;
    }

    if (command === "manual") {
        state.mode = "MANUAL";
        state.manualStartRequest = false;
        state.stopInhibit = false;
    }

    if (command === "faultreset") {
        state.fault = false;
        // Reset deliberately does not clear STOP inhibition.
    }

    state.lastCommand = command.toUpperCase();
    state.lastCommandAt = new Date().toISOString();

    return getState(mqttLive);
}

module.exports = {
    getState,
    command
};
