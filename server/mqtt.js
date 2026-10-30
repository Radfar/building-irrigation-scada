
const mqtt = require("mqtt");
const { pool } = require("./database");

const BROKER_URL = process.env.MQTT_URL || "mqtt://localhost:1883";
const ZONE4_TOPIC =
    process.env.MQTT_ZONE4_TOPIC || "zone4/soil01/data";
const ZONE4_COMMAND_TOPIC =
    process.env.MQTT_ZONE4_COMMAND_TOPIC || "zone4/soil01/command";
const ZONE4_STATUS_TOPIC =
    process.env.MQTT_ZONE4_STATUS_TOPIC || "zone4/soil01/status";
const ZONE4_RESULT_TOPIC =
    process.env.MQTT_ZONE4_RESULT_TOPIC || "zone4/soil01/command_result";
const COMMAND_ACK_TIMEOUT_MS = 8000;
const STALE_SECONDS =
    Number(process.env.ZONE4_STALE_SECONDS) || 300;
const TAG_NAME = "Z04_MOISTURE";

console.log("Zone 4 stale timeout:", STALE_SECONDS, "seconds");

let client;
let latestReading = null;
let brokerConnected = false;
let deviceStatus = null;
const pendingCommands = new Map();

// Save a validated reading to the existing PostgreSQL historian.
/*async function saveZone4Reading(moisture, timestamp) {
    const result = await pool.query(
        `INSERT INTO tag_values (tag_id, value, quality, timestamp)
         SELECT id, $1, $2, $3
         FROM tags
         WHERE tag_name = $4
         RETURNING id, tag_id`,
        [moisture, "GOOD", timestamp, TAG_NAME]
    );

    if (result.rowCount === 0) {
        throw new Error(
            `Database tag "${TAG_NAME}" was not found in the tags table`
        );
    }

    console.log(
        `Zone 4 saved to PostgreSQL: ${moisture}% ` +
        `(history row ID: ${result.rows[0].id})`
    );
}*/
async function saveZone4Reading(moisture, timestamp) {
    if (!Number.isFinite(moisture)) {
        throw new Error("Invalid Zone 04 moisture value");
    }

    const readingTimestamp = new Date(timestamp);

    if (Number.isNaN(readingTimestamp.getTime())) {
        throw new Error("Invalid Zone 04 timestamp");
    }

    const result = await pool.query(
        `INSERT INTO tag_values (tag_id, value, quality, timestamp)
         SELECT id, $1, $2, $3
         FROM tags
         WHERE tag_name = $4
         RETURNING id, tag_id`,
        [moisture, "GOOD", readingTimestamp, TAG_NAME]
    );

    if (result.rowCount === 0) {
        throw new Error(
            `Database tag "${TAG_NAME}" was not found in the tags table`
        );
    }

    console.log(
        `Zone 4 saved to PostgreSQL: ${moisture}% ` +
        `(history row ID: ${result.rows[0].id})`
    );
}



function startMqtt() {
    if (client) return client;

    console.log(`Connecting to MQTT broker: ${BROKER_URL}`);

    client = mqtt.connect(BROKER_URL, {
        clientId: "building-irrigation-scada",
        reconnectPeriod: 5000,
        connectTimeout: 10000
    });

    client.on("connect", () => {
        brokerConnected = true;
        console.log("MQTT connected");

        const subscriptions = [
            ZONE4_TOPIC,
            ZONE4_STATUS_TOPIC,
            ZONE4_RESULT_TOPIC
        ];

        client.subscribe(subscriptions, { qos: 0 }, (err) => {
            if (err) {
                console.error("MQTT subscription failed:", err.message);
            } else {
                subscriptions.forEach((topic) =>
                    console.log(`MQTT subscribed: ${topic}`)
                );
            }
        });
    });

    client.on("message", (topic, payload) => {
        let data;

        try {
            data = JSON.parse(payload.toString());
        } catch (err) {
            console.warn(`Rejected invalid MQTT JSON on ${topic}:`, err.message);
            return;
        }

        if (topic === ZONE4_STATUS_TOPIC) {
            if (
                typeof data.online === "boolean" &&
                ["AUTO", "MANUAL"].includes(data.mode)
            ) {
                deviceStatus = {
                    online: data.online,
                    mode: data.mode,
                    timestamp: new Date().toISOString()
                };
                console.log("Zone 4 device status:", deviceStatus);
            } else {
                console.warn("Rejected invalid Zone 4 device status:", data);
            }
            return;
        }

        if (topic === ZONE4_RESULT_TOPIC) {
            const commandId = data.command_id;
            const pending = pendingCommands.get(commandId);

            console.log("Zone 4 command acknowledgement:", data);

            if (pending) {
                clearTimeout(pending.timer);
                pendingCommands.delete(commandId);

                if (data.accepted === true && ["AUTO", "MANUAL"].includes(data.mode)) {
                    deviceStatus = {
                        ...(deviceStatus || {}),
                        online: true,
                        mode: data.mode,
                        timestamp: new Date().toISOString()
                    };
                }

                pending.resolve(data);
            }
            return;
        }

        if (topic !== ZONE4_TOPIC) return;

        const moisture = data.moisture;

        // Validate the expected percentage range.
        if (
            typeof moisture !== "number" ||
            !Number.isFinite(moisture) ||
            moisture < 0 ||
            moisture > 100
        ) {
            console.warn("Rejected invalid Zone 4 reading:", data);
            return;
        }

        const timestamp = new Date();

        latestReading = {
            zone: 4,
            nodeId: "soil01",
            tagName: TAG_NAME,
            moisture,
            unit: "%",
            quality: "GOOD",
            timestamp: timestamp.toISOString(),
            source: "mqtt",
            topic
        };

        console.log(`Zone 4 MQTT moisture: ${moisture}%`);

        // Persist independently so a database error does not
        // prevent the live MQTT value from updating.
        saveZone4Reading(moisture, timestamp).catch((err) => {
            console.error(
                "Zone 4 PostgreSQL write failed:",
                err.message
            );
        });
    });

    client.on("close", () => {
        brokerConnected = false;
        console.warn("MQTT connection closed");
        for (const [commandId, pending] of pendingCommands) {
            clearTimeout(pending.timer);
            pending.reject(new Error("MQTT connection closed before acknowledgement"));
            pendingCommands.delete(commandId);
        }
    });

    client.on("offline", () => {
        brokerConnected = false;
        console.warn("MQTT client offline");
    });

    client.on("error", (err) => {
        console.error("MQTT error:", err.message);
    });

    return client;
}

function publishZone4Mode(mode) {
    if (!["AUTO", "MANUAL"].includes(mode)) {
        return Promise.reject(new Error("Invalid Zone 04 mode"));
    }

    if (!client || !brokerConnected) {
        const error = new Error("MQTT broker is not connected");
        error.status = 503;
        return Promise.reject(error);
    }

    const commandId = `z4-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const payload = JSON.stringify({
        command: "SET_MODE",
        mode,
        command_id: commandId
    });

    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            pendingCommands.delete(commandId);
            const error = new Error("No acknowledgement received from the Zone 04 device");
            error.status = 504;
            reject(error);
        }, COMMAND_ACK_TIMEOUT_MS);

        pendingCommands.set(commandId, { resolve, reject, timer });

        console.log(`Publishing Zone 4 mode command: ${payload}`);
        client.publish(ZONE4_COMMAND_TOPIC, payload, { qos: 0, retain: false }, (err) => {
            if (err) {
                clearTimeout(timer);
                pendingCommands.delete(commandId);
                reject(err);
            }
        });
    });
}

function getZone4Live() {
    if (!latestReading) {
        return {
            zone: 4,
            nodeId: "soil01",
            source: "mqtt",
            brokerConnected,
            deviceMode: deviceStatus?.mode || null,
            deviceOnline: deviceStatus?.online ?? null,
            connected: false,
            moisture: null,
            unit: "%",
            quality: null,
            timestamp: null,
            ageSeconds: null
        };
    }

    const timestampMs = Date.parse(latestReading.timestamp);
    const ageSeconds = Math.max(
        0,
        Math.floor((Date.now() - timestampMs) / 1000)
    );

    return {
        ...latestReading,
        brokerConnected,
        deviceMode: deviceStatus?.mode || null,
        deviceOnline: deviceStatus?.online ?? null,
        ageSeconds,
        connected:
            brokerConnected && ageSeconds <= STALE_SECONDS
    };
}

function stopMqtt() {
    if (!client) return Promise.resolve();

    return new Promise((resolve) => {
        client.end(false, {}, () => {
            brokerConnected = false;
            client = null;
            resolve();
        });
    });
}

module.exports = {
    startMqtt,
    stopMqtt,
    getZone4Live,
    publishZone4Mode
};
