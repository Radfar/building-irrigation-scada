# Zone 01 — Modbus TCP Register Map

**Document ID:** IWM-Z01-MODBUS-001  
**Version:** 0.3  
**Status:** Runtime integration implemented — local verification pending

## 1. Purpose

This document defines the Modbus TCP data interface for the Industrial Water Management testbed. The Python application simulates a water process and exposes commands, status, setpoints, and measurements to independent Modbus TCP clients, including the Node.js Web SCADA and Ignition.

The register map is a protocol representation of the Zone 01 logical process model. It does not replace the common process contract.

## 2. Connection parameters

| Parameter | Initial value |
|---|---|
| Protocol | Modbus TCP |
| Development host | 127.0.0.1 |
| TCP port | 1502 |
| Unit ID | 1 |
| Register width | 16 bits |
| Register encoding | Unsigned integer |
| Default analog scaling | Engineering value × 10 |

The server binds to loopback by default. Port 1502 avoids requiring elevated privileges for conventional TCP port 502. Do not expose this development simulator to an untrusted network.

## 3. Addressing convention

The tables show both the zero-based Modbus PDU offset and conventional reference notation.

**Use the zero-based PDU offset in software APIs unless a client explicitly asks for a 0xxxx/1xxxx/3xxxx/4xxxx reference number.** Client configuration terminology differs: some drivers display a reference number, while others ask for a zero-based offset.

The four Modbus data areas are independent. For example, coil offset 0 and holding-register offset 0 are different addresses in different data areas.

## 4. Coils — commands and mode (0xxxx)

Coils are read/write Boolean values.

| PDU offset | Reference | Signal | Access | Meaning |
|---:|---:|---|---|---|
| 0 | 00001 | `Z01_AUTO` | R/W | Mode selection: 1 = Auto, 0 = Manual |
| 1 | 00002 | `Z01_START` | R/W | Start request |
| 2 | 00003 | `Z01_STOP` | R/W | Stop request |
| 3 | 00004 | `Z01_FAULT_RESET` | R/W | Fault-reset request |
| 4 | 00005 | `Z01_REENABLE` | R/W | Explicitly release the latched operator stop; does not issue START |

### Runtime behavior

- `AUTO` is a maintained selection; it is not proof that automatic control is active.
- The runtime samples START, STOP, FAULT_RESET, and RE-ENABLE once per scan, then clears those request coils. AUTO remains set until the client changes it.
- STOP sets a controller-owned operator-stop latch. While latched, Manual START and automatic demand cannot run the pump.
- RE-ENABLE clears the stop latch but does not create a Manual run request. In Auto, if the tank is still at/below the low-level threshold, automatic restart remains inhibited until the level rises above that threshold and subsequently falls to it again.
- STOP has priority over RE-ENABLE if both requests are sampled in the same scan. FAULT_RESET does not clear the operator-stop latch.
- The command processor detects rising edges and applies the documented control philosophy.
- A successful Modbus write confirms protocol-level write handling only. Read the status and feedback bits to determine whether the request was accepted and what the simulated process did.

## 5. Discrete inputs — status and feedback (1xxxx)

Discrete inputs are read-only Boolean values.

| PDU offset | Reference | Signal | Meaning |
|---:|---:|---|---|
| 0 | 10001 | `Z01_RUN_FEEDBACK` | Simulated run feedback |
| 1 | 10002 | `Z01_RUNNING` | Controller process-running state |
| 2 | 10003 | `Z01_FAULT` | Aggregated zone fault |
| 3 | 10004 | `Z01_PERMISSIVE` | Conditions permit operation |
| 4 | 10005 | `Z01_MANUAL` | Manual mode status |
| 5 | 10006 | `Z01_AUTO_ACTIVE` | Automatic control is actually active |
| 6 | 10007 | `Z01_FLOW_OK` | Flow satisfies the configured evaluation rule |
| 7 | 10008 | `Z01_LOW_FLOW` | Low-flow diagnostic |
| 8 | 10009 | `Z01_PROCESS_OK` | Aggregate process status |
| 9 | 10010 | `Z01_PUMP_FAULT` | Simulated pump fault |
| 10 | 10011 | `Z01_TANK_LOW` | Tank low-level condition |
| 11 | 10012 | `Z01_TANK_HIGH` | Tank high-level condition |
| 12 | 10013 | `Z01_VALVE_OPEN_FB` | Valve-open status derived from simulated position |
| 13 | 10014 | `Z01_OPERATOR_STOP_LATCHED` | Controller-owned operator stop latch; cleared only by RE-ENABLE |

At startup, `Z01_PERMISSIVE` is initialized true. The runtime then publishes calculated status on each scan. `RUN_FEEDBACK` is derived from simulated pump frequency greater than zero; it is not independent physical feedback. The `PERMISSIVE` reports the external permissive input. Setpoint validity is evaluated separately as an additional internal run condition; invalid setpoints block operation and make `PROCESS_OK` false without overwriting the external permissive point.

`COMM_OK` is intentionally not included as a device process bit. Communication availability and data freshness should be determined by each client from connection and polling behavior. `PROCESS_OK` is not a substitute for communication health.

## 6. Holding registers — setpoints (4xxxx)

Holding registers are read/write unsigned 16-bit values. Analog setpoints use a scale factor of 10.

| PDU offset | Reference | Signal | Unit | Scale | Engineering range |
|---:|---:|---|---|---:|---:|
| 0 | 40001 | `Z01_PUMP_SPEED_SP` | Hz | ×10 | 0.0–50.0 |
| 1 | 40002 | `Z01_VALVE_POSITION_SP` | % | ×10 | 0.0–100.0 |
| 2 | 40003 | `Z01_FLOW_LOW_SP` | L/min | ×10 | 0.0–1000.0 |
| 3 | 40004 | `Z01_TANK_LEVEL_LOW_SP` | % | ×10 | 0.0–100.0 |
| 4 | 40005 | `Z01_TANK_LEVEL_HIGH_SP` | % | ×10 | 0.0–100.0 |

Initial values are 45.0 Hz, 100.0%, 5.0 L/min, 20.0%, and 90.0%, respectively. These values are startup defaults, not validated operating recommendations.

The runtime validates these operating ranges: pump frequency 0–50 Hz, valve position 0–100%, low-flow threshold 0–100 L/min, and tank thresholds 0–100% with low below high. Invalid values remove the effective permissive and force the simulated pump output off. In Manual, invalid setpoints also clear the latched manual run request, requiring a fresh START after correction; Auto retains its level-based demand. A Modbus register write alone does not bypass process validation.

## 7. Input registers — process measurements (3xxxx)

Input registers are read-only unsigned 16-bit values. Values use a scale factor of 10.

| PDU offset | Reference | Signal | Unit | Scale | Engineering range |
|---:|---:|---|---|---:|---:|
| 0 | 30001 | `Z01_TANK_LEVEL` | % | ×10 | 0.0–100.0 |
| 1 | 30002 | `Z01_FLOW` | L/min | ×10 | 0.0–1000.0 |
| 2 | 30003 | `Z01_PUMP_FREQUENCY` | Hz | ×10 | 0.0–50.0 |
| 3 | 30004 | `Z01_PUMP_SPEED` | % | ×10 | 0.0–100.0 |
| 4 | 30005 | `Z01_VALVE` | % | ×10 | 0.0–100.0 |
| 5 | 30006 | `Z01_PUMP_CURRENT` | A | ×10 | 0.0–100.0 |

The process model starts with tank level at 75.0%; the other measurements start at zero. The runtime updates these registers on every scan. These are simulated values, not physical sensor readings.

## 8. Data representation and scaling

Each analog value occupies one 16-bit unsigned register. For the default scale factor of 10:

- Engineering value 56.7 is encoded as integer 567.
- Integer 567 is decoded as engineering value 56.7.
- Negative values are not supported by this initial map.
- Process logic must reject values outside the defined engineering range, even if they fit in an unsigned 16-bit register.

The protocol register contains only the scaled number. Signal name, engineering unit, description, and quality must be maintained in the client-side tag mapping/documentation.

## 9. Canonical model and Zone 01 extensions

The map preserves command/status/feedback separation:

- Commands: `AUTO`, `START`, `STOP`, `FAULT_RESET`, and `RE-ENABLE`.
- Status and diagnostics: `RUN_FEEDBACK`, `RUNNING`, `FAULT`, `PERMISSIVE`, `MANUAL`, `AUTO_ACTIVE`, `FLOW_OK`, `LOW_FLOW`, `PROCESS_OK`, and `OPERATOR_STOP_LATCHED`.
- Process values: `FLOW` and `VALVE`.
- Zone 01 extensions: tank level, pump speed/frequency/current, pump fault, tank alarms, and equipment setpoints.

Moisture setpoints are not included because this Zone 01 process models tank level rather than a soil-moisture loop.

## 10. Verification status

Implemented:
1. All four address spaces are defined with zero-based offsets.
2. A PyModbus TCP server is configured for loopback, TCP port 1502, Unit ID 1.
3. Initial register and bit values are loaded from the register map.
4. Unit tests validate device identity, address-space sizes, and startup values.

Implemented:
1. A Modbus TCP client can connect and read each address space.
2. A client can write the Auto coil and holding-register setpoints.
3. Discrete inputs and input registers are configured read-only.
4. A 500 ms nominal runtime scan connects the command processor, process model, and Modbus memory.
5. START, STOP, and FAULT_RESET are consumed and cleared after sampling; AUTO remains maintained.
6. Dynamic process measurements and controller status are published to the input registers and discrete inputs.
7. Runtime unit tests cover startup, manual start/stop, automatic start, permissive loss, and invalid setpoints.

Pending local integration verification:
1. Run the complete Python test suite after pulling the latest commits.
2. Verify the live Modbus TCP process with a client.
3. Confirm Node.js Web SCADA and Ignition interpret the same offsets, units, and signal semantics.

## 11. Change control

This is register-map version 0.3. Existing addresses and meanings are unchanged; the new command and status points are appended at unused offsets. Changes to offsets, signal meanings, access, units, or scaling require a versioned update and corresponding client mapping changes.
