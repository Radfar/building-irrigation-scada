(() => {
  "use strict";

  // Protocol identity is shown separately from process status.
  const zoneTechnology = {
    "01": { device: "Python water-process simulator", protocol: "Modbus TCP", port: "1502" },
    "02": { device: "Rockwell Micro850", protocol: "EtherNet/IP" },
    "03": { device: "CODESYS SoftPLC", protocol: "OPC UA" },
    "04": { device: "ESP8266 IoT edge", protocol: "MQTT" },
    "05": { device: "BACnet device simulator", protocol: "BACnet/IP" },
    "06": { device: "Demonstration placeholder", protocol: "Not connected" }
  };

  function addIdentityLabels() {
    document.querySelectorAll(".zone[data-zone]").forEach(card => {
      const id = card.dataset.zone;
      const identity = zoneTechnology[id];
      if (!identity || card.querySelector(".zone-identity")) return;

      const label = document.createElement("div");
      label.className = "zone-identity";
      label.innerHTML =
        '<span class="zone-device">' + identity.device + '</span>' +
        '<span class="protocol-chip">' + identity.protocol + '</span>';

      const header = card.querySelector(".zone-head");
      if (header) header.insertAdjacentElement("afterend", label);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", addIdentityLabels);
  } else {
    addIdentityLabels();
  }
})();