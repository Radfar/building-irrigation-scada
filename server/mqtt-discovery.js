const dgram = require("node:dgram");
const os = require("node:os");

const DISCOVERY_PORT = Number(process.env.MQTT_DISCOVERY_PORT) || 1884;
const MQTT_PORT = Number(process.env.MQTT_PORT) || 1883;
const REQUEST = "IRRIGATION_MQTT_DISCOVER_V1";
const RESPONSE_PREFIX = "IRRIGATION_MQTT_HERE_V1|";

let socket = null;

function ipv4ToInt(address) {
    return address.split(".").reduce(
        (value, octet) => ((value << 8) | Number(octet)) >>> 0,
        0
    );
}

function findInterfaceForClient(clientIp) {
    const client = ipv4ToInt(clientIp);

    for (const [name, addresses] of Object.entries(os.networkInterfaces())) {
        for (const item of addresses || []) {
            if (item.family !== "IPv4" || item.internal) continue;
            if (!item.address || !item.netmask) continue;

            const address = ipv4ToInt(item.address);
            const mask = ipv4ToInt(item.netmask);

            if ((client & mask) === (address & mask)) {
                return { name, address: item.address };
            }
        }
    }

    return null;
}

function startBrokerDiscovery() {
    if (socket) return socket;

    socket = dgram.createSocket({ type: "udp4", reuseAddr: true });

    socket.on("message", (message, remote) => {
        if (message.toString("utf8").trim() !== REQUEST) return;

        const network = findInterfaceForClient(remote.address);
        if (!network) {
            console.warn(
                `MQTT discovery: no local IPv4 interface matches ESP ${remote.address}`
            );
            return;
        }

        const response = Buffer.from(
            `${RESPONSE_PREFIX}${network.address}|${MQTT_PORT}`,
            "utf8"
        );

        socket.send(response, remote.port, remote.address, (error) => {
            if (error) {
                console.error("MQTT discovery reply failed:", error.message);
                return;
            }
            console.log(
                `MQTT discovery: replied to ${remote.address} via ${network.name} (${network.address}:${MQTT_PORT})`
            );
        });
    });

    socket.on("error", (error) => {
        console.error("MQTT discovery UDP error:", error.message);
    });

    socket.bind(DISCOVERY_PORT, "0.0.0.0", () => {
        console.log(
            `MQTT broker discovery listening on UDP port ${DISCOVERY_PORT}; advertising TCP port ${MQTT_PORT}`
        );
    });

    return socket;
}

function stopBrokerDiscovery() {
    if (!socket) return Promise.resolve();

    return new Promise((resolve) => {
        const current = socket;
        socket = null;
        current.close(() => resolve());
    });
}

module.exports = {
    startBrokerDiscovery,
    stopBrokerDiscovery
};
