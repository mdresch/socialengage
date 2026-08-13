# socialengage — Social Listening / Insights subsystem

Solo-developer, self-funded personal project. Rebuild of the discontinued Microsoft Social Engagement, starting with one subsystem (Social Listening / Insights) of a planned four. **Status, as of 2026-08-13 (later the same day — corrected by the Documentation Steward, see the dated note below): Phases 0–4.5 fully built and shipped in both repos; Phase 6/7 (Admin UI) well underway — Stories 6.1–6.13, 6.15, 6.16, and 6.17 built and contract-verified (`social-listening-admin`, 18/18 suites, 301/301 tests as of Story 6.17); Story 6.14 remains Ready but not yet built. Epic 6 was split 2026-08-12 into Epic 6 (Tenant Admin UI) and a new Epic 7 (Platform Admin UI, Story 6.6 relocated there under its original ID).** See [`docs/implementation-log.md`](docs/implementation-log.md) for the full, commit-by-commit build record — this file is a snapshot, not re-verified every session, so treat the log as authoritative if the two disagree.

**Documentation Steward correction, 2026-08-13/14:** the status line above previously read "Stories 6.1–6.11, 6.15, and 6.16 built... 6.12, 6.13, and 6.14 remain Ready but not yet built" (`57fe1de`, committed the morning of 2026-08-13) — accurate at the time, but overtaken the same day when Stories 6.12 (`e1e9913`), 6.13 (`500a4b9`), and 6.17 (`d0eb088`, drafted and built the same day) all shipped, confirmed directly against `docs/implementation-log.md` and `docs/user-stories/epic-6-tenant-admin-ui.md`'s own "Built" notes for each. Updated in place, following this file's own explicit "snapshot, not re-verified every session" framing rather than a dated-note append (unlike the historical-record files this project treats as append-only, e.g. `docs/implementation-log.md`, ADRs).

## Read these before doing anything else

1. [`docs/implementation-methodology.md`](docs/implementation-methodology.md) — **how** work gets done: contract-first TDD, component `SKILL.md`s, permanent regression suite, bounded self-healing, hash-anchored Implementation Log. This is not optional background reading — it's the process this repo enforces.
2. [`docs/implementation-plan.md`](docs/implementation-plan.md) — **what and when**: phases (0 through 6, plus an inserted Phase 4.5), story-by-story, dependency-ordered. No calendar dates.
3. [`docs/adr/README.md`](docs/adr/README.md) — 53 ADRs as of 2026-08-13, all Accepted, none Proposed — plus the governance conventions for changing one. (This count grows; README.md's own master index and "Proposed (not yet decided)" tracker are authoritative, not a number restated here.)
4. [`docs/user-stories/README.md`](docs/user-stories/README.md) — stories across 7 epics (Epic 7, Platform Admin UI, split out of Epic 6 on 2026-08-12), each carrying its source ADR's status forward (Ready vs. Blocked); a few (1.5, 1.6, 6.2–6.6) are unstoried-ADR CRUD/UI surface instead, per that doc's own "No-story ADR convention." The story count has grown past the original 41 as new stories were drafted (e.g. 6.8–6.16) — README.md's own listing is authoritative, not a number restated here.

## Mandatory workflow — do not freelance

- **Picking up any story:** invoke the `implement-story` skill. Do not write implementation code by hand outside it.
- **Anything failing** (a contract, the accumulated suite, lint, CI, or the `enforce-contract-first` hook blocking a write): invoke the `heal-contract-failure` skill. Do not patch it ad hoc.
- A `PreToolUse` hook (`.claude/hooks/enforce-contract-first.cjs`) mechanically blocks writes to `<repo>/src/**` before any contract test exists in that repo — this is enforced, not just documented. If it doesn't seem to be firing in a fresh session, run `/hooks` once to reload config.
- Both skills end by appending to [`docs/implementation-log.md`](docs/implementation-log.md) — commit hash, files touched, verified against git by `docs/templates/check-implementation-log.cjs`, not just asserted. It has one entry per completed story/healing pass (most recently Story 6.17, as of 2026-08-13 — check the log's own last entry, not this number, for the true current state); append to it, never edit or remove an existing entry.

## Map

- `docs/project docs/` — design spec + business case/charter/stakeholder register (context, not process)
- `docs/adr/` — 53 ADRs as of 2026-08-13 (grows; see `docs/adr/README.md`'s own master index for the current count)
- `docs/user-stories/` — story-per-epic files, 7 epics (Epic 7 added 2026-08-12, Platform Admin UI split out of Epic 6)
- `docs/implementation-plan.md`, `docs/implementation-methodology.md`, `docs/implementation-log.md`
- `docs/templates/` — CI workflow, pre-commit hook, traceability/log verification scripts (root `.github/workflows/` now has real CI in place)
- `social-listening-core/` — backend (Node.js/TypeScript), Phases 0–4.5 built: connectors (GNews, Newswire), watchlists, posts API, connector health, credential storage, Service Bus events, tenants/users + RLS, Entra-based identity resolution
- `social-listening-admin/` — Next.js UI. Built: Story 6.1 (scaffold + Entra sign-in + BFF session), 6.2 (role-gated routing shell), 6.3 (connector connect/disconnect), 6.4 (watchlist management), 6.5 (connector status view), 6.6 (Platform Admin console, now in Epic 7), 6.7 (self-service tenant sign-up), 6.8 (user invitation/management), 6.9 (tenant settings), 6.10 (Same-Domain Invite Assist), 6.11 (post feed), 6.12 (tenant-owned-feed connector setup UI), 6.13 (tenant deletion/offboarding UI), 6.15 (connector activate/deactivate), 6.16 (manual enrichment button), 6.17 (tenant-owned-feed activate/deactivate control). Ready but not yet built: 6.14 (access-history view)
- `.claude/skills/implement-story/`, `.claude/skills/heal-contract-failure/` — the two mandatory skills
- `.claude/hooks/enforce-contract-first.cjs` + `.claude/settings.json` — the real-time enforcement hook

## Facts worth not re-deriving

- Two separate repos (`social-listening-core` backend, `social-listening-admin` Next.js UI) — ADR-0001. Both now exist on disk as subdirectories of this workspace; the eventual real repo split still hasn't happened, so cross-repo commits are still logged against this single workspace repo per each Implementation Log entry's own pre-split note.
- TypeScript/Node.js throughout, Azure-native (Postgres + RLS, Key Vault, Service Bus, Entra External ID, Azure AI Language) — ADR-0016, ADR-0015, ADR-0014, ADR-0029, spec §2. All three of Key Vault, Service Bus, and Blob Storage are real provisioned Azure resources this project's contracts run against, not mocks.
- Multi-tenant with database-level isolation as a from-day-one property, not retrofitted — ADR-0015. Real authentication now sits in front of it too: `Authorization: Bearer` (Entra External ID) resolved server-side against real `tenants`/`users` tables under RLS — `X-Tenant-Id` is fully retired as a trust mechanism (Story 5.10/ADR-0033).
- Connector order decided: RSS/News first, then Reddit — spec §10, `implementation-plan.md` Phase 1. RSS/News shipped as two connectors (GNews API, Story 2.7; Newswire RSS, Story 2.6); Reddit not yet started.
- Solo project shapes several decisions directly — lightweight CI (no CODEOWNERS, no OpenAPI governance yet), and ADR-0020's distributed rate-limit gate is explicitly deferred until a second concurrent instance is ever actually run, not built speculatively.
- Credential/connector authority is ownership-tier-aware (ADR-0028, built by Story 1.7): no system-wide credentials; tenant-wide credentials only by Tenant-Admin; user-bound credentials self-activated by the user.
- Admin UI's own auth mechanism is a server-side (BFF) session, no bearer token in browser JS, no third-party auth framework adopted at v1 — ADR-0036. `GET /v1/me` (Story 5.11) is now built, so role-gating (Story 6.2) and the Platform Admin console (Story 6.6) both ship against a real resolved identity, not the degrade-to-`null` fallback.
