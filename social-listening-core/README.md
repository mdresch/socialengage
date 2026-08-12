# social-listening-core

Backend for the Social Listening / Insights subsystem: connector framework, ingestion,
normalization, enrichment, storage, event publishing, and the REST API (ADR-0001).
Independently deployable from `social-listening-admin` — see its own
`.claude/skills/core-api-client/SKILL.md` for the REST-only boundary between them.

## Database

Provisioned against **Azure Database for PostgreSQL** in every real environment
(ADR-0016), using native JSONB for `SocialPost.rawPayload` and native Row-Level
Security for tenant isolation (ADR-0015). See
`.claude/skills/postgres-tenant-db/SKILL.md` for the connection-pool/migration/RLS
implementation details.

### Local development and contract tests

The contract suite needs a real Postgres instance — RLS and JSONB behavior can't be
faithfully verified against a mock. Contract test runs (`npm run test:contracts`,
`npm test`) automatically bring up an ephemeral, project-scoped Postgres container via
Jest's `globalSetup`/`globalTeardown` (`docker-compose.test.yml`, port `5434` — chosen
to avoid colliding with any other local Postgres instance on the default `5432`), apply
pending `migrations/*.sql`, and tear the container down afterward.

**Prerequisite: Docker must be running locally** before `npm test` /
`npm run test:contracts` will succeed. The relevant scripts, if you want to drive them
by hand:

```sh
npm run db:test:up     # start the ephemeral test Postgres container
npm run db:migrate     # apply pending migrations against it
npm run db:test:down   # stop and remove it
```

### Local development against a persistent dev database

For actually running the server (`npm run dev`) or poking at real data by hand, use
`docker-compose.dev.yml` instead — a separate Postgres container, network, port
(`5435`), database name, and Docker-managed named volume from the test one above.
It's deliberately isolated from `docker-compose.test.yml`: `npm test`'s
`globalSetup`/`globalTeardown` only ever touch the test container, so running the
contract suite can never wipe dev data out from under a running `npm run dev`, and
vice versa.

```sh
npm run db:dev:up       # start the persistent dev Postgres container (first run builds it)
npm run dev             # applies any pending migrations, then starts the real server against the dev database (:3001)
npm run db:dev:down     # stop it — data survives in the named volume
npm run db:dev:reset    # stop it AND delete the volume — genuinely start over
```

**`npm run dev` runs `db:dev:migrate` automatically before starting the server (healed 2026-08-12)** — found live: a dev database left behind on an older schema (Story 1.11's `connector_activations` table hadn't been applied) let the server start and accept requests fine, then 500 on every request touching that table, with no obvious signal at startup that the schema was stale. `db:dev:migrate` is idempotent (prints `No pending migrations.` when there's nothing to do), so this adds no real cost on an already-current database — `dev:server` still exists standalone if you ever need the server without the migration check (e.g. a contract's own spawn wanting fine-grained control).

`scripts/withDevEnv.js` sets the dev database's connection env vars (`PGPORT=5435`,
`PGDATABASE=social_listening_dev`, ...) before running the given command — a plain
Node script rather than shell `export`/`$env:`, so `db:dev:migrate`/`dev` work
unmodified from both bash and PowerShell.
