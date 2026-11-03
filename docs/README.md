# Engineering Documentation

This directory contains the controlled engineering documentation for the Industrial Water Management project.

The documentation is organized around the system requirements and design, not around a particular PLC vendor or communication protocol.

## Document hierarchy

| Document | Purpose | Authority |
|---|---|---|
| Project scope and objectives | Defines project boundaries and goals | Project-level |
| Functional Design Specification (FDS) | Defines required process behavior | Functional/process authority |
| Interface Control Document (ICD) | Defines information exchanged across component boundaries | Interface authority |
| Architecture documents | Describe system structure and deployment | Architecture authority |
| Database and historian specifications | Define persistence, tag registry and history behavior | Data authority |
| Vendor/zone implementation documents | Explain how an implementation realizes the common design | Implementation evidence |
| Test specifications and records | Define and record verification | Verification evidence |
| Architecture Decision Records (ADRs) | Record significant decisions and their rationale | Decision history |

## Working principles

1. **One source of truth:** approved common process requirements are maintained in this repository.
2. **Vendor neutrality:** the FDS describes required behavior without requiring a specific PLC, runtime, programming language or protocol.
3. **Separate behavior from transport:** the ICD first defines logical signals and semantics. Protocol-specific mappings are documented separately and only when selected and verified.
4. **Traceability:** requirements should have identifiers and link to implementation and test evidence.
5. **Evidence over assumption:** distinguish verified behavior, design decisions, open questions and proposed behavior.
6. **No silent changes:** changes to approved requirements or interfaces must be reviewed and recorded.
7. **Status is explicit:** Draft, In Review, Approved, Superseded or Archived.

## Initial document set

- [Common Irrigation Zone — Functional Design Specification](03-process-model/FDS-common-irrigation-zone.md)
- [Common Irrigation Zone — Interface Control Document](04-interfaces/ICD-common-irrigation-zone.md)
- [Document control and revision rules](standards/document-control.md)

These initial specifications are **Draft for Review**. They are not yet approved as the final common contract. The current CODESYS reference and other zone implementations must be reconciled before approval.

## Planned organization

```text
docs/
├── README.md
├── 01-project/
├── 02-architecture/
├── 03-process-model/
├── 04-interfaces/
├── 05-database/
├── 06-integrations/
├── 07-hmi-and-api/
├── 08-testing/
├── 09-operations/
├── 10-engineering-decisions/
├── standards/
└── media/
```

Directories will be populated as existing material is audited and assigned to the correct document. Empty directories and speculative documents are intentionally avoided.
