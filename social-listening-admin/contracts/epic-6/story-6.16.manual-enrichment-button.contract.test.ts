/**
 * Contract: Story 6.16 — Manual "run enrichment now" button on the post
 * detail screen.
 * See docs/user-stories/epic-6-tenant-admin-ui.md#story-616--manual-run-enrichment-now-button-on-the-post-detail-screen
 *
 * Intent: Story 6.16 (frontend half) — a button on /tenant/posts/:id
 * Scope: social-listening-admin/{src/lib/core-client.ts (extended —
 *   runPostEnrichment()), src/app/api/posts/[id]/enrich/route.ts (new),
 *   src/app/tenant/posts/RunEnrichmentButton.tsx (new),
 *   src/app/tenant/posts/[id]/page.tsx (extended)}.
 *
 * Contract to encode: the detail screen renders `RunEnrichmentButton` only
 *   when `post.enrichment` is currently `null` — never for an
 *   already-enriched post. Clicking it calls the real, new
 *   `POST /v1/posts/:id/enrich` (social-listening-core, Story 6.16 backend
 *   half) via a same-origin proxy route, mirroring every other Client-
 *   Component-triggered action in this app (`ActivateDeactivateButton`'s
 *   own raw `{status, body}` pattern, same-origin proxy, `core-client.ts`
 *   as the sole bearer-token choke point). A `200` response with a real
 *   `enrichment` value reloads the page to show it (Story 6.11's own
 *   already-established enrichment layout); a `200` with `enrichment: null`
 *   (the real, honest "no AI provider is currently connected and active"
 *   outcome the backend contract already proves) shows that specific
 *   message, not a generic error.
 *
 * Explicitly out of scope for this contract:
 *   - Re-proving POST /v1/posts/:id/enrich's own backend behavior (text
 *     derivation, real enrichPost() call, persistence) — the backend's own
 *     contract (social-listening-core/contracts/epic-3/
 *     story-6.16...contract.test.ts) already proves that; this contract
 *     only proves the admin UI calls it correctly and reacts to what it
 *     returns.
 *   - Re-enrichment of an already-enriched post — the button is
 *     structurally never rendered for one (this story's own AC), not
 *     merely hidden by a disabled state.
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');
const detailPagePath = ['app', 'tenant', 'posts', '[id]', 'page.tsx'];
const buttonPath = ['app', 'tenant', 'posts', 'RunEnrichmentButton.tsx'];

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

const TENANT_USER = { type: 'tenant_user' as const, tenantId: 't-1', userId: 'u-1', role: 'tenant_user' as const };

async function renderDetailPageAs(fetchImpl: (url: string) => Response) {
  jest.resetModules();
  const sessionModule = await import('../../src/lib/session');
  const encrypted = await sessionModule.encryptSession({ idToken: 'x', accessToken: 'y', identity: TENANT_USER });

  jest.doMock('next/headers', () => ({
    cookies: async () => ({
      get: (name: string) => (name === sessionModule.SESSION_COOKIE_NAME ? { value: encrypted } : undefined),
    }),
  }));
  jest.doMock('next/navigation', () => ({
    redirect: jest.fn((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    }),
  }));
  jest.spyOn(global, 'fetch').mockImplementation(async (input: RequestInfo | URL) => fetchImpl(String(input)));

  const { default: Page } = await import('../../src/app/tenant/posts/[id]/page');
  return Page;
}

afterEach(() => {
  jest.dontMock('next/headers');
  jest.dontMock('next/navigation');
  jest.resetModules();
  jest.restoreAllMocks();
});

const UNENRICHED_POST = {
  id: 'p-1',
  createdAt: '2026-08-12T09:00:00.000Z',
  publishedAt: '2026-08-12T08:00:00.000Z',
  enrichment: null,
  authorId: null,
  acquisitionId: 'run-1',
  rawPayload: { providerId: 'newswire', title: 'A post with no enrichment yet' },
};

const ENRICHED_POST = {
  ...UNENRICHED_POST,
  enrichment: { sentiment: 'positive', keyPhrases: ['x'], entities: [], modelUsed: 'azure-ai-language:2025-01-01' },
};

describe('Story 6.16 — Manual "run enrichment now" button', () => {
  describe('AC4: the button renders only when post.enrichment is currently null', () => {
    it('creates RunEnrichmentButton.tsx and imports it in the detail page', () => {
      expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', ...buttonPath))).toBe(true);
      const source = readSrc(...detailPagePath);
      expect(source).toContain('RunEnrichmentButton');
    });

    // RunEnrichmentButton is a Client Component — a Server Component's own
    // Page() call returns an *unrendered* element reference for it (its own
    // JSX, including the "Run enrichment now" text, only exists once React
    // actually renders that boundary, which this test doesn't cross). The
    // real, serializable signal available here is whether the element
    // (carrying the real postId prop) is present in the tree at all.
    it('includes RunEnrichmentButton (with the real postId prop) for a post with enrichment: null', async () => {
      const Page = await renderDetailPageAs(() => new Response(JSON.stringify(UNENRICHED_POST), { status: 200 }));
      const element = await Page({ params: Promise.resolve({ id: 'p-1' }) });
      const rendered = JSON.stringify(element);
      expect(rendered).toContain('"postId":"p-1"');
    });

    it('omits RunEnrichmentButton entirely for a real, already-enriched post', async () => {
      const Page = await renderDetailPageAs(() => new Response(JSON.stringify(ENRICHED_POST), { status: 200 }));
      const element = await Page({ params: Promise.resolve({ id: 'p-1' }) });
      const rendered = JSON.stringify(element);
      expect(rendered).not.toContain('"postId"');
    });
  });

  describe('AC1: core-client.ts runPostEnrichment() and the same-origin proxy route', () => {
    it('runPostEnrichment() POSTs /v1/posts/:id/enrich with the session bearer token and returns the raw status/body', async () => {
      jest.resetModules();
      const sessionModule = await import('../../src/lib/session');
      const encrypted = await sessionModule.encryptSession({ idToken: 'x', accessToken: 'contract-test-token', identity: null });
      jest.doMock('next/headers', () => ({
        cookies: async () => ({
          get: (name: string) => (name === sessionModule.SESSION_COOKIE_NAME ? { value: encrypted } : undefined),
        }),
      }));
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(new Response(JSON.stringify(ENRICHED_POST), { status: 200 }));

      const { runPostEnrichment } = await import('../../src/lib/core-client');
      const outcome = await runPostEnrichment('p-1');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/v1/posts/p-1/enrich'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer contract-test-token' }),
        })
      );
      expect(outcome.status).toBe(200);
      expect((outcome.body as typeof ENRICHED_POST).enrichment?.modelUsed).toBe('azure-ai-language:2025-01-01');
    });

    it('the proxy route forwards runPostEnrichment()\'s raw status/body unchanged', () => {
      const source = fs.readFileSync(
        path.join(ADMIN_ROOT, 'src', 'app', 'api', 'posts', '[id]', 'enrich', 'route.ts'),
        'utf8'
      );
      expect(source).toContain('runPostEnrichment');
      expect(source).toMatch(/outcome\.status/);
    });
  });

  describe('AC5: the button reacts correctly to both real outcomes — a real result, and the honest "no provider" case', () => {
    it('RunEnrichmentButton.tsx shows a specific message when the response has enrichment: null, not a generic error', () => {
      const source = readSrc(...buttonPath);
      expect(source.toLowerCase()).toMatch(/no ai provider/);
    });

    it('RunEnrichmentButton.tsx reloads on a real, non-null enrichment result', () => {
      const source = readSrc(...buttonPath);
      expect(source).toMatch(/window\.location\.reload/);
    });
  });

  describe('core-client.ts stays the sole Bearer-attachment choke point (re-checked after this story\'s additions)', () => {
    it('no second ad hoc fetch-with-Authorization-header call exists anywhere else in src/', () => {
      const offenders: string[] = [];
      const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(full);
            continue;
          }
          if (!full.endsWith('.ts') && !full.endsWith('.tsx')) continue;
          if (full === path.join(ADMIN_ROOT, 'src', 'lib', 'core-client.ts')) continue;
          const content = fs.readFileSync(full, 'utf8');
          if (/Authorization/.test(content) && /fetch\(/.test(content)) {
            offenders.push(full);
          }
        }
      };
      walk(path.join(ADMIN_ROOT, 'src'));
      expect(offenders).toEqual([]);
    });
  });

  it('documents this addition in the post-feed component SKILL.md', () => {
    const skillPath = path.join(ADMIN_ROOT, '.claude', 'skills', 'post-feed', 'SKILL.md');
    expect(fs.existsSync(skillPath)).toBe(true);
    const skillSource = fs.readFileSync(skillPath, 'utf8');
    expect(skillSource).toContain('RunEnrichmentButton');
  });
});
