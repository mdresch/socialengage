/**
 * Intent: Story 3.12 — Post-watchlist match historical backfill and discovery-driven watchlist attribution
 *
 * Source: ADR-0063 (2026-08-20 Amendment Log entry, resolving Open Question 1 and authorizing discovery attribution)
 *
 * Scope:
 *   - src/watchlists/postWatchlistMatchStore.ts (backfillPostWatchlistMatches)
 *   - src/events/publishSocialPostIngestedEvents.ts (discoveringWatchlistId support)
 *   - src/connectors/wikipedia/pollWikipedia.ts (pass discovering watchlist ID)
 *   - migrations/0038_backfill_post_watchlist_matches.sql (SQL migration backfill)
 *   - .claude/skills/post-watchlist-match-persistence/SKILL.md
 *   - .claude/skills/wikipedia-connector/SKILL.md
 *
 * Contract to encode:
 *   - AC1: backfillPostWatchlistMatches() scans existing unlinked social_posts and links them in post_watchlist_matches via AST evaluation.
 *   - AC2: backfillPostWatchlistMatches() is idempotent — running multiple times produces no duplicates.
 *   - AC3: In pollWikipedia(), discovery-driven ingestion explicitly attributes the discovering watchlist ID in post_watchlist_matches.
 *   - AC4: In pollWikipedia(), re-poll of already-tracked articles evaluates all active watchlists via fallback AST matching.
 *
 * Explicitly out of scope:
 *   - Automatic trigger on watchlist term update (ADR-0063 Open Question 2 — accepted staleness at v1).
 *   - Any change to social-listening-admin.
 */

import { randomUUID } from 'crypto';
import { closePool } from '../../src/db/pool';
import { closeAdminPool } from '../../src/db/adminPool';
import { closePlatformAdminPool } from '../../src/db/platformAdminPool';
import { closeIdentityResolverPool } from '../../src/db/identityResolverPool';
import { createTenant } from '../../src/tenants/tenantStore';
import { createInvitedUser, resolveIdentity } from '../../src/identity/identityResolution';
import { startIngestionRun } from '../../src/ingestion/ingestionRunStore';
import { createWatchlist } from '../../src/watchlists/watchlistStore';
import { insertSocialPost } from '../../src/posts/socialPostStore';
import {
  insertPostWatchlistMatches,
  backfillPostWatchlistMatches,
} from '../../src/watchlists/postWatchlistMatchStore';
import { publishSocialPostIngestedEvents } from '../../src/events/publishSocialPostIngestedEvents';
import { ingestWikipediaRevisions, pollWikipedia } from '../../src/connectors/wikipedia/pollWikipedia';
import { withTenant } from '../../src/db/withTenant';

jest.setTimeout(30000);

afterAll(async () => {
  await closeIdentityResolverPool();
  await closePlatformAdminPool();
  await closeAdminPool();
  await closePool();
});

async function makeTenantWithUser(role: 'tenant_admin' | 'tenant_user' = 'tenant_user'): Promise<{
  tenantId: string;
  userId: string;
  runId: string;
}> {
  const tenant = await createTenant('test-actor', { name: `T-${randomUUID()}`, licenseSeatCount: 10 });
  const email = `user-${randomUUID()}@example.com`;
  const invited = await createInvitedUser(tenant.id, { email, role });
  await resolveIdentity({ sub: `sub-${invited.id}`, email });
  const run = await startIngestionRun(tenant.id, {
    platformId: 'test-poll',
    triggerType: 'poll',
    connectorVersion: '1.0.0',
  });
  return { tenantId: tenant.id, userId: invited.id, runId: run.id };
}

describe('Story 3.12 — Post-watchlist match historical backfill and discovery attribution', () => {
  it('AC1: backfillPostWatchlistMatches() populates post_watchlist_matches for unlinked historical posts', async () => {
    const { tenantId, userId, runId } = await makeTenantWithUser();

    // 1. Create a watchlist
    const watchlist = await createWatchlist(tenantId, userId, {
      name: 'AI Tech',
      matchType: 'keyword',
      terms: ['artificial intelligence', 'neural network'],
      platformIds: ['gnews', 'wikipedia'],
    });

    // 2. Insert a historical post without match records (simulating pre-Story 3.11 post)
    const post = await insertSocialPost({
      tenantId,
      authorId: null,
      acquisitionId: runId,
      rawPayload: { providerId: 'gnews', externalId: 'ext-hist-1', title: 'Advances in artificial intelligence' },
      publishedAt: new Date().toISOString(),
      bodyMarkdown: 'Researchers made a breakthrough in artificial intelligence models.',
    });

    // Confirm no match records exist yet
    await withTenant(tenantId, async (client) => {
      const res = await client.query('SELECT * FROM post_watchlist_matches WHERE post_id = $1', [post.id]);
      expect(res.rows.length).toBe(0);
    });

    // 3. Run backfill
    const matchedCount = await backfillPostWatchlistMatches(tenantId);
    expect(matchedCount).toBeGreaterThanOrEqual(1);

    // Confirm match record is now created
    await withTenant(tenantId, async (client) => {
      const res = await client.query('SELECT * FROM post_watchlist_matches WHERE post_id = $1', [post.id]);
      expect(res.rows.length).toBe(1);
      expect(res.rows[0].watchlist_id).toBe(watchlist.id);
      expect(res.rows[0].tenant_id).toBe(tenantId);
    });
  });

  it('AC2: backfillPostWatchlistMatches() is idempotent on repeat executions', async () => {
    const { tenantId, userId, runId } = await makeTenantWithUser();

    const watchlist = await createWatchlist(tenantId, userId, {
      name: 'Robotics',
      matchType: 'keyword',
      terms: ['robotics'],
      platformIds: ['gnews'],
    });

    const post = await insertSocialPost({
      tenantId,
      authorId: null,
      acquisitionId: runId,
      rawPayload: { providerId: 'gnews', externalId: 'ext-robot-1', title: 'Modern robotics' },
      publishedAt: new Date().toISOString(),
      bodyMarkdown: 'New advancements in autonomous robotics.',
    });

    await backfillPostWatchlistMatches(tenantId);
    await backfillPostWatchlistMatches(tenantId);

    await withTenant(tenantId, async (client) => {
      const res = await client.query('SELECT * FROM post_watchlist_matches WHERE post_id = $1', [post.id]);
      expect(res.rows.length).toBe(1);
    });
  });

  it('AC3: discovery-driven ingestion explicitly attributes discovering watchlist ID in post_watchlist_matches', async () => {
    const { tenantId, userId, runId } = await makeTenantWithUser();

    const targetWatchlist = await createWatchlist(tenantId, userId, {
      name: 'Anthropic Watch',
      matchType: 'keyword',
      terms: ['Anthropic PBC'],
      platformIds: ['wikipedia'],
    });

    const otherWatchlist = await createWatchlist(tenantId, userId, {
      name: 'General LLM',
      matchType: 'keyword',
      terms: ['Language Models'],
      platformIds: ['wikipedia'],
    });

    const revision = {
      pageid: 998877,
      title: 'Anthropic Overview',
      revid: 11223344,
      timestamp: new Date().toISOString(),
      html: '<p>Anthropic is an AI safety and research company.</p>',
      url: 'https://en.wikipedia.org/w/index.php?title=Anthropic_Overview&oldid=11223344',
    };

    // Ingest with explicit discoveringWatchlistId
    const res = await ingestWikipediaRevisions(
      tenantId,
      runId,
      [revision],
      [targetWatchlist, otherWatchlist],
      targetWatchlist.id
    );

    expect(res.postsIngested).toBe(1);

    // Verify that post_watchlist_matches contains targetWatchlist.id even if body lacks exact term 'Anthropic PBC'
    await withTenant(tenantId, async (client) => {
      const matchRows = await client.query(
        `SELECT pwm.watchlist_id
         FROM post_watchlist_matches pwm
         JOIN social_posts sp ON sp.id = pwm.post_id
         WHERE sp.raw_payload->>'externalId' = $1`,
        [String(revision.revid)]
      );
      expect(matchRows.rows.map((r: { watchlist_id: string }) => r.watchlist_id)).toContain(targetWatchlist.id);
    });
  });

  it('AC4: publishSocialPostIngestedEvents includes discoveringWatchlistId alongside AST matching', async () => {
    const { tenantId, userId, runId } = await makeTenantWithUser();

    const discWatchlist = await createWatchlist(tenantId, userId, {
      name: 'Topic A',
      matchType: 'keyword',
      terms: ['Alpha'],
      platformIds: ['wikipedia'],
    });

    const matchedWatchlist = await createWatchlist(tenantId, userId, {
      name: 'Topic B',
      matchType: 'keyword',
      terms: ['Beta'],
      platformIds: ['wikipedia'],
    });

    const post = await insertSocialPost({
      tenantId,
      authorId: null,
      acquisitionId: runId,
      rawPayload: { providerId: 'wikipedia', externalId: 'ext-ab-1', title: 'Beta Research' },
      publishedAt: new Date().toISOString(),
    });

    await publishSocialPostIngestedEvents(
      tenantId,
      'wikipedia',
      [discWatchlist, matchedWatchlist],
      {
        postId: post.id,
        text: 'Beta Research Article',
        discoveringWatchlistId: discWatchlist.id,
      }
    );

    await withTenant(tenantId, async (client) => {
      const rows = await client.query('SELECT watchlist_id FROM post_watchlist_matches WHERE post_id = $1', [post.id]);
      const ids = rows.rows.map((r: { watchlist_id: string }) => r.watchlist_id);
      expect(ids).toContain(discWatchlist.id);
      expect(ids).toContain(matchedWatchlist.id);
    });
  });
});
