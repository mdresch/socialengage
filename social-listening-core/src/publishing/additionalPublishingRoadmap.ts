/**
 * Story 14.1 (ADR-0118, BRD-0118, FDD-0118) — Additional social platform publishing roadmap.
 *
 * Defines the build order, shared constraints, credential tier requirements,
 * rate gate isolation, and prerequisite governance for extending
 * SocialConnector.publish?() to Wave 2 platforms (Mastodon, Bluesky, Instagram, Threads, X).
 */

export const WAVE_1_PUBLISHING_PLATFORMS = ['facebook', 'linkedin'] as const;

export const ADDITIONAL_PUBLISHING_BUILD_ORDER = [
  'mastodon',
  'bluesky',
  'instagram',
  'threads',
  'twitter',
] as const;

export const ALL_PUBLISHING_PLATFORMS_SEQUENCE = [
  ...WAVE_1_PUBLISHING_PLATFORMS,
  ...ADDITIONAL_PUBLISHING_BUILD_ORDER,
] as const;

export type Wave1Platform = (typeof WAVE_1_PUBLISHING_PLATFORMS)[number];
export type AdditionalPublishingPlatform = (typeof ADDITIONAL_PUBLISHING_BUILD_ORDER)[number];
export type PublishingPlatform = (typeof ALL_PUBLISHING_PLATFORMS_SEQUENCE)[number];

export interface PlatformRoadmapSpec {
  providerId: AdditionalPublishingPlatform;
  displayName: string;
  buildOrderIndex: number;
  prerequisiteWave1: readonly Wave1Platform[];
  reusedTable: 'outbound_activities';
  connectorPublishMethod: 'SocialConnector.publish?()';
  credentialTier: 'tier3_user';
  credentialOwnerType: 'user';
  governingCredentialAdrs: readonly string[];
  supportedContentTypesV1: readonly ['text', 'link-card'];
  mediaUploadDeferredTo: 'ADR-0115';
  requiresSeparateAdr: true;
  isAdrAccepted: boolean;
  economicReevaluationRequired: boolean;
  requiresMediaForPublishing: boolean;
  textOnlyViable: boolean;
}

const ROADMAP_SPECS: Record<AdditionalPublishingPlatform, PlatformRoadmapSpec> = {
  mastodon: {
    providerId: 'mastodon',
    displayName: 'Mastodon',
    buildOrderIndex: 0,
    prerequisiteWave1: WAVE_1_PUBLISHING_PLATFORMS,
    reusedTable: 'outbound_activities',
    connectorPublishMethod: 'SocialConnector.publish?()',
    credentialTier: 'tier3_user',
    credentialOwnerType: 'user',
    governingCredentialAdrs: ['ADR-0028', 'ADR-0014'],
    supportedContentTypesV1: ['text', 'link-card'],
    mediaUploadDeferredTo: 'ADR-0115',
    requiresSeparateAdr: true,
    isAdrAccepted: false,
    economicReevaluationRequired: false,
    requiresMediaForPublishing: false,
    textOnlyViable: true,
  },
  bluesky: {
    providerId: 'bluesky',
    displayName: 'Bluesky',
    buildOrderIndex: 1,
    prerequisiteWave1: WAVE_1_PUBLISHING_PLATFORMS,
    reusedTable: 'outbound_activities',
    connectorPublishMethod: 'SocialConnector.publish?()',
    credentialTier: 'tier3_user',
    credentialOwnerType: 'user',
    governingCredentialAdrs: ['ADR-0028', 'ADR-0014'],
    supportedContentTypesV1: ['text', 'link-card'],
    mediaUploadDeferredTo: 'ADR-0115',
    requiresSeparateAdr: true,
    isAdrAccepted: false,
    economicReevaluationRequired: false,
    requiresMediaForPublishing: false,
    textOnlyViable: true,
  },
  instagram: {
    providerId: 'instagram',
    displayName: 'Instagram',
    buildOrderIndex: 2,
    prerequisiteWave1: WAVE_1_PUBLISHING_PLATFORMS,
    reusedTable: 'outbound_activities',
    connectorPublishMethod: 'SocialConnector.publish?()',
    credentialTier: 'tier3_user',
    credentialOwnerType: 'user',
    governingCredentialAdrs: ['ADR-0028', 'ADR-0014'],
    supportedContentTypesV1: ['text', 'link-card'],
    mediaUploadDeferredTo: 'ADR-0115',
    requiresSeparateAdr: true,
    isAdrAccepted: false,
    economicReevaluationRequired: false,
    requiresMediaForPublishing: true,
    textOnlyViable: false,
  },
  threads: {
    providerId: 'threads',
    displayName: 'Threads',
    buildOrderIndex: 3,
    prerequisiteWave1: WAVE_1_PUBLISHING_PLATFORMS,
    reusedTable: 'outbound_activities',
    connectorPublishMethod: 'SocialConnector.publish?()',
    credentialTier: 'tier3_user',
    credentialOwnerType: 'user',
    governingCredentialAdrs: ['ADR-0028', 'ADR-0014'],
    supportedContentTypesV1: ['text', 'link-card'],
    mediaUploadDeferredTo: 'ADR-0115',
    requiresSeparateAdr: true,
    isAdrAccepted: false,
    economicReevaluationRequired: false,
    requiresMediaForPublishing: false,
    textOnlyViable: true,
  },
  twitter: {
    providerId: 'twitter',
    displayName: 'X/Twitter',
    buildOrderIndex: 4,
    prerequisiteWave1: WAVE_1_PUBLISHING_PLATFORMS,
    reusedTable: 'outbound_activities',
    connectorPublishMethod: 'SocialConnector.publish?()',
    credentialTier: 'tier3_user',
    credentialOwnerType: 'user',
    governingCredentialAdrs: ['ADR-0028', 'ADR-0014'],
    supportedContentTypesV1: ['text', 'link-card'],
    mediaUploadDeferredTo: 'ADR-0115',
    requiresSeparateAdr: true,
    isAdrAccepted: false,
    economicReevaluationRequired: true,
    requiresMediaForPublishing: false,
    textOnlyViable: true,
  },
};

/**
 * Returns the immutable list of Wave 2 publishing platforms in explicit priority order.
 */
export function getPublishingBuildOrder(): readonly AdditionalPublishingPlatform[] {
  return [...ADDITIONAL_PUBLISHING_BUILD_ORDER];
}

/**
 * Returns the full multi-wave publishing sequence (Wave 1 followed by Wave 2).
 */
export function getFullPublishingSequence(): readonly PublishingPlatform[] {
  return [...ALL_PUBLISHING_PLATFORMS_SEQUENCE];
}

/**
 * Normalizes platform identifier to roadmap platform id.
 */
function normalizePlatform(platform: string): AdditionalPublishingPlatform {
  const p = platform.trim().toLowerCase();
  if (p === 'x' || p === 'twitter') {
    return 'twitter';
  }
  if (p in ROADMAP_SPECS) {
    return p as AdditionalPublishingPlatform;
  }
  throw new Error(`Platform '${platform}' is not a recognized Wave 2 publishing roadmap platform.`);
}

/**
 * Retrieves the roadmap specification for a given Wave 2 platform.
 */
export function getPlatformRoadmapSpec(platform: string): PlatformRoadmapSpec {
  const normalized = normalizePlatform(platform);
  return { ...ROADMAP_SPECS[normalized] };
}

/**
 * Generates the isolated RequestGate key for outbound posts.
 * AC3: Format is (tenantId, providerId, 'outbound_post').
 */
export function getOutboundGateKey(tenantId: string, providerId: string): string {
  const norm = providerId.trim().toLowerCase() === 'x' ? 'twitter' : providerId.trim().toLowerCase();
  return `${tenantId}:${norm}:outbound_post`;
}

export interface PrerequisiteValidationOptions {
  isAdrAccepted?: boolean;
  economicReevaluationPassed?: boolean;
}

export interface PrerequisiteValidationResult {
  canImplement: boolean;
  reasons: string[];
}

/**
 * Validates whether a Wave 2 platform meets the prerequisite criteria to begin implementation.
 * AC6: Requires separate accepted ADR.
 * AC7: X/Twitter requires explicit economic re-evaluation.
 */
export function validatePublishingPrerequisites(
  platform: string,
  options?: PrerequisiteValidationOptions
): PrerequisiteValidationResult {
  const spec = getPlatformRoadmapSpec(platform);
  const reasons: string[] = [];

  const isAccepted = options?.isAdrAccepted ?? spec.isAdrAccepted;
  if (!isAccepted) {
    reasons.push(
      `No accepted per-platform ADR exists for '${spec.providerId}' (ADR-0048 / ADR-0027 prerequisite).`
    );
  }

  if (spec.economicReevaluationRequired) {
    const economicPassed = options?.economicReevaluationPassed ?? false;
    if (!economicPassed) {
      reasons.push(
        "X/Twitter requires explicit economic re-evaluation before building due to API cost and review barriers (ADR-0118 Decision §1)."
      );
    }
  }

  return {
    canImplement: reasons.length === 0,
    reasons,
  };
}

/**
 * Asserts that a platform is ready for implementation; throws if prerequisites are unmet.
 */
export function assertPlatformReadyForImplementation(
  platform: string,
  options?: PrerequisiteValidationOptions
): void {
  const result = validatePublishingPrerequisites(platform, options);
  if (!result.canImplement) {
    throw new Error(`Platform '${platform}' cannot be implemented: ${result.reasons.join('; ')}`);
  }
}

/**
 * Validates the credential tier for publishing.
 * AC4: Must be user-bound ('user').
 */
export function validatePublishingCredentialTier(ownerType?: string): { valid: boolean; error?: string } {
  if (ownerType === 'user') {
    return { valid: true };
  }
  return {
    valid: false,
    error: 'Publishing requires a Tier-3 (user-bound) credential under ADR-0028/ADR-0014.',
  };
}

/**
 * AC5: Content type support in v1 (text and link-card only).
 */
export function isContentTypeSupportedInV1(contentType: string): boolean {
  const ct = contentType.trim().toLowerCase();
  return ct === 'text' || ct === 'link-card';
}

/**
 * AC5: Image/video media upload deferred to ADR-0115.
 */
export function isMediaUploadDeferred(_platform: string, contentType: string): boolean {
  const ct = contentType.trim().toLowerCase();
  return ct === 'image' || ct === 'video' || ct === 'carousel';
}
