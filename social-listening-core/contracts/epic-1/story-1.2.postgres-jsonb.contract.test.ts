// Contract: Story 1.2 (ADR-0016) — Postgres as the database engine; SocialPost.rawPayload
// is a genuine JSONB column, queryable via JSONB path operators against real Postgres.
// See docs/user-stories/epic-1-repository-and-api-foundation.md#story-12--postgres-as-the-database-engine
//
// Intent: Story 1.2 — Postgres as the database engine (ADR-0016)
// Scope: migrations/0001_create_social_posts.sql, src/db/pool.ts, src/db/migrate.ts,
// docker-compose.test.yml, jest.global-setup.js, jest.global-teardown.js, README.md
// Contract to encode: (1) social_posts.raw_payload is a genuine jsonb column, not an
// opaque text blob; (2) it's queryable via a JSONB path operator against a real
// Postgres instance (a mock cannot demonstrate this); (3) provisioning documentation
// names Azure Database for PostgreSQL specifically.
// Explicitly out of scope: RLS itself (Story 5.4 — separate contract, same migration
// set), the full SocialPost entity's other columns/relations (authorId, acquisitionId,
// platformId, publishedAt, ... — owned by Stories 3.1/3.2/3.4), any ORM/query-builder
// choice beyond the raw `pg` client.

import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { getPool, closePool } from '../../src/db/pool';
import { withTenant } from '../../src/db/withTenant';

afterAll(async () => {
  await closePool();
});

describe('Story 1.2 — Postgres JSONB contract', () => {
  it('AC1: social_posts.raw_payload is reported as a genuine jsonb column', async () => {
    const { rows } = await getPool().query(
      `SELECT data_type FROM information_schema.columns
       WHERE table_name = 'social_posts' AND column_name = 'raw_payload'`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].data_type).toBe('jsonb');
  });

  it('AC1: rawPayload is queryable via a JSONB path operator against real Postgres', async () => {
    const tenantId = randomUUID();
    const payload = { platform: 'rss', meta: { language: 'en' } };

    await withTenant(tenantId, async (client) => {
      await client.query(
        'INSERT INTO social_posts (tenant_id, raw_payload) VALUES ($1, $2::jsonb)',
        [tenantId, JSON.stringify(payload)]
      );

      const { rows } = await client.query(
        `SELECT id FROM social_posts WHERE raw_payload -> 'meta' ->> 'language' = $1`,
        ['en']
      );
      expect(rows).toHaveLength(1);
    });
  });

  it('AC3: provisioning documentation names Azure Database for PostgreSQL specifically', () => {
    const readme = fs.readFileSync(path.resolve(__dirname, '..', '..', 'README.md'), 'utf8');
    expect(readme).toMatch(/Azure Database for PostgreSQL/);
  });
});
