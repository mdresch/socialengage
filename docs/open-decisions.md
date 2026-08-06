# Open decisions — unresolved ADR questions requiring a human go/no-go

**As of 2026-08-05.** Every Accepted ADR in `docs/adr/` locks a durable Decision and a set of implementation defaults — but several also carry their own explicitly-named "Open Question(s)" section: a sub-piece the ADR itself flags as genuinely undecided rather than blocking on. "All ADRs Accepted" (`docs/adr/README.md`'s own tracker) means nothing is left un-reviewed; it does not mean every question inside every ADR has been decided. This file is the first full sweep pulling those together into one place, so they can be decided deliberately instead of discovered one at a time.

**Scope and relationship to other docs:**
- This file is decisions not yet made. [`docs/open-items-and-deferred-work.md`](open-items-and-deferred-work.md) (its own Section D covers the same category more narrowly — see the pointer note added there) is work not yet built, a different thing — most items there are deliberate scope cuts with no decision pending, just implementation waiting on a trigger (a real subscriber, a second connector, a real deployment target).
- Each item below traces back to a specific ADR's own "Open Question(s)" section, or (for the last few) `docs/adr/README.md`'s own brainstorm/outstanding-items list. Check the cited ADR directly before acting on any of these — this file summarizes, the ADR is the source of truth.
- Not append-only, not CI-verified. Update in place as items get decided — cite the resolving ADR/Amendment Log/Acceptance note the same way `docs/adr/README.md` itself does, don't just delete the line.

**2026-08-06 — every item below is pre-Go-Live technical debt, not a live production risk.** `docs/project docs/Project Management Plans/Go-Live-Readiness-Definition.md` §1 states this explicitly: nothing in this project is reachable by a real end user today, so an open question here has zero current blast radius — it must still get resolved, and several items below are explicit Go-Live gate criteria (§5.3), but none represents an active danger while the system's classification stays at Stage 0.

---

## 1. Blocks work already queued next (Phase 6 — Stories 6.2–6.7)

- ~~**[ADR-0036]** No `GET /v1/me`-shaped endpoint exists in `social-listening-core`...~~ — **resolved 2026-08-05, Story 5.11:** `GET /v1/me` built and contract-verified (`contracts/epic-5/story-5.11.get-v1-me.contract.test.ts`, 10/10) — see `docs/implementation-log.md`. Story 6.2's and Story 6.6's dependency on this endpoint is satisfied; their own remaining status is about their own not-yet-built UI work, not this gap.
- **[ADR-0037 §7]** No abuse/rate-limiting mechanism or numeric threshold decided for the self-service tenant sign-up endpoint. The ADR itself: "a real precondition before this endpoint is exposed to real, untrusted traffic, not an optional hardening pass." Story 6.7 is Ready but shouldn't go live without this. **2026-08-06:** this is now a formal gate criterion, not just a caution — see `docs/project docs/Project Management Plans/Go-Live-Readiness-Definition.md` §5.3. The system cannot reach Go-Live (public self-service) without it regardless of whether Story 5.18/ADR-0040 happens to be the last thing built.
- **[ADR-0037 / ADR-0029]** ADR-0037 (self-service sign-up) depends on ADR-0029's own still-open "restrict Entra self-service sign-up at IdP level" question staying resolved "no." Flagged in ADR-0037 as needing Menno's "explicit reconciliation, not a silent assumption" — not yet done.
- **[ADR-0037]** Which of Entra's two local-account methods (email+password vs. email-OTP) `social-listening-admin` actually configures — undecided by any ADR, needed for Story 6.7.
- ~~**[ADR-0037 §8]** The "Same-Domain Invite Assist" feature (surfacing a rejected same-domain sign-up attempt to the matching tenant's Tenant-Admin) has no owning story — none of Stories 6.1–6.6 build it. Real scope gap, not just an open design question.~~ — **resolved 2026-08-06, Story 5.16 (backend half):** `GET /v1/tenants/domain-signup-attempts` built and contract-verified (`contracts/epic-5/story-5.16.same-domain-invite-assist-backend-surface.contract.test.ts`, 3/3) — see `docs/implementation-log.md`. Story 6.10's own Tenant-Admin-facing screen (the UI half) remains unbuilt.

## 2. Needed before other near-term work

- **[ADR-0034 / ADR-0028]** Can a tenant hold multiple credentials for the same platform (e.g. two Facebook Pages)? Structurally undecided — affects connector-management UI design (Story 6.3) and any future uniqueness constraint on `platform_credentials`.
- **[ADR-0027]** Whether the Admin UI's connect flow needs a standard, consistent disclosure pattern across every connector. Undesigned, blocks Story 6.3.
- **[ADR-0028]** The user-activation flow's exact UX (how a user learns a tier-3/user-bound credential is available to activate). Undesigned, blocks Story 6.3.
- **[ADR-0030 / ADR-0031 / ADR-0032]** Audit-log schema for Platform-Admin/bypass writes is still "a first cut, not a final design" — the same unresolved question inherited across three ADRs.

## 3. Real, but no forcing deadline — revisit when the trigger condition is met

- **[ADR-0019]** Whether coordinated event-schema-version cutover is operationally realistic — explicitly waits on a real downstream subscriber existing (likely Brand Reputation & Alerts).
- **[ADR-0023]** Whether connector failure-threshold behavior should vary by `deliveryMode` (push vs. poll) — waits on a push-mode connector existing.
- **[ADR-0024 / ADR-0026]** Cross-source de-duplication strategy (the same story covered by multiple outlets/wires shows as separate posts) — real product gap, no forcing deadline.
- **[ADR-0031 §3]** Seat-count race condition under concurrent invites — known, accepted as deferred at review, not fixed.
- **[ADR-0031]** Whether `tenants.name` needs a uniqueness constraint or a separate slug field for admin-UI routing — untouched by ADR-0035 (admin UI shape) despite being that ADR's natural home.
- **[ADR-0029]** Whether `oid` is reliably present in this project's actual Entra External ID (CIAM) tokens — conflicting documentation, unverified against a real token. Cheap to verify whenever convenient.
- **[ADR-0035]** The 2026-08-03 design mockup (`docs/design/admin-ui-mockup-2026-08-03.html`) hasn't been reconciled screen-by-screen against the role-gating decision or ADR-0030/31/32's specifics — matters once Stories 6.2–6.6 are actually being built.
- **[ADR-0024]** AccessWire's/Business Wire's actual public RSS access terms — unconfirmed either way; blocks expanding Newswire's wire-service coverage.
- **[ADR-0024]** Exact GlobeNewswire/PR Newswire feed subset to poll — still an undecided implementation-time tuning choice.
- **[ADR-0026]** NewsData.io's actual formal terms — flagged as "the strongest unresolved lead" for an alternative/additional RSS-News provider, not verified to primary-source bar.
- **[ADR-0026]** Exact AST-to-GNews-query-syntax translation (`translateWatchlistQuery()`) — not built; blocks native query pushdown/rate-limit savings for GNews watchlists.
- **[ADR-0027]** Whether the "connector is a technical intermediary, not a contracting party" principle should be reflected in tenant-facing legal copy (Terms of Use/onboarding) — named as a Phase 5 follow-up.
- **[ADR-0027]** Whether a data source's paid-tier signup *mechanism* itself (not just price) warrants its own vetting criterion — named as "a distinct, still-open consideration."
- **[ADR-0028]** Reddit's actual current API/commercial-use terms — flagged as secondary-sourced only, not yet verified to this project's primary-source bar. Matters once Reddit (the next connector on the roadmap) is scoped.
- **[ADR-0032]** Whether Tenant Reader and Tenant Business Analyst ever need a real authorization-level distinction — deliberately deferred ("roles are unknown at this time").
- **[ADR-0032]** Whether `external_subject` should capture which token/claims version issued it — minor, still open.
- **[ADR-0030]** How the break-glass Temporary Access Pass is delivered to the real Tenant-Admin through a verified, out-of-band channel — undesigned; blocks the break-glass mechanism actually being usable in practice, not just recorded.
- **[ADR-0030]** Whether the break-glass reset requires additional notification to the affected Tenant-Admin or a secondary contact — undecided.
- **[ADR-0030]** No escalation/recovery path exists for a tenant with zero remaining reachable Tenant-Admins.
- **[ADR-0030]** Infrastructure/operational metrics for the Platform Admin console — deliberately deferred to "when the system's limitations are well known," a genuine revisit-trigger deferral.
- **[ADR-0035]** Whether/when a real second Platform Admin operator, or a concrete security incident, triggers the deferred "Platform Console" split.
- **[ADR-0036]** Whether an idle timeout on top of the decided 8-hour absolute session ceiling is worth the complexity, and the exact rotation/refresh mechanism.
- **[ADR-0037]** Exact SQL/migration shape for `tenant_signup_role`'s grants — implementation detail, still open.
- **[ADR-0037]** Whether the public-email-provider denylist should be promoted to a maintained, external list.
- **[ADR-0037]** Exact rolling-window length and attempt-count threshold for the Same-Domain Invite Assist escalation (30 days/3 attempts are unanalyzed template defaults).
- **[ADR-0037 §8c/§8d]** Whether/when the escalation signal graduates from durable logging to real-time alerting, and whether this project ever builds outbound notification capability at all.
- **[ADR-0037]** Whether Entra External ID issues a per-token `email_verified` claim for local accounts, usable as runtime defense-in-depth — unconfirmed to primary-source bar.
- **[ADR-0037 §9]** Exact operational trigger/workflow for Platform Admin's `UPDATE(domain)` recovery grant — the grant exists and is audited, but when/how it's actually invoked is undesigned.
- **[ADR-0029]** Exact per-MAU Entra overage price beyond the confirmed 50,000-free tier — unconfirmed to primary-source bar; matters for cost planning once tenant volume grows.
- **[ADR-0029]** Machine-to-machine (M2M) authentication needs — nothing currently named needs it; flagged only so it isn't a surprise later.
- **[docs/adr/README.md, "still outstanding, not yet drafted"]** ADR-0004's point-in-time author snapshot (`followerCount`-at-publish-time on `SocialPost`) — flagged as a genuine trade-off, not a strict improvement, since it partially reintroduces the per-post duplication ADR-0004 argued against. Needs an explicit go/no-go before it's even drafted as its own ADR.
- **[docs/adr/README.md, brainstorm section]** A tenant's-own-domain RSS/content-feed connector (e.g. their own company blog) — raised in passing, not scoped or drafted. Distinct from both shipped connectors (GNews, Newswire), which both pull from third-party sources the tenant doesn't own.

---

*Compiled from a full read of every ADR's own "Open Question(s)" section (21 of 37 ADRs have one) plus `docs/adr/README.md`'s brainstorm/outstanding-items list, cross-checked against later ADRs, Amendment Logs, Acceptance notes, and shipped-code `SKILL.md`s for items resolved elsewhere but not struck through in their original section. Items already resolved, or explicitly framed as "implementation default, not blocking acceptance," are excluded — see the individual ADRs for that detail if needed.*
