# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0025 Persistent Local Dev Database, Separate from the Test Database — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer (Claude) |
| Reviewer(s) | Menno |
| Status | Approved (source ADR-0025 is Accepted; documents shipped design — Story 1.4) |
| Related Documents | ADR-0025, BRD-0025, ADR-0016, Story 1.4, `docker-compose.dev.yml`, `scripts/withDevEnv.js` |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0025 (persistent local dev database, kept separate from the ephemeral test database) and BRD-0025 into the functional design for a second, deliberately independent local Postgres setup that a developer can run and inspect data against, without any risk of Jest's test-container lifecycle destroying it. ADR-0025 is Accepted (2026-07-30, same day as drafted, after being built and verified in practice); Story 1.4 implements it. This FDD documents the shipped design, including three real bugs discovered and fixed during and after the initial build (all now part of the accepted behavior, not open issues).

### 2.2 Scope

**In scope:**
- `docker-compose.dev.yml`: an independent Docker Compose project (`social-listening-core-dev`), container, network, port (`5435`), database name (`social_listening_dev`), and named volume (`dev-pgdata`).
- npm scripts: `db:dev:up`, `db:dev:migrate`, `dev`, `db:dev:down`, `db:dev:reset`.
- `scripts/withDevEnv.js`: a cross-platform (bash/PowerShell) Node wrapper that forces dev database connection env vars and loads the repo-root `.env` before spawning the target command via `spawn()` with an argv array.
- Reuse of the same custom Postgres image (`docker/test-postgres/Dockerfile`, Postgres 17 + `pg_cron`) as the test container, so dev and test never drift on Postgres version/extensions.
- The three correctness fixes to `withDevEnv.js` found during/after the initial build: `execSync`→`spawn` (argument corruption + blocking), forced (not fallback) connection-variable overrides, and `.env` loading.

**Out of scope:**
- Any change to the production database target (Azure Database for PostgreSQL, ADR-0016) or the test container's ephemeral Jest-owned lifecycle.
- Automated CI deployment of the dev database — purely a local developer convenience.
- A schema-drift guard/automated diff between the two compose files (named as an open question, not built).
- Running both containers concurrently as a Docker-in-Docker test.

### 2.3 Target Audience

Menno (solo developer), any future contributor picking up the repo, whoever maintains local tooling documentation.

---

## 3. Context and Background

Story 1.2 (ADR-0016) built exactly one local Postgres: an ephemeral, project-scoped container (`docker-compose.test.yml`, port `5434`) that Jest's `globalSetup`/`globalTeardown` bring up, migrate, and tear down automatically around every test run — correct for CI and the contract suite, but wrong for anything that needs to survive longer than one Jest process. Story 2.6 (ADR-0024) shipped the first real, non-fixture connector — the first time the project had something worth actually running and looking at, not just proving via an automated contract. Reusing the test container for this was tried first and failed exactly as this ADR's Decision would predict: running the full contract suite in one terminal while a demo server was up in another caused `globalTeardown` to remove the shared container (fixed name, fixed compose project) the moment the test run finished, silently killing the demo server's database connection and every row of ingested data mid-session.

This ADR is one of the project's two acknowledged exceptions to the ADR series' own "architecturally significant only" scope (ADR-0024 was the first) — justified because the collision was hit and demonstrated in practice, not hypothesized, and because fixing it surfaced a real, non-obvious correctness bug worth a durable record.

**Three real bugs found and fixed, all now part of the shipped/accepted behavior:**
1. **2026-07-30 (initial build):** the wrapper's first version used `execSync()` on a rejoined `argv.slice(2).join(' ')` string — corrupting any argument containing a space/quote (re-parsed through a second shell) and blocking synchronously, the wrong model for a long-running server process. Fixed by rewriting around `spawn()` with an argv array and explicit exit-code forwarding.
2. **2026-07-30 (found writing Story 1.4's contract):** `PGDATABASE`/`PGUSER`/`PGPASSWORD`/`APP_PGUSER`/`APP_PGPASSWORD` used a `process.env.X || 'default'` fallback (unlike `PGPORT`, already forced) — meaning a stray value already set in the caller's shell would silently override the intended dev target instead of the reverse. Fixed by forcing all six connection values unconditionally.
3. **Found and fixed 2026-08-10, logged to the ADR's Amendment Log 2026-08-13 by Documentation Steward correction:** `withDevEnv.js` never called `dotenv.config()` at all — `npm run dev` and `db:dev:migrate` had only ever received the script's own hardcoded Postgres connection vars, never `ENTRA_*`/`GNEWS_API_KEY`/`AZURE_*`/`PORT` from `.env`. Fixed by loading `.env` deterministically from the repo root before building the forced-override env object, with the forced dev-DB vars still winning over any conflicting `.env` value.

Source requirements: BRD-0025 §§6–7, Story 1.4 (Epic 1, built and verified 2026-07-30).

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Eliminate collisions between the contract test run and a running local dev server | A full `npm test` run completes while `npm run dev` is live; only the test container is affected, proven in practice |
| G2 | Provide durable local development data | Data survives a routine `db:dev:down`; only `db:dev:reset` destroys it |
| G3 | Make local server startup deterministic and cross-platform | `npm run dev`/`db:dev:migrate` work unmodified from bash or PowerShell with no manual shell `export` |
| G4 | Keep dev technically aligned with test (and, transitively, production) | Both containers use the same custom Postgres image and the same migrations |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: Isolated Dev Postgres Container

- **Description:** A second, fully independent Postgres container dedicated to local development, never touched by the test suite's lifecycle.
- **Triggers:** Developer runs `npm run db:dev:up`.
- **Inputs:** `docker-compose.dev.yml` configuration (project name, container, network, port, database name, volume).
- **Processing:** Starts a container under Compose project `social-listening-core-dev`, on host port `5435` (distinct from the test container's `5434` and the default `5432`), database name `social_listening_dev`, backed by the named volume `dev-pgdata`. Builds from the same custom image as the test container (`docker/test-postgres/Dockerfile`, Postgres 17 + `pg_cron`) so the two never drift on Postgres version or extensions.
- **Outputs:** A running, addressable dev Postgres instance independent of any test run.
- **Error handling:** If port `5435` is already in use on a given machine, the developer must adjust it locally — this is a known, documented, machine-specific risk (BRD-0025 R-001), not handled automatically.
- **Edge cases:** Running `npm test` concurrently with the dev server active must leave the dev container completely unaffected — this is the specific collision this ADR exists to prevent, and is proven in practice (not just argued) per the Amendment Log.

### 5.2 Feature / Capability: Data Persistence and Explicit Reset

- **Description:** Dev database contents survive routine stop/start cycles; only an explicitly separate action destroys them.
- **Triggers:** Developer runs `db:dev:down` (routine stop) or `db:dev:reset` (explicit destroy).
- **Inputs:** Current state of the `dev-pgdata` named volume.
- **Processing:** `db:dev:down` runs a plain `docker compose down` (no `-v`) — the volume and its data remain. `db:dev:reset` runs `docker compose -f docker-compose.dev.yml down -v` — an explicit, separately-named action that deletes the volume.
- **Outputs:** Either a stopped-but-intact dev database, or a fully reset one.
- **Error handling:** N/A — the two commands are deliberately distinct so a developer cannot accidentally wipe data via the routine stop command.
- **Edge cases:** Restarting via `db:dev:up` after a `db:dev:down` (no reset) must show the same data as before the stop.

### 5.3 Feature / Capability: Cross-Platform Environment Wrapper (`withDevEnv.js`)

- **Description:** A dependency-free Node wrapper that sets the dev database's connection environment variables and loads the repo's `.env` before running a given command, so the same npm script works unmodified from bash or PowerShell.
- **Triggers:** Any npm script that needs to run against the dev database (`db:dev:migrate`, `dev`).
- **Inputs:** The target command and its arguments (as an argv array, not a rejoined string); the repo-root `.env` file; any connection-related values already present in the parent shell environment.
- **Processing:**
  1. Load `.env` deterministically from the repo root (`path.join(__dirname, '..', '.env')`, not `process.cwd()`-relative) — so non-database configuration (`ENTRA_*`, `GNEWS_API_KEY`, `AZURE_*`, `PORT`) is available to the launched process.
  2. Force all six dev database connection values (`PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `APP_PGUSER`, `APP_PGPASSWORD`) unconditionally — these override, not fall back behind, whatever `.env` or the parent shell already set.
  3. Spawn the target command via `spawn()` with an argv array (never a rejoined/re-shelled string), forwarding the child's exit code.
- **Outputs:** The target command (e.g. the real Express server, or a migration run) launched with a deterministic dev-database environment, regardless of the caller's own shell state.
- **Error handling:** A multi-word argument (containing a space or quote) passed to the wrapped command must survive intact — this was the specific defect the original `execSync`-based version had.
- **Edge cases:** A stray `PGPORT`/`PGDATABASE`/etc. value already set in the caller's shell, or a conflicting value in `.env`, must never win over the forced dev values — proven by a contract test using a fixture `.env` with a deliberately conflicting `PGPORT`.

### 5.4 Feature / Capability: npm Script Surface

- **Description:** The set of developer-facing commands that drive the dev database and server lifecycle.
- **Triggers:** Developer invocation from the command line.
- **Inputs:** None beyond the command name itself.
- **Processing:** `db:dev:up` (start container), `db:dev:migrate` (apply `migrations/*.sql` via `withDevEnv.js`), `dev` (start the real Express server against the dev database, via `withDevEnv.js`), `db:dev:down` (stop, preserve data), `db:dev:reset` (stop, destroy volume).
- **Outputs:** The named effect for each script, matching its name exactly.
- **Error handling:** N/A — each script is a thin wrapper over Docker Compose or `withDevEnv.js`; failures surface as the underlying Docker/Node process's own error output.
- **Edge cases:** Running `db:dev:migrate` or `dev` before `db:dev:up` fails at the connection step (no running container to connect to) rather than silently doing nothing.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| Menno (Backend Developer) | Daily user of the local dev database |
| Menno (Product Owner / Technical Lead) | Owner of the local development experience and correctness |
| Future Contributors | Anyone else who later picks up the repo |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| US1 (Story 1.4) | Backend developer | Run the real server and the contract suite at the same time without losing data | I can actually look at real, running connector behavior, not just trust an automated contract | `docker-compose.dev.yml` fully isolated from `docker-compose.test.yml`; a concurrent `npm test` run leaves the dev database/server unaffected |
| US2 | Backend developer | Start the dev server without manually exporting environment variables in whichever shell I'm using | The workflow is identical on bash and PowerShell | `npm run dev`/`db:dev:migrate` route through `withDevEnv.js` with no manual shell setup |
| US3 | Backend developer | Have dev data survive a routine stop, but be able to explicitly wipe it when needed | I don't lose data by accident, but can still reset cleanly | `db:dev:down` preserves data; `db:dev:reset` explicitly destroys it |

### 6.3 Workflow Diagrams / Steps

**First-time / routine dev session:**
1. `npm run db:dev:up` — starts the isolated dev Postgres container.
2. `npm run db:dev:migrate` — applies `migrations/*.sql` via `withDevEnv.js` (loads `.env`, forces dev connection vars, spawns the migration command).
3. `npm run dev` — starts the real Express server via `withDevEnv.js` against the dev database.
4. Developer manually exercises the running server (e.g. `GET /v1/posts`), and/or runs `npm test` in a second terminal — the two do not collide.
5. `npm run db:dev:down` when done — data persists in `dev-pgdata`.
6. `npm run db:dev:reset` only when an explicit clean slate is wanted.

---

## 7. Data Requirements

### 7.1 Data Inputs

- `migrations/*.sql` — the same schema files used by test and production.
- Repo-root `.env` — non-database configuration (`ENTRA_*`, `GNEWS_API_KEY`, `AZURE_*`, `PORT`).
- Any pre-existing shell environment values (explicitly overridden, not consumed).

### 7.2 Data Outputs

- A running, queryable dev Postgres instance with persisted data.
- Real `SocialPost`/`Author`/`IngestionRun`/etc. rows produced by manually exercising the real server against real connectors.

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| Dev Postgres container (`social-listening-core-dev`) | Compose project name, container, network, port `5435`, database name `social_listening_dev` | Independent of, but image-identical to, the test container |
| `dev-pgdata` (named Docker volume) | Persistent storage for the dev container's data files | Survives `db:dev:down`; destroyed only by `db:dev:reset` |
| Test Postgres container (existing, `docker-compose.test.yml`) | Port `5434`, no named volume, ephemeral, Jest-owned lifecycle | Structurally parallel to, but lifecycle-independent from, the dev container |
| Dev database connection variables | `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `APP_PGUSER`, `APP_PGPASSWORD` | Forced unconditionally by `withDevEnv.js`, overriding shell/`.env` values |
| `withDevEnv.js` (wrapper script) | Loads `.env`, forces dev vars, spawns target command via argv array | Used by `dev` and `db:dev:migrate` npm scripts |

### 7.4 Validation Rules

- The dev database connection values must always be forced by `withDevEnv.js`, overriding any conflicting value already present in the parent shell or `.env` — never the reverse.
- `withDevEnv.js` must load the repo-root `.env` before applying the forced dev overrides, so non-database configuration reaches the launched process.
- Multi-word command-line arguments passed through `withDevEnv.js` must remain intact (no shell re-parsing corruption).
- `docker-compose.dev.yml` and `docker-compose.test.yml` must share no project name, port, or database name.

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | Dev database connection values must be forced by `withDevEnv.js` and must override any value already present in the parent shell or `.env`. | Wrapper (5.3) |
| BR2 | Dev data must only be destroyed by the explicitly named `db:dev:reset` command; `db:dev:down`/`db:dev:up` must preserve it. | Persistence (5.2) |
| BR3 | The test container lifecycle is owned by Jest and is ephemeral; the dev container lifecycle is owned by the developer and is persistent. | Isolation (5.1) |
| BR4 | `withDevEnv.js` must load the repo-root `.env` before applying forced dev database overrides. | Wrapper (5.3) |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| `docker-compose.dev.yml` | Local | Defines the isolated dev Postgres container | Docker Compose YAML |
| `docker/test-postgres/Dockerfile` (shared image) | Local | Same custom Postgres 17 + `pg_cron` image used by test | Dockerfile |
| `scripts/withDevEnv.js` | Local | Environment wrapper for `dev`/`db:dev:migrate` npm scripts | Node.js (`spawn`, `dotenv`) |
| `migrations/*.sql` | Local | Schema applied to dev, test, and (transitively) production | SQL |
| Real Express server (`npm run dev`) | Local | The actual running backend, pointed at the dev database | HTTP/REST |
| Jest `globalSetup`/`globalTeardown` (test container, unaffected by this ADR) | Local | Owns the separate, ephemeral test container's lifecycle | Jest lifecycle hooks |

---

## 10. Non-Functional Considerations

- **Reliability:** The dev server must start against the intended database target regardless of what is already set in the parent shell or `.env` (NFR-001) — this is the central correctness property the three logged bug fixes all serve.
- **Maintainability:** Dev and test compose files must stay aligned on Postgres version/extensions; currently a manual responsibility, with a lightweight diff/schema-drift guard named as a future open question, not built now (consistent with the project's "build for the problem you have" discipline).
- **Usability:** Commands must work unmodified from both bash and PowerShell, with no manual shell `export`/`$env:` needed.
- **Compatibility:** Dev container port (`5435`) is a machine-specific choice, documented as adjustable if it collides on a different machine.
- **Scope discipline:** This is purely local tooling — no new cloud resources, no CI deployment, no change to the Azure production target (ADR-0016).

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| Port `5435` already in use on a developer's machine | Docker Compose start failure | Developer adjusts the port locally; documented as a known, low-impact risk |
| `npm test` run concurrently with `npm run dev` | None (transparent) | Only the test container (`docker-compose.test.yml`) is affected by `globalTeardown`; the dev container/server continue running unaffected |
| Multi-word argument passed through `withDevEnv.js` | None | Argument preserved intact via `spawn()` with an argv array (post-fix behavior) |
| Stray `PGPORT`/etc. already set in the caller's shell | None | Overridden unconditionally by the forced dev values (post-fix behavior) |
| `.env` not loaded (pre-2026-08-10 behavior) | Server missing `ENTRA_*`/`GNEWS_API_KEY`/`AZURE_*`/`PORT` config | Fixed: `.env` now loaded deterministically from the repo root before forced overrides are applied |
| `db:dev:down` run instead of `db:dev:reset` | None | Data preserved; container stopped only |

---

## 12. Assumptions and Dependencies

**Assumptions:**
- The developer has Docker and `docker compose` available locally.
- Host port `5435` is available (or is adjusted locally if it conflicts).
- The dev database applies the same `migrations/*.sql` files used by the test database and the Azure production target.

**Dependencies:**
- ADR-0016 (Azure Database for PostgreSQL as the production target) — Accepted; unaffected by this ADR.
- Story 1.2 (Postgres engine and local test container setup) — built; the test container this ADR deliberately does not touch.
- Story 1.4 (this ADR's implementation) — built and verified 2026-07-30.
- `docker/test-postgres/Dockerfile` (shared custom image) — already built.

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | Should schema-drift protection between the two compose files be automated (e.g. a diff script)? | Menno | Not built now; revisit if the repo gains a second contributor |
| Q2 | Should `docker-compose.dev.yml` become a documented required local-setup step once `social-listening-admin` has real pages developing against the live API? | Menno | Revisit then, not decided here |

---

## 14. Appendix

**Glossary:** see BRD-0025 §15 for Docker Compose project name, ephemeral test database, named volume, `pg_cron`, and `withDevEnv.js` definitions.

**Reference links:**
- [ADR-0025: Persistent local dev database, kept separate from the ephemeral test database](../../adr/0025-persistent-local-dev-database-separate-from-test-database.md)
- [BRD-0025](../Business-Requirements/BRD-0025-Persistent-Local-Dev-Database-Separate-From-Test-Database.md)
- [ADR-0016] (referenced; not independently re-verified in this pass)
- [Story 1.4 — Persistent local dev database, separate from the ephemeral test database](../../user-stories/epic-1-repository-and-api-foundation.md)
- Supporting artifacts: `social-listening-core/docker-compose.dev.yml`, `docker-compose.test.yml`, `docker/test-postgres/Dockerfile`, `scripts/withDevEnv.js`, `package.json`

**Missing sources:** No `docs/product-research/feature-designs/*.md` or deep-research report exists for this ADR — consistent with its own framing as a developer-tooling exception, not a product-facing feature, as BRD-0025's own Appendix confirms.

**Revision history:**

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 1.0 | 2026-08-23 | FDD Writer (Claude) | Full regeneration: correct H1, real per-capability Section 5 breakdown (including the three logged correctness fixes as shipped behavior), real Section 7.3 data model, replacing the prior defective BRD-shaped draft |
