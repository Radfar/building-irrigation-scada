
const mqtt = require("mqtt");

const BROKER_URL = process.env.MQTT_URL || "mqtt://localhost:1883";
const ZONE4_TOPIC =
    process.env.MQTT_ZONE4_TOPIC || "zone4/soil01/data";
const STALE_SECONDS =
    Number(process.env.ZONE4_STALE_SECONDS) || 300;
console.log("Zone 4 stale timeout:", STALE_SECONDS, "seconds");   

let client;
let latestReading = null;
let brokerConnected = false;

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

        try {
            const data = JSON.parse(payload.toString());
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

            latestReading = {
                zone: 4,
                nodeId: "soil01",
                tagName: "Z04_MOISTURE",
                moisture,
                unit: "%",
                quality: "GOOD",
                timestamp: new Date().toISOString(),
                source: "mqtt",
                topic
            };

            console.log(`Zone 4 MQTT moisture: ${moisture}%`);
        } catch (err) {
            console.warn("Rejected invalid MQTT JSON:", err.message);
        }
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
