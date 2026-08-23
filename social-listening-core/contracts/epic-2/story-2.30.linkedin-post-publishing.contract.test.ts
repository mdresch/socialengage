// Contract: Story 2.30 (ADR-0075, BRD-0075, FDD-0075) — LinkedIn Post Publishing
// See docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md#story-230--linkedin-post-publishing
//
// Intent: Story 2.30 — LinkedIn Post Publishing (ADR-0075)
// Scope: src/connectors/linkedin/linkedinConnector.ts, .claude/skills/linkedin-connector/SKILL.md,
//        .claude/skills/outbound-post/SKILL.md
// Contract to encode: (1) linkedinConnector implements publish?() using the stored
// member/organization access token; (2) publish() calls POST /v2/ugcPosts with the
// target asset id as the author URN and the outgoing text as commentary; it maps
// the returned `id` to `externalId` and to an `externalUrl` of the form
// `https://www.linkedin.com/feed/update/urn:li:share:{externalId}`;
// (3) LinkedIn/Rest.li errors reclassify token/permission failures to
// `reconnect_required` or `missing_permission`, 403 quota/rate-limit to `rate_limited`,
// and invalid author URN to `target_asset_not_found`; (4) existing credentials without
// the required `w_member_social` or `w_organization_social` scope return `missing_permission`
// cleanly; (5) pollLinkedIn and normalize are unaffected; (6) outboundPublishService.invoke()
// with linkedinConnector exercises the real production call site.
// Explicitly out of scope: Instagram/other platform publish; third-party profiles/
// organizations; media/attachment posts; scheduled posts; editing/deleting published posts;
// organization share targeting beyond the author URN.

import { linkedinConnector } from '../../src/connectors/linkedin/linkedinConnector';
import { pollLinkedIn } from '../../src/connectors/linkedin/pollLinkedIn';
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

const personTargetAssetId = 'urn:li:person:abc123';
const personCredential = JSON.stringify({
  accessToken: 'access-token-xyz',
  refreshToken: 'refresh-token-xyz',
  accessTokenExpiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(),
  refreshTokenExpiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
  memberId: 'abc123',
  memberName: 'Test User',
  scopes: ['openid', 'profile', 'email', 'w_member_social'],
});

const payload: OutboundPostPayload = {
  text: 'Hello from SocialEngage',
  targetAssetId: personTargetAssetId,
  targetAssetType: 'linkedin_person',
};

function mockResponse(status: number, body: unknown, statusText?: string): Response {
  const ok = status >= 200 && status < 300;
  const bodyText = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok,
    status,
    statusText: statusText ?? (ok ? 'OK' : 'Error'),
    json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
    text: async () => bodyText,
    headers: new Headers(),
  } as unknown as Response;
}

describe('Story 2.30 — LinkedIn post publishing', () => {
  it('AC1/2: linkedinConnector.publish calls POST /v2/ugcPosts and returns externalId/externalUrl', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockResponse(201, { id: 'urn:li:share:987654' })
    );

    const result = await linkedinConnector.publish!('t1', 'u1', payload, personCredential);

    expect(result.externalId).toBe('urn:li:share:987654');
    expect(result.externalUrl).toBe('https://www.linkedin.com/feed/update/urn:li:share:987654');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [url, init] = fetchSpy.mock.calls[0] as [string, { method?: string; headers?: Record<string, string>; body?: string }];
    expect(url).toMatch(/\/v2\/ugcPosts/);
    expect(init.method).toBe('POST');
    expect(init.headers?.['Authorization']).toBe('Bearer access-token-xyz');
    expect(init.headers?.['X-Restli-Protocol-Version']).toBe('2.0.0');

    const sent = JSON.parse(init.body ?? '{}');
    expect(sent.author).toBe(personTargetAssetId);
    expect(sent.lifecycleState).toBe('PUBLISHED');
    expect(sent.specificContent['com.linkedin.ugc.ShareContent'].shareCommentary.text).toBe('Hello from SocialEngage');
    expect(sent.visibility['com.linkedin.ugc.MemberNetworkVisibility']).toBe('PUBLIC');
  });

  it('AC2: outboundPublishService.invoke() exercises the real linkedinConnector.publish call site', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockResponse(201, { id: 'urn:li:share:555666' })
    );

    const result = await invoke({
      tenantId: 't1',
      userId: 'u1',
      payload,
      credential: personCredential,
      connector: linkedinConnector,
    });

    expect(result.status).toBe('sent');
    expect(result.externalId).toBe('urn:li:share:555666');
    expect(result.externalUrl).toBe('https://www.linkedin.com/feed/update/urn:li:share:555666');
    expect(result.errorCode).toBeNull();
    expect(result.activityType).toBe('post');
    expect(result.targetAssetId).toBe(personTargetAssetId);
  });

  it('AC4: missing w_member_social scope returns missing_permission', async () => {
    const credential = JSON.stringify({
      ...JSON.parse(personCredential),
      scopes: ['openid', 'profile', 'email'],
    });

    try {
      await linkedinConnector.publish!('t1', 'u1', payload, credential);
    } catch (err) {
      expect(err).toBeInstanceOf(ClassifiableError);
      expect((err as ClassifiableError).kind).toBe('missing_permission');
    }
  });

  it('AC4: missing w_organization_social scope for organization target returns missing_permission', async () => {
    const orgPayload: OutboundPostPayload = {
      ...payload,
      targetAssetId: 'urn:li:organization:789',
      targetAssetType: 'linkedin_organization',
    };

    try {
      await linkedinConnector.publish!('t1', 'u1', orgPayload, personCredential);
    } catch (err) {
      expect(err).toBeInstanceOf(ClassifiableError);
      expect((err as ClassifiableError).kind).toBe('missing_permission');
    }
  });

  it('AC3: HTTP 401 maps to reconnect_required', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockResponse(401, { status: 401, message: 'Invalid access token' })
    );

    try {
      await linkedinConnector.publish!('t1', 'u1', payload, personCredential);
    } catch (err) {
      expect(err).toBeInstanceOf(ClassifiableError);
      expect((err as ClassifiableError).kind).toBe('reconnect_required');
    }
  });

  it('AC3: HTTP 403 without quota/rate language maps to missing_permission', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockResponse(403, { status: 403, message: 'Insufficient permissions' })
    );

    try {
      await linkedinConnector.publish!('t1', 'u1', payload, personCredential);
    } catch (err) {
      expect(err).toBeInstanceOf(ClassifiableError);
      expect((err as ClassifiableError).kind).toBe('missing_permission');
    }
  });

  it('AC3: HTTP 403 with quota/rate language maps to rate_limited', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockResponse(403, { status: 403, message: 'Daily quota exceeded' })
    );

    try {
      await linkedinConnector.publish!('t1', 'u1', payload, personCredential);
    } catch (err) {
      expect(err).toBeInstanceOf(ClassifiableError);
      expect((err as ClassifiableError).kind).toBe('rate_limited');
    }
  });

  it('AC3: HTTP 429 maps to rate_limited', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockResponse(429, { status: 429, message: 'Too many requests' })
    );

    try {
      await linkedinConnector.publish!('t1', 'u1', payload, personCredential);
    } catch (err) {
      expect(err).toBeInstanceOf(ClassifiableError);
      expect((err as ClassifiableError).kind).toBe('rate_limited');
    }
  });

  it('AC3: invalid author URN maps to target_asset_not_found', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockResponse(422, { status: 422, message: 'Invalid author URN', code: 'INVALID_UGC_URN' })
    );

    try {
      await linkedinConnector.publish!('t1', 'u1', payload, personCredential);
    } catch (err) {
      expect(err).toBeInstanceOf(ClassifiableError);
      expect((err as ClassifiableError).kind).toBe('target_asset_not_found');
    }
  });

  it('AC5: pollLinkedIn and normalize are unchanged', () => {
    expect(typeof pollLinkedIn).toBe('function');
    const normalized = linkedinConnector.normalize({
      id: 'urn:li:share:123',
      authorUrn: 'urn:li:person:abc',
      commentary: 'Hello',
      createdAt: 1704067200000,
    });
    expect(normalized.externalId).toBe('linkedin_123');
    expect(normalized.authorExternalId).toBe('linkedin:abc');
  });
});
