# PLC Source References

This directory contains review copies of PLC/control-logic source associated with the Industrial Water Management project.

## Scope and authority

The files in this directory are **source-reference snapshots**, intended for inspection, comparison, and engineering review. They are not complete vendor engineering projects and must not be treated as the authoritative working implementation.

The native engineering application/project remains the place where the implementation is edited, compiled, and tested. The native CODESYS project is intentionally not distributed in this repository.

The Zone03 files were recovered from the repository's `docs/plc-source-reference-baseline` branch after they were removed from the feature branch. Their contents have been preserved as reference material, but they have **not yet been verified against the current native CODESYS application**. Do not describe them as a verified current export.

## Organization

- `Codesys/Zone03/` — Zone03 CODESYS source-reference files.
- Add other platform folders only when corresponding source artifacts are available and useful to review.

A zone implemented by a simulator, an IoT Edge service, or a protocol/device integration should not be given an artificial PLC source file merely to make the directory structure uniform.

## Updating a source reference

When the native implementation is available for comparison:

1. Open the authoritative native project in its engineering application.
2. Capture the complete relevant declaration and implementation.
3. Compare the captured source with the reference files in this directory.
4. Record the engineering software version, capture date, source revision, and comparison result.
5. Update the reference files only after the comparison is complete.
6. Keep behavioral corrections and refactoring separate from evidence-preserving source captures.

Do not edit a reference snapshot and assume that the native PLC implementation has changed.

## Review status

Zone03 source-reference status: **Recovered — not yet verified against the native CODESYS application.**

No future zone, controller, or communication protocol is selected by this directory structure.


The native CODESYS project file is intentionally not stored in this repository. The Zone 03 folder contains the available Structured Text and variable-list references; these remain reference material and are not represented as verified exports of the current native application.
