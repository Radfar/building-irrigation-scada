
 Generated Contract Files

Here is an overview of the target asset breakdown now saved inside your local workspace context:
1. generated/PLC_INTEGRATION_CONTRACT.md
	• Purpose: The master behavioral specifications manual detailing the vendor-agnostic architecture abstraction layout.
	• Contents: Interface requirements, Normalized global variable definitions (ZX_* tracking schemas), Retentive internal workspace local scoping variables, and full Edge-detection scan block safety constraints.
2. generated/CODESYS_COMPLIANCE_TEMPLATE.md
	• Purpose: A structured template for CODESYS instances using IEC 61131-3 compatible global variable configurations.
	• Contents: Standardized variable layouts, strict Symbol Configuration parameters, and the reusable Function Block structure complete with an unconditional 100ms simulation engine block to match your test profiles.
3. generated/ROCKWELL_COMPLIANCE_TEMPLATE.md
	• Purpose: A template optimized specifically for Rockwell Automation Connected Components Workbench (CCW) software and the Micro800 controller platform.
	• Contents: Explicit Variable Monitor mapping tables, memory classification requirements (setting variables to Retain), and structural Logix ST engine adjustments—such as executing the SimTick block unconditionally.
