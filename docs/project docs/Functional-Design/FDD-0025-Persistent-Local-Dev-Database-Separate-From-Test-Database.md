# Business Requirements Document — Persistent Local Dev Database, Separate from the Test Database

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | Business Requirements Document — Persistent Local Dev Database, Separate from the Test Database |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0025-persistent-local-dev-database-separate-from-test-database.md, ../Business-Requirements/BRD-0025-Persistent-Local-Dev-Database-Separate-From-Test-Database.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0025-persistent-local-dev-database-separate-from-test-database.md and the business requirements in BRD-0025-Persistent-Local-Dev-Database-Separate-From-Test-Database.md into functional design for **Persistent Local Dev Database Separate From Test Database**.
The `social-listening-core` backend currently relies on a single, ephemeral Postgres container that Jest brings up, migrates, and tears down around every contract-suite run. This is the right shape for automated tests, but it makes it impossible for a developer to run the real server and look at real data without risking that a concurrent or subsequent `npm test` run will wipe that data out from under them.

This BRD captures the business need for a second, deliberately independent, persistent Postgres database for local development. The solution adds a new Docker Compose dev setup on a non-conflicting port, a named volume so data survives container restarts, and a cross-platform Node wrapper that starts the dev server with the correct database connection values. This lets the developer safely run the contract suite and the live server side by side, with real persisted data, while keeping the dev and test Postgres images aligned.

The expected outcome is a faster, more reliable local development workflow that behaves the same on Windows and bash/PowerShell and never loses the data the developer is actively inspecting.

---

### 2.2 Scope
**In scope:**
- A new `docker-compose.dev.yml` defining a Postgres container that is fully isolated from the test compose project.
- A named Docker volume for the dev database that survives a plain `docker compose down`.
- New npm scripts to start, migrate, stop, and explicitly reset the dev database.
- A `scripts/withDevEnv.js` wrapper that forces the dev database connection environment and loads the repo's `.env` before launching the target command.
- Verification that the dev container and the test container can coexist without collision.
- Reuse of the existing custom Postgres image and migration pipeline so dev, test, and production do not drift.

**Out of scope:**
- Any change to the production database target (Azure Database for PostgreSQL) or to the test container's ephemeral lifecycle.
- Automated CI deployment of the dev database, because this is purely a local developer convenience.
- A schema-drift guard or automated diff between the two compose files (flagged as an open question for the future).
- Running both containers concurrently inside the contract suite as a Docker-in-Docker test.

## 3. Context and Background
Story 1.2 (ADR-0016) built exactly one local Postgres: an ephemeral, project-scoped container (`docker-compose.test.yml`, port `5434`) that Jest's `globalSetup`/`globalTeardown` bring up, migrate, and tear down (`docker compose down -v`) automatically around every `npm test` / `npm run test:contracts` run. That's the right shape for CI and for the contract suite itself — disposable, always-fresh, never accumulating state between runs.

It's the wrong shape for anything else. Story 2.6 (ADR-0024) shipped the first real, non-`examples/`-fixture connector — the first time this project had something worth actually *running* and looking at, rather than only proving via an automated contract. Doing that (starting the real Express server, polling the real Newswire connector, querying the real REST API by hand) needs a Postgres instance that survives longer than one Jest process and doesn't get wiped by an unrelated test run. Reusing the test container for this was tried first, and failed exactly as this ADR's Decision would predict: running the full contract suite in one terminal while the demo server was up in another caused Jest's `globalTeardown` to remove the shared container (fixed name, fixed compose project) the moment the test run finished — silently killing the demo server's database connection and every row of data it had ingested, mid-session.
The `social-listening-core` backend currently relies on a single, ephemeral Postgres container that Jest brings up, migrates, and tears down around every contract-suite run. This is the right shape for automated tests, but it makes it impossible for a developer to run the real server and look at real data without risking that a concurrent or subsequent `npm test` run will wipe that data out from under them.

This BRD captures the business need for a second, deliberately independent, persistent Postgres database for local development. The solution adds a new Docker Compose dev setup on a non-conflicting port, a named volume so data survives container restarts, and a cross-platform Node wrapper that starts the dev server with the correct database connection values. This lets the developer safely run the contract suite and the live server side by side, with real persisted data, while keeping the dev and test Postgres images aligned.

The expected outcome is a faster, more reliable local development workflow that behaves the same on Windows and bash/PowerShell and never loses the data the developer is actively inspecting.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Eliminate collisions between the contract test run and a running local dev server | A full `npm test` run completes while `npm run dev` is live and the dev database/server remain unaffected, proven in practice |
| 2 | Provide durable local development data | Data in the dev database survives a normal `db:dev:down` and is available again after restart |
| 3 | Make local server startup deterministic and cross-platform | `npm run dev` and `npm run db:dev:migrate` work unmodified from bash or PowerShell with no manual shell `export` of database variables |
| 4 | Keep the local dev database technically aligned with the test database and Azure production target | Both the dev and test containers use the same custom Postgres image, the same migrations, and the same `pg_cron` extension required elsewhere |

---

**Positive consequences (from ADR):**
**Positive**
- Running the contract suite and manually exploring/demoing the running server can never collide again — proven in practice the same session this was built, not just argued: a full `npm test` run was executed while `npm run dev` was live against the dev database, and only the test container was affected.
- Real, persisted data survives restarts — closing a real gap in a project where, until Story 2.6, "proven" meant "an automated contract passed," never "a person actually looked at it running."
- Reuses the test setup's exact custom Postgres image, so the two never drift on Postgres version or the `pg_cron` extension Story 4.4 depends on.
- The `execSync`→`spawn` fix is a genuine correctness improvement to `scripts/withDevEnv.js`, not incidental busywork — without it, `npm run dev` doesn't reliably work at all on Windows.

**Negative**
- **A third local Postgres flavor to keep in sync** (test container, dev container, and Azure Database for PostgreSQL in every real environment per ADR-0016) — only `migrations/*.sql` is shared between all three; the container/extension configuration itself is duplicated between `docker-compose.test.yml` and `docker-compose.dev.yml`, a real (if currently small) drift risk if one is edited without the other.
- **Doesn't exist in any real deployed environment** — purely a local-machine convenience. Azure Database for PostgreSQL remains the only production target (ADR-0016, unchanged).
- **One more thing to explain to a future session/contributor picking this repo up cold** — mitigated by documenting the split in `README.md` and here, not left implicit in a script only.
- Port `5435` is a machine-specific choice (`5432` and `5433` were both already in use on the machine this was built on) — not itself architecturally significant, but worth naming here rather than only in a code comment, in case it collides on a different machine.

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The dev database must be isolated from the test database by Docker Compose project name, container, network, host port, and database name | Must | `docker-compose.dev.yml` and `docker-compose.test.yml` have no shared project/port/database and the contract test for isolation passes | Menno |
| BR-002 | The dev database must persist data across routine `docker compose down` operations | Must | `docker-compose.dev.yml` declares a named `dev-pgdata` volume and `db:dev:down` does not include `-v`; data is still present after restart | Menno |
| BR-003 | The developer must have an explicit, separately-named action to destroy dev data | Must | `db:dev:reset` runs `docker compose -f docker-compose.dev.yml down -v` | Menno |
| BR-004 | The project must provide npm scripts for dev database start, migrate, server, stop, and reset | Must | `package.json` defines `db:dev:up`, `db:dev:migrate`, `dev`, `dev:server`, `db:dev:down`, and `db:dev:reset` and each script does what its name describes | Menno |
| BR-005 | `npm run dev` and `npm run db:dev:migrate` must run against the dev database with no manual shell environment setup | Must | Both scripts route through `scripts/withDevEnv.js`, which sets the dev Postgres variables and loads `.env` before launching the target command | Menno |
| BR-006 | The environment wrapper must preserve multi-word command-line arguments and not block the long-running server | Should | `withDevEnv.js` uses `spawn` with an `argv` array and contract tests show multi-word arguments remain intact | Menno |
| BR-007 | The dev and test database containers must use the same custom Postgres image | Should | Both compose files reference `docker/test-postgres/Dockerfile` (Postgres 17 + `pg_cron`) | Menno |

### 5.1 Architecture Decision
Add a second, deliberately independent Postgres setup for local development, never touched by the test suite's lifecycle:

- **`docker-compose.dev.yml`** — its own compose project name (`social-listening-core-dev`), container, Docker network, port (`5435` — distinct from the test container's `5434` and the default `5432`, both already in use on the machine this was built on), database name (`social_listening_dev`), and a named volume (`dev-pgdata`) so data survives a plain `docker compose down`. Builds the exact same custom image as the test setup (`docker/test-postgres/Dockerfile`, `postgres:17` + `pg_cron`) — one image, two independent containers — so dev and test never drift on Postgres version or extensions.
- **New npm scripts:** `db:dev:up` / `db:dev:migrate` / `dev` (starts the real server against the dev database) / `db:dev:down` (stops it, data persists) / `db:dev:reset` (stops it and deletes the volume — an explicit, separate action from `down`).
- **`scripts/withDevEnv.js`** — a small Node wrapper that sets the dev database's connection env vars before running a given command, rather than shell `export`/`$env:`, so the same npm script works unmodified from bash or PowerShell. Mirrors `jest.global-setup.js`'s own existing "set env vars in JS, not the shell" pattern.

**A real bug was found and fixed while building this, not after:** the wrapper's first version used `execSync()` on a rejoined `argv.slice(2).join(' ')` string. Two distinct problems, not one: (1) rejoining already-shell-split argv into one string and handing it to `execSync` (which re-parses it through *another* shell) silently corrupts any argument containing a space or quote; (2) `execSync` blocks synchronously until its child exits — the wrong model for `npm run dev`, which starts a server that's supposed to keep running indefinitely. On Windows, going through `execSync`'s shell plus an `npx` middle-man left the actual long-running `ts-node` process unable to inherit the intended environment reliably in practice — verified by running the fixed and unfixed versions side by side against the same dev database and comparing whether `GET /v1/posts` returned real data or an `AggregateError`. Fixed by rewriting the wrapper around `spawn()` with an argv *array* (no rejoining) and explicit exit-code forwarding.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Menno — Backend Developer | Daily user of the local dev database | High | Run the real server and the contract suite at the same time without losing data |
| Menno — Product Owner / Technical Lead | Owner of the local development experience and technical correctness | High | A deterministic, reproducible local setup that matches the production target |
| Future Contributors | New developers picking up the repo | Medium | Clear documentation of the two-database split and the commands to use each one |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 1.4 | epic-1-repository-and-api-foundation.md | As developer running `social-listening-core` locally to see it actually work (not just pass its contract suite), I want a persistent dev Postgres database, f... | `docker-compose.dev.yml` defines a Postgres container with its own compose project name, container, network, port, database name, and a named volume — none s... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| Dev database connection variables (`PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `APP_PGUSER`, `APP_PGPASSWORD`) | Forced values that point a command at the local dev Postgres container | `scripts/withDevEnv.js` | Core backend | Internal |
| `dev-pgdata` named Docker volume | Persistent storage for the dev Postgres data files | `docker-compose.dev.yml` | Infrastructure (local) | Low |
| Migration SQL files (`migrations/*.sql`) | Schema shared by the dev, test, and production databases | Core backend migrations | Core backend | Internal |
| Repo `.env` file | Non-database configuration such as API keys, Entra, and Azure service settings | Developer environment | Developer | Confidential |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | The dev database connection values (`PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `APP_PGUSER`, `APP_PGPASSWORD`) must be forced by `withDevEnv.js` and must override any value already present in the parent shell or the repo's `.env`. |
| BRU-002 | Dev data must only be destroyed by the explicitly named `db:dev:reset` command; the routine `db:dev:down` and `db:dev:up` must preserve it. |
| BRU-003 | The test container lifecycle is owned by Jest and is ephemeral; the dev container lifecycle is owned by the developer and is persistent. |
| BRU-004 | `withDevEnv.js` must load the repo-root `.env` before applying the forced dev database overrides, so non-database configuration is available without manual shell setup. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0016 — Azure Database for PostgreSQL as the production target | Internal / Technical | Menno | Already Accepted |
| D-002 | Story 1.2 — Postgres engine and local test container setup | Internal | Menno | Already built |
| D-003 | Story 1.4 — Persistent local dev database user story and contract | Internal | Menno | Already built and verified |
| D-004 | `docker/test-postgres/Dockerfile` custom image (Postgres 17 + `pg_cron`) | Internal | Menno | Already built |
| D-005 | `README.md` and local setup documentation | Internal | Menno | To be revisited once `social-listening-admin` has real pages that develop against the live API |

---

- The developer has Docker and `docker compose` available locally.
- Host port `5435` is available on the developer's machine (or is the configured fallback if a conflict arises).
- The local dev database applies the same `migrations/*.sql` files used by the test database and the Azure target.

Add a second, deliberately independent Postgres setup for local development, never touched by the test suite's lifecycle:

- **`docker-compose.dev.yml`** — its own compose project name (`social-listening-core-dev`), container, Docker network, port (`5435` — distinct from the test container's `5434` and the default `5432`, both already in use on the machine this was built on), database name (`social_listening_dev`), and a named volume (`dev-pgdata`) so data survives a plain `docker compose down`. Builds the exact same custom image as the test setup (`docker/test-postgres/Dockerfile`, `postgres:17` + `pg_cron`) — one image, two independent containers — so dev and test never drift on Postgres version or extensions.
- **New npm scripts:** `db:dev:up` / `db:dev:migrate` / `dev` (starts the real server against the dev database) / `db:dev:down` (stops it, data persists) / `db:dev:reset` (stops it and deletes the volume — an explicit, separate action from `down`).
- **`scripts/withDevEnv.js`** — a small Node wrapper that sets the dev database's connection env vars before running a given command, rather than shell `export`/`$env:`, so the same npm script works unmodified from bash or PowerShell. Mirrors `jest.global-setup.js`'s own existing "set env vars in JS, not the shell" pattern.

**A real bug was found and fixed while building this, not after:** the wrapper's first version used `execSync()` on a rejoined `argv.slice(2).join(' ')` string. Two distinct problems, not one: (1) rejoining already-shell-split argv into one string and handing it to `execSync` (which re-parses it through *another* shell) silently corrupts any argument containing a space or quote; (2) `execSync` blocks synchronously until its child exits — the wrong model for `npm run dev`, which starts a server that's supposed to keep running indefinitely. On Windows, going through `execSync`'s shell plus an `npx` middle-man left the actual long-running `ts-node` process unable to inherit the intended environment reliably in practice — verified by running the fixed and unfixed versions side by side against the same dev database and comparing whether `GET /v1/posts` returned real data or an `AggregateError`. Fixed by rewriting the wrapper around `spawn()` with an argv *array* (no rejoining) and explicit exit-code forwarding.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | The dev server must start with the intended database target regardless of what is already set in the parent shell or `.env` | Reliability | Must | Contract tests confirm `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `APP_PGUSER`, and `APP_PGPASSWORD` are all forced to the dev values and override conflicting inputs |
| NFR-002 | The dev and test compose files must be kept aligned so they do not drift on Postgres version or extensions | Maintainability | Should | Both files use the same `Dockerfile` and command structure; a future lightweight diff script may be added if the repo gains another contributor |
| NFR-003 | The local dev commands must work unmodified from both bash and PowerShell | Usability | Should | A developer can run the same `npm` scripts from either shell and the server starts with the correct environment |
| NFR-004 | The dev container port should avoid common local Postgres collisions | Compatibility | Could | Port `5435` is used for the dev container; if it conflicts, the developer can adjust it locally |

---

## 11. Error Handling and Exceptions
**Positive**
- Running the contract suite and manually exploring/demoing the running server can never collide again — proven in practice the same session this was built, not just argued: a full `npm test` run was executed while `npm run dev` was live against the dev database, and only the test container was affected.
- Real, persisted data survives restarts — closing a real gap in a project where, until Story 2.6, "proven" meant "an automated contract passed," never "a person actually looked at it running."
- Reuses the test setup's exact custom Postgres image, so the two never drift on Postgres version or the `pg_cron` extension Story 4.4 depends on.
- The `execSync`→`spawn` fix is a genuine correctness improvement to `scripts/withDevEnv.js`, not incidental busywork — without it, `npm run dev` doesn't reliably work at all on Windows.

**Negative**
- **A third local Postgres flavor to keep in sync** (test container, dev container, and Azure Database for PostgreSQL in every real environment per ADR-0016) — only `migrations/*.sql` is shared between all three; the container/extension configuration itself is duplicated between `docker-compose.test.yml` and `docker-compose.dev.yml`, a real (if currently small) drift risk if one is edited without the other.
- **Doesn't exist in any real deployed environment** — purely a local-machine convenience. Azure Database for PostgreSQL remains the only production target (ADR-0016, unchanged).
- **One more thing to explain to a future session/contributor picking this repo up cold** — mitigated by documenting the split in `README.md` and here, not left implicit in a script only.
- Port `5435` is a machine-specific choice (`5432` and `5433` were both already in use on the machine this was built on) — not itself architecturally significant, but worth naming here rather than only in a code comment, in case it collides on a different machine.

## 12. Assumptions and Dependencies
- The developer has Docker and `docker compose` available locally.
- Host port `5435` is available on the developer's machine (or is the configured fallback if a conflict arises).
- The local dev database applies the same `migrations/*.sql` files used by the test database and the Azure target.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Host port `5435` is already used on another developer's machine | Medium | Low | Document that the port can be changed locally if it conflicts | Menno |
| R-002 | The two compose files drift on Postgres version, extensions, or command options over time | Medium | Low | Manual review when either file changes; a lightweight diff or schema-drift guard is an open question for a future multi-contributor world | Menno |
| R-003 | Future contributors are confused about which container to use for which task | Medium | Low | Document the split in the README, the ADR, this BRD, and the story | Menno |
| R-004 | `withDevEnv.js` regresses and fails to set the correct database or load `.env` | Low | High | Contract tests assert forced overrides, `.env` loading, and multi-word argument preservation; any failure is handled through the heal-contract-failure workflow | Menno |

---

## 14. Appendix
- ADR: `../../adr/0025-persistent-local-dev-database-separate-from-test-database.md`
- BRD: `../Business-Requirements/BRD-0025-Persistent-Local-Dev-Database-Separate-From-Test-Database.md`
- Feature design: `docs/product-research/feature-designs/*.md``
- Deep research: `docs/product-research/reports/*-deep-research.md``
- User stories: see extracted stories above