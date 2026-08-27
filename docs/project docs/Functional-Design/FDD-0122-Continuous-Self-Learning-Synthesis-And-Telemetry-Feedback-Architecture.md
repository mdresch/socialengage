# Functional Design Document — FDD-0122: Continuous Self-Learning Synthesis and Telemetry Feedback Architecture

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | Continuous Self-Learning Synthesis and Telemetry Feedback Architecture — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-27 |
| Author(s) | FDD Architect Agent |
| Reviewer(s) | Menno, Technical Lead |
| Status | Approved (Derived from Accepted ADR-0122 & Approved BRD-0122) |
| Related Documents | , , ,  |

---

## 2. Functional Architecture & Pipeline Data Flow

The Self-Learning Synthesis pipeline translates raw codebase execution telemetry into structured, permanent knowledge assets within the Second Brain:

`mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer / Assistant
    participant Git as Codebase Telemetry (Git / Test Logs)
    participant Engine as Synthesis Compiler Engine
    participant Gotcha as environment-gotchas.md
    participant ADR as Governing ADRs (In-Place)
    participant Reg as Lessons-Learned-Register.md
    participant Sprint as Sprint Outputs

    Dev->>Engine: Trigger Synthesis (post-sprint / milestone)
    Engine->>Git: Extract commits, heal(...) passes, and test outputs
    Git-->>Engine: Raw telemetry data
    Engine->>Gotcha: Append/Update environment & test quirks
    Engine->>ADR: Append '## Implementation Learnings' section
    Engine->>Reg: Append generalized architectural patterns
    Engine->>Sprint: Generate Self-Learning-Synthesis-Epic-X.md
    Engine-->>Dev: Return 3-sentence brief & summary table
`

---

## 3. Component & Schema Specifications

### 3.1 Telemetry Extraction Engine
- **Input Sources**:
  - git log -n <count> --stat (Focusing on commit prefixes: heal(...), ix(...), eat(...)).
  - docs/implementation-log.md (Implementation and Built milestone records).
  - Jest contract test output logs and global setup files (jest.global-setup.js, 	estDbClone.ts).
- **Processing Logic**:
  - Filters out cosmetic whitespace commits.
  - Groups changes by Epic and Story ID (e.g., Story 6.39, Story 6.40).
  - Flags any commit containing explicit runtime error handling or environment workarounds.

---

### 3.2 environment-gotchas.md Schema Standard
Entries written to  must adhere to the standard table schema:

`markdown
### [Category / Subsystem Name]
| Issue / Symptom | Root Cause Analysis | Verified Permanent Guardrail | Source Commit |
| :--- | :--- | :--- | :--- |
| [Brief description] | [Underlying technical reason] | [Code/config fix applied] | [git-hash] |
`

---

### 3.3 In-Place ADR Annotation Standard
When runtime implementation refines an accepted ADR, the engine appends the standard block to the target ADR file:

`markdown
---

## Implementation Learnings & Real-World Constraints (Amended YYYY-MM-DD per ADR-0122)

- **[Learned Architectural Rule]**: [Description of technical constraint discovered in implementation].
- **Operational Trade-offs**: [Network, memory, or complexity trade-offs].
- **Reference Commits**: [Associated git commit hashes].
`

---

### 3.4 Lessons Learned Register Standard
Entries written to  capture high-level reusable engineering principles:
- **Architecture Pattern Name**: Reusable technical pattern (e.g., *Same-Origin Proxy Pattern*, *(1)$ Chunked Streaming*).
- **Applicable Domains**: Subsystems where the pattern applies (e.g., UI to Core communication, Bulk Exports).
- **Anti-Patterns Prevented**: Pitfalls avoided by adhering to the pattern (e.g., bearer token exposure, server heap exhaustion).

---

## 4. Operational Guardrails & Verification

1. **Idempotence**: Running the synthesis multiple times against the same commit range must not duplicate entries in environment-gotchas.md or ADR files.
2. **Preservation of Frontmatter**: All modifications to existing ADRs and wiki files must strictly preserve YAML frontmatter (	ags: [SE, ADR], etc.).
3. **Traceability Guarantee**: Every generated learning must cite the exact story number (Story X.Y) and git commit SHA.