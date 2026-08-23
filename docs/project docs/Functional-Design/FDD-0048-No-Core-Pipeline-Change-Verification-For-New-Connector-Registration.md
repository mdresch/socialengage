# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0048 No Core Pipeline Change Verification for New Connector Registration — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | AI Delivery Agent (FDD synthesis pass) |
| Reviewer(s) | Menno (Product Owner / Technical Lead) |
| Status | Approved (ADR-0048 Accepted 2026-08-11; built via Story 2.10, 2026-08-12) |
| Related Documents | ADR-0048, BRD-0048, ADR-0002, Story 2.1, Story 2.8, Story 2.9, Story 2.10 |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0048's architecture decision and BRD-0048's business requirements into the functional design of the connector-registration verification policy: a mandatory, mechanically-enforced guarantee that adding, removing, or swapping a connector (`SocialConnector` or `AIProviderConnector`) never requires editing core ingestion orchestration logic. Story 2.10 (built 2026-08-12) delivers the CI guardrail contract and the `CORE_FILES` extension-point set; this FDD documents the shipped functional behavior for traceability and future maintenance.

### 2.2 Scope

- **In scope:** mandatory PR evidence that connector registration touched only the connector implementation and the designated registry surface; a deterministic, automated CI guardrail; a required per-connector registration-traceability documentation note; equal application to `SocialConnector` and `AIProviderConnector` connector classes; the exception path (a separately approved superseding ADR) for any genuinely necessary core-path edit.
- **Out of scope:** the internal behavior of any specific connector implementation; changes to core ingestion pipeline business logic, rate limiting, error handling, or enrichment rules; user-facing admin UI/self-service connector registration; whether this policy also applies with the same strictness to connector deprecation/removal (an open question, not resolved here); the exact CI implementation mechanism beyond "deterministic and repository-run."

### 2.3 Target Audience

Backend engineers adding, removing, or swapping a connector; the Platform Maintainer owning CI and core pipeline stability; QA/release reviewers verifying PR evidence before merge; future connector-story authors relying on the invariant this policy protects.

---

## 3. Context and Background

The project has repeatedly asserted, in story language, a core architecture promise: adding or swapping a connector must not require editing core ingestion pipeline/orchestration logic. Until ADR-0048, that promise was validated only by selective story-level tests and human PR review, with no explicit, project-wide, mandatory verification requirement. This left a real gap where accidental coupling, hard-coded provider branching, or undocumented bypass of the connector abstraction (`ProviderConnector`/`SocialConnector`/`AIProviderConnector`, ADR-0002/Story 2.1) could creep into the core path over time — especially as more connectors (GNews, Newswire, Azure AI Language, Azure OpenAI, and later Wikipedia, tenant-owned-feed, Facebook) were added. ADR-0048 closes this gap by making the promise mechanically, continuously testable rather than only narratively asserted. Story 2.10 (Connector Registration Transparency) is the dedicated story that builds the guardrail and the traceability requirement — not an unowned constraint left for every future connector story to separately reinvent.

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Make the "no core pipeline change" promise mechanically verifiable, not just asserted | Every connector-affecting PR carries deterministic evidence, not only reviewer judgment |
| G2 | Prevent accidental coupling and hard-coded provider branching in the core path | CI guardrail fails a PR that edits core files outside the designated extension points |
| G3 | Keep the policy equally strict across connector classes | Identical guardrail and evidence rules for `SocialConnector` and `AIProviderConnector` |
| G4 | Preserve a living record of how each connector satisfies the invariant | Every connector's documentation carries a registration-traceability note |
| G5 | Allow a deliberate, reviewed exception path without silently weakening the rule | Any core-path edit for registration purposes requires its own separately approved superseding ADR |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: Mandatory No-Core-Path-Edit Evidence

- **Description:** Requires every connector registration, swap, or removal PR to demonstrate that the only files changed are the connector's own implementation and the designated connector registry/registration surface.
- **Triggers:** Any PR that adds, removes, or swaps a `SocialConnector` or `AIProviderConnector`.
- **Inputs:** The PR's file diff.
- **Processing:** The diff is checked against the designated extension-point set (the connector's own implementation directory, and the registry/registration surface, e.g. `registry.ts`) — verified test evidence (a contract test or equivalent deterministic artifact) confirms no file outside that set was touched for registration purposes.
- **Outputs:** A pass/fail verification result attached to the PR.
- **Error handling:** A PR touching a core ingestion orchestration file for registration purposes fails this check unless it is accompanied by a separately approved ADR explicitly superseding ADR-0048.
- **Edge cases:** A PR that touches a core file for a reason unrelated to connector registration (e.g., an unrelated bugfix bundled in the same PR) is a process/PR-hygiene concern, not something this policy is designed to distinguish — the policy checks the diff, not intent.

### 5.2 Feature / Capability: Deterministic CI Guardrail

- **Description:** An automated, repository-run check that fails a connector-affecting PR when connector-registration behavior is implemented outside the designated extension points.
- **Triggers:** Every PR that touches connector-related files, run automatically as part of CI.
- **Inputs:** The PR's file diff; the committed set of designated core files (`CORE_FILES`) and extension-point surfaces.
- **Processing:** The guardrail may be implemented as a focused diff policy, a path-based guard, or an equivalent contract-test gate — the exact mechanism is an implementation choice, but it must be deterministic (same input always yields the same pass/fail result) and must run on every connector PR, not only on request.
- **Outputs:** A clear, unambiguous, machine-readable pass/fail result, headlessly runnable in CI.
- **Error handling:** A failing guardrail blocks merge until resolved — either by confining the change to designated surfaces, or by attaching a superseding ADR.
- **Edge cases:** The guardrail must complete quickly enough to run within the existing PR test suite (named target: under one minute for the current set of real connectors) — a slow guardrail would itself become a source of PR friction this policy is meant to avoid.

### 5.3 Feature / Capability: Required Registration Traceability Note

- **Description:** Requires each connector's own documentation to explicitly record how it satisfies this policy.
- **Triggers:** Any connector added, removed, or swapped.
- **Inputs:** The connector's actual registration location and the extension points it used.
- **Processing:** The connector's documentation states: (1) where registration occurs; (2) which extension points are used; (3) how no-core-change verification was satisfied in that PR (e.g., which test or guardrail run demonstrates it).
- **Outputs:** A durable, per-connector, human-readable record that any team member can inspect without re-deriving how the invariant was enforced.
- **Error handling:** A connector PR lacking this note is incomplete against the policy, even if the mechanical guardrail otherwise passes.
- **Edge cases:** None named beyond keeping this note current if a connector's registration surface is later refactored.

### 5.4 Feature / Capability: Connector-Class-Agnostic Application

- **Description:** Applies the identical guardrail, evidence, and documentation requirements to both `SocialConnector` and `AIProviderConnector` additions, removals, and swaps — no lighter-weight path for either class.
- **Triggers:** Any PR touching either connector class.
- **Inputs:** The connector's class (`SocialConnector` vs. `AIProviderConnector`) and its PR diff.
- **Processing:** The same guardrail logic and the same `CORE_FILES`/extension-point set apply regardless of class; the same evidence and documentation requirements apply regardless of class.
- **Outputs:** Uniform enforcement — no class of connector is exempt or subject to a different bar.
- **Error handling:** Same as §5.1/§5.2 — failure blocks merge unless a superseding ADR is attached.
- **Edge cases:** Story 2.8/2.9 (the real `AIProviderConnector` implementations — Azure AI Language, Azure-hosted LLM swappability) are the concrete proof this policy applies to AI connectors, not only social ones.

### 5.5 Feature / Capability: Superseding-ADR Exception Path

- **Description:** Provides the sole permitted path for a genuinely necessary core-pipeline edit tied to connector registration.
- **Triggers:** A situation where the connector abstraction's existing extension points are found to be genuinely insufficient for a new connector's registration needs.
- **Inputs:** A proposed core-pipeline change and its rationale.
- **Processing:** The change must be accompanied by a separately approved ADR that explicitly supersedes ADR-0048 (in whole or in the specific relevant part) before the core-path edit is permitted.
- **Outputs:** Either the exception ADR is accepted (and the edit is then in-policy) or it is not (and the edit remains blocked).
- **Error handling:** A core-path edit without an accompanying superseding ADR always fails the guardrail, regardless of the technical justification offered in the PR description alone.
- **Edge cases:** None named beyond the general ADR-acceptance process itself (out of this ADR's own scope).

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| Core Backend Engineer | Implements and registers new connectors; provides the required evidence and documentation |
| Platform Maintainer | Owns CI and the guardrail's `CORE_FILES`/extension-point set; keeps it current as the codebase evolves |
| QA / Release Reviewer | Verifies PR evidence and documentation before merge |
| Menno (Product Owner / Technical Lead) | Approves any superseding-ADR exception |
| Downstream Connector Story Owners | Rely on the invariant this policy protects for their own future connector work |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| Story 2.10 | Core Backend Engineer / Platform Maintainer | ...have a mechanical, deterministic guardrail proving every connector registration stays within designated extension points | ...the "no core pipeline change" promise is continuously testable, not only narratively asserted | Contract test demonstrates the invariant for all existing real connectors; `CORE_FILES` set is committed and versioned; guardrail runs automatically and deterministically on every connector-affecting PR |
| Story 2.1 (supported, not re-decided) | Core Backend Engineer | ...have a stable `ProviderConnector`/`SocialConnector`/`AIProviderConnector` abstraction | ...connectors can be added without touching core orchestration | Provides the designated registration surface this policy verifies against |
| Story 2.8 / 2.9 (supported, not re-decided) | Core Backend Engineer | ...prove the connector abstraction genuinely supports AI-provider swappability | ...the same no-core-change guarantee holds for AI connectors, not only social ones | Concrete proof point that this policy's connector-class-agnostic application (§5.4) is real, not aspirational |

### 6.3 Workflow Diagrams / Steps

**Workflow: adding a new connector under this policy**

1. Engineer implements the new connector against the `ProviderConnector`/`SocialConnector`/`AIProviderConnector` interface (ADR-0002).
2. Engineer registers the connector in the designated registry/registration surface only.
3. Engineer writes the connector's registration-traceability documentation note (registration location, extension points used, verification method).
4. Engineer opens the PR; CI automatically runs the deterministic guardrail against the diff.
5. If the guardrail passes (no core-path edits detected): PR proceeds to normal review, which checks the traceability note is present and complete.
6. If the guardrail fails (a core-path edit is detected): the engineer either confines the change to designated surfaces and resubmits, or drafts a superseding ADR proposing the exception, which must itself be separately approved before the edit can be merged.
7. Once merged, the connector's documentation stands as the durable, inspectable record of how the invariant was satisfied.

---

## 7. Data Requirements

### 7.1 Data Inputs

The PR's git diff; the committed `CORE_FILES`/designated-extension-point set; the connector's `providerId`, `authMode`, `deliveryMode`, and registry entry.

### 7.2 Data Outputs

A pass/fail guardrail result per PR; a per-connector registration-traceability documentation note; (on exception) a superseding ADR.

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| Connector registration record | `providerId`, `authMode`, `deliveryMode`, registry entry | Produced by the connector implementation + registry, per ADR-0002's abstraction |
| Designated extension-point manifest (`CORE_FILES`) | The versioned list of core files/registry surfaces a connector may touch without a superseding ADR | Maintained by the Platform Maintainer; updated only through normal PR review |
| PR diff evidence | The set of files changed in a connector PR | Compared against `CORE_FILES` by the guardrail |
| Verification traceability note | Registration location, extension points used, verification method | Embedded in each connector's own documentation |
| Superseding ADR (exception case) | A new ADR explicitly superseding ADR-0048 for a specific, justified core-path edit | Required before any core-pipeline edit for registration purposes is permitted |

### 7.4 Validation Rules

- A connector PR's diff must not include any file outside the connector's own implementation and the designated registry/registration surface, unless a superseding ADR is attached.
- The guardrail must produce the same pass/fail result on repeated runs against the same commit (determinism).
- Every connector's documentation must include all three traceability-note elements (registration location, extension points used, verification method) — a note missing any element is incomplete.

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | Connector registration must not require edits outside the connector implementation and the designated registry/registration surface | All connector PRs |
| BR2 | Any core-pipeline edit for registration purposes is out of policy unless accompanied by a separately approved superseding ADR | Exception handling |
| BR3 | CI must fail a connector PR when registration behavior is implemented outside designated extension points | CI guardrail |
| BR4 | Every connector's documentation must cite registration location, extension points used, and how no-core-change verification was satisfied | Documentation |
| BR5 | The policy is connector-class agnostic — identical treatment for `SocialConnector` and `AIProviderConnector` | Guardrail and documentation scope |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| Connector registry/registration surface | Inbound (from engineer) | The single designated place connectors are declared and loaded | In-process TypeScript |
| CI pipeline | Internal | Runs the deterministic guardrail on every connector-affecting PR | CI job / Jest contract test |
| `CORE_FILES` manifest | Internal | Reference set the guardrail checks the PR diff against | Committed repository artifact |
| Connector documentation (per-connector) | Outbound (to reviewers/engineers) | Registration traceability note | Markdown / repository docs |
| ADR governance process | Exception path | Approves a superseding ADR when a genuine core-path edit is needed | `docs/adr/*.md` |

---

## 10. Non-Functional Considerations

- **Performance:** The guardrail must complete quickly enough to run within the existing PR test suite — named target: under one minute for the current set of real connectors.
- **Security / access control:** N/A directly, though preventing hard-coded provider branching reduces the risk of accidental cross-connector coupling that could otherwise leak provider-specific assumptions into shared code.
- **Scalability:** The `CORE_FILES`/extension-point manifest must be versioned and updated as the codebase evolves, or the guardrail risks stale false positives/negatives as new legitimate core files are added.
- **Reliability / availability:** The guardrail must be deterministic — identical input always yields identical pass/fail output, across repeated runs.
- **Audit and logging:** Every connector's documentation serves as a durable, auditable record of how the invariant was satisfied for that connector.
- **Accessibility:** N/A.
- **Localization / internationalization:** N/A.

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| PR edits a core ingestion orchestration file for registration purposes, no superseding ADR attached | Guardrail failure message identifying the offending file(s) | PR blocked from merge until confined to designated surfaces or a superseding ADR is approved |
| Connector documentation lacks the required traceability note | Review-time finding, not necessarily a CI failure | Reviewer requires the note before merge |
| Guardrail produces inconsistent results across runs on the same commit | N/A (a guardrail-implementation defect) | Violates NFR-001/determinism requirement; must be fixed as a guardrail bug, not treated as intermittently acceptable |
| A connector legitimately needs a core-pipeline change | N/A | Must be proposed as a separately approved superseding ADR before the edit is permitted |

---

## 12. Assumptions and Dependencies

- ADR-0048 has been accepted and is in effect.
- The `ProviderConnector`/`SocialConnector`/`AIProviderConnector` abstraction from ADR-0002 (Story 2.1) is the designated registration surface this policy verifies against.
- Story 2.10 (or an equivalent implementation) has delivered the guardrail contract and the `CORE_FILES` set.
- The existing Jest contract suite in `social-listening-core` is the enforcement mechanism for the CI guardrail.
- Depends on: ADR-0002 (connector abstraction contract), Story 2.1 (framework), Story 2.8/2.9 (proof of AI-connector applicability), existing Jest contract suite/CI.

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | Should this be enforced via a dedicated CI script in the repository, or as a test-level contract gate inside `social-listening-core`? | Platform Maintainer / Engineering | Not decided by ADR-0048; an implementation choice |
| Q2 | Should a strict allowlist of files/directories be defined as extension points, and where should that allowlist be maintained? | Platform Maintainer | Not decided; `CORE_FILES` exists as the working mechanism, formal allowlist governance not specified |
| Q3 | Should this policy apply to connector deprecation/removal PRs with the same strictness as registration? | Product Owner / Technical Lead | Deferred — explicitly named as an open question in ADR-0048, not resolved here |

---

## 14. Appendix

### Glossary

See BRD-0048 Section 15 for the full glossary (Core ingestion orchestration/pipeline, Connector implementation, Designated connector registry/registration surface, Designated extension point, No-core-change verification, `CORE_FILES`, `SocialConnector`, `AIProviderConnector`).

### Reference Links

- **ADR-0048:** `docs/adr/0048-no-core-pipeline-change-verification-for-new-connector-registration.md`
- **BRD-0048:** `docs/project docs/Business-Requirements/BRD-0048-No-Core-Pipeline-Change-Verification-For-New-Connector-Registration.md`
- **Related ADRs:** ADR-0002 (connector abstraction contract, Story 2.1's source)
- **Stories:** Story 2.1 (unified provider connector framework), Story 2.8/2.9 (real `AIProviderConnector` implementations), Story 2.10 (Connector Registration Transparency, built 2026-08-12, the dedicated story implementing this ADR's guardrail and traceability requirement)

### Missing / Not Applicable Sources

- No `docs/product-research/feature-designs/<feature>.md` or `docs/product-research/reports/<feature>-deep-research.md` file exists for this ADR — it is an architecture-governance requirement, not a user-facing product feature, so neither is expected.

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 1.0 | 2026-08-23 | AI Delivery Agent | Regenerated as a genuine functional-design synthesis from ADR-0048 and BRD-0048, replacing a prior defective draft that duplicated the BRD's flat requirements table. |
