// Contract: Story 2.27 (ADR-0073) — Facebook Page Reply Implementation
// See docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md#story-227--facebook-page-reply-implementation
//
// Intent: Story 2.27 — Facebook Page Reply Implementation (ADR-0073)
// Scope: src/connectors/facebook/facebookConnector.ts, .claude/skills/facebook-connector/SKILL.md
// Contract to encode: (1) facebookConnector implements reply?() using the stored
// Page access token; (2) reply() calls POST /{post-id}/comments with `message`
// and the Page token; (3) response maps to externalId and an externalUrl of the
// form `https://www.facebook.com/{post-id}/?comment_id={externalId}`; (4) Meta
// error codes are reclassified: 190/10 -> reconnect_required, permission-denied /
// insufficient scope -> missing_permission, 4/17/32/80000 -> rate_limited,
// 803 -> post_not_found; (5) pollFacebook() and normalize() are unaffected;
// (6) outboundEngagementService.invoke() exercises the real production call site.
// Explicitly out of scope: Instagram/LinkedIn replies, public/third-party posts,
// media/attachment replies, scheduled replies.

import { facebookConnector } from '../../src/connectors/facebook/facebookConnector';
import { pollFacebook } from '../../src/connectors/facebook/pollFacebook';
import { ClassifiableError } from '../../src/ingestion/errorClassification';
import { invoke } from '../../src/outbound/outboundEngagementService';
import { __resetGateForTests } from '../../src/connectors/requestGate';
import { SocialPostSummary } from '../../src/posts/socialPostStore';

beforeEach(() => {
  __resetGateForTests();
});

afterEach(() => {
  jest.restoreAllMocks();
});

const credential = JSON.stringify({
  pageId: '111',
  pageAccessToken: 'page-token-abc',
  pageName: 'Test Page',
});

const post: SocialPostSummary = {
  id: 'p1',
  createdAt: '2024-01-01T00:00:00Z',
  publishedAt: '2024-01-01T00:00:00Z',
  rawPayload: { id: '111_222', pageId: '111' },
  enrichment: {},
  bodyMarkdown: 'Hello',
};

function mockJsonResponse(status: number, body: Record<string, unknown>): { ok: boolean; status: number; json: () => Promise<Record<string, unknown>> } {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe('Story 2.27 — facebook page reply implementation', () => {
  it('AC1/2: facebookConnector.reply calls POST /{post-id}/comments and returns externalId/externalUrl', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse(200, { id: '111_222_333' }) as unknown as Response
    );

    const result = await facebookConnector.reply!(post, 'Great post!', credential);

    expect(result.externalId).toBe('111_222_333');
    expect(result.externalUrl).toBe('https://www.facebook.com/111_222/?comment_id=111_222_333');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [url, init] = fetchSpy.mock.calls[0] as [string, { method?: string; body?: URLSearchParams | string }];
    expect(url).toMatch(/\/111_222\/comments/);
    expect(url).toMatch(/access_token=page-token-abc/);
    expect(init.method).toBe('POST');
    const sentBody = new URLSearchParams(init.body?.toString() ?? '');
    expect(sentBody.get('message')).toBe('Great post!');
  });

  it('AC2: outboundEngagementService.invoke() exercises the real facebookConnector.reply call site', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse(200, { id: '111_222_444' }) as unknown as Response
    );

    const result = await invoke({
      tenantId: 't1',
      userId: 'u1',
      post,
      body: 'Nice!',
      credential,
      connector: facebookConnector,
    });

    expect(result.status).toBe('sent');
    expect(result.externalId).toBe('111_222_444');
    expect(result.errorCode).toBeNull();
  });

  it('AC3: Meta error code 190 maps to reconnect_required', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse(200, { error: { code: 190, message: 'Invalid OAuth 2.0 access token', type: 'OAuthException' } }) as unknown as Response
    );

    await expect(facebookConnector.reply!(post, 'Great post!', credential)).rejects.toThrow(ClassifiableError);
    try {
      await facebookConnector.reply!(post, 'Great post!', credential);
    } catch (err) {
      expect(err).toBeInstanceOf(ClassifiableError);
      expect((err as ClassifiableError).kind).toBe('reconnect_required');
    }
  });

  it('AC3: Meta error code 10 maps to reconnect_required', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse(200, { error: { code: 10, message: 'Permission is required', type: 'OAuthException' } }) as unknown as Response
    );

    try {
      await facebookConnector.reply!(post, 'Great post!', credential);
    } catch (err) {
      expect(err).toBeInstanceOf(ClassifiableError);
      expect((err as ClassifiableError).kind).toBe('reconnect_required');
    }
  });

  it('AC3: Meta permission-denied / insufficient scope maps to missing_permission', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse(200, { error: { code: 200, message: 'Permissions error', type: 'OAuthException' } }) as unknown as Response
    );

    try {
      await facebookConnector.reply!(post, 'Great post!', credential);
    } catch (err) {
      expect(err).toBeInstanceOf(ClassifiableError);
      expect((err as ClassifiableError).kind).toBe('missing_permission');
    }
  });

  it('AC3: Meta error code 803 maps to post_not_found', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse(200, { error: { code: 803, message: 'Some of the aliases you requested do not exist', type: 'OAuthException' } }) as unknown as Response
    );

    try {
      await facebookConnector.reply!(post, 'Great post!', credential);
    } catch (err) {
      expect(err).toBeInstanceOf(ClassifiableError);
      expect((err as ClassifiableError).kind).toBe('post_not_found');
    }
  });

  it('AC3: Meta error codes 4, 17, 32, 80000 map to rate_limited', async () => {
    for (const code of [4, 17, 32, 80000]) {
      jest.restoreAllMocks();
      jest.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockJsonResponse(200, { error: { code, message: 'Too many calls', type: 'OAuthException' } }) as unknown as Response
      );

      try {
        await facebookConnector.reply!(post, 'Great post!', credential);
      } catch (err) {
        expect(err).toBeInstanceOf(ClassifiableError);
        expect((err as ClassifiableError).kind).toBe('rate_limited');
      }
    }
  });

  it('AC4: missing permission is returned cleanly so the UI can prompt to reconnect', async () => {
    const missingScopeResponse = { error: { code: 200, message: 'Insufficient scope: pages_manage_engagement', type: 'OAuthException' } };
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse(200, missingScopeResponse) as unknown as Response
    );

    try {
      await facebookConnector.reply!(post, 'Great post!', credential);
    } catch (err) {
      expect(err).toBeInstanceOf(ClassifiableError);
      expect((err as ClassifiableError).kind).toBe('missing_permission');
    }
  });

  it('AC5: pollFacebook and normalize are unchanged', () => {
    expect(typeof pollFacebook).toBe('function');
    const normalized = facebookConnector.normalize({
      id: '111_222',
      message: 'Hello',
      created_time: '2024-01-01T00:00:00Z',
      pageId: '111',
    });
    expect(normalized.externalId).toBe('111_222');
    expect(normalized.authorExternalId).toBe('111');
  });
});
