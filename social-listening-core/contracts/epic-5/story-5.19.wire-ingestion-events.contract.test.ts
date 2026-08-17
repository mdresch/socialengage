// Contract: Story 5.19 (ADR-0058) — wire SocialPostIngestedEvent/
// ConnectorHealthChangedEvent publishing into the real ingestion pipeline.
// See docs/user-stories/epic-5-security-isolation-and-messaging.md#story-519--wire-socialpostingestedeventconnectorhealthchangedevent-publishing-into-the-real-ingestion-pipeline
//
// Intent: Story 5.19 — close the gap ingestion-events/SKILL.md's own "Known
// gaps" section already named: publishEvent() has no real caller anywhere in
// the actual ingestion pipeline. Wires SocialPostIngestedEvent publishing
// into each real connector's own ingest loop (one event per matching
// watchlist, watchlists loaded once per poll batch, published only after
// insertSocialPost() has resolved) and ConnectorHealthChangedEvent
// publishing into the shared runIngestionAttempt() itself (before/after
// health snapshot, diff, publish if changed) — both best-effort, never
// blocking real ingestion on a Service Bus failure (ADR-0038 precedent).
// Scope: src/watchlists/watchlistStore.ts (new listActiveWatchlistsForTenant()),
// src/events/publishSocialPostIngestedEvents.ts (new), src/connectors/gnews/
// pollGNewsSearch.ts, src/connectors/newswire/pollNewswireFeeds.ts,
// src/connectors/tenantOwnedFeed/pollTenantOwnedFeed.ts (all three wired),
// src/ingestion/runIngestionAttempt.ts (health-diff publishing).
// Contract to encode, per AC: (1) listActiveWatchlistsForTenant() is
// tenant-wide, distinct from the owner-scoped listWatchlists(); (2) a real,
// end-to-end publish — ingesting a post matching a real tenant watchlist
// targeting GNews produces a real SocialPostIngestedEvent on the real
// Service Bus topic; (3) matching semantics — zero/one/many events per post
// depending on how many watchlists it matches, each with the correct
// distinct watchlistId; (4) watchlists are fetched exactly once per poll
// batch, not once per post; (5) publishEvent() is only called once the
// post-insertion transaction has actually committed (a fresh, independent
// read sees the row at the moment of publish, not before); (6) a fresh
// tenant's very first ingestion attempt produces exactly one real
// ConnectorHealthChangedEvent (disconnected -> healthy); a second,
// unchanged-status attempt produces none; (7) a throwing/rejecting
// publishEvent() never fails or blocks the surrounding ingestion attempt,
// for either event type.
// Explicitly out of scope: throttling/batching multiple SocialPostIngestedEvents
// from one post matching many watchlists (ADR-0058 Decision §6 — named,
// not built for v1); Wikipedia's own connector (Story 2.13, separately
// paused) — this story covers GNews, Newswire, and tenant-owned-feed only.

import { randomUUID } from 'crypto';
import { ServiceBusClient, ServiceBusAdministrationClient } from '@azure/service-bus';
import { DefaultAzureCredential } from '@azure/identity';
import { closePool } from '../../src/db/pool';
import { closeAdminPool } from '../../src/db/adminPool';
import { withTenant } from '../../src/db/withTenant';
import { createTenant } from '../../src/tenants/tenantStore';
import { createInvitedUser } from '../../src/identity/identityResolution';
import { createWatchlist, listActiveWatchlistsForTenant } from '../../src/watchlists/watchlistStore';
import { startIngestionRun, completeIngestionRun } from '../../src/ingestion/ingestionRunStore';
import { runIngestionAttempt } from '../../src/ingestion/runIngestionAttempt';
import { ingestGNewsArticles } from '../../src/connectors/gnews/pollGNewsSearch';
import { GNEWS_PROVIDER_ID, GNewsArticle } from '../../src/connectors/gnews/gnewsConnector';
import { TOPIC_NAME, namespaceHost } from '../../src/events/serviceBusPublisher';
import * as serviceBusPublisherModule from '../../src/events/serviceBusPublisher';
import * as watchlistStoreModule from '../../src/watchlists/watchlistStore';
import { SocialPostIngestedEvent } from '../../src/events/socialPostIngestedEvent';
import { ConnectorHealthChangedEvent } from '../../src/events/connectorHealthChangedEvent';

jest.setTimeout(120000);

const credential = new DefaultAzureCredential();
const adminClient = new ServiceBusAdministrationClient(namespaceHost(), credential);
const sbClient = new ServiceBusClient(namespaceHost(), credential);
const createdSubscriptions: string[] = [];

afterEach(async () => {
  while (createdSubscriptions.length > 0) {
    const name = createdSubscriptions.pop() as string;
    await adminClient.deleteSubscription(TOPIC_NAME, name).catch(() => undefined);
  }
  jest.restoreAllMocks();
});

afterAll(async () => {
  await sbClient.close();
  await closeAdminPool();
  await closePool();
});

async function createTenantFilteredSubscription(tenantId: string): Promise<string> {
  const subscriptionName = `test-5-19-${randomUUID()}`;
  await adminClient.createSubscription(TOPIC_NAME, subscriptionName, {
    defaultRuleOptions: {
      name: 'tenant-filter',
      filter: { sqlExpression: 'tenantId = @tenantId', sqlParameters: { '@tenantId': tenantId } },
    },
    autoDeleteOnIdle: 'PT10M',
  });
  createdSubscriptions.push(subscriptionName);
  return subscriptionName;
}

async function receiveOne(subscriptionName: string, maxWaitTimeInMs = 20000) {
  const receiver = sbClient.createReceiver(TOPIC_NAME, subscriptionName);
  try {
    const [message] = await receiver.receiveMessages(1, { maxWaitTimeInMs });
    return message;
  } finally {
    await receiver.close();
  }
}

async function makeRun(tenantId: string, platformId: string): Promise<string> {
  const run = await startIngestionRun(tenantId, { platformId, triggerType: 'poll', connectorVersion: '1.0.0' });
  await completeIngestionRun(tenantId, run.id, { status: 'succeeded', postsIngested: 0, postsSkipped: 0 });
  return run.id;
}

async function makeTenantWithUser(): Promise<{ tenantId: string; userId: string }> {
  const tenant = await createTenant('test-actor', { name: `Story 5.19 ${randomUUID()}`, licenseSeatCount: 5 });
  const user = await createInvitedUser(tenant.id, { email: `${randomUUID()}@example.com` });
  return { tenantId: tenant.id, userId: user.id };
}

function makeArticle(overrides: Partial<GNewsArticle> = {}): GNewsArticle {
  return {
    title: 'Zzyzx breaking update',
    description: 'A description.',
    content: null,
    url: `https://example.com/${randomUUID()}`,
    image: '',
    publishedAt: '2026-08-17T10:00:00Z',
    lang: 'en',
    source: { id: `src-${randomUUID()}`, name: 'Example News', url: 'https://example.com', country: 'us' },
    ...overrides,
  } as GNewsArticle;
}

describe('Story 5.19 — wire ingestion events into the real pipeline contract', () => {
  it('AC1: listActiveWatchlistsForTenant() is tenant-wide, distinct from the owner-scoped listWatchlists()', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    const otherUser = await createInvitedUser(tenantId, { email: `${randomUUID()}@example.com` });

    const ownWatchlist = await createWatchlist(tenantId, userId, {
      name: 'own',
      matchType: 'keyword',
      terms: ['own-term'],
      platformIds: [GNEWS_PROVIDER_ID],
    });
    const otherUsersWatchlist = await createWatchlist(tenantId, otherUser.id, {
      name: 'other',
      matchType: 'keyword',
      terms: ['other-term'],
      platformIds: [GNEWS_PROVIDER_ID],
    });

    const all = await listActiveWatchlistsForTenant(tenantId);
    const ids = all.map((w) => w.id);
    expect(ids).toContain(ownWatchlist.id);
    expect(ids).toContain(otherUsersWatchlist.id);
  });

  it('AC1b: an inactive watchlist is excluded', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    const inactive = await createWatchlist(tenantId, userId, {
      name: 'inactive',
      matchType: 'keyword',
      terms: ['x'],
      platformIds: [GNEWS_PROVIDER_ID],
      isActive: false,
    });

    const all = await listActiveWatchlistsForTenant(tenantId);
    expect(all.map((w) => w.id)).not.toContain(inactive.id);
  });

  it('AC2: a real, end-to-end publish — a post matching a real tenant watchlist targeting GNews produces a real SocialPostIngestedEvent', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    const watchlist = await createWatchlist(tenantId, userId, {
      name: 'zzyzx-watch',
      matchType: 'boolean',
      booleanQuery: 'zzyzx',
      platformIds: [GNEWS_PROVIDER_ID],
    });

    const subscriptionName = await createTenantFilteredSubscription(tenantId);
    const runId = await makeRun(tenantId, GNEWS_PROVIDER_ID);
    await ingestGNewsArticles(tenantId, runId, [makeArticle({ title: 'Zzyzx breaking update' })]);

    const message = await receiveOne(subscriptionName);
    expect(message).toBeDefined();
    const body = message?.body as SocialPostIngestedEvent;
    expect(body.tenantId).toBe(tenantId);
    expect(body.platformId).toBe(GNEWS_PROVIDER_ID);
    expect(body.watchlistId).toBe(watchlist.id);
  });

  it('AC3: matching semantics — a post matching two watchlists publishes exactly two events with distinct watchlistIds; matching zero publishes none', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    const matchingA = await createWatchlist(tenantId, userId, {
      name: 'match-a',
      matchType: 'boolean',
      booleanQuery: 'zzyzx',
      platformIds: [GNEWS_PROVIDER_ID],
    });
    const matchingB = await createWatchlist(tenantId, userId, {
      name: 'match-b',
      matchType: 'boolean',
      booleanQuery: 'breaking',
      platformIds: [GNEWS_PROVIDER_ID],
    });
    await createWatchlist(tenantId, userId, {
      name: 'no-match',
      matchType: 'boolean',
      booleanQuery: 'qwertyuiopnomatch',
      platformIds: [GNEWS_PROVIDER_ID],
    });

    const publishSpy = jest.spyOn(serviceBusPublisherModule, 'publishEvent').mockResolvedValue(undefined);
    const runId = await makeRun(tenantId, GNEWS_PROVIDER_ID);
    await ingestGNewsArticles(tenantId, runId, [makeArticle({ title: 'Zzyzx breaking update' })]);

    const publishedWatchlistIds = publishSpy.mock.calls
      .map(([, body]) => body as SocialPostIngestedEvent)
      .filter((body) => body.tenantId === tenantId && 'watchlistId' in body)
      .map((body) => body.watchlistId);

    expect(publishedWatchlistIds.sort()).toEqual([matchingA.id, matchingB.id].sort());
  });

  it('AC4: watchlists are fetched exactly once per poll batch, not once per post', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    await createWatchlist(tenantId, userId, {
      name: 'irrelevant',
      matchType: 'keyword',
      terms: ['nomatch'],
      platformIds: [GNEWS_PROVIDER_ID],
    });

    const listSpy = jest.spyOn(watchlistStoreModule, 'listActiveWatchlistsForTenant');
    const runId = await makeRun(tenantId, GNEWS_PROVIDER_ID);
    await ingestGNewsArticles(tenantId, runId, [
      makeArticle({ title: 'Post one' }),
      makeArticle({ title: 'Post two' }),
      makeArticle({ title: 'Post three' }),
    ]);

    const callsForThisTenant = listSpy.mock.calls.filter(([calledTenantId]) => calledTenantId === tenantId);
    expect(callsForThisTenant.length).toBe(1);
  });

  it('AC5: publishEvent() is only called once the post-insertion transaction has actually committed', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    await createWatchlist(tenantId, userId, {
      name: 'zzyzx-watch',
      matchType: 'boolean',
      booleanQuery: 'zzyzx',
      platformIds: [GNEWS_PROVIDER_ID],
    });

    let sawCommittedRowAtPublishTime = false;
    jest.spyOn(serviceBusPublisherModule, 'publishEvent').mockImplementation(async (publishTenantId, body) => {
      const event = body as SocialPostIngestedEvent;
      if (publishTenantId === tenantId && 'postId' in event) {
        // An independent read against a fresh pool connection — if the
        // insert's own transaction hadn't actually committed yet, this
        // would see zero rows.
        const found = await withTenant(tenantId, async (client) => {
          const { rows } = await client.query(`SELECT id FROM social_posts WHERE id = $1`, [event.postId]);
          return rows.length > 0;
        });
        sawCommittedRowAtPublishTime = sawCommittedRowAtPublishTime || found;
      }
    });

    const runId = await makeRun(tenantId, GNEWS_PROVIDER_ID);
    await ingestGNewsArticles(tenantId, runId, [makeArticle({ title: 'Zzyzx breaking update' })]);

    expect(sawCommittedRowAtPublishTime).toBe(true);
  });

  it('AC6: a fresh tenant\'s very first ingestion attempt publishes exactly one real ConnectorHealthChangedEvent (disconnected -> healthy); an unchanged-status second attempt publishes none', async () => {
    const tenantId = randomUUID();
    const platformId = `test-platform-${randomUUID()}`;
    const subscriptionName = await createTenantFilteredSubscription(tenantId);

    const first = await runIngestionAttempt({
      tenantId,
      connectorInfo: { platformId, triggerType: 'poll', connectorVersion: '1.0.0' },
      attempt: async () => ({ postsIngested: 0, postsSkipped: 0 }),
    });
    expect(first.status).toBe('succeeded');

    const message = await receiveOne(subscriptionName);
    expect(message).toBeDefined();
    const body = message?.body as ConnectorHealthChangedEvent;
    expect(body.tenantId).toBe(tenantId);
    expect(body.platformId).toBe(platformId);
    expect(body.previousStatus).toBe('disconnected');
    expect(body.newStatus).toBe('healthy');

    const second = await runIngestionAttempt({
      tenantId,
      connectorInfo: { platformId, triggerType: 'poll', connectorVersion: '1.0.0' },
      attempt: async () => ({ postsIngested: 0, postsSkipped: 0 }),
    });
    expect(second.status).toBe('succeeded');

    const secondMessage = await receiveOne(subscriptionName, 5000);
    expect(secondMessage).toBeUndefined();
  });

  it('AC7: a rejecting publishEvent() never fails or blocks the surrounding ingestion attempt — SocialPostIngestedEvent path', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    await createWatchlist(tenantId, userId, {
      name: 'zzyzx-watch',
      matchType: 'boolean',
      booleanQuery: 'zzyzx',
      platformIds: [GNEWS_PROVIDER_ID],
    });
    jest.spyOn(serviceBusPublisherModule, 'publishEvent').mockRejectedValue(new Error('Service Bus unreachable'));

    const runId = await makeRun(tenantId, GNEWS_PROVIDER_ID);
    const result = await ingestGNewsArticles(tenantId, runId, [makeArticle({ title: 'Zzyzx breaking update' })]);

    expect(result.postsIngested).toBe(1);
    const rows = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query(`SELECT id FROM social_posts`);
      return rows;
    });
    expect(rows.length).toBe(1);
  });

  it('AC7b: a rejecting publishEvent() never fails the surrounding ingestion attempt — ConnectorHealthChangedEvent path', async () => {
    const tenantId = randomUUID();
    const platformId = `test-platform-${randomUUID()}`;
    jest.spyOn(serviceBusPublisherModule, 'publishEvent').mockRejectedValue(new Error('Service Bus unreachable'));

    const result = await runIngestionAttempt({
      tenantId,
      connectorInfo: { platformId, triggerType: 'poll', connectorVersion: '1.0.0' },
      attempt: async () => ({ postsIngested: 0, postsSkipped: 0 }),
    });

    expect(result.status).toBe('succeeded');
  });
});
