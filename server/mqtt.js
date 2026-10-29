
const mqtt = require("mqtt");
const { pool } = require("./database");

const BROKER_URL = process.env.MQTT_URL || "mqtt://localhost:1883";
const ZONE4_TOPIC =
    process.env.MQTT_ZONE4_TOPIC || "zone4/soil01/data";
const STALE_SECONDS =
    Number(process.env.ZONE4_STALE_SECONDS) || 300;
const TAG_NAME = "Z04_MOISTURE";

console.log("Zone 4 stale timeout:", STALE_SECONDS, "seconds");

let client;
let latestReading = null;
let brokerConnected = false;

// Save a validated reading to the existing PostgreSQL historian.
async function saveZone4Reading(moisture, timestamp) {
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

        client.subscribe(ZONE4_TOPIC, { qos: 0 }, (err) => {
            if (err) {
                console.error("MQTT subscription failed:", err.message);
            } else {
                console.log(`MQTT subscribed: ${ZONE4_TOPIC}`);
            }
        });
    });

    client.on("message", (topic, payload) => {
        if (topic !== ZONE4_TOPIC) return;

        let data;

        try {
            data = JSON.parse(payload.toString());
        } catch (err) {
            console.warn("Rejected invalid MQTT JSON:", err.message);
            return;
        }

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

function getZone4Live() {
    if (!latestReading) {
        return {
            zone: 4,
            nodeId: "soil01",
            source: "mqtt",
            brokerConnected,
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
    getZone4Live
};
