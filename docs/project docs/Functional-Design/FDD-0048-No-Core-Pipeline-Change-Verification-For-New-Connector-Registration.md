# Business Requirements Document — No Core Pipeline Change Verification for New Connector Registration

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | Business Requirements Document — No Core Pipeline Change Verification for New Connector Registration |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0048-no-core-pipeline-change-verification-for-new-connector-registration.md, ../Business-Requirements/BRD-0048-No-Core-Pipeline-Change-Verification-For-New-Connector-Registration.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0048-no-core-pipeline-change-verification-for-new-connector-registration.md and the business requirements in BRD-0048-No-Core-Pipeline-Change-Verification-For-New-Connector-Registration.md into functional design for **No Core Pipeline Change Verification For New Connector Registration**.
The product's core ingestion pipeline is intentionally modular: adding, removing, or swapping a connector should not require changes to core orchestration logic. Today that promise is stated in user stories and validated by selective tests, but there is no explicit, project-wide policy that mandates the evidence every connector registration must provide. This leaves a gap where hard-coded provider branches, accidental coupling, or undocumented extension-point bypasses can enter the core path over time.

ADR-0048 closes the gap by establishing a durable, enforceable verification policy for every new connector registration PR. This Business Requirements Document translates that policy into business needs: mandatory evidence of no core-path edits, an automated CI guardrail, a required registration-traceability note in connector documentation, and equal application to both social and AI connector classes. The expected business value is a continuously testable architecture, reduced connector-related technical debt, and faster, more confident PR approvals.

---

### 2.2 Scope
**In scope:**
- Verification policy for every new connector registration or swap
- Mandatory evidence that connector registration changed only the connector implementation and the designated connector registry / registration surface
- A deterministic CI guardrail that runs on every connector-affecting PR
- Required connector documentation citing registration location, extension points used, and verification method
- Equal application to `SocialConnector` and `AIProviderConnector` additions, removals, and swaps
- Traceability of the verification method in the permanent contract test suite

**Out of scope:**
- Defining or changing the internal behavior of any specific connector implementation
- Changes to core ingestion pipeline business logic, rate limiting, error handling, or enrichment rules
- User-facing admin UI or self-service connector registration flows
- Resolution of whether the policy also applies to connector deprecation / removal (left as an open question for a future ADR)
- Resolution of the exact CI implementation mechanism beyond a deterministic, repository-run check

## 3. Context and Background
This project repeatedly states a core architecture promise: adding or swapping a connector (social or AI) must not require editing core ingestion pipeline/orchestration logic.

Today that promise is asserted in story language and validated by selective story-level tests, but there is no explicit project policy defining mandatory verification evidence for every connector addition. That leaves a gap where accidental coupling, hard-coded provider branching, or undocumented extension-point bypass can creep into the core path over time.
The product's core ingestion pipeline is intentionally modular: adding, removing, or swapping a connector should not require changes to core orchestration logic. Today that promise is stated in user stories and validated by selective tests, but there is no explicit, project-wide policy that mandates the evidence every connector registration must provide. This leaves a gap where hard-coded provider branches, accidental coupling, or undocumented extension-point bypasses can enter the core path over time.

ADR-0048 closes the gap by establishing a durable, enforceable verification policy for every new connector registration PR. This Business Requirements Document translates that policy into business needs: mandatory evidence of no core-path edits, an automated CI guardrail, a required registration-traceability note in connector documentation, and equal application to both social and AI connector classes. The expected business value is a continuously testable architecture, reduced connector-related technical debt, and faster, more confident PR approvals.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Preserve the core ingestion pipeline's modularity | New connector PRs produce zero edits to core ingestion orchestration files |
| 2 | Prevent hard-coded provider branching and API-surface leaks | No `providerId`-specific literals appear in core pipeline files for any new connector registration |
| 3 | Make the "no core change" architectural promise continuously testable | Every connector PR is accompanied by deterministic, mechanical verification evidence |
| 4 | Reduce long-term connector technical debt | Connector additions and swaps remain confined to connector implementation and registry surfaces |
| 5 | Maintain parity across connector classes | Policy coverage is identical for `SocialConnector` and `AIProviderConnector` additions, removals, and swaps |

---

**Positive consequences (from ADR):**
**Positive**
- Prevents accidental API-surface leaks and hard-coded provider branches in the core pipeline.
- Makes an architectural promise continuously testable, not only narratively asserted.
- Reduces long-term connector tech-debt and preserves clean extension boundaries.

**Negative**
- Adds PR and CI overhead for connector work.
- Requires ongoing maintenance of designated extension-point checks as code structure evolves.

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | For every new connector registration, swap, or removal PR, the author must provide evidence that the only edited files are the connector implementation and the designated connector registry / registration surface | Must | A contract test or diff policy can be run that identifies the files changed for connector registration and flags any core ingestion orchestration edit | Core Backend Engineer |
| BR-002 | CI must run a deterministic guardrail on every connector-affecting PR that fails if connector registration behavior is placed outside the designated extension points | Must | The guardrail runs automatically on every relevant PR and produces a clear pass/fail result | Platform Maintainer |
| BR-003 | Every connector's documentation must include a registration traceability note | Must | The note lists the registration location, the extension points used, and how no-core-change verification was satisfied | Core Backend Engineer |
| BR-004 | The verification policy must apply equally to `SocialConnector` and `AIProviderConnector` additions, removals, and swaps | Must | The same guardrail and evidence rules run for social and AI connector PRs | Platform Maintainer |
| BR-005 | The verification evidence must be stored in the repository as part of the permanent contract suite | Should | A Jest contract test or equivalent deterministic artifact is committed alongside the connector and runs with `npm test` | Core Backend Engineer |

Priority levels: Must / Should / Could / Won't (MoSCoW)

### 5.1 Architecture Decision
**Durable decision (scope statement):** Connector registration must not require edits outside the designated registration surfaces — the connector implementation itself and the designated connector registry/registration surface. Any edit to core ingestion orchestration for registration purposes is out of policy unless accompanied by a separately approved ADR superseding this rule. The numbered items below are the verification mechanism for this rule, not separate rules of their own.

Adopt an explicit, enforceable verification policy for every new connector registration PR:

1. **Mandatory evidence of no core-path edits for registration.**
   Every connector PR must provide test evidence that connector registration required changes only in:
   - the connector implementation itself, and
   - the designated connector registry/registration surface.
   Any edit to core ingestion orchestration for registration purposes fails policy unless accompanied by a separately approved ADR superseding this rule.

2. **Automation guardrail in CI.**
   CI must include an automated check that fails when connector-registration behavior is implemented outside designated extension points.
   The check may be implemented as a focused diff policy, a path-based guard, or an equivalent contract test gate, but it must be deterministic and run on every connector PR.

3. **Required registration traceability note.**
   Documentation for each connector must explicitly cite:
   - where registration occurs,
   - which extension points are used,
   - and how no-core-change verification was satisfied in that PR.

4. **Applies equally to social and AI connector types.**
   The policy is connector-class agnostic and covers `SocialConnector` and `AIProviderConnector` additions/removals/swaps.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Core Backend Engineer | Implements and registers new connectors | High | Clear, stable connector extension points and an objective pass/fail check |
| Platform Maintainer | Owns core pipeline stability and CI | High | A deterministic, low-maintenance guardrail that catches coupling regressions early |
| Product Owner / Technical Lead (Menno) | Sponsors architecture and approves exceptions | High | Evidence that the no-core-change promise is continuously enforced |
| QA / Release Reviewer | Verifies PR evidence before merge | Medium | Explicit, machine-readable verification attached to every connector PR |
| Downstream Connector Story Owners | Depend on the no-core-change invariant | High | A durable policy that keeps their own connector work from being blocked by pipeline drift |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 2.10 | epic-2-ingestion-connectors-and-rate-limits.md |  | Every connector registration is backed by tests proving untouched core ingestion paths.; A CI guardrail runs focused diff checks or contract tests for each P... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| Connector registration record | The connector's `providerId`, `authMode`, `deliveryMode`, and registry entry | Connector implementation + registry | Core Backend Engineer | Internal |
| Designated extension-point manifest | The list of core files and registry surfaces a connector is permitted to touch without superseding ADR | ADR-0048 / Story 2.10 | Platform Maintainer | Internal |
| PR diff evidence | The set of files changed in a connector PR, used to prove no core-path edits | Git diff / contract test | Core Backend Engineer | Internal |
| Verification traceability note | The prose in each connector's documentation describing registration, extension points, and verification method | Connector documentation | Core Backend Engineer | Internal |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | Connector registration must not require edits outside the connector implementation and the designated connector registry / registration surface |
| BRU-002 | Any edit to core ingestion orchestration for the purpose of connector registration is out of policy unless a separately approved ADR explicitly supersedes ADR-0048 |
| BRU-003 | CI must fail a connector PR when connector-registration behavior is implemented outside the designated extension points |
| BRU-004 | Every connector's documentation must explicitly cite where registration occurs, which extension points are used, and how no-core-change verification was satisfied |
| BRU-005 | The policy is connector-class agnostic and covers `SocialConnector` and `AIProviderConnector` additions, removals, and swaps |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | Story 2.1 — Unified provider connector framework | Internal | Core Backend Engineer | Already Ready; provides the `ProviderConnector` / `SocialConnector` / `AIProviderConnector` contracts |
| D-002 | Story 2.10 — Connector Registration Transparency | Internal | Core Backend Engineer | Built 2026-08-12; delivers the guardrail contract and `CORE_FILES` set |
| D-003 | Story 2.8 / 2.9 — Real `AIProviderConnector` implementations | Internal | Core Backend Engineer | Already built; proves the policy applies to AI connectors |
| D-004 | ADR-0002 — Connector abstraction contract | Internal | Product Owner / Technical Lead | Accepted; source of the registration surface design |
| D-005 | Existing Jest contract suite and CI | Internal | Platform Maintainer | Already in place; host for the guardrail |
| D-006 | Future ADR on connector deprecation / removal scope | Internal | Product Owner / Technical Lead | Deferred — open question in ADR-0048 §Open Questions |

---

- ADR-0048 has been accepted and is in effect
- The `ProviderConnector` / `SocialConnector` / `AIProviderConnector` abstraction from ADR-0002 (Story 2.1) is the designated registration surface
- Story 2.10 or an equivalent implementation has delivered the guardrail contract
- The existing Jest contract suite in `social-listening-core` is the enforcement mechanism for the CI guardrail

**Durable decision (scope statement):** Connector registration must not require edits outside the designated registration surfaces — the connector implementation itself and the designated connector registry/registration surface. Any edit to core ingestion orchestration for registration purposes is out of policy unless accompanied by a separately approved ADR superseding this rule. The numbered items below are the verification mechanism for this rule, not separate rules of their own.

Adopt an explicit, enforceable verification policy for every new connector registration PR:

1. **Mandatory evidence of no core-path edits for registration.**
   Every connector PR must provide test evidence that connector registration required changes only in:
   - the connector implementation itself, and
   - the designated connector registry/registration surface.
   Any edit to core ingestion orchestration for registration purposes fails policy unless accompanied by a separately approved ADR superseding this rule.

2. **Automation guardrail in CI.**
   CI must include an automated check that fails when connector-registration behavior is implemented outside designated extension points.
   The check may be implemented as a focused diff policy, a path-based guard, or an equivalent contract test gate, but it must be deterministic and run on every connector PR.

3. **Required registration traceability note.**
   Documentation for each connector must explicitly cite:
   - where registration occurs,
   - which extension points are used,
   - and how no-core-change verification was satisfied in that PR.

4. **Applies equally to social and AI connector types.**
   The policy is connector-class agnostic and covers `SocialConnector` and `AIProviderConnector` additions/removals/swaps.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | The CI guardrail must be deterministic and produce the same result for the same inputs across runs | Reliability | Must | Re-running the check on the same commit produces identical pass/fail output |
| NFR-002 | Any exception that allows a core-pipeline edit for connector registration must be traceable to a separately approved ADR | Compliance | Must | The exception is cited by ADR number and the superseding ADR is accepted |
| NFR-003 | The verification mechanism must be machine-readable and not depend on manual interpretation | Maintainability | Must | The check can be run headlessly in CI and returns an unambiguous result |
| NFR-004 | The list of designated extension points must be versioned and updated as the codebase evolves | Maintainability | Should | The `CORE_FILES` / extension-point set is committed to the repo and changed only through normal review |
| NFR-005 | The guardrail must complete quickly enough to run in the existing PR test suite | Performance | Should | The check runs in under one minute for the current set of real connectors |

Categories include: Performance, Security, Reliability, Scalability, Usability, Compliance, Maintainability, Accessibility.

---

## 11. Error Handling and Exceptions
**Positive**
- Prevents accidental API-surface leaks and hard-coded provider branches in the core pipeline.
- Makes an architectural promise continuously testable, not only narratively asserted.
- Reduces long-term connector tech-debt and preserves clean extension boundaries.

**Negative**
- Adds PR and CI overhead for connector work.
- Requires ongoing maintenance of designated extension-point checks as code structure evolves.

## 12. Assumptions and Dependencies
- ADR-0048 has been accepted and is in effect
- The `ProviderConnector` / `SocialConnector` / `AIProviderConnector` abstraction from ADR-0002 (Story 2.1) is the designated registration surface
- Story 2.10 or an equivalent implementation has delivered the guardrail contract
- The existing Jest contract suite in `social-listening-core` is the enforcement mechanism for the CI guardrail

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | The CI guardrail adds friction or false positives to every connector PR | Medium | Medium | Keep the check focused on a committed `CORE_FILES` set and deterministic string-literal/diff rules; review after each real connector | Platform Maintainer |
| R-002 | The list of designated extension points becomes stale as the core pipeline evolves | Medium | High | Version the `CORE_FILES` / extension-point set and update it through normal PR review; include a dated note in the guardrail contract | Core Backend Engineer |
| R-003 | The guardrail produces false negatives if a connector bypasses the registry through an unexpected file | Low | High | Use a combination of path-based diff checks and contract tests that fail on provider-specific literals in core files | Platform Maintainer |
| R-004 | Enforcement is inconsistent between `SocialConnector` and `AIProviderConnector` PRs | Low | Medium | Run the same guardrail against both connector classes; include both in the contract's `REAL_CONNECTORS` data set | Core Backend Engineer |

---

## 14. Appendix
- ADR: `../../adr/0048-no-core-pipeline-change-verification-for-new-connector-registration.md`
- BRD: `../Business-Requirements/BRD-0048-No-Core-Pipeline-Change-Verification-For-New-Connector-Registration.md`
- Feature design: `docs/product-research/feature-designs/<feature>.md``
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above