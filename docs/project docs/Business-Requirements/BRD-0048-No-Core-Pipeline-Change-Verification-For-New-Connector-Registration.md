# Business Requirements Document — No Core Pipeline Change Verification for New Connector Registration

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | No Core Pipeline Change Verification for New Connector Registration – Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-11 |
| Author(s) | AI Business & Requirements Analyst |
| Approver(s) | Menno (Product Owner / Technical Lead) |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-11 | AI Business & Requirements Analyst | Initial draft derived from ADR-0048 and Story 2.10 |
| 1.0 | 2026-08-11 | AI Business & Requirements Analyst | Approved alongside ADR-0048 acceptance |

---

## 2. Executive Summary

The product's core ingestion pipeline is intentionally modular: adding, removing, or swapping a connector should not require changes to core orchestration logic. Today that promise is stated in user stories and validated by selective tests, but there is no explicit, project-wide policy that mandates the evidence every connector registration must provide. This leaves a gap where hard-coded provider branches, accidental coupling, or undocumented extension-point bypasses can enter the core path over time.

ADR-0048 closes the gap by establishing a durable, enforceable verification policy for every new connector registration PR. This Business Requirements Document translates that policy into business needs: mandatory evidence of no core-path edits, an automated CI guardrail, a required registration-traceability note in connector documentation, and equal application to both social and AI connector classes. The expected business value is a continuously testable architecture, reduced connector-related technical debt, and faster, more confident PR approvals.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Preserve the core ingestion pipeline's modularity | New connector PRs produce zero edits to core ingestion orchestration files |
| 2 | Prevent hard-coded provider branching and API-surface leaks | No `providerId`-specific literals appear in core pipeline files for any new connector registration |
| 3 | Make the "no core change" architectural promise continuously testable | Every connector PR is accompanied by deterministic, mechanical verification evidence |
| 4 | Reduce long-term connector technical debt | Connector additions and swaps remain confined to connector implementation and registry surfaces |
| 5 | Maintain parity across connector classes | Policy coverage is identical for `SocialConnector` and `AIProviderConnector` additions, removals, and swaps |

---

## 4. Scope

### 4.1 In Scope

- Verification policy for every new connector registration or swap
- Mandatory evidence that connector registration changed only the connector implementation and the designated connector registry / registration surface
- A deterministic CI guardrail that runs on every connector-affecting PR
- Required connector documentation citing registration location, extension points used, and verification method
- Equal application to `SocialConnector` and `AIProviderConnector` additions, removals, and swaps
- Traceability of the verification method in the permanent contract test suite

### 4.2 Out of Scope

- Defining or changing the internal behavior of any specific connector implementation
- Changes to core ingestion pipeline business logic, rate limiting, error handling, or enrichment rules
- User-facing admin UI or self-service connector registration flows
- Resolution of whether the policy also applies to connector deprecation / removal (left as an open question for a future ADR)
- Resolution of the exact CI implementation mechanism beyond a deterministic, repository-run check

### 4.3 Assumptions

- ADR-0048 has been accepted and is in effect
- The `ProviderConnector` / `SocialConnector` / `AIProviderConnector` abstraction from ADR-0002 (Story 2.1) is the designated registration surface
- Story 2.10 or an equivalent implementation has delivered the guardrail contract
- The existing Jest contract suite in `social-listening-core` is the enforcement mechanism for the CI guardrail

### 4.4 Constraints

- Policy must not introduce unmanageable PR friction; checks must be focused and deterministic
- Any proposed core-pipeline edit for connector registration purposes must be accompanied by a separately approved ADR superseding ADR-0048
- The set of designated extension points must be maintained as the codebase evolves

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Core Backend Engineer | Implements and registers new connectors | High | Clear, stable connector extension points and an objective pass/fail check |
| Platform Maintainer | Owns core pipeline stability and CI | High | A deterministic, low-maintenance guardrail that catches coupling regressions early |
| Product Owner / Technical Lead (Menno) | Sponsors architecture and approves exceptions | High | Evidence that the no-core-change promise is continuously enforced |
| QA / Release Reviewer | Verifies PR evidence before merge | Medium | Explicit, machine-readable verification attached to every connector PR |
| Downstream Connector Story Owners | Depend on the no-core-change invariant | High | A durable policy that keeps their own connector work from being blocked by pipeline drift |

---

## 6. Current State (As-Is)

**Current process:**

1. The connector abstraction (Story 2.1 / ADR-0002) already defines `ProviderConnector`, `SocialConnector`, and `AIProviderConnector` contracts.
2. Adding a connector is expected to require only interface implementation and registration.
3. Some existing connectors (GNews, Newswire, Azure AI Language, Azure OpenAI) have been added under this expectation.
4. PR review relies on human inspection and story-level acceptance criteria to confirm that the core pipeline was not modified.

**Pain points:**

- No project-wide, mandatory evidence requirement for every connector PR
- No automated, deterministic check that fails when connector registration logic is implemented outside designated extension points
- No central traceability note explaining where each connector is registered and how the no-core-change rule was satisfied
- Risk that future connectors accidentally introduce provider-specific branching or hard-coded strings into the core pipeline

---

## 7. Future State (To-Be)

**New or improved process:**

1. Every new connector PR — whether `SocialConnector` or `AIProviderConnector` — is accompanied by evidence that changes were limited to the connector implementation and the designated connector registry / registration surface.
2. CI runs a focused, deterministic guardrail on each connector-affecting PR that fails if connector-registration behavior is implemented outside the designated extension points.
3. Each connector's documentation explicitly states the registration location, the extension points used, and the method used to satisfy no-core-change verification.
4. Any team member can inspect the permanent contract test and the connector's own documentation to understand how the invariant was enforced.

**Expected capabilities:**

- Mechanical verification of the no-core-pipeline-change promise for every connector PR
- Automatic blocking of PRs that violate the designated extension-point policy
- A durable, living record of connector registration evidence
- Equal enforcement across social and AI connector classes

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | For every new connector registration, swap, or removal PR, the author must provide evidence that the only edited files are the connector implementation and the designated connector registry / registration surface | Must | A contract test or diff policy can be run that identifies the files changed for connector registration and flags any core ingestion orchestration edit | Core Backend Engineer |
| BR-002 | CI must run a deterministic guardrail on every connector-affecting PR that fails if connector registration behavior is placed outside the designated extension points | Must | The guardrail runs automatically on every relevant PR and produces a clear pass/fail result | Platform Maintainer |
| BR-003 | Every connector's documentation must include a registration traceability note | Must | The note lists the registration location, the extension points used, and how no-core-change verification was satisfied | Core Backend Engineer |
| BR-004 | The verification policy must apply equally to `SocialConnector` and `AIProviderConnector` additions, removals, and swaps | Must | The same guardrail and evidence rules run for social and AI connector PRs | Platform Maintainer |
| BR-005 | The verification evidence must be stored in the repository as part of the permanent contract suite | Should | A Jest contract test or equivalent deterministic artifact is committed alongside the connector and runs with `npm test` | Core Backend Engineer |

Priority levels: Must / Should / Could / Won't (MoSCoW)

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | The CI guardrail must be deterministic and produce the same result for the same inputs across runs | Reliability | Must | Re-running the check on the same commit produces identical pass/fail output |
| NFR-002 | Any exception that allows a core-pipeline edit for connector registration must be traceable to a separately approved ADR | Compliance | Must | The exception is cited by ADR number and the superseding ADR is accepted |
| NFR-003 | The verification mechanism must be machine-readable and not depend on manual interpretation | Maintainability | Must | The check can be run headlessly in CI and returns an unambiguous result |
| NFR-004 | The list of designated extension points must be versioned and updated as the codebase evolves | Maintainability | Should | The `CORE_FILES` / extension-point set is committed to the repo and changed only through normal review |
| NFR-005 | The guardrail must complete quickly enough to run in the existing PR test suite | Performance | Should | The check runs in under one minute for the current set of real connectors |

Categories include: Performance, Security, Reliability, Scalability, Usability, Compliance, Maintainability, Accessibility.

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | Connector registration must not require edits outside the connector implementation and the designated connector registry / registration surface |
| BRU-002 | Any edit to core ingestion orchestration for the purpose of connector registration is out of policy unless a separately approved ADR explicitly supersedes ADR-0048 |
| BRU-003 | CI must fail a connector PR when connector-registration behavior is implemented outside the designated extension points |
| BRU-004 | Every connector's documentation must explicitly cite where registration occurs, which extension points are used, and how no-core-change verification was satisfied |
| BRU-005 | The policy is connector-class agnostic and covers `SocialConnector` and `AIProviderConnector` additions, removals, and swaps |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| Connector registration record | The connector's `providerId`, `authMode`, `deliveryMode`, and registry entry | Connector implementation + registry | Core Backend Engineer | Internal |
| Designated extension-point manifest | The list of core files and registry surfaces a connector is permitted to touch without superseding ADR | ADR-0048 / Story 2.10 | Platform Maintainer | Internal |
| PR diff evidence | The set of files changed in a connector PR, used to prove no core-path edits | Git diff / contract test | Core Backend Engineer | Internal |
| Verification traceability note | The prose in each connector's documentation describing registration, extension points, and verification method | Connector documentation | Core Backend Engineer | Internal |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Connector PR guardrail pass/fail rate | Track compliance with the no-core-change policy | Platform Maintainer / Technical Lead | Per PR |
| Count of core-path edits blocked by the guardrail | Measure policy effectiveness and catch architectural drift early | Product Owner / Technical Lead | Monthly |
| Connector documentation completeness | Ensure every connector has the required traceability note | QA / Release Reviewer | Per connector PR |
| Social vs AI connector parity | Confirm both connector classes are equally covered by the guardrail | Product Owner | Quarterly |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | The CI guardrail adds friction or false positives to every connector PR | Medium | Medium | Keep the check focused on a committed `CORE_FILES` set and deterministic string-literal/diff rules; review after each real connector | Platform Maintainer |
| R-002 | The list of designated extension points becomes stale as the core pipeline evolves | Medium | High | Version the `CORE_FILES` / extension-point set and update it through normal PR review; include a dated note in the guardrail contract | Core Backend Engineer |
| R-003 | The guardrail produces false negatives if a connector bypasses the registry through an unexpected file | Low | High | Use a combination of path-based diff checks and contract tests that fail on provider-specific literals in core files | Platform Maintainer |
| R-004 | Enforcement is inconsistent between `SocialConnector` and `AIProviderConnector` PRs | Low | Medium | Run the same guardrail against both connector classes; include both in the contract's `REAL_CONNECTORS` data set | Core Backend Engineer |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | Story 2.1 — Unified provider connector framework | Internal | Core Backend Engineer | Already Ready; provides the `ProviderConnector` / `SocialConnector` / `AIProviderConnector` contracts |
| D-002 | Story 2.10 — Connector Registration Transparency | Internal | Core Backend Engineer | Built 2026-08-12; delivers the guardrail contract and `CORE_FILES` set |
| D-003 | Story 2.8 / 2.9 — Real `AIProviderConnector` implementations | Internal | Core Backend Engineer | Already built; proves the policy applies to AI connectors |
| D-004 | ADR-0002 — Connector abstraction contract | Internal | Product Owner / Technical Lead | Accepted; source of the registration surface design |
| D-005 | Existing Jest contract suite and CI | Internal | Platform Maintainer | Already in place; host for the guardrail |
| D-006 | Future ADR on connector deprecation / removal scope | Internal | Product Owner / Technical Lead | Deferred — open question in ADR-0048 §Open Questions |

---

## 14. Acceptance Criteria

- Every connector-affecting PR provides test evidence that the only changed files are the connector implementation and the designated connector registry / registration surface.
- CI runs a deterministic, focused guardrail that fails when connector registration behavior is implemented outside the designated extension points.
- Every connector's documentation includes a traceability note that explicitly states: (a) where registration occurs, (b) which extension points are used, and (c) how no-core-change verification was satisfied.
- The guardrail and evidence rules apply uniformly to `SocialConnector` and `AIProviderConnector` additions, removals, and swaps.
- Any allowed core-pipeline edit is accompanied by a separately approved ADR that supersedes ADR-0048.
- Story 2.10's contract test passes and demonstrates the invariant for all existing real connectors.

---

## 15. Glossary

| Term | Definition |
|---|---|
| Core ingestion orchestration / pipeline | The shared ingestion logic that normalizes, enriches, and persists `SocialPost` rows, independent of any one connector's behavior |
| Connector implementation | The connector-specific code that implements `ProviderConnector`, `SocialConnector`, or `AIProviderConnector` |
| Designated connector registry / registration surface | The single, well-defined place where connectors are declared and loaded by the core pipeline (e.g., `registry.ts`) |
| Designated extension point | The interfaces, registry, and configuration surfaces a connector is permitted to use without a superseding ADR |
| No-core-change verification | The evidence that a connector registration PR did not modify core ingestion orchestration files |
| `CORE_FILES` | The committed set of core pipeline files against which the guardrail checks for connector-specific literals or edits |
| `SocialConnector` | The specialization of `ProviderConnector` for social / content-source platforms |
| `AIProviderConnector` | The specialization of `ProviderConnector` for AI enrichment providers |

---

## 16. Appendices

### A. Reference Documents

- `docs/adr/0048-no-core-pipeline-change-verification-for-new-connector-registration.md` — source ADR
- `docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md` — Story 2.10 and related connector stories
- `docs/user-stories/README.md` — status convention and epic mapping
- `docs/adr/0002-*.md` — connector abstraction contract (Story 2.1)
- `docs/adr/0038-*.md` — Azure AI Language connector (Story 2.8)
- `docs/adr/0050-*.md` — tenant-owned-domain RSS/content-feed connector (Story 2.11)
- `docs/adr/0042-*.md` — Wikipedia connector (Story 2.13)

### B. Related User Stories

- **Story 2.1** — Unified provider connector framework (source: ADR-0002)
- **Story 2.8** — Concrete AI enrichment provider connector: Azure AI Language
- **Story 2.9** — Second `AIProviderConnector`: Azure-hosted LLM swappability validation
- **Story 2.10** — Connector Registration Transparency (source: ADR-0048)
- **Story 2.11** — Tenant-owned-domain RSS/content-feed connector
- **Story 2.13** — Wikipedia connector

### C. Missing Source Material

- No dedicated `docs/product-research/feature-designs/<feature>.md` file exists for this ADR; the policy is an architecture-governance requirement rather than a user-facing product feature.
- No `docs/product-research/reports/<feature>-deep-research.md` file exists for this ADR.

These gaps are explicitly noted in the appendices as permitted by the BRD Writer Agent instructions.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | 2026-08-11 |
| Product Owner | Menno | | 2026-08-11 |
| Technical Lead | Menno | | 2026-08-11 |
| Other Stakeholder | — | | — |
