# Zone 04 — automatic MQTT broker discovery

## Purpose

The ESP8266 soil node keeps its Wi-Fi credentials and its last-known MQTT broker address. If the Windows SCADA PC receives a different LAN IP address, the node can discover the broker again without opening the WiFiManager portal or requiring a reset.

## Discovery sequence

1. The ESP8266 reconnects to the configured Wi-Fi using its saved credentials.
2. It attempts MQTT using the last-known broker IP and TCP port 1883.
3. After five consecutive MQTT connection failures, it broadcasts the UDP request:
   `IRRIGATION_MQTT_DISCOVER_V1` on UDP port 1884.
4. The SCADA Node.js process answers with the Windows PC IPv4 address on the same subnet and the MQTT TCP port:
   `IRRIGATION_MQTT_HERE_V1|<broker-ip>|1883`.
5. The ESP accepts a reply only when the advertised IPv4 address matches the UDP reply's source address and the port is 1883. It saves a changed address to LittleFS and retries MQTT.
6. If discovery has no response, it retries after 60 seconds. It does not erase Wi-Fi credentials or launch the setup portal.

## Windows PC requirements

- Mosquitto must be running and reachable on TCP port 1883.
- Start the SCADA application with `npm start`. The SCADA server starts the UDP discovery responder automatically on UDP port 1884.
- Allow inbound UDP 1884 on the Windows PC's Private network profile. Run PowerShell as Administrator:

```powershell
New-NetFirewallRule -DisplayName "Irrigation MQTT Discovery UDP 1884" -Direction Inbound -Protocol UDP -LocalPort 1884 -Action Allow -Profile Private
```

- The existing Mosquitto firewall rule must allow inbound TCP 1883.
- The ESP8266 and SCADA PC must be on the same broadcast-enabled IPv4 subnet. UDP broadcast discovery does not cross routers or VLAN boundaries.

## Configuration

Defaults are UDP discovery port 1884 and MQTT TCP port 1883. The Node.js responder supports:

- `MQTT_DISCOVERY_PORT` — UDP listen port (default 1884)
- `MQTT_PORT` — advertised MQTT TCP port (default 1883)

The ESP8266 firmware currently expects UDP 1884 and MQTT TCP 1883. If either is changed, update the firmware constants to match.

## Important boundaries

- A router/AP restart with the same SSID and password is handled by Wi-Fi reconnection; the device should not need reprovisioning.
- A changed Windows PC IP is handled by MQTT broker discovery.
- If the Wi-Fi SSID or password itself changes, the saved Wi-Fi credentials must be provisioned again; broker discovery cannot replace Wi-Fi authentication.
- The device still reports firmware mode and soil moisture. This discovery feature does not add physical valve or pump feedback.
