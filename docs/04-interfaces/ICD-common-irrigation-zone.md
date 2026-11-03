# ICD-IRR-001 — Common Irrigation Zone

| Field | Value |
|---|---|
| Document ID | ICD-IRR-001 |
| Project | Industrial Water Management |
| Revision | 0.1 |
| Status | Draft for Review |
| Date | 2026-11-03 |
| Owner | Project engineering |
| Related document | [FDS-IRR-001 — Common Irrigation Zone](../03-process-model/FDS-common-irrigation-zone.md) |

## 1. Purpose

This Interface Control Document (ICD) defines the logical information exchanged by a common irrigation-zone function and the systems that monitor or command it.

The ICD is intentionally separated from the selection of a physical controller or communication protocol. A logical signal definition remains stable even when its transport mapping changes.

## 2. Interface boundaries

The common zone has the following logical interface boundaries:

1. **Operator/supervisory to zone:** mode selection, commands and setpoints.
2. **Sensors/process to zone:** moisture, flow and equipment feedback.
3. **Zone to supervisory system:** process values, operating status and diagnostics.
4. **Engineering/simulation to zone:** optional simulation controls and injected fault conditions.

A particular implementation may combine or distribute these boundaries across PLC variables, remote I/O, software objects, protocol registers or messages. Such mappings must be documented separately.

## 3. Logical signal catalogue — draft

The following catalogue is derived from the CODESYS reference function block. It is a logical design inventory, not an approved universal tag list.

### 3.1 Commands and mode

| Logical signal | Direction | Type | Meaning | Notes |
|---|---|---|---|---|
| Command Start | Input | Boolean | Request zone start | Momentary request in reference |
| Command Stop | Input | Boolean | Request zone stop | Momentary request in reference |
| Command Fault Reset | Input | Boolean | Request fault reset | Momentary request in reference |
| Auto | Input | Boolean | Select automatic mode | TRUE = Auto in reference |
| Simulation Enable | Input | Boolean | Enable simulation operation | Not necessarily applicable to physical implementation |

### 3.2 Process measurements and setpoints

| Logical signal | Direction | Type | Engineering unit | Meaning |
|---|---|---|---|---|
| Moisture | Input / process value | REAL | % | Soil moisture |
| Flow | Input / process value | REAL | TBD | Irrigation flow |
| Valve Position | Output / feedback | REAL | % | Valve position, 0–100 in reference |
| Moisture Low Setpoint | Input | REAL | % | Low threshold |
| Moisture High Setpoint | Input | REAL | % | High threshold |
| Flow Target | Input | REAL | TBD | Simulated target flow |
| Low Flow Limit | Input | REAL | TBD | Low-flow threshold |

The flow unit is deliberately marked TBD. Existing project records use both L/min and gpm; the project must select and document a canonical engineering unit and conversion policy before approval.

### 3.3 Status and diagnostics

| Logical signal | Direction | Type | Meaning |
|---|---|---|---|
| Running | Output | Boolean | Internal zone running state |
| Run Feedback | Output | Boolean | Running feedback in reference |
| Fault | Output | Boolean | Latched fault status in reference |
| Permissive | Output | Boolean | Conditions allow operation |
| Flow OK | Output | Boolean | Flow validation status |
| Process OK | Output | Boolean | Combined process status in reference |
| Commanded | Output | Boolean | Run command is permitted in reference |
| Auto Active | Output | Boolean | Automatic control is active |
| Manual | Output | Boolean | Manual mode indicator |
| Low Flow | Output | Boolean | Low-flow condition |
| Communication OK | Output | Boolean | Communication fault mirror in reference |
| Simulation Active | Output | Boolean | Simulation enable mirror |
| Total Runtime | Output | UDINT | Accumulated runtime, seconds |

The exact definitions and required/optional status of these signals remain subject to FDS review.

## 4. Data representation rules

The following are proposed interface rules:

- Boolean signals shall represent two-state logical values; transport-specific encodings must be documented.
- REAL process values shall include an engineering unit, valid range, precision and scaling definition.
- Commands shall identify whether they are momentary requests or maintained states.
- Every measurement exposed to SCADA should have a defined source, timestamp behavior and data-quality interpretation.
- A missing or stale measurement must not be silently represented as a valid zero.
- Protocol-specific byte order, register addressing, object identifiers, namespaces, topic names and payload formats belong in the relevant protocol mapping document.

These rules require review before becoming approved project standards.

## 5. Naming and canonical identity

The project currently uses zone-prefixed tag names such as:

- `Z02_MOISTURE`
- `Z02_FLOW`
- `Z02_VALVE`
- `Z03_MOISTURE`
- `Z03_FLOW`
- `Z03_VALVE`

These names are observed in the current project registry and implementation documentation. They are not yet a complete canonical tag standard.

The final tag registry should define, for each tag:

- stable tag identifier and canonical name;
- owning zone and equipment;
- description;
- data type;
- engineering unit;
- direction and source;
- valid range and scaling;
- historian policy;
- quality and freshness policy;
- protocol-specific mapping, where applicable.

Equipment-level telemetry (for example pump frequency, pump speed, tank level and valve actuator diagnostics) should be distinguished from the common zone process interface. Equipment tags must not be treated as substitutes for zone-level contract signals.

## 6. Protocol mapping register

No controller or protocol is selected by this document. Record a mapping only after it is chosen and verified.

| Logical signal | Zone implementation | Protocol/interface | Address or identifier | Status |
|---|---|---|---|---|
| Moisture | To be reconciled per zone | Not fixed by this ICD | TBD | Open |
| Flow | To be reconciled per zone | Not fixed by this ICD | TBD | Open |
| Valve Position | To be reconciled per zone | Not fixed by this ICD | TBD | Open |
| Commands | To be reconciled per zone | Not fixed by this ICD | TBD | Open |
| Status/diagnostics | To be reconciled per zone | Not fixed by this ICD | TBD | Open |

Protocol mapping documents may be maintained separately for OPC UA, EtherNet/IP, MQTT, BACnet/IP, Modbus TCP or another interface actually adopted by the project.

## 7. Historian and SCADA considerations

The Web SCADA application currently uses a shared PostgreSQL `tags` registry and `tag_values` history table. The interface contract must distinguish:

- the logical process signal;
- its live source and acquisition method;
- the normalized SCADA tag;
- the database tag record;
- the historian sampling or event policy.

The existing database is not yet a fully uniform implementation of this draft. Current observations include nonuniform tag coverage and mixed flow units. Do not create or rename database tags solely to match this draft until the registry and drivers have been reconciled.

## 8. Interface verification checklist

For each implemented signal, verify:

- name and description;
- source and destination;
- direction;
- data type;
- engineering unit;
- range and scaling;
- update rate and timestamp semantics;
- quality and stale-data behavior;
- command semantics, where applicable;
- protocol address/topic/object mapping;
- SCADA normalization;
- historian registration and persistence behavior.

## 9. Open issues

1. Approve canonical signal names and distinguish logical names from vendor-specific variable names.
2. Select canonical flow unit and define conversions for existing zones.
3. Define mandatory versus optional diagnostics.
4. Define command acknowledgment and pulse/retention behavior.
5. Define timestamp, quality and stale-data requirements.
6. Reconcile each existing zone's actual mappings with the logical catalogue.
7. Define how equipment-level telemetry relates to zone-level signals without conflating the two.

## 10. Source references and limitations

This draft is based on the CODESYS `FB_IrrigationZone` interface in the Testbed repository's `docs/canonical-irrigation-zone-logic.md`, observed tag names in the Web SCADA repository and the user's PostgreSQL query results.

The catalogue is not yet verified against every PLC project, backend driver, API response, HMI binding or database migration. No controller or protocol selection is implied.

## 11. Revision history

| Revision | Date | Description |
|---|---|---|
| 0.1 | 2026-11-03 | Initial logical interface draft. |
