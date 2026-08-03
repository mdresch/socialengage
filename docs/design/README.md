# UI Design References

Non-code design artifacts for `social-listening-admin` (which does not exist as a scaffolded repository yet — see `CLAUDE.md`). Referenced from ADR-0035 and `docs/open-items-and-deferred-work.md`'s still-open "admin UI" item; not itself implementation code, and not built via `implement-story`.

**Every file in this folder is plain HTML/CSS/vanilla JS, not Next.js.** Flagged directly by Menno, 2026-08-03, after the first mockup: none of this is meant to be ported or copy-pasted into `social-listening-admin`. It's a layout/flow/interaction reference only — the real screens are built from scratch via `implement-story`, contract-first, inside that app's own Next.js structure.

## `admin-ui-mockup-2026-08-03.html`

**Source:** a claude.ai Artifact ("Microsoft Social Engagement UI Mockup"), drafted outside this session and brought in 2026-08-03. Self-contained bundled HTML (~535KB) — open directly in a browser to view; no build step required.

**Status:** a design reference only, not yet reconciled against this project's own accepted architecture. In particular, check the mockup's screens against:

- **ADR-0035** — one role-gated Next.js app (not two separate deployables); Platform Admin's screens are additional routes within the same app, not a separate product.
- **ADR-0030 §3** — Platform Admin's break-glass mechanism is exactly one action (force a Tenant-Admin's credential reset), not general tenant-data access; if the mockup shows Platform Admin viewing/editing tenant content, that's a design/architecture mismatch to flag, not something to build as shown.
- **ADR-0031 §5** — sign-up domain capture and its "rerouting" UX is explicitly undesigned (an Open Question) — if the mockup shows a specific sign-up/domain-match flow, that's a real candidate answer to that Open Question, worth feeding back into ADR-0031 rather than silently diverging from it.
- **ADR-0032 §9** — `access_ends_at` (not a boolean/enum "suspended" toggle) is how a user's access state is actually modeled — check any user-management screen reflects that, not a simple active/inactive switch.

**Not yet done:** a full screen-by-screen reconciliation against the six accepted ADRs (0029–0034) and their Ready stories (5.6–5.10, 1.7). This file only records that the mockup now lives in the repo — cross-checking its content against this project's own architecture is separate follow-up work.

**A real, named limitation, flagged by Menno directly, 2026-08-03: this mockup is plain HTML/JS (in-browser Babel-transpiled markup bundled as a single static file), not Next.js.** `social-listening-admin` is Next.js per the design spec ("Thin admin layer... Next.js") and ADR-0001/ADR-0035, which assume Next.js's own file-based routing, React Server/Client Component model, and build pipeline — none of which this mockup has or uses. Concretely, this means:

- **The mockup's markup/JS cannot be copy-pasted into `social-listening-admin` as working code.** It has no `pages/`or `app/` router structure, no component file boundaries, no Next.js data-fetching conventions (Server Components, `fetch` with caching, route handlers) — none of the scaffolding whoever builds the real screens will actually be writing against.
- **It is a visual/interaction reference only** — layout, screen inventory, information hierarchy, and flow between screens are the useful parts to extract. The actual implementation, per this project's own mandatory workflow (`CLAUDE.md`), goes through `implement-story` — a Jest contract written from a story's Acceptance Criteria first, then real Next.js components built against it — not a translation or port of this file's own markup.
- **Whoever builds a real screen should treat this file as "what it should look like and how it should flow," and start the actual component from scratch** inside `social-listening-admin`'s own Next.js structure (once that repo/app is scaffolded), rather than attempting to adapt this file's DOM/JS directly.

## `platform-admin-console-mockup-2026-08-03.html`

**Source:** drafted directly in this session (not "Claude Designs"), after confirming the existing mockup above covers only Tenant-Admin/Tenant-User screens — the Platform Admin console had no design yet at all. Also published as a claude.ai Artifact for easier viewing/sharing: `https://claude.ai/code/artifact/675006a9-3700-4b28-a3c7-c62637b8e630`.

**Same limitation as above applies** — plain HTML/CSS/vanilla JS, a layout/flow reference only, not Next.js code to port.

**Screens covered, grounded directly in the accepted ADRs, not invented:**
- **Tenants list** — name, domain, status, seat ceiling/active count, created date (ADR-0031's schema exactly).
- **Tenant detail** — the *only* two actions Platform Admin's own role can take: adjust the license-seat ceiling / suspend-reactivate (ADR-0030 §2's locked provisioning-only boundary), and the break-glass credential reset (ADR-0030 §3). No users/watchlists/connectors/posts screen exists here on purpose — their absence *is* the design, not an omission.
- **Break-glass confirmation flow** — deliberately styled apart from ordinary actions (alert-colored, explicit scope list of what it does and does not do), matching ADR-0030 §3's "Platform Admin never learns or sets the actual new credential value" and audit requirements.
- **Audit log** — every Platform-Admin-bypassed write (tenant creation, seat changes, suspension, break-glass resets), per ADR-0030 §5's durable-audit requirement.

**Not yet covered:** the actual audit-log schema (ADR-0030/0031's own shared Open Question) and the exact Graph API mechanics behind the break-glass reset (ADR-0030's own flagged Open Question) are both still undecided — this mockup shows plausible UI for both without resolving either.

**Deliberately deferred, not designed here — infrastructure/operational metrics.** Menno's own direction, verbatim: *"we would need the admin to have overview of the entire metrics for anything that has to do with the servers the tenants run on to the connectivity AND the size of the storage but lets place that into a future when the systems limitations and requirements are well known."* A future screen (server health/capacity, connectivity, and storage size — per-tenant and/or aggregate) is a real, named future need for this console, but is explicitly **not** designed in this mockup or decided by any current ADR. Deferred under this project's own established discipline of not building ahead of a demonstrated need (the same reasoning ADR-0020 already applied to its distributed rate-limit gate) — the stated trigger is once this project's own actual system limitations and operational requirements are well enough known to design real thresholds/views against, not before.

**The zero-tenant-data-access basis is unchanged and applies to that future capability too.** Menno's own follow-up, verbatim: *"the basis remains unchanged no tenant data to be viewable as admin. not the details of what a client sees as posts or could be refered to as user data."* Whenever this metrics screen is eventually designed, it must stay aggregate/operational — storage consumed, connectivity/uptime status — never a window into tenant content (posts, watchlists, or anything a client would recognize as their own user data). Not a new rule; ADR-0030 §2's existing boundary, restated here so future work doesn't quietly reopen it. See ADR-0030's own matching note.
