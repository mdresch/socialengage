# ADR-0035: Admin UI's own shape — one role-gated Next.js app, not two separate deployables

**Status:** Accepted (2026-08-03) — drafted by the AI Business & Requirements Analyst persona, accepted by Menno with its own flagged rule-of-three recommendation directly decided (Acceptance note below). Seventh and last of this batch; assumes ADR-0029–0034.
**Acceptance note (2026-08-03):** Accepted by Menno, verbatim: "approved... ADR 0035." This ADR's own closing recommendation — whether three no-story ADRs (0027, 0028, 0035) now warrants a formal convention rather than a third one-off exception — was put to Menno directly rather than decided by this drafting pass alone, and **decided: yes, formalize it now.** `docs/user-stories/README.md` gets an explicit "No-story ADR convention" section (added alongside this acceptance) naming the three recognized categories this series has actually produced, so a future no-story case is checked against a stated rule rather than improvised as a fourth one-off exception.
**Source:** `docs/adr/README.md`'s 2026-07-30 governance note (candidate ADR #7); ADR-0001 (the existing two-*repository* split this ADR does not reopen); this project's own solo-developer, don't-build-ahead-of-need discipline (`CLAUDE.md`; ADR-0020's deferred distributed rate-limit gate is the direct precedent for the kind of call this ADR makes).

## Context

ADR-0001 already decided `social-listening-admin` is one repository, independently deployable from `social-listening-core`, talking to it only through the REST API. That decision stands and is not reopened here. What ADR-0001 did not anticipate — because no Admin-tier or Tenant-Admin/Tenant User model existed yet — is that this one repository now has to serve **two structurally different audiences** once ADR-0030's Admin-tier design lands: Platform Admin (provisioning-only, zero tenant-data access, realistically operated by Menno alone for the foreseeable future — `Stakeholder-Register.md`'s Sole Operator persona) and Tenant-Admin/Tenant User (day-to-day tenant usage, the audience every real future tenant will actually be). This ADR decides whether that split needs its own second deployable app, or fits inside the one that already exists.

## Decision

**One application (`social-listening-admin`), with role-gated routing — no second deployable app is introduced.** Platform Admin's screens (tenant provisioning, suspension, license-seat management) are additional routes within the same Next.js app, gated by the same resolved `role`/tenant-membership shape ADR-0029/ADR-0032 already establish: a Platform Admin session structurally has no `tenant_id` context at all (it is not a `users` row, per ADR-0032 §3), which naturally separates what it can render from what a Tenant-Admin/Tenant User session can, rather than requiring a second codebase to enforce the same separation.

**A genuinely separate deployable ("Platform Console" vs. "Tenant App") is named and explicitly deferred, not rejected outright:** it is a legitimate design for a product with a real, separate population of platform operators, and it would reduce Platform Admin's own UI bundle's attack surface (it would ship zero tenant-data-fetching code at all). It is deferred under this project's own established discipline of not building ahead of a demonstrated need (ADR-0020's distributed rate-limit gate is the direct precedent for this kind of call): today there is exactly one operator (Menno) in both roles, no second deployable pipeline, build, or hosting concern is justified by that population size. **Revisit trigger, named explicitly:** a real second Platform Admin operator distinct from Menno, or a concretely demonstrated security reason the shared bundle is a problem (not a hypothetical one) — either is sufficient grounds to revisit; neither currently exists.

## Consequences

**Positive**
- No new deployable, build pipeline, or hosting concern for a solo project whose only current Platform Admin operator is also its only current Tenant-Admin/Tenant User.
- Role-gating falls out naturally from ADR-0029/ADR-0032's identity model (a Platform Admin session has no tenant context to render tenant screens against) rather than requiring new architecture.

**Negative**
- Platform Admin's UI bundle ships alongside tenant-facing code it will never use, a real (if currently low-stakes) larger attack surface than a fully separate deployable would have — named plainly, not hidden, as the accepted cost of deferring the split.
- If a second deployable is ever warranted later, the split is real, non-trivial rework (build/deploy pipeline duplication, routing reorganization) — deferring it now does not make that future cost disappear, only postpones it until (if ever) the revisit trigger fires.

## Alternatives Considered

- **Two separate deployable apps from the start** (a "Platform Console" and a "Tenant App") — rejected for now, not permanently; see Decision's deferral and named revisit trigger.

## Open Questions

- [ ] **[Q-0035-1]** **Whether a real second Platform Admin operator or a concrete security incident ever triggers the deferred split** — not resolved here, by design; this is a "revisit when the trigger fires" item, not a fixed timeline.
- [ ] **[Q-0035-2]** **Added 2026-08-03 — a UI design mockup has been brought into the repo** (`docs/design/admin-ui-mockup-2026-08-03.html`, see that folder's own `README.md`) but not yet reconciled screen-by-screen against this ADR's role-gating decision or ADR-0030/0031/0032's own specifics (the break-glass action's real scope, domain-routing UX, `access_ends_at` modeling). Not designed or verified here — flagged so the mockup isn't assumed pre-validated against this project's own architecture.

## A note on this ADR's own place in the series' conventions

**No user story accompanies this ADR, and this is now the third such case in this series (after ADR-0027 and ADR-0028), for a reason that resembles both without being identical to either.** Like ADR-0001, this ADR is a project-structure decision (how many deployables, not a feature) rather than one that introduces a new interface, stored field, or endpoint of its own. Like ADR-0028's tiers 2/3, nothing is buildable against it yet in the strictest sense — `docs/open-items-and-deferred-work.md` §A still lists the admin UI's connect flow, watchlist management screen, and connector status view as unbuilt for the *existing*, pre-Admin-tier UI, and no Platform-Admin-facing screen of any kind exists yet for this ADR's own role-gating decision to have a contract test target. **Recommendation, following ADR-0028's own precedent rather than treating this as a fresh case:** whichever future story first builds a Platform-Admin-facing screen, or a Tenant-Admin-facing screen that needs to render differently for the two roles, should cite this ADR as the governing structural constraint (single app, role-gated routing) at that time, rather than this ADR generating its own separate story.

**This is now the third no-story ADR in this series, and per this project's own "rule of three" discipline** (already applied elsewhere — ADR-0004's organization-as-Author question, ADR-0026's own deferral of generalizing it) — **this may be the trigger to formalize an actual "non-story ADR" convention in `docs/user-stories/README.md`, rather than adding a third separately-reasoned, one-off named exception.** This is flagged here as an explicit recommendation for Menno's own acceptance-pass decision, the same way ADR-0026's own "should ADR-0004 generalize" question was decided at acceptance rather than deferred a third time — not decided unilaterally by this drafting pass.

## Note on relation to ADR-0041 (2026-08-06)

**ADR-0041** (Accepted 2026-08-06) formalizes, as a general, project-wide, cross-layer rule, something this ADR already decided locally: the admin UI gates on the fact that a Platform Admin session structurally has no `tenant_id` context at all (it is not a `users` row, per ADR-0032 §3), which naturally separates what it can render from what a Tenant-Admin/Tenant User session can. This already fully satisfies ADR-0041's Decision §1 — this note confirms that, and requires no change to this ADR's own Decision or Consequences text. ADR-0041's Decision §2 does add a durable, cross-layer requirement this ADR's own route-tree split did not itself state explicitly: every route's own page component must actually enforce that separation server-side, not merely rely on which link is shown — the concrete gap the 2026-08-06 healing pass (`social-listening-admin@1f8960e`) found and fixed under Story 6.2.

## Amendment Log

- 2026-08-03 — Initial proposal, drafted by the AI Business & Requirements Analyst persona.
