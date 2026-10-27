# Industrial Water Management — Common Foundation Contract

**Document ID:** IWM-CFC-001  
**Version:** 0.2  
**Status:** Draft for review  
**Date:** 2026-10-27

> This contract preserves the existing common water-process model. It defines requirements; it does not claim proposed behavior is implemented or tested.

## 1. Purpose and scope

Use one logical water-process model across controller platforms and expose it consistently to Node.js Web SCADA, Ignition, and the data platform. Native tags and protocols may differ, but process semantics must not.

- **Zone 01 — Siemens S7-1500/G120X:** set aside for this workstream.
- **Zone 02 — Rockwell Micro850/Micro800:** next design target after contract review. Verify actual simulator connectivity and tag access; do not assume OPC UA support. Project notes indicate a working CCW `-SIM` controller and Node-RED CIP tag access.
- **Zone 03 — CODESYS SoftPLC:** reference process model and current OPC UA integration.
- **Zone 04 — moisture data:** current Node.js endpoint reads the latest moisture value from PostgreSQL; this is a database-backed path, not proof of live source connectivity.

## 2. Canonical zone model — preserve the established structure

```text
ZONE
├── Commands
│   ├── AUTO
│   ├── START
│   ├── STOP
│   └── FAULT_RESET
├── Feedback
│   ├── RUN_FEEDBACK
│   ├── VALVE
│   ├── FLOW
│   ├── MOISTURE
│   ├── FAULT
│   └── LOW_FLOW
├── Status
│   ├── PERMISSIVE
│   ├── RUNNING
│   ├── MANUAL
│   ├── AUTO_ACTIVE
│   ├── FLOW_OK
│   └── PROCESS_OK
├── Diagnostics
│   ├── COMM_OK
│   └── zone-specific diagnostics
└── Setpoints
    ├── MOISTURE_LOW_SP
    └── MOISTURE_HIGH_SP
```

These are the logical groups and meanings already established in project notes. Do not rename or replace them merely for UI convenience.

Zone 03 additionally has simulation controls and parameters, including `SIM_ENABLE`, flow target/rate, moisture/dry rates, low-flow limit, restriction, and injected sensor/actuator/communication faults. These are simulation extensions, not mandatory tags for every physical zone. Existing Zone 03 extensions such as `SIM_ACTIVE` and `TOTAL_RUNTIME_SEC` should remain unless a versioned change is agreed.

## 3. Common field semantics

| Field | Meaning and constraint |
|---|---|
| `AUTO` | Auto mode request/selection; not proof that Auto control is active |
| `START` | Momentary start request; not running feedback |
| `STOP` | Momentary stop request; agreed Zone 03 behavior will add a controller-owned latch behind this request |
| `FAULT_RESET` | Momentary reset request; must not clear the operator-stop latch |
| `RUN_FEEDBACK` | Source run indication; currently mirrors `RUNNING` in the Zone 03 simulation, not independent physical feedback |
| `RUNNING` | Controller running state, distinct from a command |
| `VALVE` | Valve position in percent; physical feedback availability is zone-dependent |
| `FLOW` | Flow value; Zone 03 currently uses L/min |
| `MOISTURE` | Moisture value; Zone 03 currently uses percent |
| `FAULT` | Zone fault indication; document whether it is active, latched, or aggregated |
| `LOW_FLOW` | Low-flow diagnostic in current Zone 03 logic; not currently a trip |
| `PERMISSIVE` | Controller indication that operating conditions permit action |
| `MANUAL` | Manual mode status, semantically consistent with `AUTO` |
| `AUTO_ACTIVE` | Automatic control is active, not merely selected |
| `FLOW_OK` | Flow meets the configured rule; threshold/evaluation must be documented |
| `PROCESS_OK` | Aggregate process status as implemented; do not assume it equals `COMM_OK` |
| `COMM_OK` | Communication diagnostic; the monitored connection must be identified |
| `MOISTURE_LOW_SP`, `MOISTURE_HIGH_SP` | Moisture hysteresis setpoints, in percent in Zone 03 |

Each native implementation must document data type, unit, access, and mapping. Keep common semantics consistent while allowing vendor-specific native names.

## 4. Zone 03: existing behavior and agreed change

### Existing behavior from reviewed source
- `GVL_SCADA` exposes Zone 03 commands, feedback, status, simulation parameters, fault-injection inputs, and moisture setpoints.
- `PLC_PRG` calls one `FB_IrrigationZone` instance and maps its inputs/outputs to `GVL_SCADA`.
- `PLC_PRG` clears `Z03_START`, `Z03_STOP`, and `Z03_FAULT_RESET` after the function block processes the scan.
- Automatic demand uses low/high moisture setpoint hysteresis.
- `Z03_RUN_FEEDBACK` mirrors the internal running state in the simulation.
- The simulation updates nominally every 100 ms; the Node.js OPC UA client polls nominally every 1,000 ms.

### Agreed behavior change — not yet implemented
The selected Stop behavior is **latched operator stop**:
1. A valid `STOP` request sets a controller-owned stop latch.
2. While latched, neither Manual Start nor automatic moisture demand may cause operation.
3. Automatic demand cannot clear the latch or restart the process.
4. `FAULT_RESET` does not clear the stop latch.
5. A separate explicit Re-enable action is required to release the latch.
6. Re-enable is not itself Start. After re-enable, Auto may start if selected, demand exists, and all permissives are satisfied; this must be indicated to the operator and tested.
7. Restart/power-loss behavior must prevent unexpected restart. Persistence versus startup-inhibit remains to be decided.

Do not document a Re-enable tag or API command as existing; it is a planned addition. The operational stop latch is not a substitute for a safety-rated emergency-stop function.

## 5. Common command and integration principles

- The controller owns mode logic, automatic demand, permissives, interlocks, stop inhibition, fault logic, and authoritative state.
- HMI/backend checks improve usability but do not replace controller validation.
- Command requests, controller state, and feedback remain distinct.
- An OPC UA write success does not prove controller acceptance or execution.
- Multi-client commands must be coordinated deterministically.
- SMS/cloud/database access must not be required for local control or bypass controller interlocks.
- The reviewed API currently supports `start`, `stop`, `faultReset`, `auto`, and `manual` through `POST /api/zone3/command`. Re-enable and command acknowledgements are not evidenced as implemented.

## 6. Common data representation

Where available, normalized points should include zone/equipment ID, value/type, unit, source system/protocol, source timestamp, receive timestamp, quality, freshness/age, and read/write classification. Unknown quality must remain unknown rather than being silently treated as good.

Existing paths:
- Zone 03: CODESYS OPC UA → Node.js in-memory cache → Web SCADA/API.
- Zone 04 moisture: PostgreSQL latest `tag_values` row → Node.js `/api/zone4`.
- PostgreSQL history must not be confused with live controller state.
- Zone 03's current API does not fully expose per-tag quality/freshness.
- Preserve existing routes and response fields where practical; coordinate and document schema changes.

## 7. Web SCADA and Ignition

Both clients consume the same normalized model. The same semantics should support a reusable Ignition Zone UDT/faceplate and the existing Node.js HTML/CSS/JavaScript Web SCADA. Native source tags may differ; the mapping must not.

Display mode, running state, permissive, fault, low-flow status, and communications/data quality as distinct concepts. Label simulated, live, database/history, stale, and unavailable values distinctly. Add Stop-latch/Re-enable UI only after controller behavior is implemented.

## 8. Security and resilience

Before production or untrusted-network use: authenticate clients, authorize writes, restrict CORS, use secure transport and suitable OPC UA security/certificates, segment OT networks, define reconnect/stale-data/shutdown/restart behavior, and audit command outcomes. The reviewed OPC UA client uses anonymous access with `MessageSecurityMode.None` and `SecurityPolicy.None`; treat this as isolated-lab configuration only.

## 9. Acceptance tests — all initially Not Run

| ID | Test | Acceptance criterion | Status |
|---|---|---|---|
| CF01 | Model preservation | Existing canonical groups/semantics remain mapped in Zone 03 | Not Run |
| CF02 | Stop in Auto | Stop latch inhibits operation despite Auto demand | Not Run |
| CF03 | Demand while stopped | Low moisture cannot restart while latch is set | Not Run |
| CF04 | Re-enable | Explicit accepted Re-enable releases latch but does not itself Start | Not Run |
| CF05 | Fault reset separation | Fault Reset does not release operator stop | Not Run |
| CF06 | Start while inhibited | Controller inhibits Start while latch/blocking condition is active | Not Run |
| CF07 | Command outcome | API distinguishes write submission from controller acceptance/completion | Not Run |
| CF08 | Communications loss | Local control remains defined; remote data becomes stale/unavailable appropriately | Not Run |
| CF09 | Restart recovery | No unexpected restart after restart/power recovery | Not Run |
| CF10 | Data quality | Bad, missing, and stale values differ from good current values | Not Run |
| CF11 | Multi-client consistency | Web SCADA and Ignition converge on authoritative state | Not Run |
| CF12 | Zone 02 mapping | Micro850/Micro800 maps into the same model through a verified connection | Not Run |

A test is Pass only after execution evidence is recorded.

## 10. Implementation order

1. Review and accept this contract.
2. Keep Zone 01 Siemens on hold.
3. Design Zone 02 against this model; verify simulator connectivity and tag types before choosing its adapter.
4. Keep Zone 03 as the reference and implement the agreed Stop-latch change separately.
5. Improve Node.js command acknowledgement and data quality without silently breaking API consumers.
6. Map Zone 02 to the common model and verify equivalent semantics.
7. Update both HMIs after controller and adapter behavior are verified.

## 11. Change control and open decisions

Changes to common field meanings, units, types, or command semantics require impact review across all zones and clients. Zone-specific simulation parameters may remain extensions.

Still to decide/verify: exact status encodings; stop-latch retention/startup-inhibit strategy; multi-client arbitration; freshness thresholds; authentication/certificate/network design; and physical equipment feedback, trips, and safety requirements.

**Baseline statement:** Version 0.2 preserves the existing process model and records the agreed Zone 03 Stop-latch change as future work. It does not claim implementation, test passes, or production readiness.
