# ADR-0040: Self-service tenant sign-up rate limiting and abuse-prevention mechanism

**Status:** Accepted (2026-08-06) — drafted by the AI Business & Requirements Analyst persona (left Proposed, per its own charter boundary; this persona does not hold ADR-acceptance authority), then accepted by Menno as drafted. Story 5.18 moves to **Ready**.
**Acceptance note (2026-08-06):** Accepted by Menno, verbatim: *"ADR 0040 also approved."* Accepted as drafted, no revisions. All Open Questions below remain open at acceptance. This closes out the three-ADR batch (0038/0039/0040) drafted 2026-08-05 — all three are now Accepted, the same day this session's own WIP-limit rule (`Development-Approach-and-Life-Cycle-Plan.md`, max 3 ADRs open for review) would otherwise have started constraining new ADR work.
**Source:** ADR-0037 §7 (Accepted) names this explicitly as a real, undesigned gap and a hard precondition, not an optional hardening pass: "nothing in this Decision bounds how many *distinct* new identities... can each successfully create one new tenant in rapid succession... the exact mechanism and numeric threshold are left as an Open Question... not designed here." ADR-0037's own Consequences section restates it as "a precondition for exposing this endpoint publicly, not an optional hardening pass," and `docs/open-decisions.md` §1 lists it under "Blocks work already queued next." Requested directly by Menno as part of a 16-item story-drafting batch.

## Context

`POST /v1/tenants/self-service-signup` (ADR-0037, Story 5.15 in this same batch) is, by ADR-0037 §5's own explicit design, **the one endpoint in this entire project reachable by a caller holding a validly-signed Entra token that resolves to no existing `users` or `platform_admins` row at all** — every other route in this project rejects such a caller outright (ADR-0029 §4). ADR-0037 §7 already narrows the realistic threat model considerably (§8a's email-OTP-verification precondition means an attacker needs control of real, distinct, individually-verified mailboxes, not merely fabricated email strings) and already bounds the real-world severity of a successfully-abused tenant (§7's own added note: a freshly-created tenant is an empty shell with zero ambient access to any external system, since every connector requires its own separate, vendor-issued credential per ADR-0027/ADR-0028). **What remains genuinely undesigned is the mechanism itself** — nothing currently in this project can rate-limit a caller before a resolved tenant/user identity exists to key a limit on.

This project's one existing rate-limiting mechanism, `RequestGate` (ADR-0003, ADR-0020), is keyed by `(tenantId, providerId)` — structurally inapplicable here, since neither exists yet at the moment this endpoint is invoked. A new, differently-keyed mechanism is required, which ADR-0037 §7 itself already flagged rather than improvised. This crosses this series' own bar for a fresh ADR (ADR-0027/0028/0035/0036/0038's "hard-to-reverse, real security consequence, not just a new field/endpoint shape") for a reason distinct from why Stories 5.12–5.17 in this same batch do **not** need one: those stories expose an *already fully-designed* authorization boundary or data model over HTTP; this one requires *inventing* a new state/keying mechanism with real DoS/availability stakes if built wrong — the same category of decision that earned ADR-0020 its own ADR (rate-limit queue bounds and distributed gate state) rather than being left as an implementation detail of whichever story needed it.

## Decision

### 1. Keying: per-IP and per-verified-email-domain, both enforced, neither alone sufficient

- **Per-IP-address rate limiting** bounds the cheapest, most naive form of abuse (a single script hammering the endpoint from one address) and requires no reliance on the token's own claims.
- **Per-verified-email-domain rate limiting** (keyed on the domain captured from the token's own OTP-verified `email` claim, per ADR-0037 §8a) bounds the more realistic threat ADR-0037 itself already named: a caller controlling several distinct, individually-verified mailboxes at one domain, which per-IP limiting alone would not catch if distributed across different source addresses (e.g. via different residential IPs or a VPN/proxy pool). This reuses, rather than duplicates, the same `domain_signup_attempts` data ADR-0037 §8b already commits to recording for the Same-Domain Invite Assist feature — the rate-limit check and the Invite Assist proposal both read the same underlying attempt history, not two parallel logs.
- **Neither key alone is sufficient**, per ADR-0037 §7's own framing of the residual risk (an attacker controlling many real mailboxes across many domains they own is unaffected by a domain-scoped limit alone; a determined attacker can rotate source IPs). This ADR does not claim either key closes the gap completely — see Consequences.

### 2. Mechanism: a new, narrow, dedicated counter — not a reuse of `RequestGate`

A new, minimal rate-limiting mechanism, structurally independent of `RequestGate` (ADR-0003/ADR-0020), which remains scoped to `(tenantId, providerId)` outbound-request gating and is not repurposed here. The new mechanism tracks attempt counts within a rolling window, keyed by IP and by domain as decided above, and rejects (`429`) once either threshold is crossed within its own window. **Exact storage** (in-process for a single-instance deployment, consistent with this project's own solo-deployment posture and ADR-0020's own precedent of deferring distributed state until a real multi-instance need exists; or a lightweight shared store if this project is ever deployed as more than one concurrent instance) is an implementation default, not decided here — the same treatment ADR-0020 gave its own distributed-gate question.

### 3. Numeric thresholds — template defaults, explicitly revisable, not deeply analyzed

Consistent with this series' own established practice (ADR-0017–0023's "implementation default... does not require superseding this ADR" convention) and ADR-0037 §8b's own precedent for its 30-day/3-attempt Same-Domain Invite Assist thresholds: a starting default of **10 sign-up attempts per IP address per rolling 24-hour window**, and **5 sign-up attempts per verified email domain per rolling 24-hour window** (independent of ADR-0037 §8b's separate 3-attempt/30-day Invite Assist escalation threshold, which governs Tenant-Admin/Platform-Admin visibility, not whether a request is rejected outright). Both are logged here as adjustable via this ADR's own Amendment Log, not requiring supersession to tune once real usage data exists.

### 4. A rejected-by-rate-limit attempt is not itself escalated the same way a domain-match rejection is

A `429` rejection under this ADR's own mechanism is a distinct outcome from ADR-0037 §3's domain-match rejection — it does not, on its own, write a `domain_signup_attempts` row or trigger ADR-0037 §8c's escalation logic (which is specifically about a *successful*, OTP-verified domain match against an *existing* tenant, a materially different signal than "too many attempts too fast"). This mechanism's own rejected-attempt counters may optionally be logged for Platform Admin's own future review (Open Questions, below) but this ADR does not require wiring them into `platform_admin_audit_log` — a real, deliberately narrower scope than ADR-0037 §8c's own mechanism, named so the two are not conflated.

## Consequences

**Positive**
- Closes ADR-0037 §7's own explicitly-named precondition before Story 5.15's endpoint is exposed to real, untrusted traffic — resolving a gap this project has already twice flagged (ADR-0037 itself, `docs/open-decisions.md` §1) rather than leaving it open a third time.
- Reuses ADR-0037 §8b's own `domain_signup_attempts` data for the domain-keyed limit rather than inventing a second, parallel attempt log.
- Deliberately independent of `RequestGate` — avoids retrofitting a mechanism designed for a different keying shape (resolved tenant/provider) onto a caller that, by this endpoint's own design, has neither yet.

**Negative**
- **Does not fully close the volumetric-abuse gap ADR-0037 §7 already named as accepted-but-real** — a sufficiently determined attacker controlling many real mailboxes across many domains they independently control, rotating source IPs, is not fully stopped by either key alone. This ADR bounds the cheap/naive cases, consistent with ADR-0037 §7's own already-stated severity ceiling (a successfully-created tenant is an empty shell with no ambient external access), not a claim of complete closure.
- **A new, small piece of stateful infrastructure** (the attempt-counter store) is real, if narrow, operational surface — the same trade-off this series has already accepted for `identity_resolver_role` (ADR-0032) and `tenant_signup_role` (ADR-0037) each adding their own small increase in system complexity.
- **The numeric defaults (§3) are unanalyzed template values**, the same accepted trade-off ADR-0037 §8b's own thresholds already carry — may need tuning once real sign-up traffic exists, and a too-tight default risks rejecting a legitimate burst (e.g. a real company's several employees signing up in quick succession before any of them is yet invited) as if it were abuse.

## Alternatives Considered

- **Reuse `RequestGate` with a synthetic `providerId`** — rejected: `RequestGate`'s entire design (ADR-0003) assumes a resolved `tenantId`, which structurally does not exist for this endpoint's own caller; forcing a fit would either require a fake tenant identity (defeating the isolation guarantees `RequestGate` exists to enforce) or a parallel special case inside an otherwise-uniform mechanism.
- **A third-party bot/abuse-detection service (e.g. a CAPTCHA or a managed WAF rate-limiting product)** — considered; not chosen for v1, consistent with this project's own repeatedly-applied "no new external vendor machinery until a demonstrated need" discipline (ADR-0031 §3, ADR-0020's deferred distributed gate) — a self-contained counter is cheaper to build and sufficient for this project's own current, solo-operated scale; revisit if real abuse volume ever demonstrates this mechanism's own limits.
- **Rely solely on ADR-0037 §8a's email-OTP-verification precondition, with no additional rate limiting at all** — rejected: ADR-0037 §7 itself already names this as insufficient ("narrowed, not closed" by §8a) — a real mailbox-controlling attacker (e.g. a role account like `info@acme.com`, or a script with access to many disposable-but-real mailboxes) is still unaffected by OTP verification alone.

## Open Questions for decision

- **Whether rejected-attempt counters (§4) should also flow into `platform_admin_audit_log`** for Platform Admin's own future review, alongside ADR-0037 §8c's separately-scoped escalation signal — not decided here, a real possible future enhancement.
- **The exact numeric thresholds (§3)** — template defaults, explicitly revisable per this ADR's own Amendment Log once real usage data exists.
- **Whether this mechanism should share infrastructure with a future, more general API-level rate-limiter** if this project ever needs one beyond this one endpoint — not designed here, named only so it isn't lost if that broader need materializes later.
- **The exact storage mechanism (in-process vs. shared)** — an implementation default, following ADR-0020's own precedent of deferring distributed state until a real multi-instance deployment exists.

## Amendment Log

- 2026-08-05 — Initial proposal, drafted by the AI Business & Requirements Analyst persona, as part of a 16-item story-drafting batch, resolving ADR-0037 §7's own explicitly-named, undesigned precondition. Left **Proposed** — this persona does not hold ADR-acceptance authority.
- 2026-08-06 — **Accepted by Menno**, verbatim: *"ADR 0040 also approved."* As drafted, no revisions. Story 5.18 moves to Ready.
