// Contract: Story 2.6 (ADR-0024) — Newswire connector: direct wire-service RSS
// (GlobeNewswire + PR Newswire), issuer-as-Author modeling.
// See docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md#story-26--newswire-connector-direct-wire-service-rss-issuer-as-author
//
// Intent: Story 2.6 — Newswire connector: direct wire-service RSS, issuer-as-Author (ADR-0024)
// Scope: src/connectors/newswire/rssFeedParser.ts (new), src/connectors/newswire/newswireConnector.ts
// (new), src/connectors/newswire/pollNewswireFeeds.ts (new), src/posts/socialPostStore.ts
// (findSocialPostByExternalId, a new dedup-lookup reader alongside its existing readers),
// src/ingestion/runIngestionAttempt.ts (attempt() gains a runId parameter — the minimal,
// additive wiring every real connector needs to satisfy insertSocialPost()'s required
// acquisitionId from inside its own attempt() closure; no existing caller breaks, since a
// zero-arg attempt callback still satisfies a one-arg function type).
// Contract to encode: (1) a registered SocialConnector (authMode: 'none', deliveryMode:
// 'poll', a distinct providerId) polls at least one real GlobeNewswire feed and at least
// one real PR Newswire feed and normalizes new items into SocialPost rows via
// runIngestionAttempt() — proven against genuinely live feeds, not a synthetic fixture;
// (2) each normalized post's Author resolves to the issuing organization (externalAuthorId
// = feed's issuer identifier, followerCount unpopulated); (3) supportedQueryFeatures is
// declared accurately (empty at v1) and watchlist matching genuinely falls back rather than
// silently no-op'ing, proven against real fetched titles; (4) no API key/account is ever
// required, and re-polling a feed with no new items since the last check is a correct
// no-op (no duplicate SocialPost rows) across two consecutive poll cycles; (5) cross-wire
// duplicate handling is a deliberate v1 choice (accept duplicates, not resolved by ADR-0024
// itself), proven via a controlled fixture rather than waiting for a live coincidental
// cross-wire republish.
// Explicitly out of scope: AccessWire/Business Wire (deferred per ADR-0024, not confirmed
// open/free); a real feed-subset-selection or watchlist-driven feed list (implementation-time
// choice per the ADR, not fixed here — this story hardcodes one representative feed per
// wire); a connector/watchlist status view surfacing unsupportedNodeTypes (no such view
// exists anywhere yet, Phase 1's "also build, not storied" scope); real historical backfill
// (ADR-0024 explicitly has none); distributed RequestGate state (ADR-0020, unrelated).
//
// Note: unlike every prior connector-facing contract in this repo (all of which use
// examples/synthetic fixtures — see provider-connector-framework's SKILL.md), this is the
// first contract that makes real outbound HTTP calls to GlobeNewswire's and PR Newswire's
// own public feeds. That's ADR-0024's own explicit bar ("prove the pipeline against a
// genuinely live, real-world feed"), not an oversight — this test requires real internet
// access to pass, and its content assertions are written to tolerate live feed content
// changing between runs (see AC3's "pick a real word from a real fetched title" approach).

import { randomUUID } from 'crypto';
import { closePool } from '../../src/db/pool';
import { withTenant } from '../../src/db/withTenant';
import { getSocialConnector, registerSocialConnector, __resetRegistryForTests } from '../../src/connectors/registry';
import {
  newswireConnector,
  fetchNewswireFeed,
  NEWSWIRE_PROVIDER_ID,
} from '../../src/connectors/newswire/newswireConnector';
import { pollNewswireFeeds, ingestNewswireItems } from '../../src/connectors/newswire/pollNewswireFeeds';
import { ParsedRssItem } from '../../src/connectors/newswire/rssFeedParser';
import { runIngestionAttempt } from '../../src/ingestion/runIngestionAttempt';
import { resolveWatchlistAstDispatch, matchPostsForWatchlistAst } from '../../src/watchlists/dispatch';
import { parseBooleanQuery } from '../../src/watchlists/ast';
import { MatchablePost } from '../../src/watchlists/matcher';

jest.setTimeout(60000);

afterAll(async () => {
  await closePool();
});

const GLOBENEWSWIRE_FEED_URL =
  'https://www.globenewswire.com/RssFeed/industry/1-Energy/feedTitle/GlobeNewswire%20-%20Industry%20News%20on%20Energy';
const PRNEWSWIRE_FEED_URL = 'https://www.prnewswire.com/rss/news-releases-list.rss';

async function countSocialPosts(tenantId: string): Promise<number> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query(`SELECT count(*)::int AS c FROM social_posts`);
    return rows[0].c;
  });
}

describe('Story 2.6 — Newswire connector contract', () => {
  beforeAll(() => {
    __resetRegistryForTests();
    registerSocialConnector(newswireConnector);
  });

  it('AC1: a registered connector (authMode none, poll, distinct providerId) ingests real items from both wires via runIngestionAttempt()', async () => {
    expect(getSocialConnector(NEWSWIRE_PROVIDER_ID)).toBe(newswireConnector);
    expect(newswireConnector.authMode).toBe('none');
    expect(newswireConnector.deliveryMode).toBe('poll');
    expect(newswireConnector.providerId).not.toBe('example-poll');

    const tenantId = randomUUID();
    const result = await pollNewswireFeeds(tenantId, [GLOBENEWSWIRE_FEED_URL, PRNEWSWIRE_FEED_URL]);

    expect(result.status).toBe('succeeded');

    const rows = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query<{ raw_payload: { link: string } }>(
        `SELECT raw_payload FROM social_posts`
      );
      return rows;
    });

    expect(rows.length).toBeGreaterThan(0);
    const links = rows.map((r) => r.raw_payload.link);
    expect(links.some((l) => l.includes('globenewswire.com'))).toBe(true);
    expect(links.some((l) => l.includes('prnewswire.com'))).toBe(true);
  });

  it("AC2: each post's Author resolves to the issuing organization, not an individual account", async () => {
    const tenantId = randomUUID();
    const result = await pollNewswireFeeds(tenantId, [GLOBENEWSWIRE_FEED_URL]);
    expect(result.status).toBe('succeeded');

    const authorRows = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query<{ external_author_id: string; follower_count: number | null }>(
        `SELECT external_author_id, follower_count FROM authors WHERE platform_id = $1`,
        [NEWSWIRE_PROVIDER_ID]
      );
      return rows;
    });

    expect(authorRows.length).toBeGreaterThan(0);
    for (const row of authorRows) {
      // Real GlobeNewswire items reliably carry dc:contributor (verified against
      // a live feed sample before writing this connector) — 'unknown' would mean
      // the issuer field genuinely went missing, not the expected case here.
      expect(row.external_author_id).not.toBe('unknown');
      expect(row.follower_count).toBeNull();
    }
  });

  it('AC3: supportedQueryFeatures is declared empty, and watchlist matching genuinely falls back rather than silently no-op\'ing', async () => {
    const items = await fetchNewswireFeed(PRNEWSWIRE_FEED_URL);
    expect(items.length).toBeGreaterThan(0);
    expect(newswireConnector.supportedQueryFeatures).toEqual([]);

    // A real word drawn from a real fetched title — proven against live
    // content, not a fixture, consistent with this story's own bar.
    const sampleTitle = items[0].title;
    const sampleWord = sampleTitle.split(/\s+/).find((w: string) => w.length > 4) ?? sampleTitle;
    const ast = parseBooleanQuery(sampleWord);

    const dispatch = resolveWatchlistAstDispatch(newswireConnector, ast);
    expect(dispatch.mode).toBe('fallback');
    expect(dispatch.unsupportedNodeTypes).toEqual(['TERM']);

    const posts: MatchablePost[] = items.map((item: ParsedRssItem, i: number) => ({
      id: String(i),
      text: item.title,
    }));
    const matched = matchPostsForWatchlistAst(dispatch, ast, posts);
    expect(matched.some((p) => p.id === '0')).toBe(true);

    // A term guaranteed absent proves fallback genuinely filters, rather than
    // 'fallback' meaning "pass everything through" (the silent no-op this AC rules out).
    const implausibleAst = parseBooleanQuery('zzzznoresultxyzzzz123');
    const implausibleDispatch = resolveWatchlistAstDispatch(newswireConnector, implausibleAst);
    expect(matchPostsForWatchlistAst(implausibleDispatch, implausibleAst, posts)).toHaveLength(0);
  });

  it('AC4: no API key/account is required, and re-polling with no new items is a correct no-op across two consecutive cycles', async () => {
    expect(newswireConnector.getAuthHeaders).toBeUndefined();

    const tenantId = randomUUID();
    const first = await pollNewswireFeeds(tenantId, [GLOBENEWSWIRE_FEED_URL]);
    expect(first.status).toBe('succeeded');

    const countAfterFirst = await countSocialPosts(tenantId);
    expect(countAfterFirst).toBeGreaterThan(0);

    const second = await pollNewswireFeeds(tenantId, [GLOBENEWSWIRE_FEED_URL]);
    expect(second.status).toBe('succeeded');

    const countAfterSecond = await countSocialPosts(tenantId);
    expect(countAfterSecond).toBe(countAfterFirst);
  });

  it('AC5: cross-wire duplicate handling is a deliberate v1 choice (accept duplicates), not an accidental gap', async () => {
    // ADR-0024 explicitly leaves cross-wire de-duplication as an
    // implementation-time decision. This story's decision: v1 does not
    // attempt cross-wire de-duplication — the same release independently
    // arriving on each wire (different guid, since each wire assigns its
    // own) yields two distinct SocialPost rows. Proven with a controlled
    // fixture: two wires coincidentally covering the very same release
    // within a single test run isn't something a test can force
    // deterministically against live feeds (AC1 already proves the live path).
    const tenantId = randomUUID();
    const shared = {
      title: 'Acme Corp announces record results',
      pubDate: 'Thu, 30 Jul 2026 12:00:00 GMT',
      issuer: 'Acme Corp',
    };
    const gnItem: ParsedRssItem = {
      guid: 'https://www.globenewswire.com/news-release/2026/07/30/example.html',
      link: 'https://www.globenewswire.com/news-release/2026/07/30/example.html',
      ...shared,
    };
    const prnItem: ParsedRssItem = {
      guid: 'https://www.prnewswire.com/news-releases/example.html',
      link: 'https://www.prnewswire.com/news-releases/example.html',
      ...shared,
    };

    const result = await runIngestionAttempt({
      tenantId,
      connectorInfo: { platformId: NEWSWIRE_PROVIDER_ID, triggerType: 'poll', connectorVersion: '1.0.0' },
      attempt: (runId) => ingestNewswireItems(tenantId, runId, [gnItem, prnItem]),
    });

    expect(result.status).toBe('succeeded');
    expect(await countSocialPosts(tenantId)).toBe(2);
  });
});
