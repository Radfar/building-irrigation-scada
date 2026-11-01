# Learning Journal — Industrial Water Management Web SCADA

> Engineering notebook for the browser-based SCADA/HMI and multi-protocol water-management testbed. It records architecture decisions, integration patterns, commissioning evidence, troubleshooting and future learning tasks. It is written for both project continuity and other engineers studying industrial IT/OT integration.

## 1. Project purpose and scope

This project explores how different controller and edge-device technologies can be integrated into one supervisory application through protocol-specific backend drivers and a common observation model.

The application is a custom Web SCADA prototype:
- Browser HMI: HTML, CSS and vanilla JavaScript.
- Backend integration layer: Node.js and Express.
- Historian/configuration database: PostgreSQL.
- Controller and edge connectivity: EtherNet/IP, OPC UA, MQTT and BACnet/IP.

It is a development and simulation testbed, not a production-ready or safety-certified SCADA system.

## 2. Core architecture principle

The browser HMI should not implement PLC-specific protocol logic. The Node.js backend owns protocol sessions, polling, command validation, data normalization and API exposure.

```text
Controllers / edge devices / protocol simulators
                 |
        Protocol-specific drivers
                 |
        Normalized observations
                 |
         Node.js / Express API
            /           \
       Browser HMI    PostgreSQL
```

Each driver translates its source protocol into the same supervisory data shape. This reduces coupling between the HMI and individual PLC vendors.

### Normalized observation contract

The project uses a common observation structure with these fields:

| Field | Purpose |
|---|---|
| `tagName` | Stable SCADA tag identifier |
| `value` | Current value |
| `engineeringUnit` | Unit displayed and interpreted by the HMI |
| `sourceSystemId` | Identity of the source controller/device |
| `protocol` | Source protocol, e.g. EtherNet/IP, OPC UA, MQTT or BACnet/IP |
| `sourceTimestamp` | Timestamp supplied by the source, when available |
| `receivedTimestamp` | Time the SCADA backend received the value |
| `quality` | Data-quality state such as GOOD, UNCERTAIN or BAD |
| `qualityReason` | Machine-readable explanation when quality is not GOOD |

Do not confuse a successful network connection with valid process data. A driver should consider communication state, value validity and data freshness when assigning quality.

## 3. Zone integration map

| Zone | Source | Protocol / driver | Responsibility |
|---|---|---|---|
| Zone 02 | Rockwell Micro850 | EtherNet/IP / `server/drivers/micro800/zone02.js` | PLC tag polling and whitelisted commands |
| Zone 03 | CODESYS Control Win | OPC UA / `server/opcua.js` | Browse and poll PLC variables; write approved commands |
| Zone 04 | ESP8266 soil node | MQTT / `server/mqtt.js` | Telemetry, device status, command and acknowledgement |
| Zone 05 | Independent BACnet device simulator | BACnet/IP / `server/drivers/bacnet/zone05.js` | Analog/binary monitoring and commandable BO objects |

The zones are independent technology demonstrations inside one supervisory HMI. They are not a claim that a real irrigation plant should use four vendors or protocols in the same installation.

## 4. Protocol integration notes

### Zone 02 — EtherNet/IP / Rockwell Micro850

- Driver uses the `st-ethernet-ip` Node.js library.
- Polling is configured at approximately one-second intervals.
- Requests are serialized to avoid overlapping operations.
- Commands use an explicit whitelist.
- Start, Stop and Fault Reset are momentary commands; Auto and Simulation Enable are level commands.
- Start checks the permissive before the command is accepted.

Learning focus: distinguish cyclic data acquisition from explicit message writes; understand controller tag paths, connection lifecycle, timeouts and reconnection behavior.

### Zone 03 — OPC UA / CODESYS

- Backend endpoint in the current implementation: `opc.tcp://127.0.0.1:4840`.
- The client browses the `GVL_SCADA` variable group and polls discovered values.
- Start, Stop and Fault Reset are pulsed; AUTO is a held Boolean.
- PLC-side logic remains responsible for the process sequence and interlocks.

Learning focus: endpoint discovery, certificates/trust, security policy, anonymous versus authenticated sessions, namespace indexes, browse paths, NodeIds, read/write permissions and subscription versus polling.

Security note: the current testbed has used SecurityPolicy None with an anonymous session. Treat this as a lab-only configuration and do not expose it to untrusted networks.

### Zone 04 — MQTT / ESP8266 IoT edge

Data path:

```text
ESP8266 -> MQTT broker -> Node.js MQTT client
                         |-> live state / REST API
                         |-> PostgreSQL historian
```

Topics used by the current firmware integration:
- `zone4/soil01/data`
- `zone4/soil01/status`
- `zone4/soil01/command`
- `zone4/soil01/command_result`

The backend validates moisture values (0–100), updates live state and stores valid readings. A freshness threshold can mark live data UNCERTAIN. UDP broker discovery is limited to the local broadcast-enabled IPv4 subnet; it does not cross routers or VLANs.

Learning focus: MQTT publish/subscribe, topic design, payload validation, retained messages, QoS, Last Will and Testament, reconnect behavior, command acknowledgement and edge-device identity.

### Zone 05 — BACnet/IP / independent simulator

The simulator is maintained separately in [bacnet-device-simulator](https://github.com/Radfar/bacnet-device-simulator). It listens on UDP 47809 in the development environment. The SCADA driver polls four Analog Inputs, two Binary Inputs and the AUTO-mode Binary Output.

- Driver location: `server/drivers/bacnet/zone05.js`.
- Device instance: 10005.
- Simulator endpoint default: `192.168.186.224:47809`.
- Client local UDP port default: 47810.
- Poll interval default: 1000 ms.
- Command priority: 8.
- API: `GET /api/zone05` and `POST /api/zone05/command`.

AUTO/MANUAL is a held BO1 state. START, STOP and FAULT_RESET are action requests written ACTIVE and then cleared after a short pulse. The simulator interprets the active transition as the command; clearing the BO slot does not reverse the process action.

Learning focus: BACnet Device and object model, object type/instance identifiers, Present_Value, Object_List, ReadProperty, ReadPropertyMultiple, WriteProperty, Binary Output priority arrays, Relinquish_Default, NULL relinquishment, Who-Is/I-Am and BACnet/IP UDP addressing.

See the simulator repository's learning journal for YABE commissioning details, object mapping and protocol-level troubleshooting.

## 5. Data quality and historian design

A value is not useful to a supervisory system unless its context is known. The normalized contract separates the value from its source, unit, receipt time and quality.

Practical interpretation:
- GOOD: the latest acquisition succeeded and the value passed the driver's validation.
- UNCERTAIN: a value exists but freshness or validity cannot currently be guaranteed.
- BAD: the source is unavailable or the driver cannot provide a trustworthy current value.

The exact quality policy should be defined per driver and documented with its timeout and stale-data thresholds. Do not silently present an old value as current after communication loss.

PostgreSQL stores equipment/tag configuration and historical readings. Validate database writes independently from live HMI updates: a value appearing in the HMI does not by itself prove that historian insertion succeeded.

## 6. API and HMI boundary

The browser consumes REST endpoints and does not open EtherNet/IP, OPC UA, MQTT or BACnet sessions directly. This separation:
- keeps protocol libraries out of the browser;
- centralizes command whitelists and validation;
- allows a consistent HMI across different controller vendors;
- gives the backend one place to normalize values and quality;
- makes it possible to replace a simulator with a real controller without redesigning the HMI, provided the tag contract remains stable.

For new zones, add a protocol driver and API route rather than embedding protocol-specific code in the HMI.

## 7. Commissioning and regression strategy

Commission each layer separately before testing the full system.

1. **Source/device test:** verify the PLC runtime or simulator independently.
2. **Protocol test:** use the vendor tool or protocol explorer to read values and issue controlled writes.
3. **Driver test:** verify connection state, polling, values, units, command validation and timeout behavior.
4. **API test:** inspect the endpoint response and confirm quality metadata.
5. **HMI test:** verify displayed values, units, status and operator feedback.
6. **Historian test:** confirm valid samples are stored with the correct tag and timestamp.
7. **Regression test:** run all zones together and verify that one unavailable source does not stop unrelated drivers.

### Zone 05 evidence recorded

The development sequence included YABE discovery and property tests, then SCADA API/HMI integration. The Zone 05 endpoint was observed returning seven observations with GOOD quality during a successful communication session. AUTO/MANUAL, START and STOP were exercised. The user subsequently reported a combined test of Zones 02, 03, 04 and 05 as successful.

This evidence should be extended with repeatable tests for simulator shutdown/recovery, stale-data quality, invalid commands, fault injection and sustained operation. Do not interpret one successful combined run as a load, cybersecurity or safety validation.

## 8. Troubleshooting framework

| Layer | Questions to ask |
|---|---|
| Physical / virtual network | Are the hosts on reachable subnets? Is the correct interface active? Are firewall rules and UDP/TCP ports correct? |
| Protocol | Does an independent client read the source? Are object/tag identifiers and data types correct? |
| Driver | Is polling serialized? Are timeouts and reconnects handled? Are errors visible without flooding logs? |
| Data contract | Are units, source identity, timestamps and quality mapped correctly? |
| API | Does the route return the expected schema and status code? |
| HMI | Is stale data visibly distinguished from live data? Are controls disabled or explained when unavailable? |
| Historian | Are samples inserted once, with correct tag identity and timestamps? |
| Security | Are credentials, certificates, network boundaries and command authorization appropriate? |

For VMware-based BACnet testing, confirm the simulator VM's current IP address. A DHCP change can invalidate the SCADA driver's configured address even while the simulator itself is running normally.

## 9. Engineering limitations

The current repository is a prototype and has important limitations:
- OPC UA SecurityPolicy None and anonymous access have been used in the lab.
- Express CORS is open and operator authentication/authorization is not implemented.
- MQTT uses an unauthenticated, unencrypted private-LAN setup.
- Zone 04 valve and flow behavior is simulated; the ESP8266 LED is not physical valve feedback.
- Zone 05 is a software simulator, not a physical BACnet controller.
- No production safety certification, cybersecurity assessment, performance qualification or field commissioning is claimed.

Before real deployment, define threat boundaries, authenticate operators and devices, use secure protocol configurations, validate fail-safe behavior, segment networks, harden hosts and verify controller-level safety interlocks.

## 10. Reusable checklist for adding another zone

- Define the process and the source-device boundary.
- Decide whether the source is a physical controller, edge device or simulator.
- Document the protocol endpoint, addressing and ports.
- Define tag names, data types, engineering units and read/write access.
- Implement a dedicated backend driver.
- Normalize observations to the shared contract.
- Add a command whitelist with explicit level-versus-pulse semantics.
- Define timeout, stale-data and reconnect behavior.
- Expose a REST endpoint.
- Add HMI indication for value, unit, quality, mode and command feedback.
- Test the source independently, then driver, API, HMI, historian and all-zone regression.
- Document known limitations and exact test evidence.

## 11. Next experiments

1. Add automated integration tests for driver connection loss and recovery.
2. Verify historian continuity and quality handling for every protocol.
3. Evaluate OPC UA subscriptions against one-second polling.
4. Add BACnet fault injection and test alarm/reset behavior end-to-end.
5. Add authentication, role-based command authorization and secure transport.
6. Introduce a shared driver lifecycle and health-status interface.
7. Add timestamps and source-quality handling consistently across all drivers.
8. Measure polling load and response latency with all zones active.

## References

- [OPC Foundation](https://opcfoundation.org/)
- [ODVA — EtherNet/IP](https://www.odva.org/)
- [ASHRAE — BACnet](https://www.ashrae.org/technical-resources/bookstore/bacnet)
- [OASIS — MQTT](https://www.oasis-open.org/standards/)
- [PostgreSQL documentation](https://www.postgresql.org/docs/)
- [Node.js documentation](https://nodejs.org/docs/)

---
*Keep this journal factual and version-aware. When a test is performed, record the date, software version, setup, expected result, actual result and any deviation. Update the main README when the architecture or supported integrations change.*
