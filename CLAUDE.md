# socialengage — Social Listening / Insights subsystem

Solo-developer, self-funded personal project. Rebuild of the discontinued Microsoft Social Engagement, starting with one subsystem (Social Listening / Insights) of a planned four. **Status, as of 2026-08-04: Phases 0–4.5 fully built and shipped in both repos (95+ story contracts passing); Phase 6 (Admin UI) underway — Story 6.1 (Next.js scaffold + real Entra External ID sign-in) shipped, Stories 6.2–6.7 drafted and Ready but not yet built.** See [`docs/implementation-log.md`](docs/implementation-log.md) for the full, commit-by-commit build record.

## Read these before doing anything else

1. [`docs/implementation-methodology.md`](docs/implementation-methodology.md) — **how** work gets done: contract-first TDD, component `SKILL.md`s, permanent regression suite, bounded self-healing, hash-anchored Implementation Log. This is not optional background reading — it's the process this repo enforces.
2. [`docs/implementation-plan.md`](docs/implementation-plan.md) — **what and when**: phases (0 through 6, plus an inserted Phase 4.5), story-by-story, dependency-ordered. No calendar dates.
3. [`docs/adr/README.md`](docs/adr/README.md) — 37 ADRs (Accepted decisions + a handful of Proposed policy awaiting acceptance), plus the governance conventions for changing one.
4. [`docs/user-stories/README.md`](docs/user-stories/README.md) — 41 stories across 6 epics, each carrying its source ADR's status forward (Ready vs. Blocked); a few (1.5, 1.6, 6.2–6.6) are unstoried-ADR CRUD/UI surface instead, per that doc's own "No-story ADR convention."

## Mandatory workflow — do not freelance

- **Picking up any story:** invoke the `implement-story` skill. Do not write implementation code by hand outside it.
- **Anything failing** (a contract, the accumulated suite, lint, CI, or the `enforce-contract-first` hook blocking a write): invoke the `heal-contract-failure` skill. Do not patch it ad hoc.
- A `PreToolUse` hook (`.claude/hooks/enforce-contract-first.cjs`) mechanically blocks writes to `<repo>/src/**` before any contract test exists in that repo — this is enforced, not just documented. If it doesn't seem to be firing in a fresh session, run `/hooks` once to reload config.
- Both skills end by appending to [`docs/implementation-log.md`](docs/implementation-log.md) — commit hash, files touched, verified against git by `docs/templates/check-implementation-log.cjs`, not just asserted. It now has one entry per completed story/healing pass, most recently Story 6.1; append to it, never edit or remove an existing entry.

## Map

- `docs/project docs/` — design spec + business case/charter/stakeholder register (context, not process)
- `docs/adr/` — 37 ADRs
- `docs/user-stories/` — 41 stories, 6 epics
- `docs/implementation-plan.md`, `docs/implementation-methodology.md`, `docs/implementation-log.md`
- `docs/templates/` — CI workflow, pre-commit hook, traceability/log verification scripts (root `.github/workflows/` now has real CI in place)
- `social-listening-core/` — backend (Node.js/TypeScript), Phases 0–4.5 built: connectors (GNews, Newswire), watchlists, posts API, connector health, credential storage, Service Bus events, tenants/users + RLS, Entra-based identity resolution
- `social-listening-admin/` — Next.js UI, Story 6.1 built (scaffold + Entra sign-in + server-side BFF session); Stories 6.2–6.7 (role gating, connect/watchlist/status screens, Platform Admin console, self-service tenant sign-up) not yet built
- `.claude/skills/implement-story/`, `.claude/skills/heal-contract-failure/` — the two mandatory skills
- `.claude/hooks/enforce-contract-first.cjs` + `.claude/settings.json` — the real-time enforcement hook

## Facts worth not re-deriving

- Two separate repos (`social-listening-core` backend, `social-listening-admin` Next.js UI) — ADR-0001. Both now exist on disk as subdirectories of this workspace; the eventual real repo split still hasn't happened, so cross-repo commits are still logged against this single workspace repo per each Implementation Log entry's own pre-split note.
- TypeScript/Node.js throughout, Azure-native (Postgres + RLS, Key Vault, Service Bus, Entra External ID, Azure AI Language) — ADR-0016, ADR-0015, ADR-0014, ADR-0029, spec §2. All three of Key Vault, Service Bus, and Blob Storage are real provisioned Azure resources this project's contracts run against, not mocks.
- Multi-tenant with database-level isolation as a from-day-one property, not retrofitted — ADR-0015. Real authentication now sits in front of it too: `Authorization: Bearer` (Entra External ID) resolved server-side against real `tenants`/`users` tables under RLS — `X-Tenant-Id` is fully retired as a trust mechanism (Story 5.10/ADR-0033).
- Connector order decided: RSS/News first, then Reddit — spec §10, `implementation-plan.md` Phase 1. RSS/News shipped as two connectors (GNews API, Story 2.7; Newswire RSS, Story 2.6); Reddit not yet started.
- Solo project shapes several decisions directly — lightweight CI (no CODEOWNERS, no OpenAPI governance yet), and ADR-0020's distributed rate-limit gate is explicitly deferred until a second concurrent instance is ever actually run, not built speculatively.
- Credential/connector authority is ownership-tier-aware (ADR-0028, built by Story 1.7): no system-wide credentials; tenant-wide credentials only by Tenant-Admin; user-bound credentials self-activated by the user.
- Admin UI's own auth mechanism is a server-side (BFF) session, no bearer token in browser JS, no third-party auth framework adopted at v1 — ADR-0036. Role-gating (Story 6.2) and the Platform Admin console (Story 6.6) are both still blocked in practice on a `GET /v1/me`-shaped identity endpoint that doesn't exist yet in `social-listening-core`.
