# CODESYS — Zone 03 Irrigation

This folder contains the native CODESYS project and readable source snapshots used for engineering review.

## Native project

- Project: `IrrigationPLC.project`
- Function block under review: `FB_IrrigationZone`

The native project is the working engineering artifact. The adjacent `*.reference.st` file is a human-readable review snapshot and must be kept synchronized with the native POU.

## Capture instructions

1. Open `IrrigationPLC.project` in CODESYS.
2. Locate the actual `FB_IrrigationZone` POU in the project tree.
3. Open its declaration and implementation.
4. Copy the complete current POU source, including its variable declarations and implementation.
5. Paste it into `FB_IrrigationZone.reference.st`, replacing the capture placeholder.
6. Complete the metadata header in that file. Record the CODESYS version and capture date if known.
7. Do not modify the logic while copying it.

If CODESYS can export the POU directly as a text file, prefer that export. Otherwise, copy the complete declaration and implementation from the editor. If the IDE presents them separately, include both sections in the reference file.

## Review status

The source snapshot is currently awaiting capture from the native project. The listing in the Testbed documentation is useful historical/reference material, but it has not yet been confirmed as identical to the POU in the current native project.
