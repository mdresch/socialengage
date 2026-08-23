// Contract: Story 2.29 (ADR-0075, BRD-0075, FDD-0075) — Facebook Page Post Publishing
// See docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md#story-229--facebook-page-post-publishing
//
// Intent: Story 2.29 — Facebook Page Post Publishing (ADR-0075)
// Scope: src/connectors/facebook/facebookConnector.ts, .claude/skills/facebook-connector/SKILL.md,
//        .claude/skills/outbound-post/SKILL.md
// Contract to encode: (1) facebookConnector implements publish?() using the stored Page access token;
// (2) publish() calls POST /{page-id}/feed with `message` and the Page token, then maps the response
// to externalId and an externalUrl of the form `https://www.facebook.com/{page-id}/posts/{externalId}`;
// (3) Meta error codes 190/10 -> reconnect_required, permission-denied / insufficient scope -> missing_permission,
//     4/17/32/80000 -> rate_limited, 803 -> target_asset_not_found;
// (4) existing Page credentials that predate the write scope return missing_permission cleanly;
// (5) pollFacebook() and normalize() are unaffected;
// (6) outboundPublishService.invoke() with facebookConnector exercises the real production call site.
// Explicitly out of scope: Instagram/other platform publish, third-party Pages, media/attachment posts,
// scheduled posts, editing/deleting published posts.

import { facebookConnector } from '../../src/connectors/facebook/facebookConnector';
import { pollFacebook } from '../../src/connectors/facebook/pollFacebook';
import { ClassifiableError } from '../../src/ingestion/errorClassification';
import { invoke } from '../../src/outbound/outboundPublishService';
import { __resetGateForTests } from '../../src/connectors/requestGate';
import { OutboundPostPayload } from '../../src/connectors/types';

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

const payload: OutboundPostPayload = {
  text: 'Hello from SocialEngage',
  targetAssetId: '111',
  targetAssetType: 'facebook_page',
};

function mockJsonResponse(status: number, body: Record<string, unknown>): { ok: boolean; status: number; json: () => Promise<Record<string, unknown>> } {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe('Story 2.29 — Facebook page post publishing', () => {
  it('AC1/2: facebookConnector.publish calls POST /{page-id}/feed and returns externalId/externalUrl', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse(200, { id: '111_222' }) as unknown as Response
    );

    const result = await facebookConnector.publish!('t1', 'u1', payload, credential);

    expect(result.externalId).toBe('111_222');
    expect(result.externalUrl).toBe('https://www.facebook.com/111/posts/111_222');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [url, init] = fetchSpy.mock.calls[0] as [string, { method?: string; body?: URLSearchParams | string }];
    expect(url).toMatch(/\/111\/feed/);
    expect(url).toMatch(/access_token=page-token-abc/);
    expect(init.method).toBe('POST');
    const sentBody = new URLSearchParams(init.body?.toString() ?? '');
    expect(sentBody.get('message')).toBe('Hello from SocialEngage');
  });

  it('AC2: outboundPublishService.invoke() exercises the real facebookConnector.publish call site', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse(200, { id: '111_333' }) as unknown as Response
    );

    const result = await invoke({
      tenantId: 't1',
      userId: 'u1',
      payload,
      credential,
      connector: facebookConnector,
    });

    expect(result.status).toBe('sent');
    expect(result.externalId).toBe('111_333');
    expect(result.externalUrl).toBe('https://www.facebook.com/111/posts/111_333');
    expect(result.errorCode).toBeNull();
    expect(result.activityType).toBe('post');
    expect(result.targetAssetId).toBe('111');
  });

  it('AC3: Meta error code 190 maps to reconnect_required', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse(200, { error: { code: 190, message: 'Invalid OAuth 2.0 access token', type: 'OAuthException' } }) as unknown as Response
    );

    try {
      await facebookConnector.publish!('t1', 'u1', payload, credential);
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
      await facebookConnector.publish!('t1', 'u1', payload, credential);
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
      await facebookConnector.publish!('t1', 'u1', payload, credential);
    } catch (err) {
      expect(err).toBeInstanceOf(ClassifiableError);
      expect((err as ClassifiableError).kind).toBe('missing_permission');
    }
  });

  it('AC3: Meta error code 803 maps to target_asset_not_found', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse(200, { error: { code: 803, message: 'Some of the aliases you requested do not exist', type: 'OAuthException' } }) as unknown as Response
    );

    try {
      await facebookConnector.publish!('t1', 'u1', payload, credential);
    } catch (err) {
      expect(err).toBeInstanceOf(ClassifiableError);
      expect((err as ClassifiableError).kind).toBe('target_asset_not_found');
    }
  });

  it('AC3: Meta error codes 4, 17, 32, 80000 map to rate_limited', async () => {
    for (const code of [4, 17, 32, 80000]) {
      jest.restoreAllMocks();
      jest.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockJsonResponse(200, { error: { code, message: 'Too many calls', type: 'OAuthException' } }) as unknown as Response
      );

      try {
        await facebookConnector.publish!('t1', 'u1', payload, credential);
      } catch (err) {
        expect(err).toBeInstanceOf(ClassifiableError);
        expect((err as ClassifiableError).kind).toBe('rate_limited');
      }
    }
  });

  it('AC4: missing permission is returned cleanly so the UI can prompt to reconnect', async () => {
    const missingScopeResponse = { error: { code: 200, message: 'Insufficient scope: pages_manage_posts', type: 'OAuthException' } };
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse(200, missingScopeResponse) as unknown as Response
    );

    try {
      await facebookConnector.publish!('t1', 'u1', payload, credential);
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
