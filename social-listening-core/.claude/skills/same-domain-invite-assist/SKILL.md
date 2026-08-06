---
name: same-domain-invite-assist
description: GET /v1/tenants/domain-signup-attempts — the Tenant-Admin-facing, RLS-scoped read of domain_signup_attempts (Story 5.15's own sole-writer table), aggregated by domain with an escalation flag, plus the inline check that writes a Platform-Admin-visible audit-log entry when a domain crosses the escalation threshold. Read this before touching domainSignupAttemptsRouter.ts, domainSignupAttempts.ts, or the recordDomainSignupAttempt() call site in selfServiceSignup.ts.
---

# Same-Domain Invite Assist backend surface

## What this is

ADR-0037 §8b/§8c's own already-decided mechanism, exposed over HTTP (Story 5.16). `domain_signup_attempts` (Story 5.15, `migrations/0022`) records every domain-match sign-up rejection; this component reads it back for the matched tenant's own Tenant-Admin, aggregated by domain, and separately watches for a domain crossing the escalation threshold (3 distinct verified emails within a rolling 30-day window) to write a Platform-Admin-visible `platform_admin_audit_log` entry — reusing that table, not a fourth parallel audit path.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0037 §8b | `domain_signup_attempts` aggregated by domain, distinct-email count, expand-on-demand to the full list | 5.15 (writer), 5.16 (this reader) |
| ADR-0037 §8c | Repeated attempts against a domain also become a Platform-Admin-visible audit-log signal, not real-time alerting | 5.16 |

## Contracts that constrain this component

- `contracts/epic-5/story-5.16.same-domain-invite-assist-backend-surface.contract.test.ts` — `GET /v1/tenants/domain-signup-attempts` is `tenant_admin`-only (403 for `tenant_user`, 401 unauthenticated), RLS-scoped to the caller's own tenant; the response aggregates by domain with a distinct-email count and the full email list in the same payload; `escalated` becomes `true` exactly at 3 distinct emails within the rolling window; crossing the threshold writes exactly one `domain_signup_escalation` audit-log entry, proven not to duplicate on a 4th/5th attempt; cross-tenant isolation is proven directly (tenant B's Tenant-Admin cannot see tenant A's attempts).

## How to extend this safely

- **The escalation-check call lives in `selfServiceSignup.ts`'s `recordDomainSignupAttempt()`, not in this router.** The router is a plain, side-effect-free `GET` (this project's own "GET only, no write verb" convention, same as `platform-admin-audit-log/SKILL.md`'s own discipline) — a read endpoint must never be where an audit-log write gets triggered. If you ever need to re-check escalation state without a fresh attempt, add a separate, explicitly-named function; don't make the `GET` handler call `checkAndLogDomainEscalation()`.
- **A new escalation threshold or window length:** change `ESCALATION_THRESHOLD`/`ESCALATION_WINDOW_DAYS` in `domainSignupAttempts.ts` — both are named, template-default constants (ADR-0037 §8b's own "not deeply analyzed defaults, revisable via Amendment Log" framing), not values to inline elsewhere.
- **Real-time alerting on the escalation signal** (Slack/email/on-call) is explicitly out of scope (ADR-0037 §8c) — don't add it here without a new story/ADR decision; this component's job ends at the durable, reviewable audit-log write.

## Load-bearing constraints — do not change casually

- **"3 attempts" (ADR-0037 §8b's own literal wording) is implemented as 3 *distinct verified emails*, not 3 raw `domain_signup_attempts` rows.** A real, resolved implementation-time ambiguity, not an oversight: ADR-0037 §8c's own Amendment Log clarifies escalation "requires the force of multiple email accounts," which only makes sense read as a distinct-identity count — the same person retrying the same domain repeatedly should not, by itself, cross the threshold.
- **The escalation write fires once per crossing, not once per attempt past the threshold.** Implemented by checking `distinctCount === ESCALATION_THRESHOLD` exactly (not `>=`) right after each insert — a 4th, 5th, ... distinct email past the threshold does not re-trigger, matching ADR-0037 §8c's own framing of a durable, reviewable *signal*, not an audit-log entry per attempt. (A domain's count can fall back below the threshold as old attempts age out of the 30-day window and later cross it again with a fresh cluster of emails — re-triggering in that case is correct, not a bug, since it's a genuinely new pattern.)
- **Cross-tenant isolation is enforced by RLS itself (the ordinary `app_user`/`withTenant()` path), never by an application-level `WHERE tenant_id = ...` the caller could theoretically bypass.** `listDomainSignupAttempts()` and `checkAndLogDomainEscalation()`'s own read both run inside `withTenant(tenantId, ...)` — the same discipline every other tenant-scoped read in this codebase already holds itself to.
- **The escalation write reuses `tenant_signup_role`'s existing grants — no new migration.** `tenant_signup_role` already has `INSERT` on `platform_admin_audit_log` (migration 0021, Story 5.15's own successful-signup audit write) and the escalation-check's own read of `domain_signup_attempts` goes through `app_user`/`withTenant()` (already granted `SELECT`, migration 0022) — not `tenant_signup_role` directly, which has no `SELECT` grant on that table at all.
- **`actorIdentity` for the escalation entry is `'system:domain-signup-escalation'`** — a clearly-labeled system-triggered value, never conflated with a real Platform Admin's own identity or with the `self-service-signup:<sub>` labeling Story 5.15 uses for its own writes.

## Known gaps / deferred work

- **Real-time alerting is not built** (ADR-0037 §8c's own explicit scope limit) — the escalation write is durably logged and reviewable, not paged.
- **The one-click "invite this person" action and the visual escalation treatment are Story 6.10's own job** — this component only proves the data/aggregation/escalation mechanics, not the screen.
- **A tenant whose `domain` value is changed by Platform Admin (`UPDATE(domain)`, ADR-0037 §9) will have its historical `domain_signup_attempts` rows re-attributed to whatever the tenant's *current* domain is when this component's own JOIN runs** — `domain_signup_attempts` stores only `tenant_id`, not a copy of the domain that was actually matched at attempt time. A real, if narrow, correctness edge case, not fixed here — named honestly rather than silently assumed away.
