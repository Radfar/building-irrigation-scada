(() => {
  "use strict";

  // Controller/device identity is displayed independently from live process status.
  const zoneTechnology = {
    "01": { device: "Python water-process simulator", protocol: "Modbus TCP" },
    "02": { device: "Rockwell Micro850", protocol: "EtherNet/IP" },
    "03": { device: "CODESYS SoftPLC", protocol: "OPC UA" },
    "04": { device: "ESP8266 IoT edge", protocol: "MQTT" },
    "05": { device: "BACnet device simulator", protocol: "BACnet/IP" },
    "06": { device: "Demonstration placeholder", protocol: "Not connected" }
  };

  function addIdentityLabels() {
    document.querySelectorAll(".zone[data-zone]").forEach(card => {
      const identity = zoneTechnology[card.dataset.zone];
      if (!identity || card.querySelector(".zone-identity")) return;

      const label = document.createElement("div");
      label.className = "zone-identity";

      const device = document.createElement("span");
      device.className = "zone-device";
      device.textContent = identity.device;

      const protocol = document.createElement("span");
      protocol.className = "protocol-chip";
      protocol.textContent = identity.protocol;

      label.append(device, protocol);

      const header = card.querySelector(".zone-head");
      if (header) header.insertAdjacentElement("afterend", label);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", addIdentityLabels, { once: true });
  } else {
    addIdentityLabels();
  }
})();
