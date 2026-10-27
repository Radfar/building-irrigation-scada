## 🔌 Multi-Brand PLC Driver Architecture & Integration Contract

This project implements a vendor-agnostic architecture layer designed to decouple the SCADA HMI backend from individual hardware manufacturers. By adhering to a unified tag and behavioral contract, you can deploy distinct PLC brands (CODESYS, Rockwell Automation Micro850, Siemens S7, or Modbus TCP modules) across different irrigation zones without rewriting any Node.js service routes or database schemas.

### Core Interface Abstraction Architecture

```mermaid
flowchart TD
    %% Frontend Representation
    subgraph Web HMI Layer
        UI[Unified Web Browser UI]
    end

    %% Middleware Integration Backend
    subgraph SCADA Backend API Service
        API[Express App / Router Node]
        DB[(PostgreSQL Schema)]
        API <--> DB
    end

    %% Protocol Interface Drivers
    subgraph Protocol Driver Abstraction Layer
        UA_Drv[node-opcua Driver]
        EIP_Drv[ethernet-ip Driver]
        MB_Drv[modbus-serial Driver]
    end

    %% Vendor Implementations
    subgraph Industrial Controller Environment
        subgraph Zone 03: CODESYS SoftPLC
            direction TB
            C_GVL[GVL: Z03_Tags]
            C_FB[FB_IrrigationZone]
            C_GVL <--> C_FB
        end
        
        subgraph Zone 02: Rockwell Micro850
            direction TB
            R_Global[Global Var: Z02_Tags]
            R_ST[ST Program Program]
            R_Global <--> R_ST
        end
    end

    %% Network Routing Paths
    UI <-->|REST API JSON| API
    API <-->|OPC UA Protocol| UA_Drv
    API <-->|EtherNet/IP CIP| EIP_Drv
    API <-->|Modbus TCP| MB_Drv
    
    UA_Drv <-->|Symbolic Routing| C_GVL
    EIP_Drv <-->|Direct Tag Extraction| R_Global
    MB_Drv <-->|Mapped Register Offsets| R_Global
```

### Multi-Brand PLC Implementation Compliance Checklist

When adding a new controller node to the irrigation grid, the PLC program must satisfy these criteria:

1. **Tag Mapping:** Expose global control variables matching the standard `ZX_[Tag]` format exactly (where `X` represents the integer Zone number).
2. **Internal Scoping:** Isolate processing variables (`R_TRIG` blocks, `TON` elements, calculation steps) entirely inside the program local scope, keeping the global memory space clean.
3. **Unconditional Simulation Loops:** If using simulation profiles, execute tracking clocks (e.g., `SimTick`) unconditionally every scan cycle to ensure calculation loops update reliably.
4. **Command Autoclear:** Momentary SCADA input variables (`START`, `STOP`, `FAULT_RESET`) must be consumed by internal program edge triggers and cleared immediately back to `FALSE` inside the same execution pass to prevent protocol write locking.
