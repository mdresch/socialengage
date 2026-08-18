# SocialEngage

A rebuild of the discontinued Microsoft Social Engagement, starting with one subsystem of a planned four: **Social Listening / Insights** — ingesting posts from real external sources, normalizing and enriching them, and exposing them through a multi-tenant REST API and admin UI.

Solo-developer, self-funded personal project. Everything here — architecture decisions, user stories, the implementation process itself — is written down because there's no team memory to fall back on between sessions.

## Status

**As of 2026-08-13:** Phases 0–4.5 (ingestion, storage, security/multi-tenancy, derived data) fully built and shipped in both repos. Phase 6/7 (Admin UI) well underway. The authoritative, continuously-current status line lives in [`CLAUDE.md`](CLAUDE.md) — this file is a snapshot for orientation, not re-verified every session; treat `CLAUDE.md` and [`docs/implementation-log.md`](docs/implementation-log.md) (the commit-by-commit build record) as the source of truth if the two ever disagree.

## Repository layout

This workspace holds two independently deployable repos, plus the project's own documentation:

- [`social-listening-core/`](social-listening-core) — backend (Node.js/TypeScript, Express). Connector framework, ingestion, normalization, enrichment, storage, event publishing, and the REST API.
- [`social-listening-admin/`](social-listening-admin) — Next.js admin UI. Talks to `social-listening-core` exclusively through its REST API; never touches the database directly.
- [`docs/`](docs) — architecture decisions, user stories, the implementation process, and project-management artifacts. See "Where to start reading" below.

Both repos are already independent packages (separate `package.json`s, no cross-imports), even though the eventual real repo split into two git repositories hasn't happened yet — cross-repo work is still logged against this one workspace repo.

## Architecture at a glance

- **Azure-native**: Postgres with row-level security, Key Vault (credential storage), Service Bus (event publishing), Entra External ID (authentication), Azure AI Language and Azure OpenAI (swappable enrichment providers). These are real provisioned Azure resources the test suite runs contracts against — not mocks.
- **Multi-tenant with database-level isolation** as a from-day-one property, not retrofitted. Every tenant-scoped table enforces RLS; a `Bearer` token (Entra External ID) is resolved server-side against real `tenants`/`users` tables — there is no client-supplied tenant header anywhere in the trust path.
- **Real connectors**: GNews (general-news search API), Newswire (GlobeNewswire + PR Newswire public RSS), and a tenant-owned-domain RSS/content-feed connector (a tenant's own blog or press-release feed, DNS-TXT-verified). Reddit is the next connector on the roadmap; Wikipedia has emerged as a stronger near-term candidate on licensing/access grounds — see [`docs/open-decisions.md`](docs/open-decisions.md).
- **TypeScript throughout.** `social-listening-core` runs on Express + `pg`; `social-listening-admin` runs on Next.js 16 with a server-side (BFF) session — no bearer token ever reaches browser JS.

## How this project is built

Every story is implemented contract-first: a failing Jest contract is written from the story's Acceptance Criteria *before* any implementation code, and that contract becomes a permanent regression guard, never silently rewritten. A `PreToolUse` hook mechanically blocks writes to either repo's `src/**` until a contract exists. Full rationale lives in [`docs/implementation-methodology.md`](docs/implementation-methodology.md); the two mandatory Claude Code skills that operationalize it are `implement-story` (picking up a story) and `heal-contract-failure` (anything failing — a contract, the suite, lint, CI, or resuming a story a prior session left uncommitted).

If a failure looks environmental rather than a logic bug, check [`docs/environment-gotchas.md`](docs/environment-gotchas.md) first — a cross-cutting index of recurring real-Azure-timing, Jest-parallel-worker, and dev-tooling surprises already found and fixed once.

## Where to start reading

In order:

1. [`docs/implementation-methodology.md`](docs/implementation-methodology.md) — **how** work gets done.
2. [`docs/implementation-plan.md`](docs/implementation-plan.md) — **what and when**: phases, story-by-story, dependency-ordered.
3. [`docs/adr/README.md`](docs/adr/README.md) — every architecture decision, all Accepted, with the governance conventions for changing one.
4. [`docs/user-stories/README.md`](docs/user-stories/README.md) — stories across 7 epics, each tracing back to its source ADR.

[`CLAUDE.md`](CLAUDE.md) is the fuller operational entry point (written for an AI coding agent picking up work in this repo, but equally useful as a human map of the project).

## Local development

Each repo runs independently. From inside the relevant directory:

**`social-listening-core`** (needs Docker for the local Postgres container, and real Azure credentials for anything touching Key Vault/Service Bus/Entra):
```bash
npm install
npm run db:dev:up        # starts a local Postgres via docker-compose.dev.yml
npm run dev               # runs migrations, then starts the API server
npm test                  # full Jest suite, including contracts (spins up an ephemeral test DB)
npm run test:contracts    # contracts only
```

**`social-listening-admin`**:
```bash
npm install
npm run dev                # next dev, port 3000
npm test
npm run test:contracts
```

Both repos expect real environment configuration (`.env`, Azure credentials, Entra app registration) — see each repo's own `.claude/skills/` for the components that need them; none of this is invented or mocked at the contract level.

## A note on `AGENTS.md`

[`AGENTS.md`](AGENTS.md) mirrors `CLAUDE.md`'s guidance for other agent tools that read that filename by convention. `social-listening-admin/AGENTS.md` is a different, Next.js-generated file (regenerated by `next dev` itself) and is unrelated.
