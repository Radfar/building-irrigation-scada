# CODESYS — Zone03 Irrigation

This directory contains recovered, text-based source references for the Zone03 irrigation control logic.

## Included files

| File | Purpose |
|---|---|
| `FB_IrrigationZone.declaration.reference.st` | Function-block declaration and variable interfaces |
| `FB_IrrigationZone.implementation.reference.st` | Function-block implementation body |
| `GVL_SCADA` | Global SCADA variable declarations |
| `PLC_PRG` | Program-level function-block instance and signal mapping |

## Native project

The native CODESYS project (`IrrigationPLC.project`) is intentionally **not included** in this repository. These text files are review references, not a substitute for the native project and not guaranteed to be directly importable as a complete CODESYS application.

## Provenance and verification status

The files were recovered from the repository branch `docs/plc-source-reference-baseline` after the corresponding files were deleted from another feature branch.

Their contents have been retained as recovered reference material. They have **not yet been compared with the current native CODESYS application**. In particular:

- The declaration and implementation are stored as separate reference files.
- The original implementation logic has not been corrected or refactored as part of this recovery.
- No claim is made that these files exactly match the current native POU or project.
- CODESYS version, capture date, and native-project revision have not been established by this recovery.

Before treating these files as current source exports, open the native CODESYS application, compare the complete `FB_IrrigationZone` declaration and implementation, and record the result here.

## Handling rules

- Preserve the recovered files as evidence until the native comparison is complete.
- Do not make behavioral changes in a source-reference recovery commit.
- Record proposed logic changes separately and reconcile them against the approved FDS and ICD.
- Update this README when the native comparison has been completed.
