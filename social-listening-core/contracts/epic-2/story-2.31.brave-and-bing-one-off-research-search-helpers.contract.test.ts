// Contract: Story 2.31 (ADR-0076) — Brave and Bing one-off research search helpers
// See docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md#story-231
//
// Intent: Story 2.31 — Add an internal, read-only `searchForResearch()` helper to
// the Brave and Bing search connectors for the composer Deep Research endpoint.
// Scope: touches
//   src/connectors/braveSearch/braveSearchConnector.ts,
//   src/connectors/bingSearch/bingSearchConnector.ts,
//   .claude/skills/brave-search-connector/SKILL.md,
//   .claude/skills/bing-search-connector/SKILL.md
// Contract to encode:
//   AC1: `searchForResearch(tenantId, query, limit)` is exported from both connector modules.
//   AC2: Returns `{ title, url, snippet, provider }` objects, with canonical URLs
//       and Markdown-normalized snippets, provider set to 'brave-search' or 'bing-search'.
//   AC3: No persistence: no social_posts, post_watchlist_matches, or ingestion events.
//   AC4: Consumes a separate RequestGate key `(tenantId, providerId, 'research')`.
//   AC5: Reuses existing credential retrieval and reclassifies HTTP 401/403/429/5xx
//       (plus gate errors) into ClassifiableError, same as the polling connector.
//   AC6: Jest contract asserts request shape, URL canonicalization, provider field,
//       and no side effects on the persistence tables.
// Explicitly out of scope: A generic `SearchProvider` interface; real-time streaming;
//   persistence of search results; media or image search.

import { randomUUID } from 'crypto';
import { closePool } from '../../src/db/pool';
import { getPlatformAdminPool, closePlatformAdminPool } from '../../src/db/platformAdminPool';
import { getAdminPool, closeAdminPool } from '../../src/db/adminPool';
import { withTenant } from '../../src/db/withTenant';
import { getKeyClient } from '../../src/credentials/keyVaultProvider';
import { storeCredential } from '../../src/credentials/credentialStore';
import { ClassifiableError } from '../../src/ingestion/errorClassification';
import { htmlToMarkdown } from '../../src/content/htmlToMarkdown';
import * as requestGate from '../../src/connectors/requestGate';
import {
  searchForResearch as searchBraveForResearch,
  BRAVE_SEARCH_PROVIDER_ID,
} from '../../src/connectors/braveSearch/braveSearchConnector';
import {
  searchForResearch as searchBingForResearch,
  BING_SEARCH_PROVIDER_ID,
} from '../../src/connectors/bingSearch/bingSearchConnector';

jest.setTimeout(60000);

let testKeyName: string;
let testKeyId: string;

beforeAll(async () => {
  testKeyName = `test-key-${randomUUID()}`;
  const key = await getKeyClient().createRsaKey(testKeyName, { keySize: 2048 });
  testKeyId = key.id as string;
});

afterAll(async () => {
  requestGate.__resetGateForTests();
  try {
    const poller = await getKeyClient().beginDeleteKey(testKeyName);
    await poller.pollUntilDone();
  } catch {
    // best effort cleanup
  }
  await closePlatformAdminPool();
  await closeAdminPool();
  await closePool();
});

beforeEach(() => {
  requestGate.__resetGateForTests();
});

async function makeTenantWithUser(): Promise<{ tenantId: string; userId: string }> {
  const { rows: tenantRows } = await getPlatformAdminPool().query<{ id: string }>(
    `INSERT INTO tenants (name, license_seat_count) VALUES ($1, 5) RETURNING id`,
    [`Research Tenant ${randomUUID()}`]
  );
  const tenantId = tenantRows[0].id;

  const { rows: userRows } = await getAdminPool().query<{ id: string }>(
    `INSERT INTO users (tenant_id, email, role, status) VALUES ($1, $2, 'tenant_admin', 'active') RETURNING id`,
    [tenantId, `user-${randomUUID()}@example.com`]
  );
  const userId = userRows[0].id;

  return { tenantId, userId };
}

async function storeBraveCredential(tenantId: string): Promise<void> {
  await storeCredential(tenantId, BRAVE_SEARCH_PROVIDER_ID, 'test-brave-subscription-token', testKeyId, 'tenant');
}

async function storeBingCredential(tenantId: string): Promise<void> {
  await storeCredential(tenantId, BING_SEARCH_PROVIDER_ID, 'test-bing-subscription-key', testKeyId, 'tenant');
}

function mockFetchBrave(results: Array<{ url: string; title: string; description: string }>): () => void {
  const originalFetch = global.fetch;
  global.fetch = jest.fn().mockImplementation((input: any, _init: any) => {
    const urlStr = typeof input === 'string' ? input : input?.url ?? '';
    if (urlStr.includes('api.search.brave.com')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ results }),
      } as Response);
    }
    return originalFetch(input, _init);
  });
  return () => {
    global.fetch = originalFetch;
  };
}

function mockFetchBing(results: Array<{ url: string; name: string; snippet: string }>): () => void {
  const originalFetch = global.fetch;
  global.fetch = jest.fn().mockImplementation((input: any, _init: any) => {
    const urlStr = typeof input === 'string' ? input : input?.url ?? '';
    if (urlStr.includes('api.bing.microsoft.com')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ webPages: { value: results } }),
      } as Response);
    }
    return originalFetch(input, _init);
  });
  return () => {
    global.fetch = originalFetch;
  };
}

describe('Story 2.31 — Brave and Bing one-off research search helpers contract', () => {
  describe('AC1: searchForResearch is exported from both connector modules', () => {
    it('exposes a function for both Brave and Bing', () => {
      expect(typeof searchBraveForResearch).toBe('function');
      expect(typeof searchBingForResearch).toBe('function');
    });
  });

  describe('AC2: Returns search result objects with title, canonical URL, Markdown snippet, and provider', () => {
    it('Brave: canonicalizes URLs, normalizes snippets, and sets provider', async () => {
      const { tenantId } = await makeTenantWithUser();
      await storeBraveCredential(tenantId);
      const restore = mockFetchBrave([
        {
          url: 'https://www.theverge.com/2026/08/20/ai-launch?utm_source=feed#comments',
          title: 'AI Startup Launches New Model',
          description: '<p>A startup claims a breakthrough in agentic reasoning.</p>',
        },
      ]);

      const results = await searchBraveForResearch(tenantId, 'agentic AI', 1);
      restore();

      expect(results).toHaveLength(1);
      const [r] = results;
      expect(r.title).toBe('AI Startup Launches New Model');
      expect(r.url).toBe('https://www.theverge.com/2026/08/20/ai-launch');
      expect(r.snippet).toBe(htmlToMarkdown('<p>A startup claims a breakthrough in agentic reasoning.</p>'));
      expect(r.provider).toBe('brave-search');
    });

    it('Bing: canonicalizes URLs, normalizes snippets, and sets provider', async () => {
      const { tenantId } = await makeTenantWithUser();
      await storeBingCredential(tenantId);
      const restore = mockFetchBing([
        {
          url: 'https://www.TechCrunch.com/2026/08/20/robotics?utm_medium=social',
          name: 'Robotics Funding Rises',
          snippet: '<b>Investors</b> pour capital into humanoid robotics startups.',
        },
      ]);

      const results = await searchBingForResearch(tenantId, 'humanoid robots', 1);
      restore();

      expect(results).toHaveLength(1);
      const [r] = results;
      expect(r.title).toBe('Robotics Funding Rises');
      expect(r.url).toBe('https://techcrunch.com/2026/08/20/robotics');
      expect(r.snippet).toBe(htmlToMarkdown('<b>Investors</b> pour capital into humanoid robotics startups.'));
      expect(r.provider).toBe('bing-search');
    });
  });

  describe('AC3: Does not persist posts, watchlist matches, or ingestion events', () => {
    it('Brave research leaves social_posts and post_watchlist_matches untouched', async () => {
      const { tenantId } = await makeTenantWithUser();
      await storeBraveCredential(tenantId);
      const restore = mockFetchBrave([
        {
          url: 'https://example.com/brave-article',
          title: 'Brave Result',
          description: 'A description.',
        },
      ]);

      await searchBraveForResearch(tenantId, 'test', 1);
      restore();

      await withTenant(tenantId, async (client) => {
        const posts = await client.query('SELECT 1 FROM social_posts WHERE tenant_id = $1', [tenantId]);
        const matches = await client.query('SELECT 1 FROM post_watchlist_matches WHERE tenant_id = $1', [tenantId]);
        expect(posts.rowCount).toBe(0);
        expect(matches.rowCount).toBe(0);
      });
    });

    it('Bing research leaves social_posts and post_watchlist_matches untouched', async () => {
      const { tenantId } = await makeTenantWithUser();
      await storeBingCredential(tenantId);
      const restore = mockFetchBing([
        {
          url: 'https://example.com/bing-article',
          name: 'Bing Result',
          snippet: 'A snippet.',
        },
      ]);

      await searchBingForResearch(tenantId, 'test', 1);
      restore();

      await withTenant(tenantId, async (client) => {
        const posts = await client.query('SELECT 1 FROM social_posts WHERE tenant_id = $1', [tenantId]);
        const matches = await client.query('SELECT 1 FROM post_watchlist_matches WHERE tenant_id = $1', [tenantId]);
        expect(posts.rowCount).toBe(0);
        expect(matches.rowCount).toBe(0);
      });
    });
  });

  describe('AC4: Consumes a tenant-scoped RequestGate key (tenantId:providerId:research)', () => {
    it('Brave acquires the research gate key with a valid rate-limit config', async () => {
      const { tenantId } = await makeTenantWithUser();
      await storeBraveCredential(tenantId);
      const acquireSpy = jest.spyOn(requestGate, 'acquire').mockResolvedValue(undefined);
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ results: [] }),
      } as Response);

      await searchBraveForResearch(tenantId, 'gate test', 5);

      expect(acquireSpy).toHaveBeenCalledWith(
        `${tenantId}:${BRAVE_SEARCH_PROVIDER_ID}:research`,
        expect.objectContaining({
          requestsPerWindow: expect.any(Number),
          windowSeconds: expect.any(Number),
        })
      );

      global.fetch = originalFetch;
      acquireSpy.mockRestore();
    });

    it('Bing acquires the research gate key with a valid rate-limit config', async () => {
      const { tenantId } = await makeTenantWithUser();
      await storeBingCredential(tenantId);
      const acquireSpy = jest.spyOn(requestGate, 'acquire').mockResolvedValue(undefined);
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ webPages: { value: [] } }),
      } as Response);

      await searchBingForResearch(tenantId, 'gate test', 5);

      expect(acquireSpy).toHaveBeenCalledWith(
        `${tenantId}:${BING_SEARCH_PROVIDER_ID}:research`,
        expect.objectContaining({
          requestsPerWindow: expect.any(Number),
          windowSeconds: expect.any(Number),
        })
      );

      global.fetch = originalFetch;
      acquireSpy.mockRestore();
    });
  });

  describe('AC5: Reclassifies credential and HTTP errors as ClassifiableError', () => {
    it('Brave throws http_401 when no credential is registered', async () => {
      const { tenantId } = await makeTenantWithUser();
      await expect(searchBraveForResearch(tenantId, 'missing credential', 1)).rejects.toThrow(
        expect.objectContaining({ kind: 'http_401' })
      );
    });

    it('Bing throws http_401 when no credential is registered', async () => {
      const { tenantId } = await makeTenantWithUser();
      await expect(searchBingForResearch(tenantId, 'missing credential', 1)).rejects.toThrow(
        expect.objectContaining({ kind: 'http_401' })
      );
    });

    it('Brave maps HTTP 401/403/429/5xx to ClassifiableError kinds', async () => {
      const { tenantId } = await makeTenantWithUser();
      await storeBraveCredential(tenantId);

      const cases = [
        { status: 401, expected: 'http_401' },
        { status: 403, expected: 'http_403' },
        { status: 429, expected: 'rate_limit' },
        { status: 503, expected: 'http_5xx' },
      ];

      for (const { status, expected } of cases) {
        const originalFetch = global.fetch;
        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          status,
          statusText: 'Test',
        } as Response);

        await expect(searchBraveForResearch(tenantId, 'error test', 1)).rejects.toThrow(
          expect.objectContaining({ kind: expected })
        );

        global.fetch = originalFetch;
        requestGate.__resetGateForTests();
      }
    });

    it('Bing maps HTTP 401/403/429/5xx to ClassifiableError kinds', async () => {
      const { tenantId } = await makeTenantWithUser();
      await storeBingCredential(tenantId);

      const cases = [
        { status: 401, expected: 'http_401' },
        { status: 403, expected: 'http_403' },
        { status: 429, expected: 'rate_limit' },
        { status: 503, expected: 'http_5xx' },
      ];

      for (const { status, expected } of cases) {
        const originalFetch = global.fetch;
        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          status,
          statusText: 'Test',
        } as Response);

        await expect(searchBingForResearch(tenantId, 'error test', 1)).rejects.toThrow(
          expect.objectContaining({ kind: expected })
        );

        global.fetch = originalFetch;
        requestGate.__resetGateForTests();
      }
    });
  });

  describe('AC6: Jest contract asserts request shape and URL canonicalization', () => {
    it('Brave request URL contains the query and count', async () => {
      const { tenantId } = await makeTenantWithUser();
      await storeBraveCredential(tenantId);
      const calls: string[] = [];
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation((input: any, _init: any) => {
        const urlStr = typeof input === 'string' ? input : input?.url ?? '';
        calls.push(urlStr);
        if (urlStr.includes('api.search.brave.com')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ results: [] }),
          } as Response);
        }
        return originalFetch(input, _init);
      });

      await searchBraveForResearch(tenantId, 'climate tech', 3);
      global.fetch = originalFetch;

      expect(calls.length).toBeGreaterThanOrEqual(1);
      const braveUrl = calls.find((u) => u.includes('api.search.brave.com'))!;
      expect(braveUrl).toContain('q=climate+tech');
      expect(braveUrl).toContain('count=3');
    });

    it('Bing request URL contains the query and count', async () => {
      const { tenantId } = await makeTenantWithUser();
      await storeBingCredential(tenantId);
      const calls: string[] = [];
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation((input: any, _init: any) => {
        const urlStr = typeof input === 'string' ? input : input?.url ?? '';
        calls.push(urlStr);
        if (urlStr.includes('api.bing.microsoft.com')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ webPages: { value: [] } }),
          } as Response);
        }
        return originalFetch(input, _init);
      });

      await searchBingForResearch(tenantId, 'climate tech', 4);
      global.fetch = originalFetch;

      expect(calls.length).toBeGreaterThanOrEqual(1);
      const bingUrl = calls.find((u) => u.includes('api.bing.microsoft.com'))!;
      expect(bingUrl).toContain('q=climate+tech');
      expect(bingUrl).toContain('count=4');
    });
  });
});
