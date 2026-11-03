# Zone 01 — Water Process Model

**Document ID:** IWM-Z01-PROC-001  
**Version:** 0.1  
**Status:** Process equations defined; Python process model implemented independently of Modbus

## 1. Purpose

This document defines the first simulated process for Zone 01. A pump transfers water from an assumed source reservoir into a storage tank through a control valve. It supports PLC, SCADA, Modbus, and HMI development; it is not a hydraulic design or pump-selection calculation.

## 2. Process arrangement

Water source → P-01 pump/VFD → FT-01 flow measurement → XV-01 control valve → storage tank with LT-01 level measurement.

The source reservoir is assumed to have sufficient water. Source-low protection is not modelled because the current Zone 01 register map has no source-level measurement.

## 3. Model parameters

| Parameter | Default | Unit |
|---|---:|---|
| Tank capacity | 10,000 | L |
| Maximum pump frequency | 50 | Hz |
| Maximum flow | 100 | L/min |
| Rated pump current | 10 | A |
| Initial tank level | 75 | % |

The intended controller scan interval is 500 ms. The model accepts elapsed time from its caller.

## 4. Equations

### 4.1 Pump speed

Pump speed (%) = pump frequency / 50 × 100.

### 4.2 Flow

Flow (L/min) = maximum flow × frequency / maximum frequency × valve opening / 100.

This is a linear approximation. A real centrifugal pump requires its pump curve and system curve; valve characteristics are also nonlinear.

### 4.3 Tank level

Added volume (L) = flow (L/min) × elapsed time (s) / 60.

Level increase (%) = added volume / tank capacity × 100.

Tank level is constrained to 0–100%. There is no tank outflow in this first model; a future extension can add a demand/outflow term.

### 4.4 Pump current

Current (A) = rated current × frequency / maximum frequency.

This is an illustrative linear indication, not an electrical motor model.

## 5. Model boundaries

- The model calculates measurements only; it does not interpret Modbus commands.
- The model does not decide whether a pump start is permitted.
- Automatic level control and fault handling are not implemented here.
- The valve actuator is instantaneous.
- Pump acceleration/deceleration ramps are not modelled.
- The source reservoir is assumed available.
- A full tank clamps the simulated level at 100%; controller/interlock logic must stop the pump.
- A pump running against a closed valve produces zero flow; low-flow protection is a separate controller function.

## 6. Python interface

WaterProcessModel.step() accepts pump_running, pump_frequency_setpoint_hz, valve_position_setpoint_percent, and elapsed_seconds.

It returns an immutable ProcessMeasurements snapshot containing tank level, flow, pump frequency, pump speed, valve position, and pump current.

The module has no PyModbus dependency and can be unit-tested without starting the TCP server.

## 7. Verification

Run:

```powershell
python -m unittest discover -s tests -v
```

Tests cover initial state, flow calculation, valve influence, stopped-pump behavior, tank accumulation, tank-level clamping, and input validation.
