# PLC and Control-Logic Source References

This directory contains reviewable source-code references for the control implementations used by the Industrial Water Management project.

## Purpose

The repository must let an engineer inspect the actual control logic without having to open every vendor engineering environment. Text exports such as Structured Text (ST) are useful for code review, comparison, traceability and documentation.

These files are **source snapshots for engineering review**. They must not silently become competing implementations or be mistaken for the complete native engineering projects.

## Source-of-truth rule

For each implementation, its native engineering project or explicitly designated source file remains the authoritative working implementation. A text export in this directory is a review copy. Whenever the native implementation changes, update its review copy in the same change set and record the source revision/date.

Do not edit a review copy and assume the native PLC project has changed.

## Organization

Organize by actual implementation platform and process function, not by an assumption that every zone uses ST:

- `Codesys/` — CODESYS project exports and readable POU/FB source snapshots.
- `Rockwell/` — Rockwell CCW project references and exported program/function-block source where available.
- Other zones should receive platform-specific folders only when their actual implementation artifacts are available and useful to review.

The current project includes different kinds of integrations. A zone implemented by a Python simulator, an IoT Edge service or a BACnet device integration should not be given an artificial PLC ST file merely to make the folder structure look uniform.

## Source snapshot requirements

Every source snapshot should include a header comment stating:

- Zone and process function
- Platform and engineering software/version, if known
- Native project filename and POU/program name
- Whether the file is a direct export or manually copied
- Source capture date
- Source project revision/commit, if known
- Review status: Unverified, Compared, or Verified

Preserve the implementation exactly when capturing it. Do not silently reformat, rename variables, fix defects or harmonize behavior in a reference snapshot. Proposed changes belong in a separate reviewed change, not in an evidence copy.

## Naming convention

Use descriptive names such as:

- `FB_IrrigationZone.reference.st`
- `PRG_ZoneComparison.reference.st`

The `.reference.st` suffix indicates a review snapshot, not necessarily a file that can be imported directly into the engineering tool.

## Review workflow

1. Export or copy the current source from the native engineering project.
2. Paste it into the designated reference file without changing its logic.
3. Complete the source metadata header.
4. Commit the source snapshot.
5. Compare it against the FDS and ICD.
6. Record findings and differences in the requirements traceability/reconciliation documents.
7. Only after decisions and tests are agreed should implementation changes be proposed.

## Current scope

The common moisture-driven irrigation-zone behavior is being reconciled first between the CODESYS reference and the Rockwell Zone Comparison implementation. Zone 01's tank/pump simulation remains a separate process model; it is not to be represented as an equivalent moisture-driven irrigation-zone implementation.

No future zone, controller or communication protocol is selected by this directory structure.
