/**
 * Contract: Story 13.12 (ADR-0116, BRD-0116, FDD-0116) — Semantic drift UI (frontend).
 * See docs/user-stories/epic-13-adr-0109-to-0117.md#story-1312
 *
 * Intent:
 *   Surface semantic drift detection on the Topic Evolution Timeline so a
 *   Topic-Center-Analyst sees a warning when a topic's meaning has shifted,
 *   inspects top clusters and sample posts from each time window, and can
 *   ask RAG for a plain-language explanation.
 *
 * Scope:
 *   - social-listening-admin/contracts/epic-13/story-13.12.semantic-drift-ui.contract.test.ts
 *   - social-listening-admin/src/lib/core-client.ts (getTopicDrift, TopicDriftResult)
 *   - social-listening-admin/src/app/api/topics/drift/route.ts (BFF proxy)
 *   - social-listening-admin/src/app/tenant/analytics/TopicEvolutionTimeline.tsx
 *   - social-listening-admin/src/app/tenant/analytics/DriftExplanationCard.tsx
 *   - social-listening-admin/.claude/skills/topic-evolution-ui/SKILL.md
 *   - social-listening-admin/.claude/skills/core-api-client/SKILL.md
 *   - social-listening-admin/.claude/skills/rag-discovery-ui/SKILL.md
 *
 * Contract to encode:
 *   (1) core-client.ts exposes getTopicDrift and a TopicDriftResult type that
 *       calls GET /v1/topics/:id/drift with start and end query parameters.
 *   (2) /api/topics/drift BFF route exists and proxies to getTopicDrift.
 *   (3) TopicEvolutionTimeline renders a drift warning icon when the backend
 *       returns warning: 'significant'.
 *   (4) DriftExplanationCard shows topClustersNow, topClustersThen, and
 *       sample posts from each window.
 *   (5) RAGAsk can generate and display a plain-language drift summary.
 *   (6) A date-range selector lets the user pick the two comparison windows
 *       and calls the drift endpoint.
 *
 * Explicitly out of scope:
 *   - Backend SemanticDriftService / GET /v1/topics/:id/drift implementation (Story 13.11).
 *   - Real embedding/clustering algorithm swaps.
 *   - Pre-computed daily drift jobs.
 */

import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

if (!process.env.CORE_API_BASE_URL) {
  process.env.CORE_API_BASE_URL = 'http://localhost:3001';
}
if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = randomBytes(32).toString('base64');
}

const fixtureDriftResult = {
  topicId: 'topic-123',
  start: '2026-08-01T00:00:00.000Z',
  end: '2026-08-31T00:00:00.000Z',
  driftScore: 0.72,
  topClustersNow: ['music', 'concert', 'tour'],
  topClustersThen: ['programming language', 'compiler', 'xcode'],
  samplePostsNow: ['Taylor Swift announced a new tour.', 'Concert tickets sold out.'],
  samplePostsThen: ['Swift 6 is coming this year.', 'The compiler is faster.'],
  warning: 'significant' as const,
};

describe('Story 13.12 — Semantic drift UI (frontend)', () => {
  afterEach(() => {
    jest.dontMock('../../src/lib/core-client');
    jest.dontMock('next/headers');
    jest.resetModules();
    jest.restoreAllMocks();
  });

  describe('AC1: core-client.ts exposes getTopicDrift with typed result', () => {
    it('exports getTopicDrift and a TopicDriftResult type', () => {
      const src = readSrc('lib', 'core-client.ts');
      expect(src).toMatch(/export\s+(?:interface|type)\s+TopicDriftResult/);
      expect(src).toMatch(/export\s+async\s+function\s+getTopicDrift\s*\(/);
      expect(src).toContain('/v1/topics/');
      expect(src).toContain('/drift?');
      expect(src).toContain('start');
      expect(src).toContain('end');
      expect(src).toContain('warning');
      expect(src).toContain('driftScore');
      expect(src).toContain('topClustersNow');
      expect(src).toContain('topClustersThen');
      expect(src).toContain('samplePostsNow');
      expect(src).toContain('samplePostsThen');
    });

    it('calls GET /v1/topics/:id/drift with start and end', async () => {
      jest.resetModules();
      const sessionModule = await import('../../src/lib/session');
      const encrypted = await sessionModule.encryptSession({
        idToken: 'x',
        accessToken: 'contract-test-access-token',
        identity: null,
      });
      jest.doMock('next/headers', () => ({
        cookies: async () => ({
          get: (name: string) =>
            name === sessionModule.SESSION_COOKIE_NAME ? { value: encrypted } : undefined,
        }),
      }));

      const fetchSpy = jest.spyOn(global, 'fetch');
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify(fixtureDriftResult), { status: 200 })
      );

      const { getTopicDrift } = await import('../../src/lib/core-client');
      const result = await getTopicDrift(
        'topic-123',
        '2026-08-01T00:00:00.000Z',
        '2026-08-31T00:00:00.000Z'
      );

      expect(fetchSpy).toHaveBeenCalled();
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toMatch(/\/v1\/topics\/topic-123\/drift/);
      expect(url).toMatch(/start=/);
      expect(url).toMatch(/end=/);

      expect(result.driftScore).toBe(0.72);
      expect(result.warning).toBe('significant');
      expect(result.topClustersNow).toContain('music');
      expect(result.samplePostsThen).toContain('Swift 6 is coming this year.');
    });
  });

  describe('AC2: BFF route /api/topics/drift proxies to getTopicDrift', () => {
    it('route exists and calls getTopicDrift with topic id, start, and end', async () => {
      const routePath = path.join(ADMIN_ROOT, 'src', 'app', 'api', 'topics', 'drift', 'route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
      const routeSrc = readSrc('app', 'api', 'topics', 'drift', 'route.ts');
      expect(routeSrc).toMatch(/getTopicDrift/);
      expect(routeSrc).toMatch(/GET/);
      expect(routeSrc).toContain('start');
      expect(routeSrc).toContain('end');

      const getTopicDriftMock = jest.fn().mockResolvedValue(fixtureDriftResult);
      jest.doMock('../../src/lib/core-client', () => ({
        getTopicDrift: getTopicDriftMock,
      }));

      const { GET } = await import('../../src/app/api/topics/drift/route');
      const request = new Request(
        'http://localhost:3000/api/topics/drift?id=topic-123&start=2026-08-01T00:00:00.000Z&end=2026-08-31T00:00:00.000Z'
      );
      const response = await GET(request as any);

      expect(getTopicDriftMock).toHaveBeenCalledWith('topic-123', '2026-08-01T00:00:00.000Z', '2026-08-31T00:00:00.000Z');
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.warning).toBe('significant');
      expect(body.topClustersNow).toEqual(['music', 'concert', 'tour']);
    });
  });

  describe('AC3: TopicEvolutionTimeline renders a drift warning icon for significant drift', () => {
    it('TopicEvolutionTimeline source contains drift warning UI and DriftExplanationCard', () => {
      const src = readSrc('app', 'tenant', 'analytics', 'TopicEvolutionTimeline.tsx');
      expect(src).toContain('DriftExplanationCard');
      expect(src).toMatch(/warning[^\n]{0,120}significant/);
      expect(src).toMatch(/significant/);
      expect(src).toMatch(/driftScore/);
      expect(src).toMatch(/['"]⚠️['"]/);
    });

    it('warning is rendered conditionally based on the drift warning value', () => {
      const src = readSrc('app', 'tenant', 'analytics', 'TopicEvolutionTimeline.tsx');
      expect(src).toMatch(/warning\s*===?\s*['"]significant['"]/);
    });
  });

  describe('AC4: DriftExplanationCard shows clusters and sample posts', () => {
    it('DriftExplanationCard source renders topClustersNow, topClustersThen, samplePostsNow, samplePostsThen', () => {
      const cardPath = path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'analytics', 'DriftExplanationCard.tsx');
      expect(fs.existsSync(cardPath)).toBe(true);
      const src = readSrc('app', 'tenant', 'analytics', 'DriftExplanationCard.tsx');
      expect(src).toContain('topClustersNow');
      expect(src).toContain('topClustersThen');
      expect(src).toContain('samplePostsNow');
      expect(src).toContain('samplePostsThen');
    });

    it('DriftExplanationCard accepts a TopicDriftResult prop', () => {
      const src = readSrc('app', 'tenant', 'analytics', 'DriftExplanationCard.tsx');
      expect(src).toMatch(/interface\s+DriftExplanationCardProps/);
      expect(src).toMatch(/drift\??:\s*TopicDriftResult/);
    });
  });

  describe('AC5: RAGAsk can generate a plain-language drift summary', () => {
    it('DriftExplanationCard calls /api/rag/ask to summarize drift', () => {
      const src = readSrc('app', 'tenant', 'analytics', 'DriftExplanationCard.tsx');
      expect(src).toMatch(/\/api\/rag\/ask/);
      expect(src).toMatch(/question/);
      expect(src).toMatch(/drift/);
      expect(src).toMatch(/setSummary|setDriftSummary/);
    });

    it('the summary prompt includes clusters from both windows', () => {
      const src = readSrc('app', 'tenant', 'analytics', 'DriftExplanationCard.tsx');
      expect(src).toMatch(/topClustersNow/);
      expect(src).toMatch(/topClustersThen/);
      expect(src).toMatch(/join\(|\.map\(/);
    });
  });

  describe('AC6: Date range selector for the two windows', () => {
    it('TopicEvolutionTimeline has start and end date inputs', () => {
      const src = readSrc('app', 'tenant', 'analytics', 'TopicEvolutionTimeline.tsx');
      expect(src).toMatch(/type\s*=\s*['"]date['"]/);
      expect(src).toMatch(/start.*date|date.*start/);
      expect(src).toMatch(/end.*date|date.*end/);
    });

    it('selecting a date range fetches /api/topics/drift', () => {
      const src = readSrc('app', 'tenant', 'analytics', 'TopicEvolutionTimeline.tsx');
      expect(src).toMatch(/\/api\/topics\/drift/);
      expect(src).toMatch(/fetch\(/);
      expect(src).toMatch(/setDrift/);
    });
  });
});
