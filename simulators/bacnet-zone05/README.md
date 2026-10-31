# Zone 05 BACnet Device Simulator

Independent BACnet/IP device simulator for the Building Irrigation SCADA testbed.

## Configuration

| Variable | Default | Description |
|---|---:|---|
| `ZONE05_BACNET_DEVICE_INSTANCE` | `10005` | BACnet Device object instance |
| `ZONE05_BACNET_PORT` | `47809` | UDP port |
| `ZONE05_BACNET_INTERFACE` | `0.0.0.0` | Local interface to bind |

**Why UDP 47809?** The existing Zone 03 gateway uses UDP 47808. Two BACnet/IP server processes cannot both bind the same UDP port on the same host. Zone 05 therefore uses 47809 for this same-host development setup. The client must target the simulator's IP address and port explicitly.

## Run

Install the main repository dependencies, then start the simulator in a terminal:

```powershell
npm install
node simulators/bacnet-zone05/device.js
```

Expected startup messages include:

```
[Zone05 BACnet] Device 10005 listening on 0.0.0.0:47809/UDP
[Zone05 BACnet] Independent process simulation started
```

The simulator is an independent process. It does not connect to Zone 03, OPC UA, PostgreSQL, or the SCADA backend.

## BACnet object map

| Object | Instance | Object name | Present_Value | Unit / meaning |
|---|---:|---|---|---|
| Analog Input | 1 | Zone05_Moisture | REAL | percent |
| Analog Input | 2 | Zone05_Flow | REAL | gallons per minute |
| Analog Input | 3 | Zone05_ValvePosition | REAL | percent |
| Analog Input | 4 | Zone05_TankLevel | REAL | percent |
| Binary Input | 1 | Zone05_PumpRunning | ENUMERATED | 0=inactive, 1=active |
| Binary Input | 2 | Zone05_PumpFault | ENUMERATED | 0=inactive, 1=active |
| Binary Output | 1 | Zone05_AutoMode | ENUMERATED | active=AUTO, inactive=MANUAL |
| Binary Output | 2 | Zone05_StartRequest | ENUMERATED | momentary start request |
| Binary Output | 3 | Zone05_StopRequest | ENUMERATED | momentary stop request |
| Binary Output | 4 | Zone05_FaultReset | ENUMERATED | momentary reset request |

Binary Output objects implement a 16-slot Priority_Array and Relinquish_Default. Only Present_Value is writable. Monitoring objects are read-only and reject WriteProperty with WRITE_ACCESS_DENIED.

## SCADA tag mapping

| SCADA tag | BACnet object | Instance | Access | Canonical unit |
|---|---|---:|---|---|
| `Z05_MOISTURE` | Analog Input | 1 | Read | % |
| `Z05_FLOW` | Analog Input | 2 | Read | gpm |
| `Z05_VALVE` | Analog Input | 3 | Read | % |
| `Z05_TANK_LEVEL` | Analog Input | 4 | Read | % |
| `Z05_RUNNING` | Binary Input | 1 | Read | Boolean |
| `Z05_FAULT` | Binary Input | 2 | Read | Boolean |
| `Z05_AUTO` | Binary Output | 1 | Command/readback | Boolean |
| `Z05_START` | Binary Output | 2 | Momentary command | Boolean |
| `Z05_STOP` | Binary Output | 3 | Momentary command | Boolean |
| `Z05_FAULT_RESET` | Binary Output | 4 | Momentary command | Boolean |

The SCADA driver will normalize these object values into the existing project observation shape. Boolean historian values are stored numerically as 0/1.

## Process model

- Initial moisture: 56%; it falls slowly when irrigation is off.
- AUTO starts watering at or below 30% moisture and stops at or above 55%.
- MANUAL accepts Start and Stop commands.
- Flow is 4.9 gpm while watering and zero otherwise.
- Valve position is 100% while watering and zero otherwise.
- Tank level starts at 78% and decreases during watering.
- Start is rejected if the mode is not MANUAL, a fault is active, or tank level is below 20%.
- Fault Reset clears the simulated fault; it does not start the pump.

The process model is deliberately separated from the BACnet object database so it can be unit-tested without a BACnet network.

## Validation note

This simulator uses `node-bacnet` server-side `whoIs`, `readProperty`, and `writeProperty` events. The library documents server-side request handling as beta; the implementation follows the request/response pattern already used by the Zone 03 gateway in this portfolio. Validate the exact installed-library behavior with a separate BACnet client before integrating the Zone 05 client driver.
