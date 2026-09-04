// Contract: Story 14.1 (ADR-0118, BRD-0118, FDD-0118) — Additional social platform publishing roadmap (backend)
// See docs/user-stories/epic-14-adr-0118-to-0122.md#story-141--additional-social-platform-publishing-roadmap-backend
//
// Intent: Story 14.1 — Additional social platform publishing roadmap (backend) (ADR-0118)
// Scope: src/publishing/additionalPublishingRoadmap.ts,
//        contracts/epic-14/story-14.1.additional-social-platform-publishing-roadmap.contract.test.ts,
//        .claude/skills/additional-publishing-roadmap/SKILL.md
// Contract to encode:
// (1) AC1: The build order is explicitly sequenced: Mastodon -> Bluesky -> Instagram -> Threads -> X/Twitter,
//     following Wave 1 (Facebook [Story 2.29] and LinkedIn [Story 2.30]);
// (2) AC2: Each platform's publish implementation reuses the outbound_activities table and
//     SocialConnector.publish?() contract from ADR-0075;
// (3) AC3: Each platform uses RequestGate with key (tenantId, providerId, 'outbound_post'),
//     distinct from ingestion and research gates;
// (4) AC4: Each platform requires a Tier-3 (user-bound) credential (owner_type = 'user')
//     under ADR-0028/ADR-0014;
// (5) AC5: v1 publish() for each platform supports text and link-card only; image/video
//     media upload is explicitly out of scope (deferred to ADR-0115);
// (6) AC6: No per-platform implementation begins without a separate, primary-source-verified,
//     accepted ADR for that platform (per ADR-0048 and ADR-0027);
// (7) AC7: X/Twitter requires an explicit economic re-evaluation barrier before building
//     due to API cost and review barriers.
// Explicitly out of scope:
// - Implementation of per-platform connector write paths (Mastodon, Bluesky, Instagram, Threads, X)
//   which are deferred to separate accepted ADRs per AC6;
// - Ingestion, polling, or public reply methods (SocialConnector.poll/reply) for these platforms;
// - Image/video media upload pipeline in v1 (governed by ADR-0115);
// - Frontend Polypost Composer UI changes (Wave 2 publishing UI).

import {
  WAVE_1_PUBLISHING_PLATFORMS,
  ADDITIONAL_PUBLISHING_BUILD_ORDER,
  ALL_PUBLISHING_PLATFORMS_SEQUENCE,
  AdditionalPublishingPlatform,
  getPublishingBuildOrder,
  getFullPublishingSequence,
  getPlatformRoadmapSpec,
  getOutboundGateKey,
  validatePublishingPrerequisites,
  validatePublishingCredentialTier,
  isContentTypeSupportedInV1,
  isMediaUploadDeferred,
  assertPlatformReadyForImplementation,
  PlatformRoadmapSpec,
} from '../../src/publishing/additionalPublishingRoadmap';
import { SocialConnector, OutboundPostPayload } from '../../src/connectors/types';
import {
  acquireForOutboundPost,
  outboundPostKey,
  __resetGateForTests,
} from '../../src/connectors/requestGate';
import { invoke } from '../../src/outbound/outboundPublishService';
import { withTenant } from '../../src/db/withTenant';

describe('Story 14.1 — Additional social platform publishing roadmap (backend)', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    __resetGateForTests();
  });

  describe('AC1: Build order sequencing', () => {
    it('documents build order: Mastodon -> Bluesky -> Instagram -> Threads -> X/Twitter after Wave 1', () => {
      expect(WAVE_1_PUBLISHING_PLATFORMS).toEqual(['facebook', 'linkedin']);
      expect(ADDITIONAL_PUBLISHING_BUILD_ORDER).toEqual([
        'mastodon',
        'bluesky',
        'instagram',
        'threads',
        'twitter',
      ]);

      const sequence = getFullPublishingSequence();
      expect(sequence).toEqual([
        'facebook',
        'linkedin',
        'mastodon',
        'bluesky',
        'instagram',
        'threads',
        'twitter',
      ]);
    });

    it('getPublishingBuildOrder returns immutable array of Wave 2 platforms in exact order', () => {
      const order = getPublishingBuildOrder();
      expect(order).toEqual(['mastodon', 'bluesky', 'instagram', 'threads', 'twitter']);

      const mastodonIdx = order.indexOf('mastodon');
      const blueskyIdx = order.indexOf('bluesky');
      const instagramIdx = order.indexOf('instagram');
      const threadsIdx = order.indexOf('threads');
      const twitterIdx = order.indexOf('twitter');

      expect(mastodonIdx).toBe(0);
      expect(blueskyIdx).toBe(1);
      expect(instagramIdx).toBe(2);
      expect(threadsIdx).toBe(3);
      expect(twitterIdx).toBe(4);

      expect(mastodonIdx).toBeLessThan(blueskyIdx);
      expect(blueskyIdx).toBeLessThan(instagramIdx);
      expect(instagramIdx).toBeLessThan(threadsIdx);
      expect(threadsIdx).toBeLessThan(twitterIdx);
    });

    it('specifies prerequisites: Facebook and LinkedIn must precede any Wave 2 platform', () => {
      for (const platform of ADDITIONAL_PUBLISHING_BUILD_ORDER) {
        const spec = getPlatformRoadmapSpec(platform);
        expect(spec.prerequisiteWave1).toContain('facebook');
        expect(spec.prerequisiteWave1).toContain('linkedin');
      }
    });
  });

  describe('AC2: Reuse outbound_activities and SocialConnector.publish?()', () => {
    it('declares that all roadmap platforms reuse outbound_activities table and SocialConnector.publish?()', () => {
      for (const platform of ADDITIONAL_PUBLISHING_BUILD_ORDER) {
        const spec = getPlatformRoadmapSpec(platform);
        expect(spec.reusedTable).toBe('outbound_activities');
        expect(spec.connectorPublishMethod).toBe('SocialConnector.publish?()');
      }
    });

    it('verifies that outbound_activities table in Postgres has required columns for post publishing', async () => {
      await withTenant(tenantId, async (client) => {
        const { rows } = await client.query<{ column_name: string; data_type: string }>(
          `SELECT column_name, data_type 
           FROM information_schema.columns 
           WHERE table_name = 'outbound_activities'
           ORDER BY ordinal_position`
        );
        const columnNames = rows.map((r) => r.column_name);

        expect(columnNames).toContain('id');
        expect(columnNames).toContain('tenant_id');
        expect(columnNames).toContain('user_id');
        expect(columnNames).toContain('provider_id');
        expect(columnNames).toContain('activity_type');
        expect(columnNames).toContain('body');
        expect(columnNames).toContain('status');
        expect(columnNames).toContain('target_asset_id');
        expect(columnNames).toContain('external_id');
        expect(columnNames).toContain('error_code');
      });
    });

    it('executes real outboundPublishService.invoke with a simulated roadmap connector', async () => {
      for (const platform of ADDITIONAL_PUBLISHING_BUILD_ORDER) {
        const testConnector: SocialConnector = {
          providerId: platform,
          authMode: 'oauth',
          deliveryMode: 'poll',
          getRateLimitConfig: () => ({ requestsPerWindow: 10, windowSeconds: 1 }),
          normalize: () => ({
            externalId: 'ext-norm-1',
            authorExternalId: 'auth-1',
            publishedAt: new Date().toISOString(),
            rawPayload: {},
          }),
          publish: async (tId, uId, payload, cred) => ({
            externalId: `${platform}-post-123`,
            externalUrl: `https://${platform}.example.com/posts/123`,
          }),
        };

        const result = await invoke({
          tenantId,
          userId: 'user-456',
          payload: {
            text: `Publishing to ${platform}`,
            targetAssetId: 'asset-789',
            targetAssetType: `${platform}_account`,
          },
          credential: 'test-token',
          connector: testConnector,
        });

        expect(result.status).toBe('sent');
        expect(result.providerId).toBe(platform);
        expect(result.externalId).toBe(`${platform}-post-123`);
        expect(result.externalUrl).toBe(`https://${platform}.example.com/posts/123`);
        expect(result.errorCode).toBeNull();
      }
    });
  });

  describe('AC3: RequestGate key separation', () => {
    it('formats gate key as (tenantId, providerId, "outbound_post")', () => {
      for (const platform of ADDITIONAL_PUBLISHING_BUILD_ORDER) {
        const gateKey = getOutboundGateKey(tenantId, platform);
        expect(gateKey).toBe(`${tenantId}:${platform}:outbound_post`);

        const connector: SocialConnector = {
          providerId: platform,
          authMode: 'oauth',
          deliveryMode: 'poll',
          getRateLimitConfig: () => ({ requestsPerWindow: 10, windowSeconds: 60 }),
          normalize: () => ({
            externalId: '1',
            authorExternalId: '1',
            publishedAt: new Date().toISOString(),
            rawPayload: {},
          }),
        };

        expect(outboundPostKey(tenantId, connector)).toBe(gateKey);
      }
    });

    it('ensures outbound_post gate keys are strictly distinct from ingestion, reply, and research keys', () => {
      for (const platform of ADDITIONAL_PUBLISHING_BUILD_ORDER) {
        const outboundPost = getOutboundGateKey(tenantId, platform);
        const ingestionKey = `${tenantId}:${platform}`;
        const replyKey = `${tenantId}:${platform}:outbound`;
        const searchKey = `${tenantId}:${platform}:search`;
        const researchKey = `${tenantId}:${platform}:research`;

        expect(outboundPost).not.toBe(ingestionKey);
        expect(outboundPost).not.toBe(replyKey);
        expect(outboundPost).not.toBe(searchKey);
        expect(outboundPost).not.toBe(researchKey);
        expect(outboundPost.endsWith(':outbound_post')).toBe(true);
      }
    });

    it('exercises real acquireForOutboundPost for each roadmap platform', async () => {
      for (const platform of ADDITIONAL_PUBLISHING_BUILD_ORDER) {
        const connector: SocialConnector = {
          providerId: platform,
          authMode: 'oauth',
          deliveryMode: 'poll',
          getRateLimitConfig: () => ({ requestsPerWindow: 5, windowSeconds: 1 }),
          normalize: () => ({
            externalId: '1',
            authorExternalId: '1',
            publishedAt: new Date().toISOString(),
            rawPayload: {},
          }),
        };

        await expect(acquireForOutboundPost(tenantId, connector)).resolves.toBeUndefined();
      }
    });
  });

  describe('AC4: Tier-3 (user-bound) credential requirement', () => {
    it('mandates Tier-3 user-bound credentials for all roadmap platforms', () => {
      for (const platform of ADDITIONAL_PUBLISHING_BUILD_ORDER) {
        const spec = getPlatformRoadmapSpec(platform);
        expect(spec.credentialTier).toBe('tier3_user');
        expect(spec.credentialOwnerType).toBe('user');
        expect(spec.governingCredentialAdrs).toContain('ADR-0028');
        expect(spec.governingCredentialAdrs).toContain('ADR-0014');
      }
    });

    it('validates credential tier enforcement: accepts ownerType user, rejects tenant or unowned', () => {
      expect(validatePublishingCredentialTier('user')).toEqual({ valid: true });
      expect(validatePublishingCredentialTier('tenant')).toEqual({
        valid: false,
        error: 'Publishing requires a Tier-3 (user-bound) credential under ADR-0028/ADR-0014.',
      });
      expect(validatePublishingCredentialTier(undefined as any)).toEqual({
        valid: false,
        error: 'Publishing requires a Tier-3 (user-bound) credential under ADR-0028/ADR-0014.',
      });
    });
  });

  describe('AC5: v1 content types and deferred media upload', () => {
    it('declares v1 publish supports text and link-card only', () => {
      for (const platform of ADDITIONAL_PUBLISHING_BUILD_ORDER) {
        const spec = getPlatformRoadmapSpec(platform);
        expect(spec.supportedContentTypesV1).toEqual(['text', 'link-card']);
      }
    });

    it('isContentTypeSupportedInV1 accepts text and link-card, rejects image and video in v1', () => {
      expect(isContentTypeSupportedInV1('text')).toBe(true);
      expect(isContentTypeSupportedInV1('link-card')).toBe(true);
      expect(isContentTypeSupportedInV1('image')).toBe(false);
      expect(isContentTypeSupportedInV1('video')).toBe(false);
      expect(isContentTypeSupportedInV1('carousel')).toBe(false);
    });

    it('explicitly defers image/video media upload to ADR-0115', () => {
      for (const platform of ADDITIONAL_PUBLISHING_BUILD_ORDER) {
        expect(isMediaUploadDeferred(platform, 'image')).toBe(true);
        expect(isMediaUploadDeferred(platform, 'video')).toBe(true);
        expect(isMediaUploadDeferred(platform, 'text')).toBe(false);
        expect(isMediaUploadDeferred(platform, 'link-card')).toBe(false);

        const spec = getPlatformRoadmapSpec(platform);
        expect(spec.mediaUploadDeferredTo).toBe('ADR-0115');
      }
    });

    it('records that Instagram requires media upload and cannot support text-only v1 posting', () => {
      const spec = getPlatformRoadmapSpec('instagram');
      expect(spec.requiresMediaForPublishing).toBe(true);
      expect(spec.textOnlyViable).toBe(false);
    });
  });

  describe('AC6: Per-platform accepted ADR prerequisite', () => {
    it('requires a separate accepted ADR for each platform before implementation begins', () => {
      for (const platform of ADDITIONAL_PUBLISHING_BUILD_ORDER) {
        const spec = getPlatformRoadmapSpec(platform);
        expect(spec.requiresSeparateAdr).toBe(true);
        expect(spec.isAdrAccepted).toBe(false);
      }
    });

    it('blocks implementation when separate ADR is not accepted', () => {
      for (const platform of ADDITIONAL_PUBLISHING_BUILD_ORDER) {
        const result = validatePublishingPrerequisites(platform, { isAdrAccepted: false });
        expect(result.canImplement).toBe(false);
        expect(result.reasons).toContain(
          `No accepted per-platform ADR exists for '${platform}' (ADR-0048 / ADR-0027 prerequisite).`
        );

        expect(() => assertPlatformReadyForImplementation(platform, { isAdrAccepted: false })).toThrow(
          /No accepted per-platform ADR exists/
        );
      }
    });

    it('allows implementation when per-platform ADR is accepted (for non-Twitter platforms)', () => {
      const mastodonResult = validatePublishingPrerequisites('mastodon', { isAdrAccepted: true });
      expect(mastodonResult.canImplement).toBe(true);
      expect(mastodonResult.reasons).toEqual([]);
    });
  });

  describe('AC7: Explicit re-evaluation barrier for X/Twitter', () => {
    it('flags X/Twitter as requiring explicit economic re-evaluation', () => {
      const twitterSpec = getPlatformRoadmapSpec('twitter');
      expect(twitterSpec.economicReevaluationRequired).toBe(true);

      // Other platforms do not have the economic re-evaluation barrier
      for (const platform of ['mastodon', 'bluesky', 'instagram', 'threads'] as const) {
        const spec = getPlatformRoadmapSpec(platform);
        expect(spec.economicReevaluationRequired).toBe(false);
      }
    });

    it('blocks X/Twitter implementation even with accepted ADR if economic re-evaluation is not confirmed', () => {
      const withoutReview = validatePublishingPrerequisites('twitter', {
        isAdrAccepted: true,
        economicReevaluationPassed: false,
      });
      expect(withoutReview.canImplement).toBe(false);
      expect(withoutReview.reasons).toContain(
        "X/Twitter requires explicit economic re-evaluation before building due to API cost and review barriers (ADR-0118 Decision §1)."
      );

      const withReview = validatePublishingPrerequisites('twitter', {
        isAdrAccepted: true,
        economicReevaluationPassed: true,
      });
      expect(withReview.canImplement).toBe(true);
      expect(withReview.reasons).toEqual([]);
    });
  });
});
