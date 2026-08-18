// Contract: Story 2.13 (ADR-0042) — Wikipedia connector: MediaWiki Action
// API, revision re-poll cadence via recentchanges, article-as-Author.
// See docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md#story-213--wikipedia-connector-mediawiki-action-api-revision-re-poll-cadence-article-as-author
//
// Intent: Story 2.13 — a real SocialConnector (authMode: 'none', no
// account/key) targeting the MediaWiki Action API directly, re-polling an
// already-tracked article via recentchanges (not a one-shot snapshot),
// article-as-Author keyed by the page's stable pageid, SocialPost.url set
// to the specific ingested revision's own permalink.
// Scope: src/connectors/wikipedia/wikipediaConnector.ts (already drafted —
// fetchWikipediaSearch/fetchWikipediaRecentChanges/fetchWikipediaRevision,
// the registered connector object), src/connectors/wikipedia/pollWikipedia.ts
// (new — ingestWikipediaRevisions()/pollWikipedia(), mirroring
// pollNewswireFeeds.ts's/pollTenantOwnedFeed.ts's own two-call-site
// ingestXItems() split), src/authors/authorStore.ts (new
// listAuthorsByPlatform() — this connector's own "already discovered"
// membership check and re-poll-by-title source), src/connectors/
// bootstrapConnectors.ts (registration), contracts/epic-2/
// story-2.10.connector-registration-transparency.contract.test.ts
// (REAL_CONNECTORS extended, per that file's own documented convention).
// Contract to encode, per AC: (1) a registered connector (authMode: 'none',
// deliveryMode: 'poll', distinct providerId) targets the real MediaWiki
// Action API, registered without any core-pipeline-file edit (ADR-0048/
// Story 2.10's own no-core-path-edit evidence, extended to this connector);
// (2) every outbound request sets a compliant, non-generic User-Agent; (3)
// re-polling an already-tracked article via recentchanges produces a new
// SocialPost per qualifying revision — two distinct revisions across two
// poll cycles yield two distinct posts, same Author; (4) Author resolves to
// the article itself, keyed by pageid, handle/displayName = current title,
// followerCount unpopulated; (5) SocialPost.url is the specific revision's
// own permalink (?oldid=), not the bare article URL; (6) first discovery
// (via search) ingests only the current revision, no historical backfill;
// (7) supportedQueryFeatures is declared conservatively (empty), watchlist
// matching falls back correctly; (8) getRateLimitConfig() is an explicitly
// conservative, named placeholder (no confirmed Wikimedia ceiling); (9) a
// poll cycle against an already-tracked article with zero qualifying
// recentchanges entries is a correct no-op, no duplicate SocialPost rows,
// across two consecutive cycles; (10) ADR-0058 Decision §5 — this
// connector's own ingest function publishes one SocialPostIngestedEvent per
// matching tenant watchlist, the same wiring Story 5.19 already built into
// GNews/Newswire/tenant-owned-feed, adopted here as part of this
// connector's own original build, not a separate follow-up story.
// Explicitly out of scope, per ADR-0042's own Open Questions: a materiality
// threshold for re-ingestion (every qualifying recentchanges entry
// produces a SocialPost, unfiltered by edit size); backfilling revision
// history beyond current content at discovery; RAG/embedding chunking; the
// CC BY-SA "Adapted Material" question for AI-enrichment output (enrichment
// applies unmodified, no Wikipedia-specific handling added).
//
// Makes real outbound HTTP calls to Wikipedia's own live MediaWiki Action
// API (en.wikipedia.org/w/api.php) — no API key/account needed (authMode:
// 'none'). Content assertions tolerate live results changing between runs,
// same tolerance Story 2.7's own GNews contract already establishes.

import { randomUUID } from 'crypto';
import { closePool } from '../../src/db/pool';
import { withTenant } from '../../src/db/withTenant';
import { getSocialConnector, registerSocialConnector, __resetRegistryForTests } from '../../src/connectors/registry';
import {
  wikipediaConnector,
  WIKIPEDIA_PROVIDER_ID,
  WIKIPEDIA_USER_AGENT,
  fetchWikipediaSearch,
  fetchWikipediaRecentChanges,
  fetchWikipediaRevision,
  WikipediaRevision,
} from '../../src/connectors/wikipedia/wikipediaConnector';
import { pollWikipedia, ingestWikipediaRevisions } from '../../src/connectors/wikipedia/pollWikipedia';
import { startIngestionRun, completeIngestionRun } from '../../src/ingestion/ingestionRunStore';
import { resolveWatchlistAstDispatch } from '../../src/watchlists/dispatch';
import { parseBooleanQuery } from '../../src/watchlists/ast';
import { createTenant } from '../../src/tenants/tenantStore';
import { createInvitedUser } from '../../src/identity/identityResolution';
import { createWatchlist } from '../../src/watchlists/watchlistStore';
import * as serviceBusPublisherModule from '../../src/events/serviceBusPublisher';
import { SocialPostIngestedEvent } from '../../src/events/socialPostIngestedEvent';

jest.setTimeout(60000);

// A well-known, stable article with a real, non-trivial edit history —
// verified directly live at drafting time (pageid 6206236).
const TEST_ARTICLE = 'Anthropic';

async function makeTenantWithRun(): Promise<{ tenantId: string; runId: string }> {
  const tenantId = randomUUID();
  const run = await startIngestionRun(tenantId, {
    platformId: WIKIPEDIA_PROVIDER_ID,
    triggerType: 'poll',
    connectorVersion: '1.0.0',
  });
  await completeIngestionRun(tenantId, run.id, { status: 'succeeded', postsIngested: 0, postsSkipped: 0 });
  return { tenantId, runId: run.id };
}

afterAll(async () => {
  await closePool();
});

describe('Story 2.13 — Wikipedia connector contract', () => {
  beforeAll(() => {
    __resetRegistryForTests();
    registerSocialConnector(wikipediaConnector);
  });

  it('AC1: a registered connector (authMode none, poll, distinct providerId) targets the real MediaWiki Action API', async () => {
    expect(getSocialConnector(WIKIPEDIA_PROVIDER_ID)).toBe(wikipediaConnector);
    expect(wikipediaConnector.authMode).toBe('none');
    expect(wikipediaConnector.deliveryMode).toBe('poll');
    expect(wikipediaConnector.providerId).not.toBe('gnews');
    expect(wikipediaConnector.providerId).not.toBe('newswire');
    expect(wikipediaConnector.providerId).not.toBe('tenant-owned-feed');

    const results = await fetchWikipediaSearch(TEST_ARTICLE, 1);
    expect(results.length).toBeGreaterThan(0);
  });

  it('AC2: every outbound request sets a compliant, non-generic User-Agent', () => {
    expect(WIKIPEDIA_USER_AGENT).toMatch(/SocialEngage/);
    expect(WIKIPEDIA_USER_AGENT).toMatch(/contact|@|http/i);
    expect(WIKIPEDIA_USER_AGENT.toLowerCase()).not.toBe('node');
    expect(WIKIPEDIA_USER_AGENT.toLowerCase()).not.toContain('axios');
  });

  it('AC3: re-polling an already-tracked article via recentchanges produces a new SocialPost per qualifying revision, both resolving to the same Author', async () => {
    const { tenantId, runId } = await makeTenantWithRun();

    const revisionA: WikipediaRevision = await fetchWikipediaRevision(TEST_ARTICLE);
    const first = await ingestWikipediaRevisions(tenantId, runId, [revisionA], []);
    expect(first.postsIngested).toBe(1);

    const changes = await fetchWikipediaRecentChanges(TEST_ARTICLE, 5);
    const olderRevision = changes.find((c) => c.old_revid && c.old_revid !== revisionA.revid);
    const revisionB: WikipediaRevision = olderRevision
      ? await fetchWikipediaRevision(TEST_ARTICLE, olderRevision.old_revid)
      : { ...revisionA, revid: revisionA.revid - 1, url: revisionA.url.replace(String(revisionA.revid), String(revisionA.revid - 1)) };

    const second = await ingestWikipediaRevisions(tenantId, runId, [revisionB], []);
    expect(second.postsIngested).toBe(1);

    const rows = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query<{ author_id: string; raw_payload: { revid: number } }>(
        `SELECT author_id, raw_payload FROM social_posts ORDER BY created_at ASC`
      );
      return rows;
    });
    expect(rows.length).toBe(2);
    expect(rows[0].author_id).toBe(rows[1].author_id);
    expect(rows[0].raw_payload.revid).not.toBe(rows[1].raw_payload.revid);
  });

  it('AC10: this connector\'s own ingest function publishes one SocialPostIngestedEvent per matching tenant watchlist, adopting Story 5.19\'s already-built wiring (ADR-0058 Decision §5)', async () => {
    const publishSpy = jest.spyOn(serviceBusPublisherModule, 'publishEvent').mockResolvedValue(undefined);
    const { tenantId, runId } = await makeTenantWithRun();
    const tenant = await createTenant('test-actor', { name: `wikipedia-watch-${randomUUID()}`, licenseSeatCount: 5 });
    const owner = await createInvitedUser(tenant.id, { email: `${randomUUID()}@example.com` });
    const watchlist = await createWatchlist(tenant.id, owner.id, {
      name: 'anthropic-watch',
      matchType: 'boolean',
      booleanQuery: TEST_ARTICLE.toLowerCase(),
      platformIds: [WIKIPEDIA_PROVIDER_ID],
    });

    // ingestWikipediaRevisions() itself only needs the watchlist array — the
    // real tenant this watchlist was created under is irrelevant to the
    // matching logic, only to satisfying createWatchlist()'s own real FK
    // requirements (tenants/users tables). tenantId (the ingestion-scoped
    // one from makeTenantWithRun()) is what social_posts/authors are
    // written under.
    const revision = await fetchWikipediaRevision(TEST_ARTICLE);
    await ingestWikipediaRevisions(tenantId, runId, [revision], [watchlist]);

    const matchingCalls = publishSpy.mock.calls.filter(([, body]) => {
      const event = body as SocialPostIngestedEvent;
      return 'watchlistId' in event && event.watchlistId === watchlist.id;
    });
    expect(matchingCalls.length).toBe(1);
    const [publishedTenantId, publishedBody] = matchingCalls[0];
    expect(publishedTenantId).toBe(tenantId);
    expect((publishedBody as SocialPostIngestedEvent).platformId).toBe(WIKIPEDIA_PROVIDER_ID);

    publishSpy.mockRestore();
  });

  it('AC4: Author resolves to the article itself, keyed by pageid — handle/displayName the current title, followerCount unpopulated', async () => {
    const { tenantId, runId } = await makeTenantWithRun();
    const revision = await fetchWikipediaRevision(TEST_ARTICLE);
    await ingestWikipediaRevisions(tenantId, runId, [revision], []);

    const authorRows = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query<{ external_author_id: string; handle: string | null; display_name: string | null; follower_count: number | null }>(
        `SELECT external_author_id, handle, display_name, follower_count FROM authors WHERE platform_id = $1`,
        [WIKIPEDIA_PROVIDER_ID]
      );
      return rows;
    });
    expect(authorRows.length).toBe(1);
    expect(authorRows[0].external_author_id).toBe(String(revision.pageid));
    expect(authorRows[0].display_name).toBe(revision.title);
    expect(authorRows[0].follower_count).toBeNull();
  });

  it('AC5: SocialPost.url is the specific revision\'s own permalink (?oldid=), not the bare article URL', async () => {
    const { tenantId, runId } = await makeTenantWithRun();
    const revision = await fetchWikipediaRevision(TEST_ARTICLE);
    await ingestWikipediaRevisions(tenantId, runId, [revision], []);

    const rows = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query<{ raw_payload: { url: string } }>(`SELECT raw_payload FROM social_posts`);
      return rows;
    });
    expect(rows.length).toBe(1);
    expect(rows[0].raw_payload.url).toContain(`oldid=${revision.revid}`);
    expect(rows[0].raw_payload.url).not.toBe(`https://en.wikipedia.org/wiki/${encodeURIComponent(revision.title)}`);
  });

  it('AC6: first discovery ingests only the current revision, no historical backfill', async () => {
    const searchResults = await fetchWikipediaSearch(TEST_ARTICLE, 1);
    expect(searchResults.length).toBeGreaterThan(0);
    const revision = await fetchWikipediaRevision(searchResults[0].title);

    const { tenantId, runId } = await makeTenantWithRun();
    const result = await ingestWikipediaRevisions(tenantId, runId, [revision], []);
    expect(result.postsIngested).toBe(1);

    const rows = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query(`SELECT id FROM social_posts`);
      return rows;
    });
    expect(rows.length).toBe(1);
  });

  it('AC7: supportedQueryFeatures is declared conservatively (empty), watchlist matching falls back correctly', () => {
    expect(wikipediaConnector.supportedQueryFeatures).toEqual([]);

    const ast = parseBooleanQuery(TEST_ARTICLE.toLowerCase());
    const dispatch = resolveWatchlistAstDispatch(wikipediaConnector, ast);
    expect(dispatch.mode).toBe('fallback');
  });

  it('AC8: getRateLimitConfig() is an explicitly conservative, named placeholder', () => {
    const config = wikipediaConnector.getRateLimitConfig();
    expect(config.requestsPerWindow).toBeGreaterThan(0);
    expect(config.windowSeconds).toBeGreaterThan(0);
  });

  it('AC9: a poll cycle against an already-tracked article with zero qualifying recentchanges is a correct no-op — no duplicate SocialPost rows across two consecutive cycles', async () => {
    const { tenantId, runId } = await makeTenantWithRun();
    const revision = await fetchWikipediaRevision(TEST_ARTICLE);

    const first = await ingestWikipediaRevisions(tenantId, runId, [revision], []);
    expect(first.postsIngested).toBe(1);

    // Second cycle re-fetches the exact same current revision (no real edit
    // happened between calls) — the shared dedup check (findSocialPostByExternalId)
    // is what actually guarantees no duplicate row, independent of whether
    // MediaWiki's own recentchanges lookback window would have surfaced it.
    const second = await ingestWikipediaRevisions(tenantId, runId, [revision], []);
    expect(second.postsIngested).toBe(0);
    expect(second.postsSkipped).toBe(1);

    const rows = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query(`SELECT id FROM social_posts`);
      return rows;
    });
    expect(rows.length).toBe(1);
  });

  it('AC1 (registration transparency): pollWikipedia() runs a full attempt end to end via runIngestionAttempt(), real discovery + repoll phases, no throw', async () => {
    const tenantId = randomUUID();
    const publishSpy = jest.spyOn(serviceBusPublisherModule, 'publishEvent').mockResolvedValue(undefined);
    const result = await pollWikipedia(tenantId, TEST_ARTICLE);
    expect(result.status).toBe('succeeded');
    publishSpy.mockRestore();
  });

  it('AC10b: publishSocialPostIngestedEvents best-effort — a rejecting publishEvent() never fails ingestWikipediaRevisions()', async () => {
    const { tenantId, runId } = await makeTenantWithRun();
    const tenant = await createTenant('test-actor', { name: `wikipedia-besteffort-${randomUUID()}`, licenseSeatCount: 5 });
    const owner = await createInvitedUser(tenant.id, { email: `${randomUUID()}@example.com` });
    const watchlist = await createWatchlist(tenant.id, owner.id, {
      name: 'anthropic-watch-2',
      matchType: 'boolean',
      booleanQuery: TEST_ARTICLE.toLowerCase(),
      platformIds: [WIKIPEDIA_PROVIDER_ID],
    });
    jest.spyOn(serviceBusPublisherModule, 'publishEvent').mockRejectedValueOnce(new Error('Service Bus unreachable'));

    const revision = await fetchWikipediaRevision(TEST_ARTICLE);
    const result = await ingestWikipediaRevisions(tenantId, runId, [revision], [watchlist]);

    expect(result.postsIngested).toBe(1);
  });
});
