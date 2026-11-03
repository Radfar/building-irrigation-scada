# Zone 01 — Control Logic

**Document ID:** IWM-Z01-CTRL-001  
**Version:** 0.2  
**Status:** Integrated runtime implemented — local verification pending

## 1. Purpose

This document defines the first-pass command and status behavior for the Zone 01 simulated water-filling process. The Python command processor is a software reference implementation for later comparison with PLC implementations.

It is not a safety-rated control design and must not be used as a substitute for a site-specific risk assessment or validated machine-control system.

## 2. Operating modes

### Manual mode

Manual mode is selected when the AUTO command is false.

- A rising edge on START sets a retained manual run request.
- A rising edge on STOP clears run demand and sets a controller-owned operator-stop latch.
- While the latch is set, Manual START and automatic demand cannot run the pump.
- A rising edge on RE-ENABLE clears the latch but does not create a run request. In Manual, a fresh START edge is required.
- STOP takes priority if START and STOP arrive in the same scan.
- A held START or STOP input is not repeatedly interpreted; requests are edge-detected.
- Manual run demand does not override permissives, faults, or the high-tank stop condition.

### Automatic mode

Automatic mode is selected when AUTO is true.

- At or below the low-level setpoint (default 20%), automatic demand is set.
- At or above the high-level setpoint (default 90%), automatic demand is cleared.
- Between the thresholds, the previous automatic demand is retained. This is hysteresis.
- An operator STOP sets the persistent operator-stop latch. Automatic restart is blocked while it is set.
- RE-ENABLE clears the latch. If tank level remains at/below the low-level setpoint, automatic restart remains inhibited until level rises above the low-level setpoint and subsequently falls to it again.
- Switching to Auto clears the manual run request.
- Switching to Manual clears the automatic run request. A new manual START is required.

AUTO is a mode selection. AUTO_ACTIVE indicates that Auto is selected, the permissive is present, and neither a latched fault nor the operator-stop latch is active.

## 3. Stop and start conditions

A run demand can produce RUNNING only when all of the following are true:

- Manual or automatic run demand is present.
- The external permissive input is true.
- Tank level is below the high-level threshold.
- No latched low-flow or pump fault is active.
- The operator-stop latch is clear.

Loss of permissive, high tank level, or a fault stops the simulated pump. The command processor does not itself operate a physical output.

## 4. Operator stop latch

- STOP is edge-detected and sets the operator-stop latch in either mode.
- The latch blocks Manual and Auto run demand without setting the process FAULT status.
- RE-ENABLE is edge-detected and clears only the operator-stop latch. It is not a START command.
- STOP has priority if STOP and RE-ENABLE are sampled in the same scan.
- FAULT_RESET does not clear the operator-stop latch.
- The latch is held in controller memory only; a simulator process restart initializes it cleared. This is a software testbed behavior, not a safety-rated or nonvolatile shutdown function.

## 5. Fault handling

### Low-flow protection

When the pump is running and measured flow is below the low-flow setpoint (default 5 L/min), a timer accumulates. At 3 seconds, a low-flow fault is latched and RUNNING is cleared.

The timer resets whenever the pump is not running or flow is at/above the threshold. The latched fault remains until reset.

### Pump fault

An asserted external pump-fault condition latches the pump-fault status. The latch remains set after the input clears until a valid fault-reset request is received.

### Fault reset

FAULT_RESET is edge-detected. A reset is accepted when the external pump-fault condition is false. A low-flow trip stops the pump, so measured flow is expected to fall to zero; requiring flow recovery would make the trip impossible to reset while stopped.

A reset clears the fault latch but does not create a run request. The operator or automatic sequence must establish a new valid demand.

## 6. Status definitions

| Status | Meaning |
|---|---|
| MANUAL | AUTO selection is false |
| AUTO_ACTIVE | AUTO selected, permissive true, no latched fault |
| RUNNING | Run demand accepted and no stop/interlock/fault condition |
| PERMISSIVE | External permissive input |
| FAULT | Low-flow or pump-fault latch active |
| PUMP_FAULT | External pump-fault latch active |
| LOW_FLOW | Low-flow trip latch active |
| TANK_LOW | Tank level at/below low setpoint |
| TANK_HIGH | Tank level at/above high setpoint |
| FLOW_OK | RUNNING and flow at/above low-flow setpoint |
| PROCESS_OK | Permissive true, no fault, tank below high threshold |
| OPERATOR_STOP_LATCHED | Operator stop latch is set; RE-ENABLE is required before another run request can take effect |

RUNNING is a controller decision, not independent physical run feedback. The simulator must not represent it as proof that a real motor or pump has physically started.

## 7. Initial software interface

The Python module `src/command_processor.py` exposes:

- `ControlCommands`: sampled mode and momentary command requests.
- `ControlSetpoints`: low/high tank thresholds and low-flow threshold.
- `CommandProcessor.update()`: evaluates one scan and returns a `ControlState`.

The caller supplies process measurements, permissive state, external pump-fault condition, and elapsed scan time. The module is independent of PyModbus and the water process model.

## 8. Initial assumptions and limitations

- Default low-flow trip delay is 3 seconds.
- No start-delay, minimum-run-time, minimum-stop-time, or VFD ramp is implemented.
- The operator-stop latch is volatile and clears on simulator restart; startup retention behavior is not implemented.
- No source-low condition exists in the current register map.
- No independent physical run feedback is available. In the integrated simulator, RUN_FEEDBACK is derived from the simulated pump frequency being greater than zero; it is not independent proof from a motor contactor or VFD status input.
- The runtime validates setpoints against the current simulation ranges (pump frequency 0–50 Hz, valve 0–100%, low-flow threshold 0–100 L/min, and tank thresholds 0–100% with low below high). Invalid setpoints remove the effective permissive and force the simulated pump output off. In Manual, the invalid setpoint also clears the latched manual run request, so a fresh START is required after correction. In Auto, the level-based demand is retained and can resume when the setpoints become valid.
- The runtime reads the external permissive from the read-only DI memory location. No external pump-fault input is currently mapped; the pump-fault latch remains available for later integration.
- This is a simulation control philosophy, not a validated safety or protection function.
