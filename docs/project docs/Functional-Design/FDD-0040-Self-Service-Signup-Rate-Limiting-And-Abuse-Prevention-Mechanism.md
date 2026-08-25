# Functional Design Document

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | FDD-0040 Self-Service Sign-up Rate Limiting and Abuse Prevention Mechanism — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0040-self-service-signup-rate-limiting-and-abuse-prevention-mechanism.md, ../Business-Requirements/BRD-0040-Self-Service-Signup-Rate-Limiting-And-Abuse-Prevention-Mechanism.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0040-self-service-signup-rate-limiting-and-abuse-prevention-mechanism.md and the business requirements in BRD-0040-Self-Service-Signup-Rate-Limiting-And-Abuse-Prevention-Mechanism.md into functional design for **Self Service Signup Rate Limiting And Abuse Prevention Mechanism**.
The `POST /v1/tenants/self-service-signup` endpoint is, by design, the one route in the SocialEngage project that accepts a caller who has a validly-signed Entra token but does not yet resolve to any existing `tenants` or `users` row. This creates a genuine abuse-prevention gap: a script or a distributed actor could repeatedly create new tenants before any tenant-level identity exists on which an ordinary rate limiter could key. The existing `RequestGate` mechanism is intentionally keyed by `(tenantId, providerId)` and therefore cannot operate at this pre-identity boundary.

This BRD describes a new, narrowly-scoped rate-limiting and abuse-prevention mechanism dedicated to that one endpoint. The mechanism will track sign-up attempts in two independent rolling windows—one keyed by the caller's source IP address and one keyed by the verified email domain from the Entra token—and will reject further attempts with HTTP `429` when either window's threshold is crossed. The numeric defaults are explicitly template values and are expected to be tuned as real sign-up traffic emerges.

The expected business value is the closure of ADR-0037 §7's named precondition, protection of platform availability against cheap and naive volumetric attacks, and a deliberately narrow scope that avoids retrofitting the wrong mechanism or adding unnecessary third-party services.

---

### 2.2 Scope
**In scope:**
- A new, dedicated rate-limiting mechanism for `POST /v1/tenants/self-service-signup`, structurally independent of `RequestGate`.
- Per-IP-address rolling-window rate limiting with a configurable default of 10 attempts per 24 hours.
- Per-verified-email-domain rolling-window rate limiting with a configurable default of 5 attempts per 24 hours.
- Keying the domain limit on the raw domain captured from the token's OTP-verified `email` claim, before public-email-provider denylist filtering.
- Returning HTTP `429` once either threshold is crossed.
- Keeping the `429` rejection path distinct from ADR-0037 §3's domain-match `409` rejection and from ADR-0037 §8c's escalation logic.
- Reading thresholds and window durations from environment configuration, not hardcoding them.
- In-process storage for the attempt counters for the current single-instance deployment posture.

**Out of scope:**
- Reuse or modification of `RequestGate` to handle pre-identity sign-up attempts.
- Introduction of third-party CAPTCHA, managed WAF, or dedicated bot-detection services in v1.
- Real-time alerting or paging for rate-limit rejections.
- Writing rejected-attempt records to `platform_admin_audit_log` (a possible future enhancement, not required here).
- Distributed or shared storage for the counter state (deferred until a multi-instance deployment need is demonstrated).
- Per-user or per-tenant rate limiting, which is impossible at this pre-identity boundary.

## 3. Context and Background
`POST /v1/tenants/self-service-signup` (ADR-0037, Story 5.15 in this same batch) is, by ADR-0037 §5's own explicit design, **the one endpoint in this entire project reachable by a caller holding a validly-signed Entra token that resolves to no existing `users` or `platform_admins` row at all** — every other route in this project rejects such a caller outright (ADR-0029 §4). ADR-0037 §7 already narrows the realistic threat model considerably (§8a's email-OTP-verification precondition means an attacker needs control of real, distinct, individually-verified mailboxes, not merely fabricated email strings) and already bounds the real-world severity of a successfully-abused tenant (§7's own added note: a freshly-created tenant is an empty shell with zero ambient access to any external system, since every connector requires its own separate, vendor-issued credential per ADR-0027/ADR-0028). **What remains genuinely undesigned is the mechanism itself** — nothing currently in this project can rate-limit a caller before a resolved tenant/user identity exists to key a limit on.

This project's one existing rate-limiting mechanism, `RequestGate` (ADR-0003, ADR-0020), is keyed by `(tenantId, providerId)` — structurally inapplicable here, since neither exists yet at the moment this endpoint is invoked. A new, differently-keyed mechanism is required, which ADR-0037 §7 itself already flagged rather than improvised. This crosses this series' own bar for a fresh ADR (ADR-0027/0028/0035/0036/0038's "hard-to-reverse, real security consequence, not just a new field/endpoint shape") for a reason distinct from why Stories 5.12–5.17 in this same batch do **not** need one: those stories expose an *already fully-designed* authorization boundary or data model over HTTP; this one requires *inventing* a new state/keying mechanism with real DoS/availability stakes if built wrong — the same category of decision that earned ADR-0020 its own ADR (rate-limit queue bounds and distributed gate state) rather than being left as an implementation detail of whichever story needed it.
The `POST /v1/tenants/self-service-signup` endpoint is, by design, the one route in the SocialEngage project that accepts a caller who has a validly-signed Entra token but does not yet resolve to any existing `tenants` or `users` row. This creates a genuine abuse-prevention gap: a script or a distributed actor could repeatedly create new tenants before any tenant-level identity exists on which an ordinary rate limiter could key. The existing `RequestGate` mechanism is intentionally keyed by `(tenantId, providerId)` and therefore cannot operate at this pre-identity boundary.

This BRD describes a new, narrowly-scoped rate-limiting and abuse-prevention mechanism dedicated to that one endpoint. The mechanism will track sign-up attempts in two independent rolling windows—one keyed by the caller's source IP address and one keyed by the verified email domain from the Entra token—and will reject further attempts with HTTP `429` when either window's threshold is crossed. The numeric defaults are explicitly template values and are expected to be tuned as real sign-up traffic emerges.

The expected business value is the closure of ADR-0037 §7's named precondition, protection of platform availability against cheap and naive volumetric attacks, and a deliberately narrow scope that avoids retrofitting the wrong mechanism or adding unnecessary third-party services.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Close ADR-0037 §7's precondition before the self-service sign-up endpoint is exposed to real, untrusted traffic | Story 5.18 built and contract-verified; `docs/open-decisions.md` §1 gap resolved |
| 2 | Prevent cheap, naive sign-up abuse without relying solely on email-OTP verification | A single IP or a single verified domain cannot exceed its rolling-window allowance undetected |
| 3 | Preserve architectural separation between tenant/provider gating and pre-identity gating | `RequestGate` remains scoped to `(tenantId, providerId)` and is not reused or widened |
| 4 | Keep the solution self-contained and free of new external vendor machinery | No third-party CAPTCHA, WAF, or bot-detection service is introduced in v1 |
| 5 | Provide revisable numeric defaults without requiring a new ADR | Thresholds are configuration-driven and can be tuned via ADR-0040's Amendment Log |

---

**Positive consequences (from ADR):**
**Positive**
- Closes ADR-0037 §7's own explicitly-named precondition before Story 5.15's endpoint is exposed to real, untrusted traffic — resolving a gap this project has already twice flagged (ADR-0037 itself, `docs/open-decisions.md` §1) rather than leaving it open a third time.
- Reuses ADR-0037 §8b's own `domain_signup_attempts` data for the domain-keyed limit rather than inventing a second, parallel attempt log.
- Deliberately independent of `RequestGate` — avoids retrofitting a mechanism designed for a different keying shape (resolved tenant/provider) onto a caller that, by this endpoint's own design, has neither yet.

**Negative**
- **Does not fully close the volumetric-abuse gap ADR-0037 §7 already named as accepted-but-real** — a sufficiently determined attacker controlling many real mailboxes across many domains they independently control, rotating source IPs, is not fully stopped by either key alone. This ADR bounds the cheap/naive cases, consistent with ADR-0037 §7's own already-stated severity ceiling (a successfully-created tenant is an empty shell with no ambient external access), not a claim of complete closure.
- **A new, small piece of stateful infrastructure** (the attempt-counter store) is real, if narrow, operational surface — the same trade-off this series has already accepted for `identity_resolver_role` (ADR-0032) and `tenant_signup_role` (ADR-0037) each adding their own small increase in system complexity.
- **The numeric defaults (§3) are unanalyzed template values**, the same accepted trade-off ADR-0037 §8b's own thresholds already carry — may need tuning once real sign-up traffic exists, and a too-tight default risks rejecting a legitimate burst (e.g. a real company's several employees signing up in quick succession before any of them is yet invited) as if it were abuse.

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall track self-service sign-up attempts per source IP address in a rolling 24-hour window | Must | A caller exceeding the configured IP threshold receives `429`; a caller from a different IP is unaffected | Technical Lead |
| BR-002 | The system shall track self-service sign-up attempts per verified email domain in a rolling 24-hour window | Must | Several distinct verified emails at one domain, exceeding the threshold, are rejected; a different domain is unaffected | Technical Lead |
| BR-003 | The system shall reject `POST /v1/tenants/self-service-signup` with HTTP `429` once either the IP or the domain threshold is crossed | Must | Contract test confirms `429` returned before any tenant/user database work begins | Technical Lead |
| BR-004 | The system shall keep the `429` rate-limit rejection path independent of the `409` domain-match rejection and escalation path | Must | A `429` does not write a `domain_signup_attempts` row or trigger the escalation logic in Story 5.16 | Technical Lead |
| BR-005 | The system shall read the rate-limit thresholds and window durations from configuration | Should | Environment variables or equivalent config exist for IP threshold, domain threshold, and window length; defaults match ADR-0040 §3 | Technical Lead |
| BR-006 | The system shall use in-process storage for the attempt counters for the current single-instance deployment posture | Should | Counter state is held in process memory; multi-instance limitations are documented | Technical Lead |
| BR-007 | The system shall key the domain limit on the raw domain extracted from the token's `email` claim, before any public-email-provider denylist is applied | Must | Attempts against a denylisted public domain such as `gmail.com` are rate-limited by that domain key | Technical Lead |

Priority levels: Must / Should / Could / Won't (MoSCoW)

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Menno (Product Owner / Business Sponsor) | Sole sponsor and decision authority | High | A minimal, self-contained mechanism that closes the open decision and unblocks public exposure |
| Platform Operator | Operates the `social-listening-core` service | High | Availability protection and clear, tunable thresholds |
| Platform Admin | Reviews platform-level audit and escalation signals | Medium | Future visibility into rejected attempts; clear distinction from domain-match escalations |
| Tenant Admin (prospective) | Legitimate self-service sign-up user | Medium | Ability to complete sign-up without being blocked by a falsely tight threshold |
| Security / Architecture Reviewer | Validates design safety | High | Architectural separation from `RequestGate` and correct pre-identity keying |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 5.18 | epic-5-security-isolation-and-messaging.md | As platform operator exposing the one unauthenticated-until-resolved endpoint in this project, I want sign-up attempts rate-limited by IP address and by veri... | A new, dedicated rate-limiting mechanism — structurally independent of `RequestGate` (ADR-0003/ADR-0020), which stays scoped to `(tenantId, providerId)` — re... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| In-process per-IP attempt counter | Rolling count of sign-up attempts keyed by caller source IP | Runtime request metadata | Technical Lead | Operational |
| In-process per-domain attempt counter | Rolling count of sign-up attempts keyed by raw verified email domain | Entra token `email` claim | Technical Lead | Operational |
| `domain_signup_attempts` table | Persists domain-match rejection history for Tenant-Admin visibility and escalation (referenced conceptually, not used as the rate-limit store) | Story 5.15 / 5.16 | Technical Lead | Tenant-scoped |
| Rate-limit configuration | Environment variables or equivalent holding IP threshold, domain threshold, and window length | Deployment configuration | Platform Operator | Operational |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | Both per-IP and per-verified-email-domain rate limiting are enforced; neither key alone is treated as sufficient. |
| BRU-002 | A `429` rejection under the rate-limit mechanism is a distinct outcome from the `409` domain-match rejection in ADR-0037 §3. |
| BRU-003 | A `429` rejection does not write a `domain_signup_attempts` row and does not trigger Story 5.16's escalation logic. |
| BRU-004 | The raw domain from the token's `email` claim is used for the domain-keyed limit, before public-email-provider denylist filtering. |
| BRU-005 | The numeric thresholds may be revised via the ADR-0040 Amendment Log without requiring a new ADR. |
| BRU-006 | `RequestGate` remains scoped to `(tenantId, providerId)` outbound-request gating and is not repurposed for self-service sign-up rate limiting. |
| BRU-007 | In-process counter storage is acceptable only while the deployment remains a single concurrent instance. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | `POST /v1/tenants/self-service-signup` endpoint built (Story 5.15) | Internal | Technical Lead | Resolved 2026-08-06 |
| D-002 | ADR-0037 accepted and the `domain_signup_attempts` concept defined | Internal | Product Owner | Resolved 2026-08-04 |
| D-003 | Entra token with verified `email` claim available at the sign-up endpoint | External (Entra) | Platform Operator | Resolved |
| D-004 | `domain_signup_attempts` table and Tenant-Admin read path (Story 5.16) | Internal | Technical Lead | Resolved / Ready |

---

- The project remains a single-instance deployment, consistent with the posture that deferred `RequestGate` distributed state in ADR-0020.
- `POST /v1/tenants/self-service-signup` already exists and accepts callers with no resolved `tenants`/`users` row (ADR-0037, Story 5.15).
- Entra External ID already returns a token with an OTP-verified `email` claim as required by ADR-0037 §8a.
- `domain_signup_attempts` (Story 5.16) already captures the domain-match concept and is available as a contextual reference, but the rate-limit counter is a separate, in-process construct.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | The rate-limit check must not materially increase end-to-end sign-up latency | Performance | Should | p95 latency of the sign-up endpoint remains within the same order of magnitude as before the mechanism was added |
| NFR-002 | The mechanism must be a separately maintained component, not a special case inside `RequestGate` | Maintainability | Must | No `RequestGate` code path is modified to accept a synthetic or null `tenantId`/`providerId` |
| NFR-003 | The mechanism must be safe to expose before the self-service sign-up endpoint is opened to untrusted traffic | Security | Must | The two-key design is implemented and contract-verified before public exposure |
| NFR-004 | The solution must operate without new external vendor dependencies | Security / Cost | Must | No new third-party CAPTCHA, WAF, or bot-detection service is used in v1 |
| NFR-005 | Numeric defaults must be revisable without an ADR supersession | Maintainability | Should | Thresholds are configuration-driven and the ADR Amendment Log can record any tune |

Categories include: Performance, Security, Reliability, Scalability, Usability, Compliance, Maintainability, Accessibility.

---

## 11. Error Handling and Exceptions
**Positive**
- Closes ADR-0037 §7's own explicitly-named precondition before Story 5.15's endpoint is exposed to real, untrusted traffic — resolving a gap this project has already twice flagged (ADR-0037 itself, `docs/open-decisions.md` §1) rather than leaving it open a third time.
- Reuses ADR-0037 §8b's own `domain_signup_attempts` data for the domain-keyed limit rather than inventing a second, parallel attempt log.
- Deliberately independent of `RequestGate` — avoids retrofitting a mechanism designed for a different keying shape (resolved tenant/provider) onto a caller that, by this endpoint's own design, has neither yet.

**Negative**
- **Does not fully close the volumetric-abuse gap ADR-0037 §7 already named as accepted-but-real** — a sufficiently determined attacker controlling many real mailboxes across many domains they independently control, rotating source IPs, is not fully stopped by either key alone. This ADR bounds the cheap/naive cases, consistent with ADR-0037 §7's own already-stated severity ceiling (a successfully-created tenant is an empty shell with no ambient external access), not a claim of complete closure.
- **A new, small piece of stateful infrastructure** (the attempt-counter store) is real, if narrow, operational surface — the same trade-off this series has already accepted for `identity_resolver_role` (ADR-0032) and `tenant_signup_role` (ADR-0037) each adding their own small increase in system complexity.
- **The numeric defaults (§3) are unanalyzed template values**, the same accepted trade-off ADR-0037 §8b's own thresholds already carry — may need tuning once real sign-up traffic exists, and a too-tight default risks rejecting a legitimate burst (e.g. a real company's several employees signing up in quick succession before any of them is yet invited) as if it were abuse.

## 12. Assumptions and Dependencies
- The project remains a single-instance deployment, consistent with the posture that deferred `RequestGate` distributed state in ADR-0020.
- `POST /v1/tenants/self-service-signup` already exists and accepts callers with no resolved `tenants`/`users` row (ADR-0037, Story 5.15).
- Entra External ID already returns a token with an OTP-verified `email` claim as required by ADR-0037 §8a.
- `domain_signup_attempts` (Story 5.16) already captures the domain-match concept and is available as a contextual reference, but the rate-limit counter is a separate, in-process construct.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | A determined attacker controlling many real mailboxes across many domains and rotating source IPs is not fully stopped | Medium | Medium | Accept the residual risk; note that a newly-created tenant is an empty shell with no ambient external access (ADR-0037 §7) | Menno |
| R-002 | Default thresholds are too tight and reject legitimate sign-up bursts (e.g., several employees from one company) | Medium | High | Make thresholds configuration-driven and revisable via the ADR Amendment Log; monitor real traffic after launch | Product Owner |
| R-003 | In-process counter storage cannot support a future multi-instance deployment | Low | Medium | Document the limitation; defer distributed store until a real second concurrent instance need is demonstrated | Technical Lead |
| R-004 | The rate-limit mechanism is accidentally conflated with `RequestGate` or `domain_signup_attempts` | Low | High | Maintain explicit separation in the ADR, story, and code; verify with contract tests | Technical Lead |

---

## 14. Appendix
- ADR: `../../adr/0040-self-service-signup-rate-limiting-and-abuse-prevention-mechanism.md`
- BRD: `../Business-Requirements/BRD-0040-Self-Service-Signup-Rate-Limiting-And-Abuse-Prevention-Mechanism.md`
- Feature design: `docs/product-research/feature-designs/<feature>.md``
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above