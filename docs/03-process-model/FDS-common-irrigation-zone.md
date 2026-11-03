# FDS-IRR-001 — Common Irrigation Zone

| Field | Value |
|---|---|
| Document ID | FDS-IRR-001 |
| Project | Industrial Water Management |
| Revision | 0.1 |
| Status | Draft for Review |
| Date | 2026-11-03 |
| Owner | Project engineering |
| Related document | [ICD-IRR-001 — Common Irrigation Zone](../04-interfaces/ICD-common-irrigation-zone.md) |
| Source basis | Testbed `docs/canonical-irrigation-zone-logic.md`; current Web SCADA repository and database observations |

## 1. Purpose

This Functional Design Specification (FDS) describes the intended functional behavior of one irrigation zone. It is intended to provide a common, vendor-neutral process definition against which the project's different implementations can be reviewed and tested.

This document defines process behavior. It does **not** select a PLC, controller family, programming language, communication protocol or SCADA product.

## 2. Scope

The specification covers one independently controlled irrigation zone with:

- a soil-moisture measurement;
- a controllable irrigation valve;
- a flow measurement;
- automatic and manual operating modes;
- operator commands and adjustable process setpoints;
- permissives, fault handling and process diagnostics;
- optional simulation inputs for development and testing.

The wider system may include shared pumps, tanks, water supply equipment and other plant-level functions. Those functions are not fully specified here and must not be assumed to be part of every zone.

## 3. Reference operating concept

The existing canonical CODESYS reference describes moisture-threshold automatic control with hysteresis:

1. At or below the low-moisture setpoint, automatic irrigation demand becomes active.
2. At or above the high-moisture setpoint, automatic irrigation demand becomes inactive.
3. Between the thresholds, the previous automatic-demand state is retained.
4. A permissive is required before the zone can run.
5. Fault, communication and simulation-enable conditions can inhibit operation.
6. A flow response and soil-moisture response are simulated in the reference implementation.

These points are source-derived from the current CODESYS reference. They are not yet approved common requirements for every existing zone.

## 4. Functional requirements — draft

| ID | Requirement | Current status |
|---|---|---|
| FREQ-001 | The zone shall provide automatic and manual operating modes. | Proposed from reference |
| FREQ-002 | In automatic mode, irrigation demand shall use low and high soil-moisture thresholds with hysteresis. | Proposed from reference |
| FREQ-003 | The zone shall accept operator Start and Stop requests. | Proposed from reference |
| FREQ-004 | The zone shall accept a Fault Reset request. | Proposed from reference |
| FREQ-005 | The zone shall only command irrigation when the required permissive conditions are satisfied. | Proposed from reference |
| FREQ-006 | The zone shall expose running state, moisture, flow and valve-position feedback. | Proposed from reference |
| FREQ-007 | The zone shall expose fault and process diagnostic status. | Proposed from reference |
| FREQ-008 | The zone shall expose sufficient status to distinguish automatic demand, operator command and actual running state. | Proposed from reference |

Requirements will receive Approved status only after comparison with the actual implementations and resolution of the open issues below.

## 5. Operating modes

### 5.1 Automatic

Automatic mode uses the moisture thresholds to determine irrigation demand.

- Moisture at or below the low setpoint: demand ON.
- Moisture at or above the high setpoint: demand OFF.
- Moisture between thresholds: retain the previous demand state.

The reference implementation updates this demand independently from the final running decision.

### 5.2 Manual

Manual mode accepts operator Start and Stop requests, subject to permissives and protective conditions.

The exact behavior of a manual Start request, its retention, and mode transitions must be confirmed against all implementations.

### 5.3 Mode transition

The required behavior when changing between Auto and Manual has not yet been fully standardized. In particular, the project must decide whether a prior automatic demand is retained, recalculated, or reset when entering Auto.

## 6. Commands and setpoints

The reference CODESYS function block contains the following command inputs:

- Start request
- Stop request
- Fault Reset request
- Auto mode selection
- Simulation enable

It also contains moisture low/high setpoints, simulated flow target and response rates, and a low-flow limit.

The command interface must distinguish momentary requests from maintained mode selections. Exact command acknowledgment, pulse duration, edge detection and write-back behavior belong in the ICD and implementation specifications.

## 7. Permissives and protective behavior

The CODESYS reference currently includes:

- a latched fault for simulated actuator or sensor faults;
- communication status;
- simulation enable;
- a permissive derived from fault, communication and enable conditions;
- inhibition of running when faulted, communication is faulted or simulation is disabled;
- fault reset only when the simulated actuator and sensor fault causes are absent.

These are reference behaviors, not yet a complete project-wide protection philosophy.

The following must be resolved before approval:

- whether loss of permissive always stops the zone;
- whether communication loss is handled locally, by the supervisory system, or both;
- whether low flow is diagnostic only or causes a trip;
- how a fault reset is acknowledged;
- whether a fault reset can clear one fault while another remains active;
- required valve state on Stop, fault, loss of communication and loss of power.

## 8. Process response and simulation

The CODESYS reference models:

- valve position as 0–100%;
- flow ramping toward a target;
- reduced flow under a simulated restriction;
- increasing soil moisture during irrigation;
- decreasing soil moisture during drying;
- a low-flow diagnostic;
- accumulated runtime.

The reference uses a 100 ms simulation tick. This is an implementation detail of that simulation and is not automatically a requirement for physical equipment or other implementations.

Simulation parameters, physical process dynamics, sensor behavior, scaling and timing require a separate review before a common simulation model is approved.

## 9. Alarms and diagnostics

The reference exposes status concepts including:

- Running and Run Feedback
- Fault
- Permissive
- Flow OK and Low Flow
- Process OK
- Commanded
- Auto Active and Manual
- Communication OK
- Simulation Active
- Total Runtime

The precise definitions, latching behavior and relationships among these statuses must be standardized. A status name alone is not sufficient to establish equivalent semantics across zones.

## 10. Open issues requiring engineering review

| ID | Open issue | Why it matters |
|---|---|---|
| OI-001 | Define the exact Stop behavior in Auto mode. | The reference says Stop wins for the current scan, but the low-moisture demand may become active again on a later scan. |
| OI-002 | Define whether low flow is an alarm, a diagnostic or a trip. | Current reference reports Low Flow and Flow OK but does not clearly latch a fault or stop the process for low flow. |
| OI-003 | Define mode-transition behavior. | Prevents different implementations retaining or resetting demand inconsistently. |
| OI-004 | Define canonical flow engineering units. | Existing database records show both L/min and gpm. |
| OI-005 | Define the relationship between Running, Run Feedback and Commanded. | These are distinct concepts and must not be treated as interchangeable. |
| OI-006 | Define valve fail position and behavior on loss of power/communications. | Required for a meaningful functional and safety review. |
| OI-007 | Confirm which diagnostics are mandatory for every zone. | Existing zone tag coverage is not uniform. |
| OI-008 | Define whether simulation faults and physical equipment faults share the same logical interface. | Keeps test controls distinct from real equipment status. |

## 11. Verification approach

The common behavior should be verified using a shared test set, independent of implementation technology. The test specification should cover at least:

- Auto demand activation at the low threshold;
- Auto demand deactivation at the high threshold;
- hysteresis in the dead band;
- Manual Start and Stop;
- Stop behavior in Auto;
- mode changes;
- permissive loss;
- sensor and actuator faults;
- communication loss;
- fault reset with cause present and cause cleared;
- low-flow response;
- valve feedback and flow response;
- runtime accumulation.

Expected results must be agreed before tests are marked as passed.

## 12. Source references and limitations

The principal source for this draft is the Testbed repository's `docs/canonical-irrigation-zone-logic.md`, which contains a CODESYS Structured Text `FB_IrrigationZone` reference implementation and a wiring example.

The Testbed decisions log states that the Rockwell comparison program was added alongside the original tank sequencer to implement the same moisture-threshold zone logic. This draft has not yet been reconciled line-by-line against the Rockwell program, CODESYS project, Python simulator, current Web SCADA drivers or all database mappings.

**Do not use this draft as an approved implementation or commissioning specification.**

## 13. Revision history

| Revision | Date | Description |
|---|---|---|
| 0.1 | 2026-11-03 | Initial draft based on existing canonical CODESYS reference and current project observations. |
