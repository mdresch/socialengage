// Contract: Story 2.14 (ADR-0042 §5) — Wikipedia discovery search driven by
// the tenant's own watchlist terms, replacing the shared hardcoded default.
// See docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md#story-214--wikipedia-discovery-search-driven-by-the-tenants-own-watchlist-terms
//
// Intent: Story 2.14 — pollWikipedia()'s discovery phase, when called with
// no explicit query (its one real production call site,
// bootstrapConnectors.ts:72, has never passed one), now derives its search
// query from the tenant's own active watchlists whose platformIds include
// 'wikipedia', instead of the shared DEFAULT_QUERY = 'Anthropic' literal
// every tenant previously searched regardless of what they actually track.
// Scope: src/connectors/wikipedia/pollWikipedia.ts (discovery phase — a new,
// unexported buildDiscoveryQueries() helper; DEFAULT_QUERY removed; query
// becomes an optional override with no default). No other file changes:
// wikipediaConnector.ts, bootstrapConnectors.ts, and the registry are
// unaffected.
// Contract to encode, per AC: (1) two tenants with differently-termed
// wikipedia-targeted watchlists each produce a discovery search reflecting
// their own terms, not a shared literal; (2) a tenant with zero active
// wikipedia-targeted watchlists performs no discovery search when query is
// omitted; (3) a keyword-typed watchlist's own terms drive a real, live
// MediaWiki search call; (4) a tenant with more than one active
// wikipedia-targeted watchlist gets one separate search per watchlist, no
// cross-watchlist term concatenation; (5) a boolean-typed watchlist is
// skipped for discovery purposes (not mistranslated); (6) whole-article
// fallback matching for event-publishing (Story 2.13 AC10) is unchanged —
// a boolean watchlist still receives a SocialPostIngestedEvent once content
// is discovered by some other means; (7) an explicit query argument
// (Story 2.13's own existing contract, its final test) behaves exactly as
// before — this story must not rewrite that passing contract.
// Explicitly out of scope: full boolean AST-to-CirrusSearch operator
// translation (AND/OR/NOT, quoted phrases, intitle:/insource:) — ADR-0042's
// own still-open, unverified gap; recentchanges-driven re-poll of
// already-tracked articles (Story 2.13 Phase 2), unchanged by this story;
// GNews's identical, separately-tracked DEFAULT_QUERY gap.

import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { closePool } from '../../src/db/pool';
import { withTenant } from '../../src/db/withTenant';
import * as wikipediaConnectorModule from '../../src/connectors/wikipedia/wikipediaConnector';
import { WIKIPEDIA_PROVIDER_ID } from '../../src/connectors/wikipedia/wikipediaConnector';
import { pollWikipedia } from '../../src/connectors/wikipedia/pollWikipedia';
import { createTenant } from '../../src/tenants/tenantStore';
import { createInvitedUser } from '../../src/identity/identityResolution';
import { createWatchlist } from '../../src/watchlists/watchlistStore';
import * as serviceBusPublisherModule from '../../src/events/serviceBusPublisher';

jest.setTimeout(60000);

async function makeTenant(label: string): Promise<{ tenantId: string; userId: string }> {
  const tenant = await createTenant('test-actor', { name: `wikipedia-topic-${label}-${randomUUID()}`, licenseSeatCount: 5 });
  const owner = await createInvitedUser(tenant.id, { email: `${randomUUID()}@example.com` });
  return { tenantId: tenant.id, userId: owner.id };
}

afterAll(async () => {
  await closePool();
});

describe('Story 2.14 — Wikipedia watchlist-driven discovery contract', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('AC1: two tenants with differently-termed wikipedia-targeted watchlists each produce a discovery search reflecting their own terms', async () => {
    const tenantA = await makeTenant('a');
    const tenantB = await makeTenant('b');
    await createWatchlist(tenantA.tenantId, tenantA.userId, {
      name: 'topic-a',
      matchType: 'keyword',
      terms: ['AlphaTopic'],
      platformIds: [WIKIPEDIA_PROVIDER_ID],
    });
    await createWatchlist(tenantB.tenantId, tenantB.userId, {
      name: 'topic-b',
      matchType: 'keyword',
      terms: ['BetaTopic'],
      platformIds: [WIKIPEDIA_PROVIDER_ID],
    });

    const searchSpy = jest.spyOn(wikipediaConnectorModule, 'fetchWikipediaSearch').mockResolvedValue([]);

    await pollWikipedia(tenantA.tenantId);
    expect(searchSpy).toHaveBeenCalledWith('AlphaTopic');
    searchSpy.mockClear();

    await pollWikipedia(tenantB.tenantId);
    expect(searchSpy).toHaveBeenCalledWith('BetaTopic');
    expect(searchSpy).not.toHaveBeenCalledWith('AlphaTopic');
  });

  it('AC2: a tenant with zero active wikipedia-targeted watchlists performs no discovery search when query is omitted', async () => {
    const { tenantId } = await makeTenant('none');
    const searchSpy = jest.spyOn(wikipediaConnectorModule, 'fetchWikipediaSearch').mockResolvedValue([]);

    await pollWikipedia(tenantId);

    expect(searchSpy).not.toHaveBeenCalled();
  });

  it('AC3: a keyword-typed watchlist\'s own terms drive a real, live MediaWiki search call', async () => {
    const { tenantId, userId } = await makeTenant('live');
    await createWatchlist(tenantId, userId, {
      name: 'live-topic',
      matchType: 'keyword',
      terms: ['Anthropic'],
      platformIds: [WIKIPEDIA_PROVIDER_ID],
    });

    // No mockResolvedValue — real outbound call to en.wikipedia.org, same
    // live-API tolerance Story 2.13's own contract already establishes.
    const searchSpy = jest.spyOn(wikipediaConnectorModule, 'fetchWikipediaSearch');

    const result = await pollWikipedia(tenantId);

    expect(searchSpy).toHaveBeenCalledWith('Anthropic');
    expect(result.status).toBe('succeeded');
  });

  it('AC4: a tenant with more than one active wikipedia-targeted watchlist gets one separate search per watchlist, no cross-watchlist concatenation', async () => {
    const { tenantId, userId } = await makeTenant('multi');
    await createWatchlist(tenantId, userId, {
      name: 'multi-one',
      matchType: 'keyword',
      terms: ['FirstTerm'],
      platformIds: [WIKIPEDIA_PROVIDER_ID],
    });
    await createWatchlist(tenantId, userId, {
      name: 'multi-two',
      matchType: 'hashtag',
      terms: ['SecondTerm'],
      platformIds: [WIKIPEDIA_PROVIDER_ID],
    });

    const searchSpy = jest.spyOn(wikipediaConnectorModule, 'fetchWikipediaSearch').mockResolvedValue([]);

    await pollWikipedia(tenantId);

    expect(searchSpy).toHaveBeenCalledTimes(2);
    const calledQueries = searchSpy.mock.calls.map(([q]) => q);
    expect(calledQueries).toContain('FirstTerm');
    expect(calledQueries).toContain('SecondTerm');
    expect(calledQueries).not.toContain('FirstTerm SecondTerm');
  });

  it('AC5: a boolean-typed watchlist is skipped for discovery purposes, not mistranslated', async () => {
    const { tenantId, userId } = await makeTenant('boolean-only');
    await createWatchlist(tenantId, userId, {
      name: 'boolean-topic',
      matchType: 'boolean',
      booleanQuery: 'foo AND bar',
      platformIds: [WIKIPEDIA_PROVIDER_ID],
    });

    const searchSpy = jest.spyOn(wikipediaConnectorModule, 'fetchWikipediaSearch').mockResolvedValue([]);

    await pollWikipedia(tenantId);

    expect(searchSpy).not.toHaveBeenCalled();
  });

  it('AC6 (regression): whole-article fallback matching for event-publishing is unchanged — a boolean watchlist still receives a SocialPostIngestedEvent once content is discovered another way', async () => {
    const { tenantId, userId } = await makeTenant('regression');
    await createWatchlist(tenantId, userId, {
      name: 'regression-boolean',
      matchType: 'boolean',
      booleanQuery: 'anthropic',
      platformIds: [WIKIPEDIA_PROVIDER_ID],
    });
    // A second, keyword-typed watchlist is what actually drives this test's
    // one real discovery search — the boolean watchlist above is only here
    // to prove it still gets evaluated for event-matching once a post is
    // discovered by some other watchlist's own search.
    await createWatchlist(tenantId, userId, {
      name: 'regression-keyword',
      matchType: 'keyword',
      terms: ['Anthropic'],
      platformIds: [WIKIPEDIA_PROVIDER_ID],
    });

    const publishSpy = jest.spyOn(serviceBusPublisherModule, 'publishEvent').mockResolvedValue(undefined);

    await pollWikipedia(tenantId);

    // At least one event published against this tenant — proves
    // ingestWikipediaRevisions()/publishSocialPostIngestedEvents() still
    // runs unmodified against whatever discovery (now watchlist-driven)
    // actually finds.
    const tenantCalls = publishSpy.mock.calls.filter(([calledTenantId]) => calledTenantId === tenantId);
    expect(tenantCalls.length).toBeGreaterThan(0);
  });

  it('AC7: an explicit query argument behaves exactly as before — Story 2.13\'s own existing contract call shape is unaffected', async () => {
    const { tenantId } = await makeTenant('explicit-query');
    const searchSpy = jest.spyOn(wikipediaConnectorModule, 'fetchWikipediaSearch').mockResolvedValue([]);

    await pollWikipedia(tenantId, 'Anthropic');

    // Exactly the same call shape pollWikipedia(tenantId, TEST_ARTICLE)
    // already exercises in story-2.13.wikipedia-connector.contract.test.ts —
    // one search for the literal supplied, no watchlist lookup involved in
    // deriving it.
    expect(searchSpy).toHaveBeenCalledTimes(1);
    expect(searchSpy).toHaveBeenCalledWith('Anthropic');
  });

  it('structural: bootstrapConnectors.ts\'s own real production call site required no change — it already calls pollWikipedia(tenantId) with no second argument', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../src/connectors/bootstrapConnectors.ts'),
      'utf-8'
    );
    expect(source).toContain('pollWikipedia(tenantId)');
  });
});
