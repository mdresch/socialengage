# Go-Live Readiness Definition
## SocialEngage Project — Environment Stages, Access Gating, and the Go-Live Decision

**Project:** Social Listening & Engagement Platform (SocialEngage)
**Phase:** Phase 1 — Social Listening / Insights Subsystem
**Owner:** Menno Drescher
**Date:** 2026-08-06
**Status:** Active — current classification is **Stage 0 (Ephemeral Test Infrastructure)**; no later stage has been entered
**Version:** 1.1

---

## 1. Purpose

This document draws one explicit line the rest of the project can point to, requested directly by Menno to resolve a real, recurring confusion: **an ADR's Open Question, a `SKILL.md`'s Known Gap, or an open finding in a security/legal/privacy register reads very differently depending on whether a real end user could currently be harmed by it.** Today, none can be — this project has never had a real end user. Without a formal statement of that fact, every deferred item risks being read as an active production danger it structurally cannot yet be.

**Core rule:** until this document records a dated Go-Live decision (§6), every currently-open item across the ADR series, component `SKILL.md`s, and the security/legal/privacy/architecture registers is **pre-Go-Live technical debt** — real, tracked, and eventually must be resolved, but not a live risk, because nothing built here is reachable by anyone but Menno (and, later, an explicitly-admitted pilot under §4). This document does not close, weaken, or resolve any of those items — it only correctly scopes their current severity. The moment the classification in §3 advances, every open item must be re-triaged against real exposure; this document's existence is not a blanket clearance.

## 2. What "Go Live" Means

**Go Live** is the specific event at which the system becomes available for:
- **Public self-service onboarding** — anyone signing themselves up without individual admission (the self-service tenant sign-up flow, Stories 5.15/5.16/6.7 — ~~not-yet-built~~ **Documentation Steward correction, 2026-08-13: all three are now built and contract-verified** — `social-listening-core@a2510508`/earlier for 5.15/5.16, `social-listening-admin@2b4463747` for 6.7's UI; see `docs/implementation-log.md`. This does not change §3's Stage 0 classification — a real, working code path existing is not the same as it being open to real traffic, per §1's own core rule and §7 below), and
- **Any client end user's real use of the system**, outside the narrow Pilot exception in §4.

Until that event is explicitly declared here, dated, both are prohibited — regardless of what is technically built and deployed. Go-Live is a **Sponsor decision** (§6), not an automatic consequence of shipping enough stories.

**What Go-Live is not:**
- **Not the same as Milestone M7** (`Business-Case-v6.0.md` §9, `Project-Charter.md` §5) — M7 is the go/no-go on starting a *second* SocialEngage subsystem (Brand Reputation & Alerts, etc.). Go-Live is about opening *this* subsystem to real users. The two may inform each other but are separate decisions.
- **Not the same as Phase 5 ("Production Readiness")** completing — Phase 5 (`docs/implementation-plan.md`) is a real technical precondition for Go-Live, not Go-Live itself. Passing every Phase 5 check makes Go-Live *possible*; it does not make it *automatic*.

## 3. Environment Stages

**Added 2026-08-06, per Menno's own direct elaboration.** Go-Live is not a single on/off switch reached in one step — there is a real, distinct intermediate stage between "ephemeral test run" and "pilot user," and it carries its own new risk that today's testing mode does not.

| Stage | Name | What it is | Data/credential lifetime | Who can reach it |
|---|---|---|---|---|
| **0** | Ephemeral test infrastructure | Local Docker Postgres containers plus real Azure resources (Key Vault, Service Bus, the real `getsocialengage` Entra tenant) scoped to a single contract-test run | **Self-deleting — no data survives teardown.** Test-run Key Vault keys are per-run-`uuid`-named and soft-deleted in `afterAll`; Postgres containers are created and removed per run (`social-listening-core-test-postgres-1`, confirmed directly in this session's own test output) | Nobody but the running test process; nothing persists to be reached afterward |
| **1** | Persistent Development Environment | A standing, non-self-deleting deployment — real credentials, real data, an actually-running system (connectors polling on a real schedule, a reachable admin UI) — for continuous development/demo use | **Persists.** Credentials are long-lived, not per-test-run-scoped | **Developer only (Menno).** Explicitly not exposed to pilots or any end user — this is a development environment, not a soft-launch |
| **2** | Pilot Access | A small, explicitly named, individually-admitted set of real users, onboarded manually — never through public self-service | Persists, same as Stage 1 or its own dedicated environment | Menno plus each individually-admitted pilot user, under the special terms in §4 |
| **3** | Go-Live / General Availability | Public self-service onboarding is open | Persists, real production data | Anyone |

**Current classification (2026-08-06): Stage 0 only.** No persistent development environment exists yet. No pilot exists. Nothing here is public.

### 3.1 The new risk Stage 1 introduces, named explicitly

Standing up Stage 1 is not merely "the same thing, but left running longer." **It is the first time this project's credential-handling machinery is exercised under real persistence rather than a single ephemeral test run** — Key Vault envelope encryption (`credential-envelope-encryption/SKILL.md`), connector OAuth token refresh/expiry, the break-glass mechanism (Story 5.7/5.13) under real elapsed time rather than a same-session request-then-execute, and credential rotation generally. Today, "how well the credential systems work" has only ever been proven at the timescale of one test run (minutes) — Stage 1 is where that claim first gets tested at the timescale of real operational use (days/weeks/months). This is a distinct, new risk from any currently tracked, and is logged as such: see `Uncertainty-Management-Plan.md` Appendix D, **R-07**.

**Stage 0 → Stage 1 is therefore its own gate, not a formality**, with its own named readiness bar (§5.1) — separate from, and prerequisite to, the Stage 1 → 2 (Pilot) and Stage 2 → 3 (Go-Live) gates.

### 3.2 The environment banner — a standing requirement, not just a gate checkbox

**Added 2026-08-06, per Menno's own direct instruction.** Every UI surface reachable at Stage 1 or Stage 2 must display a persistent, always-visible banner stating plainly that this is a development/pre-production environment whose content may be periodically deleted or erased without notice — **shown to everyone, including Menno himself**, not just to a pilot user. This is not a one-time disclosure buried in the Stage 2 terms-and-conditions document (§4) — it is a live, on-screen reminder present on every screen, every session, for as long as the environment is not Stage 3.

This exists for two distinct reasons, both real:
- **For a pilot user (§4):** the in-product banner is a standing reminder that reinforces, rather than replaces, the one-time acknowledged agreement — someone can forget what they signed weeks ago; they cannot as easily miss a banner on the screen in front of them.
- **For the developer:** the same discipline this project already applies elsewhere (name the uncertainty so it can be managed, `Uncertainty-Management-Plan.md` §3.1) applies to Menno's own use of Stage 1 — a standing environment that *feels* durable is exactly the condition under which someone starts treating it as production by habit. The banner is a deliberate, self-imposed check against that drift, not just an end-user-facing courtesy.

**Default-on, fail-safe:** the banner ships present by default; its removal is itself one of Go-Live's own checkable gate criteria (§5.3), not a separate feature to remember to build later. A build where the banner is absent and Stage 3 has not been declared here is itself a finding, not a cosmetic gap.

**Not built yet** — no UI exists at Stage 1 today (Stage 1 itself doesn't exist yet, per §3's current classification). Named here as a real requirement for whoever builds it, the same treatment this document already gives the Stage 3 technical-enforcement gap (§7).

## 4. The Pilot Exception (Stage 2)

A pilot user is **never** onboarded through public self-service. Each is individually admitted by Menno, under explicit special terms and conditions — a real, acknowledged agreement, not implied consent — that at minimum discloses:
- The system is pre-production; features, data, and availability may change or reset without notice.
- Known, currently-open items in the security/legal/privacy/architecture registers (`docs/security/security-register.md`, `docs/legal/legal-compliance-register.md`, `docs/privacy/data-sovereignty-register.md`, `docs/architecture/knowledge-graph-register.md`) exist and have not been resolved to a production bar.
- No SLA, no data-durability guarantee.

**No pilot currently exists.** This section defines the category and its admission requirement; it does not itself admit anyone.

## 5. Gate Criteria

### 5.1 Stage 0 → Stage 1 (standing up a Persistent Development Environment)

- Azure Key Vault soft-delete **and purge protection** posture confirmed and documented for whatever vault instance Stage 1 uses (not yet verified — `credential-envelope-encryption/SKILL.md`'s own current language only covers per-test-run soft-delete, not a standing vault's purge-protection setting).
- A credential rotation/expiry monitoring approach exists — even a manual, dated checklist is acceptable at this stage (per `Uncertainty-Management-Plan.md`'s own solo-developer adaptation philosophy), but it must exist, not be assumed.
- Access to Stage 1's real secrets is itself scoped and known (who/what can reach them) — not wider than "Menno plus whatever service identities the running system itself needs."
- A defined data-retention/reset policy for the environment, even though it does not self-delete on every run — e.g., how/when it gets reset, if ever.
- The environment banner (§3.2) is live on every reachable UI surface before Stage 1 traffic begins — not added after the fact.

### 5.2 Stage 1 → Stage 2 (admitting a first pilot)

- Stage 1 has been running long enough to have exercised at least one real credential-rotation or token-refresh cycle for whichever connector(s) the pilot would use — not proven only at single-test-run timescale.
- The break-glass mechanism (Story 5.7/5.13) has a real, verified out-of-band TAP-delivery channel for the pilot's own Tenant-Admin — still an open item today (`platform-admin-access/SKILL.md`'s own named gap) and a real precondition here, not optional.
- Each pilot's special terms and conditions (§4) exist as an actual document a real person acknowledges — not yet drafted.
- The environment banner (§3.2) is confirmed visible from the pilot user's own actual sign-in path, not just verified internally.

### 5.3 Stage 2 → Stage 3 (Go-Live)

- Phase 5 ("Production Readiness," `docs/implementation-plan.md`) is complete: security review, load/chaos testing against the isolation guarantees the ADR series argued for, operational runbooks for the failure modes ADR-0009/0010/0023 describe.
- The self-service sign-up rate-limiting/abuse-prevention mechanism (ADR-0037 §7, ADR-0040/Story 5.18) is built — ADR-0037's own words: "a real precondition before this endpoint is exposed to real, untrusted traffic, not an optional hardening pass."
- Every open finding in the security/legal/privacy/architecture registers has been triaged to a real resolution or an explicit, dated risk-acceptance decision by Menno — not left silently open the way pre-Go-Live technical debt is allowed to be.
- The environment banner (§3.2) is removed. Its continued presence past a declared Stage 3 is itself a finding, not a cosmetic leftover.

## 6. Governance — Who Decides, and How

Each stage transition (0→1, 1→2 per pilot, 2→3) is a **dated decision by Menno** (Sponsor/Product Owner), recorded as a dated addendum to this document — the same acceptance-and-Amendment-Log pattern already used for ADR acceptance (`docs/adr/README.md`). No stage transition is inferred from code shipping; it must be explicitly declared here.

**Stage transition log:**
- 2026-08-06 — This document created. Classification: Stage 0 (unchanged from the project's actual state to date — no persistent environment has ever existed).

## 7. Known Gap — No Technical Enforcement Yet

**This document is currently pure policy.** Nothing in the codebase today checks or enforces the Stage 0 classification, because no code path capable of onboarding a real user exists yet (Stories 5.15/5.16/6.7 are Ready but unbuilt). The moment they ship, this policy becomes the *only* thing preventing public self-onboarding unless a technical gate is also built — e.g., an environment flag the self-service-signup endpoint itself checks, rejecting with a clear "not yet open" response until §6 records a Stage 3 decision. **Flagged here as a real, named follow-up for whoever builds Story 5.15/6.7 — not built by this document, and not assumed solved by the policy alone.**

**Documentation Steward correction, 2026-08-06.** The paragraph above is now stale and, worse, understates the current real exposure: Story 5.15 (`POST /v1/tenants/self-service-signup`) and Story 5.16 (`GET /v1/tenants/domain-signup-attempts`) are both **built and contract-verified** (see `docs/implementation-log.md`), not "Ready but unbuilt." A real code path capable of onboarding a real, self-provisioned tenant already exists in `social-listening-core` today — it has simply never been called by any real, untrusted caller, because no UI screen (Story 6.7, still unbuilt) fronts it and because this document's own policy (Stage 0) says it must not be. **The one item still actually missing before this endpoint would be safe to expose publicly is the abuse/rate-limiting mechanism (Story 5.18/ADR-0040) named in §5.3 — Story 5.18 is Ready but not yet built.** No technical gate (environment flag or otherwise) exists yet either, so this document's own policy classification remains the only thing standing between the shipped endpoint and real traffic — this correction sharpens, rather than closes, the gap this section already named.

**Documentation Steward correction, 2026-08-13.** The 2026-08-06 correction directly above is itself now stale on both of its own named points. Story 6.7 (self-service tenant sign-up UI) shipped 2026-08-09 (`social-listening-admin@2b4463747`) — a real `/sign-up` screen now fronts the endpoint; it is no longer true that "no UI screen... fronts it." And Story 5.18 (self-service sign-up rate limiting, ADR-0040) shipped 2026-08-10 (`social-listening-core@7a2466d27958`) — the §5.3 gate criterion at line 91 below ("the self-service sign-up rate-limiting/abuse-prevention mechanism... is built") is now factually satisfied, not merely stated as a requirement. As of this correction, every one of Stories 5.15/5.16/5.18/6.7 is built and contract-verified — the full self-service onboarding path (UI, backend, abuse-prevention) is technically complete and could be reached by real traffic today. **This is a factual correction only, not a stage-transition decision** — §3's Stage 0 classification, and whether/when to advance it, remains Menno's own call per §6's governance rule; a technical gate (§7's still-not-built environment-flag check) also still does not exist, so this document's own Stage 0 policy remains, as of this correction, the *only* thing standing between the fully-built endpoint and real traffic — the gap this section named has narrowed to exactly that one item.

The §3.2 environment banner is a second, separate not-yet-built item — a UI component, not a backend gate. Both are real, named implementation gaps this document surfaces but does not close; neither has a story yet.

## 8. Cross-References

- `docs/implementation-plan.md` — Phase 5 ("Production readiness") is §5.3's own technical precondition.
- `Uncertainty-Management-Plan.md` Appendix D — canonical risk register; R-07 (new) tracks §3.1's persistent-credential risk; R-04 tracks the (now largely resolved) authentication gap this document's own gating supersedes as the *current* real blocker to end-user access.
- `docs/open-decisions.md` §1 — the ADR-0037 §7 rate-limiting item is a §5.3 gate criterion, not an ambient danger, per this document's own §1 core rule.
- `docs/open-items-and-deferred-work.md` — Section 5 ("Production readiness") is the same phase this document's §5.3 gates.
- `Stakeholder-Register.md` §3.3 — "Future end users / tenants" (Monitor engagement) are revisited per this document's own stage transitions; §3.3's own 2026-08-06 correction retired its earlier "no authentication mechanism exists" rationale in favor of this document as the real, current blocker.
- `docs/security/security-register.md`, `docs/legal/legal-compliance-register.md`, `docs/privacy/data-sovereignty-register.md`, `docs/architecture/knowledge-graph-register.md` — every open finding in each is pre-Go-Live technical debt under §1's core rule, re-triaged at each stage transition per §5.

## 9. Revision History

| Version | Date | Author | Changes | Approved By |
|---|---|---|---|---|
| 1.0 | 2026-08-06 | Menno Drescher (requested), AI Delivery Agent (drafted) | Initial creation — Go-Live definition, the Pilot exception, and the four-stage environment model (added same day, same request, after Menno's own direct elaboration on the Persistent Development Environment stage and its credential-exposure risk) | Menno Drescher |
| 1.1 | 2026-08-06 | Menno Drescher (requested), AI Delivery Agent (drafted) | Added §3.2, the environment banner requirement — a persistent, always-visible UI disclosure at Stage 1/2, shown to the developer as well as any pilot user, default-on with its removal made a §5.3 Go-Live gate criterion | Menno Drescher |
