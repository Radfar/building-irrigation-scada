# 🎛️ PLC Integration Contract Specification

This document defines the strict multi-brand tag matching matrix and behavioral constraints required to scale additional automation hardware brands into the irrigation loop.

## 1. Normalized Global Variable (GVL) Tracking Scheme
Every added zone must expose global telemetry configurations mapped exactly to this layout format (where `X` represents the zone integer):

* **`ZX_START`** (BOOL, Read/Write, Pulse): Momentary activation rising edge trigger.
* **`ZX_STOP`** (BOOL, Read/Write, Pulse): Momentary cycle cancel override.
* **`ZX_FAULT_RESET`** (BOOL, Read/Write, Pulse): Reset condition clear command.
* **`ZX_AUTO`** (BOOL, Read/Write, Level): Hysteresis mode toggle (TRUE=Auto, FALSE=Manual).
* **`ZX_RUNNING`** (BOOL, Read Only): Logic engine cycle feedback tracking state.
* **`ZX_FAULT`** (BOOL, Read Only): Safety system status exception latch indicator.
* **`ZX_PERMISSIVE`** (BOOL, Read Only): System interlocking status baseline check flag.
* **`ZX_MOISTURE`** (REAL): Scaled ground feedback environment reading (%).
* **`ZX_FLOW`** (REAL): Measured continuous line pipe velocity feedback (L/min).
* **`ZX_VALVE`** (REAL): Scannable output valve physical positioning data (%).

## 2. Command Autoclear Rule
To prevent system command bits from sticking `TRUE` due to communication lag, the PLC application must process incoming pulses via an execution check loop and drop the variable state instantly inside its active scan path:

```pascal
IF ZX_START THEN 
    ZX_START := FALSE; 
END_IF;
```