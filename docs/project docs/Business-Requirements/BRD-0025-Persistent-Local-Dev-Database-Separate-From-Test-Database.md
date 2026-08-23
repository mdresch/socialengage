# Business Requirements Document — Persistent Local Dev Database, Separate from the Test Database

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage — Persistent Local Dev Database Separate from the Test Database |
| Version | 1.0 |
| Date | 2026-08-19 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno — Business Sponsor, Product Owner, Technical Lead |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 1.0 | 2026-08-19 | BRD Writer Agent | Initial draft derived from ADR-0025, Story 1.4, and the associated contract test |

---

## 2. Executive Summary

The `social-listening-core` backend currently relies on a single, ephemeral Postgres container that Jest brings up, migrates, and tears down around every contract-suite run. This is the right shape for automated tests, but it makes it impossible for a developer to run the real server and look at real data without risking that a concurrent or subsequent `npm test` run will wipe that data out from under them.

This BRD captures the business need for a second, deliberately independent, persistent Postgres database for local development. The solution adds a new Docker Compose dev setup on a non-conflicting port, a named volume so data survives container restarts, and a cross-platform Node wrapper that starts the dev server with the correct database connection values. This lets the developer safely run the contract suite and the live server side by side, with real persisted data, while keeping the dev and test Postgres images aligned.

The expected outcome is a faster, more reliable local development workflow that behaves the same on Windows and bash/PowerShell and never loses the data the developer is actively inspecting.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Eliminate collisions between the contract test run and a running local dev server | A full `npm test` run completes while `npm run dev` is live and the dev database/server remain unaffected, proven in practice |
| 2 | Provide durable local development data | Data in the dev database survives a normal `db:dev:down` and is available again after restart |
| 3 | Make local server startup deterministic and cross-platform | `npm run dev` and `npm run db:dev:migrate` work unmodified from bash or PowerShell with no manual shell `export` of database variables |
| 4 | Keep the local dev database technically aligned with the test database and Azure production target | Both the dev and test containers use the same custom Postgres image, the same migrations, and the same `pg_cron` extension required elsewhere |

---

## 4. Scope

### 4.1 In Scope

- A new `docker-compose.dev.yml` defining a Postgres container that is fully isolated from the test compose project.
- A named Docker volume for the dev database that survives a plain `docker compose down`.
- New npm scripts to start, migrate, stop, and explicitly reset the dev database.
- A `scripts/withDevEnv.js` wrapper that forces the dev database connection environment and loads the repo's `.env` before launching the target command.
- Verification that the dev container and the test container can coexist without collision.
- Reuse of the existing custom Postgres image and migration pipeline so dev, test, and production do not drift.

### 4.2 Out of Scope

- Any change to the production database target (Azure Database for PostgreSQL) or to the test container's ephemeral lifecycle.
- Automated CI deployment of the dev database, because this is purely a local developer convenience.
- A schema-drift guard or automated diff between the two compose files (flagged as an open question for the future).
- Running both containers concurrently inside the contract suite as a Docker-in-Docker test.

### 4.3 Assumptions

- The developer has Docker and `docker compose` available locally.
- Host port `5435` is available on the developer's machine (or is the configured fallback if a conflict arises).
- The local dev database applies the same `migrations/*.sql` files used by the test database and the Azure target.

### 4.4 Constraints

- No new cloud resources may be introduced; this is local tooling only.
- The solution must work from both bash and PowerShell without per-shell environment setup.
- The project is a solo-developer effort, so the long-term drift risk between the two compose files is accepted as a manual responsibility for now.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Menno — Backend Developer | Daily user of the local dev database | High | Run the real server and the contract suite at the same time without losing data |
| Menno — Product Owner / Technical Lead | Owner of the local development experience and technical correctness | High | A deterministic, reproducible local setup that matches the production target |
| Future Contributors | New developers picking up the repo | Medium | Clear documentation of the two-database split and the commands to use each one |

---

## 6. Current State (As-Is)

**Current process:**

1. The only local Postgres is defined in `docker-compose.test.yml` on port `5434`.
2. Jest `globalSetup` / `globalTeardown` bring this container up, run migrations, and tear it down with `docker compose down -v` around every `npm test` run.
3. When a developer wants to run the real server and look at actual connector data, they must point it at the same test container.
4. A concurrent or later contract run destroys the test container and all its data, silently killing the dev server's connection and erasing everything it had ingested.

**Pain points:**

- Running `npm test` and `npm run dev` at the same time collides on the same database.
- Any data manually loaded or observed is ephemeral by design, which makes it hard to verify real connector behavior.
- The original wrapper for setting dev environment variables used `execSync` with rejoined `argv`, which corrupted multi-word arguments and blocked on Windows.

---

## 7. Future State (To-Be)

**New or improved process:**

1. The developer runs `npm run db:dev:up` to start a second, independent Postgres container (`social-listening-core-dev`) on port `5435`.
2. Migrations are applied with `npm run db:dev:migrate`, which runs through `scripts/withDevEnv.js` so the correct dev connection values are set automatically.
3. The real Express server is started with `npm run dev`, also through `withDevEnv.js`, which loads the repo's `.env` and forces the dev database target.
4. The developer can now run `npm test` in another terminal; Jest's teardown only affects the test container on port `5434`.
5. When finished, `npm run db:dev:down` stops the dev container but leaves its data in the named `dev-pgdata` volume.
6. If the developer wants a fresh start, `npm run db:dev:reset` explicitly destroys the volume.

**Expected capabilities:**

- Two fully independent Postgres lifecycles, one owned by Jest and one owned by the developer.
- Persistent dev data that survives routine container stops.
- Cross-platform startup with no manual per-shell environment export.
- The same Postgres version and `pg_cron` extension in dev as in test.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The dev database must be isolated from the test database by Docker Compose project name, container, network, host port, and database name | Must | `docker-compose.dev.yml` and `docker-compose.test.yml` have no shared project/port/database and the contract test for isolation passes | Menno |
| BR-002 | The dev database must persist data across routine `docker compose down` operations | Must | `docker-compose.dev.yml` declares a named `dev-pgdata` volume and `db:dev:down` does not include `-v`; data is still present after restart | Menno |
| BR-003 | The developer must have an explicit, separately-named action to destroy dev data | Must | `db:dev:reset` runs `docker compose -f docker-compose.dev.yml down -v` | Menno |
| BR-004 | The project must provide npm scripts for dev database start, migrate, server, stop, and reset | Must | `package.json` defines `db:dev:up`, `db:dev:migrate`, `dev`, `dev:server`, `db:dev:down`, and `db:dev:reset` and each script does what its name describes | Menno |
| BR-005 | `npm run dev` and `npm run db:dev:migrate` must run against the dev database with no manual shell environment setup | Must | Both scripts route through `scripts/withDevEnv.js`, which sets the dev Postgres variables and loads `.env` before launching the target command | Menno |
| BR-006 | The environment wrapper must preserve multi-word command-line arguments and not block the long-running server | Should | `withDevEnv.js` uses `spawn` with an `argv` array and contract tests show multi-word arguments remain intact | Menno |
| BR-007 | The dev and test database containers must use the same custom Postgres image | Should | Both compose files reference `docker/test-postgres/Dockerfile` (Postgres 17 + `pg_cron`) | Menno |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | The dev server must start with the intended database target regardless of what is already set in the parent shell or `.env` | Reliability | Must | Contract tests confirm `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `APP_PGUSER`, and `APP_PGPASSWORD` are all forced to the dev values and override conflicting inputs |
| NFR-002 | The dev and test compose files must be kept aligned so they do not drift on Postgres version or extensions | Maintainability | Should | Both files use the same `Dockerfile` and command structure; a future lightweight diff script may be added if the repo gains another contributor |
| NFR-003 | The local dev commands must work unmodified from both bash and PowerShell | Usability | Should | A developer can run the same `npm` scripts from either shell and the server starts with the correct environment |
| NFR-004 | The dev container port should avoid common local Postgres collisions | Compatibility | Could | Port `5435` is used for the dev container; if it conflicts, the developer can adjust it locally |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | The dev database connection values (`PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `APP_PGUSER`, `APP_PGPASSWORD`) must be forced by `withDevEnv.js` and must override any value already present in the parent shell or the repo's `.env`. |
| BRU-002 | Dev data must only be destroyed by the explicitly named `db:dev:reset` command; the routine `db:dev:down` and `db:dev:up` must preserve it. |
| BRU-003 | The test container lifecycle is owned by Jest and is ephemeral; the dev container lifecycle is owned by the developer and is persistent. |
| BRU-004 | `withDevEnv.js` must load the repo-root `.env` before applying the forced dev database overrides, so non-database configuration is available without manual shell setup. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| Dev database connection variables (`PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `APP_PGUSER`, `APP_PGPASSWORD`) | Forced values that point a command at the local dev Postgres container | `scripts/withDevEnv.js` | Core backend | Internal |
| `dev-pgdata` named Docker volume | Persistent storage for the dev Postgres data files | `docker-compose.dev.yml` | Infrastructure (local) | Low |
| Migration SQL files (`migrations/*.sql`) | Schema shared by the dev, test, and production databases | Core backend migrations | Core backend | Internal |
| Repo `.env` file | Non-database configuration such as API keys, Entra, and Azure service settings | Developer environment | Developer | Confidential |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Dev / test container collision incidents | Confirm the two databases no longer interfere with each other | Developer | Ad-hoc and whenever a new connector is exercised locally |
| Successful dev database migration on `npm run dev` | Ensure the dev server starts against the current schema | Developer | Every dev server start |
| Time to get a local dev server running | Track improvement in local developer setup time | Product Owner / Technical Lead | Per session initially, then monthly |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Host port `5435` is already used on another developer's machine | Medium | Low | Document that the port can be changed locally if it conflicts | Menno |
| R-002 | The two compose files drift on Postgres version, extensions, or command options over time | Medium | Low | Manual review when either file changes; a lightweight diff or schema-drift guard is an open question for a future multi-contributor world | Menno |
| R-003 | Future contributors are confused about which container to use for which task | Medium | Low | Document the split in the README, the ADR, this BRD, and the story | Menno |
| R-004 | `withDevEnv.js` regresses and fails to set the correct database or load `.env` | Low | High | Contract tests assert forced overrides, `.env` loading, and multi-word argument preservation; any failure is handled through the heal-contract-failure workflow | Menno |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0016 — Azure Database for PostgreSQL as the production target | Internal / Technical | Menno | Already Accepted |
| D-002 | Story 1.2 — Postgres engine and local test container setup | Internal | Menno | Already built |
| D-003 | Story 1.4 — Persistent local dev database user story and contract | Internal | Menno | Already built and verified |
| D-004 | `docker/test-postgres/Dockerfile` custom image (Postgres 17 + `pg_cron`) | Internal | Menno | Already built |
| D-005 | `README.md` and local setup documentation | Internal | Menno | To be revisited once `social-listening-admin` has real pages that develop against the live API |

---

## 14. Acceptance Criteria

- `docker-compose.dev.yml` declares its own Docker Compose project name, container, network, host port, and database name, all distinct from `docker-compose.test.yml`.
- The dev database has a named `dev-pgdata` volume; the test database has no named volume and remains ephemeral.
- `npm run db:dev:down` stops the dev container without deleting data; `npm run db:dev:reset` explicitly destroys the volume.
- Running the full contract suite (`npm test`) while `npm run dev` is active against the dev database leaves the dev database and server unaffected, proven in practice.
- `npm run dev` and `npm run db:dev:migrate` both route through `scripts/withDevEnv.js` and require no manual shell export of database variables.
- `withDevEnv.js` loads the repo-root `.env`, forces the dev database connection values over any conflicting shell or `.env` value, and preserves multi-word command-line arguments.
- Both the dev and test containers build from the same custom `docker/test-postgres/Dockerfile` and apply the same migrations.

---

## 15. Glossary

| Term | Definition |
|---|---|
| Docker Compose project name | A namespace that isolates containers, networks, and volumes managed by one compose file from another. |
| Ephemeral test database | The Postgres container managed by Jest that is created, migrated, and destroyed around every contract-suite run, leaving no persistent data. |
| Named volume | A Docker-managed persistent storage object that survives a plain `docker compose down` unless explicitly removed with `-v`. |
| `pg_cron` | A Postgres extension for cron-like scheduling, required by `social-listening-core` and included in the shared custom image. |
| `withDevEnv.js` | A cross-platform Node wrapper that sets the dev database environment, loads `.env`, and spawns the target command with the correct arguments. |

---

## 16. Appendices

### Reference Documents

- [ADR-0025: Persistent local dev database, kept separate from the ephemeral test database](../../../adr/0025-persistent-local-dev-database-separate-from-test-database.md)
- [Story 1.4 — Persistent local dev database, separate from the ephemeral test database](../../../user-stories/epic-1-repository-and-api-foundation.md)
- [Contract test: `story-1.4.persistent-local-dev-database.contract.test.ts`](../../../../social-listening-core/contracts/epic-1/story-1.4.persistent-local-dev-database.contract.test.ts)

### Supporting Artifacts

- `social-listening-core/docker-compose.dev.yml`
- `social-listening-core/docker-compose.test.yml`
- `social-listening-core/docker/test-postgres/Dockerfile`
- `social-listening-core/scripts/withDevEnv.js`
- `social-listening-core/package.json` (dev and `db:dev:*` scripts)

### Missing Source Note

No related `docs/product-research/feature-designs/*.md` feature design or `docs/product-research/reports/*-deep-research.md` research brief exists for ADR-0025. This is consistent with the ADR's own framing as a developer-tooling exception, not a product-facing feature. This BRD therefore synthesizes the requirements directly from the ADR, the user story, and the contract test.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | — | | |
