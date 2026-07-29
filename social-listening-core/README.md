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
