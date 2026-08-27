# Self-Learning Synthesis: Epic 6 (Tenant Admin UI & Core Contract Integrations)

**Compiled Date:** 2026-08-27  
**Source Telemetry:** Git commits `01bce70` through `64ac1f3` (Stories 6.38–6.41 & Healing passes)  
**Governing Architecture:** ADR-0122 / FDD-0122 / Story 14.5

---

## 1. Executive Summary & Telemetry Ingestion

Epic 6 (*Tenant Admin UI*) covers `social-listening-admin`, server-side session authentication with Entra External ID (CIAM), role-gated shells, and integration with `social-listening-core`.

During recent delivery of Stories 6.38–6.41 (Outbound Replies, Polypost Composer Publish, Workspace Exports, and Deep Research), runtime testing and contract verification uncovered three critical architectural constraints and three environment failure modes that were successfully healed and codified.

---

## 2. Reusable Architectural Patterns Codified

### A. Same-Origin Route Proxy Pattern (ADR-0036 Enforced)
- **Problem**: Client-side React components in `social-listening-admin` must invoke `social-listening-core` REST endpoints without exposing Entra CIAM bearer tokens or session secrets to browser JavaScript.
- **Learned Pattern**: Create dedicated Next.js App Router route handlers under `src/app/api/.../route.ts` (e.g., `api/outbound/posts`, `api/posts/export.csv`, `api/composer/research`).
- **Mechanism**: The route handler retrieves the session via `getSession()`, attaches `Authorization: Bearer <token>`, forwards the payload via `core-client.ts`, and streams/proxies the response.
- **Verified Commits**: `c643553` (Story 6.1), `443819e` (Story 6.2).

### B. Streaming Export Handler for Large Payloads (ADR-0074 / ADR-0090)
- **Problem**: Full workspace JSON exports and posts CSV downloads can easily exceed memory buffers if buffered entirely in Node.js memory before returning.
- **Learned Pattern**: Proxy endpoints stream chunks directly from `social-listening-core` to the client response pipe, maintaining constant $O(1)$ memory overhead regardless of tenant dataset size.
- **Verified Commits**: `cf1f96c` (Story 6.40 export routes).

### C. Multi-Platform Asset Resolution & Partial Success (`207 Multi-Status`)
- **Problem**: When authoring a post across multiple networks (Facebook, LinkedIn, etc.), some platforms may succeed while others fail (e.g., expired Page access token or network timeout).
- **Learned Pattern**: `PublishTargetsDialog` and `PolypostComposer` consume `207 Multi-Status` payloads from core, mapping individual target asset IDs to per-platform status toasts (`published` with live URL vs `failed` with localized error code).
- **Verified Commits**: `e0abfdd` (Story 6.39).

---

## 3. Environment & Test Infrastructure Gotchas Indexed

| Issue & Component | Root Cause Analysis | Verified Permanent Guardrail | Source Commit |
| :--- | :--- | :--- | :--- |
| **Jest CSS Module Parsing** (`social-listening-admin`) | Jest dynamically imports `page.tsx` during route-gating contract tests, failing on `.module.css` syntax. | Added `identity-obj-proxy` to `devDependencies` and mapped `\\.module\\.css$` in `jest.config.js`. | `3cb453d` |
| **`pg_cron` in Test DB Clones** (`social-listening-core`) | `CREATE EXTENSION pg_cron` only succeeds in the configured `cron.database_name` (`social_listening_test`). | Clone templates by first migrating `social_listening_test`, then running `CREATE DATABASE ... TEMPLATE social_listening_test`. | `01bce70` |
| **Cross-Repo Port Collisions** (`withDevEnv.js`) | `withDevEnv.js` forced `PGPORT=5435` (dev DB), breaking contract tests running against test DB on `5434`. | Added `WITH_DEV_ENV_RESPECT_PG=1` opt-in flag to allow cross-repo test suites to override Postgres port variables. | `761f086` |

---

## 4. Immediate Actionable Safeguards for Remaining Stories

1. **Ephemeral State for AI Panels**: Do not persist Deep Research or LLM exploratory output to `localStorage` draft state; keep AI analysis ephemeral to avoid corrupting active post drafts across sessions (`64ac1f3`).
2. **Strict Gating on Sensitive Actions**: Ensure export buttons and offboarding links on `/tenant/settings` verify `session.identity.role === 'tenant_admin'` on the server side in addition to UI conditional rendering.
3. **Graceful Degraded States**: When non-Facebook connectors (LinkedIn, Instagram) lack live `publish()` implementations, render platform targets as disabled with informative tooltips rather than omitting them entirely.