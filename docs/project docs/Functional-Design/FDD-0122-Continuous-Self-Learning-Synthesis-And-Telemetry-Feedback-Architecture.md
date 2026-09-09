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

    Dev->>Engine: --capture --epic N (post-sprint / milestone)
    Engine->>Git: Extract git log, heal(...) commits, impl-log, test inventory
    Git-->>Raw: Persist raw telemetry to vault raw/synthesis-epic-N-date/
    Dev->>Engine: --compile --epic N
    Engine->>Raw: Read latest capture from raw/
    Raw-->>Engine: Parsed telemetry (commits, tests, ADR status, gotchas)
    Engine->>Sprint: Generate Self-Learning-Synthesis-Epic-N.md (repo + vault)
    Engine-->>Dev: Actionable recommendations (gotchas, ADR annotations, patterns)
    Dev->>Gotcha: Manually verify/update environment & test quirks
    Dev->>ADR: Manually append '## Implementation Learnings' sections
    Dev->>Reg: Manually append generalized architectural patterns
`

---

## 3. Component & Schema Specifications

### 3.1 Telemetry Extraction Engine (`scripts/synthesize-telemetry.mjs`)

The engine is implemented as a Node.js ESM script with three modes:

**`--capture --epic <N> [--with-tests] [--vault <path>]`**
Dumps raw telemetry from the git repo into the Second Brain vault's `raw/` folder under `raw/synthesis-epic-<N>-<date>/`. Captures:
- `repo-telemetry/git-log.txt` — `git log -n 50 --stat --format` output (hash, author, date, subject).
- `repo-telemetry/healing-commits.txt` — filtered `heal(...)` and `fix(...)` commits with full messages and bodies.
- `repo-telemetry/feature-commits.txt` — `feat(...)` commits matching the epic's story numbers.
- `repo-telemetry/impl-log-excerpt.md` — last 200 lines of `docs/implementation-log.md`.
- `repo-telemetry/contract-tests.json` — inventory of all `*.contract.test.ts` files with modification timestamps.
- `repo-telemetry/environment-gotchas.md` — snapshot of the current gotchas file.
- `repo-telemetry/adr-inventory.json` — all ADR files with a boolean `hasLearnings` flag.
- `repo-telemetry/jest-<repo>.json` — (optional, `--with-tests`) Jest `--json` output per repo.
- `manifest.json` — capture metadata (epic, date, git HEAD, branch, file list).

**`--compile --epic <N> [--vault <path>]`**
Reads the latest capture from `raw/`, parses the telemetry, and generates:
- `docs/synthesis/Self-Learning-Synthesis-Epic-<N>.md` (in the repo).
- `wiki/Projects/Social Engage/Guides & Operations/Self-Learning-Synthesis-Epic-<N>.md` (in the Second Brain vault).
- Console output with actionable recommendations: healing commits to verify in gotchas, stories to check for ADR annotations, and a prompt to check for new cross-cutting patterns.

The generated synthesis artifact includes: a telemetry summary table, healing/fix commit listing, feature commit listing, contract test inventory grouped by directory, ADR annotation status (annotated vs. unannotated), environment gotchas section summary, and synthesis recommendations.

**`(no args)` — legacy verification mode**
Scans the last 25 git commits and verifies that the three self-learning artifacts (environment-gotchas.md, Lessons-Learned-Register.md, synthesis artifacts) exist. Prints a summary to stdout.

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