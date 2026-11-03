# Document Control and Revision Rules

**Status:** Draft  
**Applies to:** Engineering documents in this repository

## 1. Purpose

This document defines how engineering documentation is identified, reviewed, approved, revised and maintained. It is intended to make the repository understandable and auditable by another engineer who has not participated in the project discussions.

## 2. Document status

Use one of the following statuses in each controlled specification:

| Status | Meaning |
|---|---|
| Draft | Being prepared; content may be incomplete |
| In Review | Submitted for technical review; not yet authoritative |
| Approved | Reviewed and accepted as the current project requirement or design baseline |
| Superseded | Replaced by a newer approved revision |
| Archived | Retained for historical reference; not current |

A document must not be described as approved merely because it exists in the repository or has been implemented in software.

## 3. Document header

Controlled specifications should begin with:

| Field | Description |
|---|---|
| Document ID | Stable identifier, e.g. FDS-IRR-001 |
| Title | Clear engineering title |
| Project | Industrial Water Management |
| Revision | Start at 0.1 for drafts; use 1.0 for first approved issue |
| Status | One of the statuses above |
| Date | Issue or revision date |
| Owner | Person responsible for maintaining the document |
| Reviewers | Technical reviewers, when assigned |
| Source documents | Existing specifications, code or decisions used |

## 4. Revision convention

- Draft revisions use 0.x (0.1, 0.2, 0.3).
- First approved issue is 1.0.
- Minor approved clarification or compatible change increments the minor number.
- A material change to requirements or interface compatibility increments the major number.
- Record every meaningful change in a revision-history table.

The revision number describes the engineering document revision. Git commits and pull requests provide the detailed file history.

## 5. Requirements and traceability

Use stable identifiers that do not depend on line numbers:

- FREQ-xxx — functional requirement
- FINT-xxx — interlock or protection requirement
- FALM-xxx — alarm/diagnostic requirement
- ICD-xxx — interface requirement
- TEST-xxx — verification test

Each requirement should be singular, testable and written so that its acceptance can be determined. Link tests to the requirements they verify.

## 6. Evidence labels

Use explicit labels when describing implementation status:

- **Verified:** demonstrated by source inspection, test evidence or observed system behavior.
- **Specified:** required by an approved document but not necessarily implemented.
- **Implemented, not verified:** code exists, but acceptance evidence is incomplete.
- **Proposed:** suggested design, not yet accepted.
- **Open:** requires investigation or a project decision.

Do not infer that all zones behave identically merely because their tag names look similar.

## 7. Change control

Changes to an approved FDS or ICD must identify:

1. What requirement or interface is changing.
2. Why the change is needed.
3. Which zones, drivers, PLC programs, API endpoints, HMI elements and database records may be affected.
4. Which tests must be repeated.
5. Whether compatibility with existing implementations is maintained.

Record significant architectural or technical decisions as Architecture Decision Records (ADRs).

## 8. Document review checklist

Before approval, check that:

- terminology is defined and used consistently;
- requirements are testable and unambiguous;
- units and data types are explicit;
- assumptions and unresolved issues are visible;
- interfaces agree with actual source code and database configuration;
- implementation claims have evidence;
- related requirements and tests are traceable;
- diagrams and links are current.
