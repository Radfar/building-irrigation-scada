
const mqtt = require("mqtt");

const brokerUrl = "mqtt://localhost:1883";
const topic = "zone4/soil01/data";

const client = mqtt.connect(brokerUrl, {
  clientId: "webscada-zone4-test",
  reconnectPeriod: 5000,
  connectTimeout: 10000
});

client.on("connect", () => {
  console.log("Connected to MQTT broker");

  client.subscribe(topic, { qos: 0 }, (err) => {
    if (err) {
      console.error("Subscription failed:", err.message);
    } else {
      console.log(`Subscribed to ${topic}`);
    }
  });
});

client.on("message", (receivedTopic, payload) => {
  try {
    const data = JSON.parse(payload.toString());

    if (
      receivedTopic === topic &&
      typeof data.moisture === "number" &&
      Number.isFinite(data.moisture)
    ) {
      console.log("Live soil moisture:", data.moisture);
    } else {
      console.warn("Unexpected MQTT payload:", payload.toString());
    }
  } catch (err) {
    console.error("Invalid MQTT JSON:", err.message);
  }
});

client.on("error", (err) => {
  console.error("MQTT connection error:", err.message);
});

client.on("reconnect", () => {
  console.log("Reconnecting to MQTT broker...");
});
