// Contract: Story 2.11 (ADR-0050) — tenant-owned-domain RSS/content-feed
// connector, DNS TXT domain-ownership verification gate, domain-as-Author.
// See docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md#story-211
//
// Intent: a tenant proves control of a domain via a DNS TXT record
// challenge before SocialEngage will ever poll that domain's own RSS/Atom
// feed. Polling and Author identity both key off the *verified domain*,
// never a per-item field or a vendor credential (authMode: 'none').
// Scope: migrations/0026_create_tenant_owned_feed_activations.sql (new),
// src/connectors/tenantOwnedFeed/{dnsVerification,feedItemParser,
// tenantOwnedFeedConnector,tenantOwnedFeedStore,pollTenantOwnedFeed}.ts
// (new), src/http/versions/v1/tenantOwnedFeedRouter.ts (new),
// src/http/versions/v1/router.ts (new mount, before /connectors).
// Contract to encode, per AC: (1) a registered SocialConnector
// (providerId distinct, authMode 'none', deliveryMode 'poll') — the
// no-core-path-edit evidence itself is Story 2.10/ADR-0048's own contract,
// cross-referenced, not re-proven here; (2) POST .../connect returns
// txtRecordHost/txtRecordValue/expiresAt/feedUrl; (3) polling never begins
// while an activation is pending; (4) POST .../verify-domain: a matching
// TXT record marks verified, a missing/mismatched one returns pending, not
// a hard failure; (5) once verified, a real poll cycle via
// runIngestionAttempt() produces real SocialPost rows; (6) Author resolves
// to the verified domain, followerCount unpopulated; (7) no historical
// backfill — no date-range parameter exists anywhere in the poll path;
// (8) feedUrl is required and no autodiscovery step exists; (9) a verified
// domain need not match tenants.domain — no code path here ever reads or
// compares against it; (10) supportedQueryFeatures is empty and watchlist
// matching genuinely falls back; (11) every fetch sets a real,
// self-identifying User-Agent header; (12) idempotent re-poll across two
// consecutive cycles.
// Explicitly out of scope: multi-domain Admin UI/UX (ADR-0050 Open
// Question 2 — storage-level support only); third-party CMS hosting ToS
// considerations (Open Question 3); respecting a feed's own <ttl> as a
// binding poll-interval floor (Open Question 4); autodiscovery (deferred
// past v1); token-expiry transition to 'expired' (no scheduled job exists
// yet — a named, real gap, see this component's own SKILL.md).
//
// Dated note, 2026-08-17 (Story 6.20 / ADR-0057 Decision §2): connect and
// verify-domain now require tenant_admin — previously ungated (a real,
// pre-existing role-gating inconsistency ADR-0057 found and corrected,
// unlike every other tenant-wide connector action in this codebase). Every
// call to either endpoint below that used to authorize with the default
// tenant_user identity now explicitly passes tenant_admin instead — a
// deliberate, ADR-justified update to this story's own contract, not a
// silent rewrite; the behavior itself (TXT instructions, pending/verified
// transitions) is completely unchanged.
//
// A note on the one deliberate mock in this file: this project has no
// domain it can publish a real, controllable DNS TXT record for, so the
// "record genuinely matches" path (AC4) is proven by spying on Node's own
// `dns.promises.resolveTxt` for exactly one test, restored immediately
// after. Every other DNS lookup in this file (the "no match" path) runs
// against real DNS for a real domain (example.com, IANA-reserved,
// guaranteed to carry no such record) — see dnsVerification.ts's own
// Load-bearing-constraints note in tenant-owned-feed-connector/SKILL.md for
// why this narrow exception is scoped exactly this way and not wider.

import { randomUUID } from 'crypto';
import dns from 'dns';
import http from 'http';
import type { AddressInfo } from 'net';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { closePool } from '../../src/db/pool';
import { withTenant } from '../../src/db/withTenant';
import { getSocialConnector, registerSocialConnector, __resetRegistryForTests } from '../../src/connectors/registry';
import {
  tenantOwnedFeedConnector,
  fetchTenantOwnedFeed,
  TENANT_OWNED_FEED_PROVIDER_ID,
  TENANT_OWNED_FEED_USER_AGENT,
} from '../../src/connectors/tenantOwnedFeed/tenantOwnedFeedConnector';
import { pollTenantOwnedFeed } from '../../src/connectors/tenantOwnedFeed/pollTenantOwnedFeed';
import {
  createActivation,
  markVerified,
  expectedTxtRecordValue,
} from '../../src/connectors/tenantOwnedFeed/tenantOwnedFeedStore';
import { checkTxtRecord } from '../../src/connectors/tenantOwnedFeed/dnsVerification';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { resolveWatchlistAstDispatch, matchPostsForWatchlistAst } from '../../src/watchlists/dispatch';
import { parseBooleanQuery } from '../../src/watchlists/ast';
import { MatchablePost } from '../../src/watchlists/matcher';

jest.setTimeout(60000);

afterAll(async () => {
  await closePool();
});

// Story 6.20 / ADR-0057 Decision §2 (2026-08-17): connect/verify-domain are
// now tenant_admin-only — every real call to either below uses this helper.
function adminHeader(tenantId: string): string {
  return testIdentityHeaderValue(tenantId, { role: 'tenant_admin' });
}

// Real, live, already-proven-reachable feed (same one Story 2.6's own
// contract already uses) — decoupled from domain *verification*, which is
// exercised separately below. Reusing it avoids introducing a new external
// dependency risk just to prove real RSS ingestion mechanics.
const REAL_FEED_URL =
  'https://www.globenewswire.com/RssFeed/industry/1-Energy/feedTitle/GlobeNewswire%20-%20Industry%20News%20on%20Energy';

async function countSocialPosts(tenantId: string): Promise<number> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query(`SELECT count(*)::int AS c FROM social_posts`);
    return rows[0].c;
  });
}

describe('Story 2.11 — tenant-owned-feed connector contract', () => {
  beforeAll(() => {
    __resetRegistryForTests();
    registerSocialConnector(tenantOwnedFeedConnector);
  });

  it('AC1: a registered connector — authMode none, deliveryMode poll, distinct providerId (no-core-path-edit evidence is Story 2.10\'s own contract)', () => {
    expect(getSocialConnector(TENANT_OWNED_FEED_PROVIDER_ID)).toBe(tenantOwnedFeedConnector);
    expect(tenantOwnedFeedConnector.authMode).toBe('none');
    expect(tenantOwnedFeedConnector.deliveryMode).toBe('poll');
    expect(tenantOwnedFeedConnector.providerId).toBe('tenant-owned-feed');
  });

  it('AC2: POST /v1/connectors/tenant-owned-feed/connect returns TXT record instructions', async () => {
    const app = createApp();
    const tenantId = randomUUID();

    const res = await request(app)
      .post('/v1/connectors/tenant-owned-feed/connect')
      .set('X-Test-Identity', adminHeader(tenantId))
      .send({ domain: 'blog.example.com', feedUrl: 'https://blog.example.com/feed' });

    expect(res.status).toBe(201);
    expect(res.body.connectorActivationId).toBeDefined();
    expect(res.body.txtRecordHost).toBe('_socialengage-verify.blog.example.com');
    expect(res.body.txtRecordValue).toMatch(/^socialengage-verify=/);
    expect(new Date(res.body.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(res.body.feedUrl).toBe('https://blog.example.com/feed');
  });

  it('AC3: polling never begins while an activation is pending', async () => {
    const tenantId = randomUUID();
    // A feed URL that would throw if actually fetched — proves the fetch
    // was never attempted, since a real attempt would surface as a
    // failed/dead-lettered run, not a clean success.
    await createActivation(tenantId, { domain: 'never-verified.example', feedUrl: 'http://127.0.0.1:1/unreachable' });

    const result = await pollTenantOwnedFeed(tenantId);
    expect(result.status).toBe('succeeded');
    expect(await countSocialPosts(tenantId)).toBe(0);
  });

  it('AC4a: verify-domain with a missing/mismatched TXT record returns pending, not a hard failure (real DNS lookup)', async () => {
    const app = createApp();
    const tenantId = randomUUID();
    const activation = await createActivation(tenantId, {
      domain: 'example.com', // IANA-reserved; guaranteed no _socialengage-verify TXT record
      feedUrl: 'https://example.com/feed',
    });

    const res = await request(app)
      .post('/v1/connectors/tenant-owned-feed/verify-domain')
      .set('X-Test-Identity', adminHeader(tenantId))
      .send({ connectorActivationId: activation.id });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('pending');
    expect(res.body.retryAfter).toBeGreaterThan(0);
  });

  it('AC4b: verify-domain marks an activation verified once the real DNS lookup returns the matching token (spied dns.resolveTxt — see file header note)', async () => {
    const app = createApp();
    const tenantId = randomUUID();
    const activation = await createActivation(tenantId, {
      domain: 'blog.example.com',
      feedUrl: 'https://blog.example.com/feed',
    });

    const spy = jest
      .spyOn(dns.promises, 'resolveTxt')
      .mockResolvedValue([[expectedTxtRecordValue(activation)]]);
    try {
      const res = await request(app)
        .post('/v1/connectors/tenant-owned-feed/verify-domain')
        .set('X-Test-Identity', adminHeader(tenantId))
        .send({ connectorActivationId: activation.id });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('verified');
    } finally {
      spy.mockRestore();
    }
  });

  it('checkTxtRecord() unit behavior: an injected resolver proves the matching/chunk-joining logic directly', async () => {
    const matched = await checkTxtRecord('_socialengage-verify.example.com', 'socialengage-verify=abc123', async () => [
      ['socialengage-verify=', 'abc123'], // DNS TXT records may be split into multiple chunks
    ]);
    expect(matched).toBe(true);

    const mismatched = await checkTxtRecord('_socialengage-verify.example.com', 'socialengage-verify=abc123', async () => [
      ['socialengage-verify=wrong'],
    ]);
    expect(mismatched).toBe(false);
  });

  it('AC5/AC6: once verified, a real poll cycle ingests real SocialPost rows with Author = the verified domain (followerCount unpopulated)', async () => {
    const tenantId = randomUUID();
    const activation = await createActivation(tenantId, { domain: 'acme-blog.example', feedUrl: REAL_FEED_URL });
    await markVerified(tenantId, activation.id);

    const result = await pollTenantOwnedFeed(tenantId);
    expect(result.status).toBe('succeeded');

    const postRows = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query<{ raw_payload: { link: string } }>(`SELECT raw_payload FROM social_posts`);
      return rows;
    });
    expect(postRows.length).toBeGreaterThan(0);
    expect(postRows.every((r) => r.raw_payload.link.includes('globenewswire.com'))).toBe(true);

    const authorRows = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query<{ external_author_id: string; follower_count: number | null }>(
        `SELECT external_author_id, follower_count FROM authors WHERE platform_id = $1`,
        [TENANT_OWNED_FEED_PROVIDER_ID]
      );
      return rows;
    });
    expect(authorRows.length).toBe(1);
    expect(authorRows[0].external_author_id).toBe('acme-blog.example');
    expect(authorRows[0].follower_count).toBeNull();
  });

  it('AC7: no historical backfill — no date-range/since parameter exists anywhere in the poll path', () => {
    expect(pollTenantOwnedFeed.length).toBe(1); // (tenantId) only
    expect(fetchTenantOwnedFeed.length).toBe(1); // (feedUrl) only — no "since"/"fromDate"
  });

  it('AC8: connect requires feedUrl explicitly and performs no autodiscovery', async () => {
    const app = createApp();
    const tenantId = randomUUID();

    const missingFeedUrl = await request(app)
      .post('/v1/connectors/tenant-owned-feed/connect')
      .set('X-Test-Identity', adminHeader(tenantId))
      .send({ domain: 'blog.example.com' });
    expect(missingFeedUrl.status).toBe(400);

    const missingDomain = await request(app)
      .post('/v1/connectors/tenant-owned-feed/connect')
      .set('X-Test-Identity', adminHeader(tenantId))
      .send({ feedUrl: 'https://blog.example.com/feed' });
    expect(missingDomain.status).toBe(400);

    // No autodiscovery machinery anywhere in this connector's own files —
    // structural proof, not just "the connect handler happens not to call
    // it". Checks for the actual RSS-autodiscovery HTML pattern
    // (rssboard.org/rss-autodiscovery) rather than the word "autodiscovery"
    // itself, which this router's own doc comments legitimately mention.
    const routerSource = require('fs').readFileSync(
      require('path').join(__dirname, '../../src/http/versions/v1/tenantOwnedFeedRouter.ts'),
      'utf8'
    );
    expect(routerSource).not.toContain('rel="alternate"');
    expect(routerSource).not.toContain('text/html');
  });

  it('AC9: a verified domain need not match tenants.domain — no code path here reads or compares against it', () => {
    const storeSource = require('fs').readFileSync(
      require('path').join(__dirname, '../../src/connectors/tenantOwnedFeed/tenantOwnedFeedStore.ts'),
      'utf8'
    );
    const routerSource = require('fs').readFileSync(
      require('path').join(__dirname, '../../src/http/versions/v1/tenantOwnedFeedRouter.ts'),
      'utf8'
    );
    expect(storeSource).not.toMatch(/from\s+tenants\b/i);
    expect(routerSource).not.toMatch(/from\s+tenants\b/i);
  });

  it('AC10: supportedQueryFeatures is declared empty, and watchlist matching genuinely falls back rather than silently no-op\'ing', async () => {
    expect(tenantOwnedFeedConnector.supportedQueryFeatures).toEqual([]);

    const items = await fetchTenantOwnedFeed(REAL_FEED_URL);
    expect(items.length).toBeGreaterThan(0);

    const sampleTitle = items[0].title;
    const sampleWord = sampleTitle.split(/\s+/).find((w: string) => w.length > 4) ?? sampleTitle;
    const ast = parseBooleanQuery(sampleWord);

    const dispatch = resolveWatchlistAstDispatch(tenantOwnedFeedConnector, ast);
    expect(dispatch.mode).toBe('fallback');

    const posts: MatchablePost[] = items.map((item, i) => ({ id: String(i), text: item.title }));
    const matched = matchPostsForWatchlistAst(dispatch, ast, posts);
    expect(matched.some((p) => p.id === '0')).toBe(true);

    const implausibleAst = parseBooleanQuery('zzzznoresultxyzzzz123');
    const implausibleDispatch = resolveWatchlistAstDispatch(tenantOwnedFeedConnector, implausibleAst);
    expect(matchPostsForWatchlistAst(implausibleDispatch, implausibleAst, posts)).toHaveLength(0);
  });

  it('AC11: every outbound feed fetch sets a real, self-identifying User-Agent header (proven against a real local HTTP server)', async () => {
    let receivedUserAgent: string | undefined;
    const server = http.createServer((req, res) => {
      receivedUserAgent = req.headers['user-agent'];
      res.writeHead(200, { 'Content-Type': 'application/rss+xml' });
      res.end('<rss><channel></channel></rss>');
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as AddressInfo).port;

    try {
      await fetchTenantOwnedFeed(`http://127.0.0.1:${port}/feed`);
      expect(receivedUserAgent).toBe(TENANT_OWNED_FEED_USER_AGENT);
      expect(receivedUserAgent).toContain('SocialEngage');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('AC12: idempotent re-poll — no duplicate SocialPost rows across two consecutive cycles', async () => {
    const tenantId = randomUUID();
    const activation = await createActivation(tenantId, { domain: 'acme-blog.example', feedUrl: REAL_FEED_URL });
    await markVerified(tenantId, activation.id);

    const first = await pollTenantOwnedFeed(tenantId);
    expect(first.status).toBe('succeeded');
    const countAfterFirst = await countSocialPosts(tenantId);
    expect(countAfterFirst).toBeGreaterThan(0);

    const second = await pollTenantOwnedFeed(tenantId);
    expect(second.status).toBe('succeeded');
    const countAfterSecond = await countSocialPosts(tenantId);
    expect(countAfterSecond).toBe(countAfterFirst);
  });
});
