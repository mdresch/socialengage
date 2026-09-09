import crypto from 'crypto';
import { SocialConnector, RateLimitConfig, NormalizedPost, OutboundPostPayload } from '../types';
import { ClassifiableError } from '../../ingestion/errorClassification';

export const LINKEDIN_PROVIDER_ID = 'linkedin';

export const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
export const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
export const LINKEDIN_REVOKE_URL = 'https://www.linkedin.com/oauth/v2/revoke';

export const LINKEDIN_MEMBER_SCOPES = [
  'openid',
  'profile',
  'email',
  'w_member_social',
];

export const LINKEDIN_ORG_SCOPES = [
  'w_organization_social',
  'r_organization_social',
];

export interface LinkedInCredential {
  accessToken: string;
  accessTokenExpiresAt: string; // ISO 8601 UTC (60 days)
  refreshToken: string;
  refreshTokenExpiresAt: string; // ISO 8601 UTC (365 days)
  memberId?: string;
  memberName?: string;
  scopes: string[];
}

export interface LinkedInOAuthStateEntry {
  tenantId: string;
  state: string;
  createdAt: number;
  expiresAt: number;
}

export interface RawLinkedInPost {
  id: string;
  authorUrn: string;
  authorName?: string;
  commentary?: string;
  createdAt?: number | string;
  lifecycleState?: string;
  distribution?: Record<string, unknown>;
}

/**
 * State parameter storage & tenant isolation (ADR-0069 §3).
 * Keyed by `linkedin:oauth:state:{tenantId}:{state}` with 10-minute TTL.
 */
const oauthStateCache = new Map<string, LinkedInOAuthStateEntry>();
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function generateState(tenantId: string): string {
  const state = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const key = `linkedin:oauth:state:${tenantId}:${state}`;
  oauthStateCache.set(key, {
    tenantId,
    state,
    createdAt: now,
    expiresAt: now + STATE_TTL_MS,
  });
  return state;
}

export function validateAndConsumeState(tenantId: string, state: string): boolean {
  const key = `linkedin:oauth:state:${tenantId}:${state}`;
  const entry = oauthStateCache.get(key);
  if (!entry) {
    return false;
  }
  oauthStateCache.delete(key);
  if (entry.tenantId !== tenantId) {
    return false;
  }
  if (Date.now() > entry.expiresAt) {
    return false;
  }
  return true;
}

export function clearStateCache(): void {
  oauthStateCache.clear();
}

/**
 * Parse and validate LinkedIn credential JSON from storage (ADR-0014, ADR-0069).
 */
export function parseLinkedInCredential(credential: string | Record<string, unknown>): LinkedInCredential {
  let parsed: Partial<LinkedInCredential>;
  if (typeof credential === 'string') {
    try {
      parsed = JSON.parse(credential) as Partial<LinkedInCredential>;
    } catch {
      throw new ClassifiableError('http_401', 'LinkedIn credential is not valid JSON.');
    }
  } else {
    parsed = credential as Partial<LinkedInCredential>;
  }

  if (!parsed.accessToken) {
    throw new ClassifiableError(
      'http_401',
      'LinkedIn credential missing required accessToken field.'
    );
  }

  return {
    accessToken: parsed.accessToken,
    accessTokenExpiresAt: parsed.accessTokenExpiresAt || new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(),
    refreshToken: parsed.refreshToken || '',
    refreshTokenExpiresAt: parsed.refreshTokenExpiresAt || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
    memberId: parsed.memberId,
    memberName: parsed.memberName,
    scopes: parsed.scopes || LINKEDIN_MEMBER_SCOPES,
  };
}

/**
 * Generate LinkedIn authorize URL with cryptographically secure, tenant-scoped state (ADR-0069 §1/§3).
 */
export function getAuthUrl(
  tenantId: string,
  state: string,
  options?: {
    clientId?: string;
    redirectUri?: string;
    scopes?: string[];
    isOrgEnabled?: boolean;
  }
): string {
  const clientId = options?.clientId || process.env.LINKEDIN_CLIENT_ID || '';
  const redirectUri = options?.redirectUri || process.env.LINKEDIN_REDIRECT_URI || '';
  const scopes = options?.scopes || (options?.isOrgEnabled
    ? [...LINKEDIN_MEMBER_SCOPES, ...LINKEDIN_ORG_SCOPES]
    : LINKEDIN_MEMBER_SCOPES);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: scopes.join(' '),
  });

  return `${LINKEDIN_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens using confidential client credentials (ADR-0069 §1/§3).
 */
export async function exchangeAuthorizationCode(
  code: string,
  state: string,
  tenantId: string,
  options: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    skipStateValidation?: boolean;
    fetchImpl?: typeof fetch;
    now?: number;
  }
): Promise<LinkedInCredential> {
  if (!options.skipStateValidation) {
    const isValidState = validateAndConsumeState(tenantId, state);
    if (!isValidState) {
      throw new ClassifiableError('http_401', 'Invalid or expired OAuth state parameter for LinkedIn.');
    }
  }

  const customFetch = options.fetchImpl || fetch;
  const now = options.now ?? Date.now();

  const bodyParams = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: options.redirectUri,
    client_id: options.clientId,
    client_secret: options.clientSecret,
  });

  let response: Response;
  try {
    response = await customFetch(LINKEDIN_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: bodyParams.toString(),
    });
  } catch (err) {
    throw new ClassifiableError('network', `Failed to reach LinkedIn token endpoint: ${(err as Error).message}`);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new ClassifiableError('http_401', `LinkedIn token exchange failed (${response.status}): ${errorText}`);
  }

  const tokenData = await response.json() as {
    access_token: string;
    expires_in?: number;
    refresh_token?: string;
    refresh_token_expires_in?: number;
    scope?: string;
  };

  const expiresInSeconds = tokenData.expires_in ?? 60 * 24 * 3600; // default 60 days
  const accessTokenExpiresAt = new Date(now + expiresInSeconds * 1000).toISOString();
  // Refresh token valid up to 1 year (365 days) from issuance
  const refreshTokenExpiresAt = new Date(now + 365 * 24 * 3600 * 1000).toISOString();

  let memberId: string | undefined;
  let memberName: string | undefined;

  try {
    const userinfoRes = await customFetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (userinfoRes.ok) {
      const userinfo = (await userinfoRes.json()) as { sub?: string; name?: string };
      memberId = userinfo.sub;
      memberName = userinfo.name;
    }
  } catch {
    // Graceful fallback if userinfo is unavailable
  }

  return {
    accessToken: tokenData.access_token,
    accessTokenExpiresAt,
    refreshToken: tokenData.refresh_token || '',
    refreshTokenExpiresAt,
    memberId,
    memberName,
    scopes: tokenData.scope ? tokenData.scope.split(' ') : LINKEDIN_MEMBER_SCOPES,
  };
}

/**
 * Token refresh and lifecycle management (ADR-0069 §1/§3).
 */
export async function refreshToken(
  credential: LinkedInCredential,
  options: {
    clientId: string;
    clientSecret: string;
    fetchImpl?: typeof fetch;
    now?: number;
  }
): Promise<LinkedInCredential> {
  const customFetch = options.fetchImpl || fetch;
  const now = options.now ?? Date.now();

  const bodyParams = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: credential.refreshToken,
    client_id: options.clientId,
    client_secret: options.clientSecret,
  });

  let response: Response;
  try {
    response = await customFetch(LINKEDIN_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: bodyParams.toString(),
    });
  } catch (err) {
    throw new ClassifiableError('network', `Failed to reach LinkedIn token refresh endpoint: ${(err as Error).message}`);
  }

  if (!response.ok) {
    const errorJson = (await response.json().catch(() => ({}))) as { error?: string; error_description?: string };
    if (errorJson.error === 'invalid_grant' || response.status === 400 || response.status === 401) {
      const classification = classifyInvalidGrant(credential.refreshTokenExpiresAt, now);
      throw new ClassifiableError('http_401', `LinkedIn token refresh failed (${classification.credentialStatus}): ${classification.reason}`);
    }
    throw new ClassifiableError('network', `LinkedIn token refresh returned ${response.status}`);
  }

  const tokenData = await response.json() as {
    access_token: string;
    expires_in?: number;
    refresh_token?: string;
    refresh_token_expires_in?: number;
    scope?: string;
  };

  const expiresInSeconds = tokenData.expires_in ?? 60 * 24 * 3600;
  const accessTokenExpiresAt = new Date(now + expiresInSeconds * 1000).toISOString();

  // If a new refresh_token is present in response, update it and reset refreshTokenExpiresAt to now + 365 days;
  // otherwise retain existing refresh token and its existing refreshTokenExpiresAt.
  let refreshTokenValue = credential.refreshToken;
  let refreshTokenExpiresAtValue = credential.refreshTokenExpiresAt;

  if (tokenData.refresh_token) {
    refreshTokenValue = tokenData.refresh_token;
    refreshTokenExpiresAtValue = new Date(now + 365 * 24 * 3600 * 1000).toISOString();
  }

  return {
    ...credential,
    accessToken: tokenData.access_token,
    accessTokenExpiresAt,
    refreshToken: refreshTokenValue,
    refreshTokenExpiresAt: refreshTokenExpiresAtValue,
    scopes: tokenData.scope ? tokenData.scope.split(' ') : credential.scopes,
  };
}

/**
 * Surface proactive warnings when access token is within 7 days of expiry
 * or refresh token is within 30 days of refreshTokenExpiresAt (ADR-0069 §3).
 */
export function evaluateCredentialStatus(
  credential: Pick<LinkedInCredential, 'accessTokenExpiresAt' | 'refreshTokenExpiresAt'>,
  now = Date.now()
): 'valid' | 'expiring_soon' {
  const accessExpiryMs = new Date(credential.accessTokenExpiresAt).getTime();
  const refreshExpiryMs = new Date(credential.refreshTokenExpiresAt).getTime();

  const SEVEN_DAYS_MS = 7 * 24 * 3600 * 1000;
  const THIRTY_DAYS_MS = 30 * 24 * 3600 * 1000;

  if (accessExpiryMs - now <= SEVEN_DAYS_MS || refreshExpiryMs - now <= THIRTY_DAYS_MS) {
    return 'expiring_soon';
  }

  return 'valid';
}

/**
 * Deterministic invalid_grant classification (ADR-0069 §3).
 */
export function classifyInvalidGrant(
  refreshTokenExpiresAt: string,
  now = Date.now()
): { credentialStatus: 'expired' | 'revoked'; reason: string; reconnectRequired: true } {
  const expiryMs = new Date(refreshTokenExpiresAt).getTime();
  if (now > expiryMs) {
    return {
      credentialStatus: 'expired',
      reason: 'Refresh token expired (>1 year)',
      reconnectRequired: true,
    };
  }
  return {
    credentialStatus: 'revoked',
    reason: 'Authorization revoked by user or password changed',
    reconnectRequired: true,
  };
}

export interface LinkedInRateLimitInfo {
  remainingRequests?: number;
  resetEpochMs?: number;
  limit?: number;
}

/**
 * Rest.li rate-limit header extraction (ADR-0069 §1/§4).
 * Defensively and case-insensitively parses:
 * 1. limit: 'x-restli-gateway-ratelimit-limit' (fallback: 'x-ratelimit-limit')
 * 2. remaining: 'x-restli-gateway-ratelimit-remaining' (fallback: 'x-ratelimit-remaining')
 * 3. reset: 'x-restli-gateway-ratelimit-reset' (epoch seconds converted to ms; fallback: 'x-ratelimit-reset')
 */
export function parseRateLimitHeaders(
  headers: Headers | Record<string, string | string[] | undefined | null>
): LinkedInRateLimitInfo {
  const getHeader = (name: string): string | undefined => {
    if (typeof (headers as Headers).get === 'function') {
      return (headers as Headers).get(name) ?? undefined;
    }
    const record = headers as Record<string, string | string[] | undefined | null>;
    const target = name.toLowerCase();
    for (const key of Object.keys(record)) {
      if (key.toLowerCase() === target) {
        const val = record[key];
        return Array.isArray(val) ? val[0] : (val ?? undefined);
      }
    }
    return undefined;
  };

  const result: LinkedInRateLimitInfo = {};

  // Remaining
  const remainingRaw =
    getHeader('x-restli-gateway-ratelimit-remaining') ?? getHeader('x-ratelimit-remaining');
  if (remainingRaw !== undefined) {
    const parsed = parseInt(remainingRaw, 10);
    if (!isNaN(parsed)) {
      result.remainingRequests = parsed;
    }
  }

  // Limit
  const limitRaw =
    getHeader('x-restli-gateway-ratelimit-limit') ?? getHeader('x-ratelimit-limit');
  if (limitRaw !== undefined) {
    const parsed = parseInt(limitRaw, 10);
    if (!isNaN(parsed)) {
      result.limit = parsed;
    }
  }

  // Reset (LinkedIn returns epoch seconds on x-restli-gateway-ratelimit-reset; convert to epoch ms)
  const resetRaw =
    getHeader('x-restli-gateway-ratelimit-reset') ?? getHeader('x-ratelimit-reset');
  if (resetRaw !== undefined) {
    const parsed = parseInt(resetRaw, 10);
    if (!isNaN(parsed)) {
      // If value is in seconds (< 10_000_000_000), convert to ms
      const resetEpochMs = parsed < 10000000000 ? parsed * 1000 : parsed;
      result.resetEpochMs = resetEpochMs;
    }
  }

  return result;
}

/**
 * Polling cadence guardrail validation (ADR-0069 §5).
 * Strictly rejects any polling interval < 3600 seconds (1 hour) unless
 * linkedin.org.enabled === true AND partner tier is verified.
 */
export function validateLinkedInPollCadence(
  cadenceSeconds: number,
  options?: { isOrgEnabled?: boolean; isPartnerVerified?: boolean }
): void {
  const minSeconds = 3600;
  const isElevated = options?.isOrgEnabled === true && options?.isPartnerVerified === true;
  if (cadenceSeconds < minSeconds && !isElevated) {
    throw new Error(
      'LinkedIn polling interval cannot be less than 3600 seconds (1 hour) without verified partner status and organization feature flag.'
    );
  }
}

/**
 * Best-effort token revocation & disconnect (ADR-0069 §7).
 * Calls https://www.linkedin.com/oauth/v2/revoke with stored refresh token (fallback: access token).
 * Non-blocking: logs non-200 responses with console.warn.
 */
export async function revokeToken(
  token: string,
  options: {
    clientId: string;
    clientSecret: string;
    fetchImpl?: typeof fetch;
  }
): Promise<boolean> {
  const customFetch = options.fetchImpl || fetch;

  const bodyParams = new URLSearchParams({
    token,
    client_id: options.clientId,
    client_secret: options.clientSecret,
  });

  try {
    const response = await customFetch(LINKEDIN_REVOKE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: bodyParams.toString(),
    });

    if (!response.ok) {
      // eslint-disable-next-line no-console
      console.warn(`[LinkedInConnector] Token revocation returned HTTP ${response.status} (best-effort, non-blocking)`);
      return false;
    }
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[LinkedInConnector] Token revocation network warning: ${(err as Error).message} (best-effort, non-blocking)`);
    return false;
  }
}

export async function disconnectLinkedIn(
  credential: LinkedInCredential,
  options: {
    clientId: string;
    clientSecret: string;
    fetchImpl?: typeof fetch;
  }
): Promise<void> {
  const tokenToRevoke = credential.refreshToken || credential.accessToken;
  if (tokenToRevoke) {
    await revokeToken(tokenToRevoke, options);
  }
}

/**
 * Data normalization (ADR-0069 §1/§8).
 * Discards raw JSON response payloads from permanent storage (ADR-0018).
 */
export function normalizeLinkedInPost(
  raw: RawLinkedInPost,
  tenantId: string
): {
  post: {
    externalId: string;
    tenantId: string;
    content: string;
    createdAt: string;
    authorExternalId: string;
  };
  author: {
    externalId: string;
    tenantId: string;
    displayName: string;
  };
} {
  const authorId = `linkedin:${raw.authorUrn.replace(/^urn:li:person:/, '').replace(/^urn:li:organization:/, '')}`;
  const postId = `linkedin_${raw.id.replace(/^urn:li:share:/, '').replace(/^urn:li:ugcPost:/, '')}`;
  const createdAtIso = raw.createdAt
    ? typeof raw.createdAt === 'number'
      ? new Date(raw.createdAt).toISOString()
      : new Date(raw.createdAt).toISOString()
    : new Date().toISOString();

  return {
    post: {
      externalId: postId,
      tenantId,
      content: raw.commentary || '',
      createdAt: createdAtIso,
      authorExternalId: authorId,
    },
    author: {
      externalId: authorId,
      tenantId,
      displayName: raw.authorName || 'LinkedIn Member',
    },
  };
}

export async function fetchLinkedInProfile(
  accessToken: string,
  options?: { fetchImpl?: typeof fetch }
): Promise<{ id: string; localizedFirstName?: string; localizedLastName?: string }> {
  const customFetch = options?.fetchImpl || fetch;

  // Try OpenID Connect /v2/userinfo first (standard for modern LinkedIn OAuth tokens)
  try {
    const userinfoRes = await customFetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (userinfoRes.ok) {
      const u = (await userinfoRes.json()) as { sub: string; given_name?: string; family_name?: string; name?: string };
      return {
        id: u.sub,
        localizedFirstName: u.given_name || u.name || '',
        localizedLastName: u.family_name || '',
      };
    }
  } catch {
    // fallback to /v2/me
  }

  const url = 'https://api.linkedin.com/v2/me';
  const response = await customFetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) throw new ClassifiableError('http_401', 'LinkedIn API returned 401 Unauthorized');
    if (response.status === 403) throw new ClassifiableError('http_403', 'LinkedIn API returned 403 Forbidden');
    if (response.status === 429) throw new ClassifiableError('rate_limit', 'LinkedIn API rate limit exceeded');
    throw new ClassifiableError('network', `LinkedIn API returned ${response.status}`);
  }

  return response.json() as Promise<{ id: string; localizedFirstName?: string; localizedLastName?: string }>;
}

export async function fetchLinkedInMemberPosts(
  accessToken: string,
  options?: {
    memberId?: string;
    fetchImpl?: typeof fetch;
    isOrgEnabled?: boolean;
  }
): Promise<{ posts: RawLinkedInPost[]; rateLimitHeaders?: Headers }> {
  const customFetch = options?.fetchImpl || fetch;
  const apiVersion = process.env.LINKEDIN_API_VERSION || '202601';
  const url = options?.memberId
    ? `https://api.linkedin.com/rest/posts?author=${encodeURIComponent(`urn:li:person:${options.memberId}`)}&q=author`
    : 'https://api.linkedin.com/rest/posts';

  try {
    const response = await customFetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'LinkedIn-Version': apiVersion,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });

    if (!response.ok) {
      if (response.status === 401) throw new ClassifiableError('http_401', 'LinkedIn API returned 401');
      if (response.status === 403) {
        // Graceful scope degradation (ADR-0069 §2)
        // eslint-disable-next-line no-console
        console.info('[LinkedInConnector] Organization features unavailable — partner scope approval pending.');
        return { posts: [] };
      }
      if (response.status === 429) throw new ClassifiableError('rate_limit', 'LinkedIn API returned 429');
      if (response.status >= 500) throw new ClassifiableError('http_5xx', `LinkedIn API returned ${response.status}`);
      throw new ClassifiableError('network', `LinkedIn API returned ${response.status}`);
    }

    const data = await response.json() as { elements?: RawLinkedInPost[] };
    return {
      posts: data.elements || [],
      rateLimitHeaders: response.headers,
    };
  } catch (err) {
    if (err instanceof ClassifiableError) throw err;
    throw new ClassifiableError('network', `Failed to fetch LinkedIn posts: ${(err as Error).message}`);
  }
}

/**
 * Story 2.30 (ADR-0075) — publish a new post to a LinkedIn profile or
 * organization via the UGC Posts API. Requires the credential to include
 * `w_member_social` for person targets or `w_organization_social` for
 * organization targets (working assumption; verify live before any real tenant
 * goes live).
 */
export async function publishToLinkedIn(
  tenantId: string,
  userId: string,
  payload: OutboundPostPayload,
  credential: string
): Promise<{ externalId: string; externalUrl: string }> {
  const cred = parseLinkedInCredential(credential);
  const authorUrn = payload.targetAssetId;

  const isOrganization = authorUrn.startsWith('urn:li:organization:');
  const requiredScope = isOrganization ? 'w_organization_social' : 'w_member_social';
  if (!cred.scopes.includes(requiredScope)) {
    throw new ClassifiableError(
      'missing_permission',
      `LinkedIn credential missing required scope: ${requiredScope}`
    );
  }

  // Story 13.9 (ADR-0115) — the v1 LinkedIn connector is text-only.
  // Native image/video UGC posts will be added by a later story.
  if (payload.assets && payload.assets.length > 0) {
    throw new ClassifiableError('platform_asset_rejected', 'LinkedIn publishing does not support media attachments in v1.');
  }

  const body = {
    author: authorUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: {
          text: payload.text,
        },
        shareMediaCategory: 'NONE',
      },
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  };

  const apiVersion = process.env.LINKEDIN_API_VERSION || '202601';
  const url = 'https://api.linkedin.com/v2/ugcPosts';
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cred.accessToken}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': apiVersion,
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new ClassifiableError('network', `Failed to reach LinkedIn UGC Posts endpoint: ${(err as Error).message}`);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const errorJson = safeJsonParse(text) as { message?: string; code?: string; status?: number } | null;
    const message = errorJson?.message || text || response.statusText;
    const code = errorJson?.code || '';

    if (response.status === 401) {
      throw new ClassifiableError('reconnect_required', `LinkedIn returned 401: ${message}`);
    }
    if (response.status === 403) {
      if (/quota|rate|throttle|limit/i.test(message)) {
        throw new ClassifiableError('rate_limited', `LinkedIn returned 403 quota/rate: ${message}`);
      }
      throw new ClassifiableError('missing_permission', `LinkedIn returned 403: ${message}`);
    }
    if (response.status === 429) {
      throw new ClassifiableError('rate_limited', `LinkedIn returned 429: ${message}`);
    }
    if (response.status === 422 || response.status === 400 || /invalid.*urn|author|not found/i.test(`${message} ${code}`)) {
      throw new ClassifiableError('target_asset_not_found', `LinkedIn returned invalid author: ${message}`);
    }
    if (response.status >= 500) {
      throw new ClassifiableError('http_5xx', `LinkedIn returned ${response.status}: ${message}`);
    }
    throw new ClassifiableError('network', `LinkedIn returned ${response.status}: ${message}`);
  }

  const data = (await response.json().catch(() => ({}))) as { id?: string };
  if (!data.id) {
    throw new ClassifiableError('network', 'LinkedIn publish response did not contain an id.');
  }

  const externalId = data.id;
  const externalUrl = `https://www.linkedin.com/feed/update/${externalId}`;
  return { externalId, externalUrl };
}

function safeJsonParse(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Standard SocialConnector implementation for LinkedIn (ADR-0069 §1).
 */
export const linkedinConnector: SocialConnector = {
  providerId: LINKEDIN_PROVIDER_ID,
  authMode: 'oauth',
  deliveryMode: 'poll',

  getRateLimitConfig(): RateLimitConfig {
    return {
      requestsPerWindow: 100, // conservative per-member daily post limit baseline
      windowSeconds: 86400,
    };
  },

  parseRateLimitHeaders(headers: Record<string, string>): Partial<RateLimitConfig> | undefined {
    const parsed = parseRateLimitHeaders(headers);
    if (parsed.remainingRequests !== undefined) {
      return { requestsPerWindow: parsed.remainingRequests };
    }
    return undefined;
  },

  /**
   * Story 2.30 (ADR-0075) / Story 11.7 (ADR-0098) — optional outbound post publishing.
   */
  publish: publishToLinkedIn,

  targetAssets: async (tenantId: string, userId: string, credential: string) => {
    let credObj: LinkedInCredential | null = null;
    try {
      if (credential) {
        credObj = JSON.parse(credential);
      }
    } catch {
      // ignore
    }
    const targets: Array<{ id: string; name: string; type: string }> = [];
    if (credObj?.memberId) {
      targets.push({
        id: `urn:li:person:${credObj.memberId}`,
        name: credObj.memberName || 'LinkedIn Personal Profile',
        type: 'linkedin_person',
      });
    }
    targets.push({
      id: `urn:li:organization:corp-${tenantId.slice(0, 8)}`,
      name: 'Company LinkedIn Page',
      type: 'linkedin_organization',
    });
    return targets;
  },

  normalize(rawItem: unknown): NormalizedPost {
    const raw = rawItem as RawLinkedInPost;
    const authorId = `linkedin:${(raw.authorUrn || '').replace(/^urn:li:person:/, '').replace(/^urn:li:organization:/, '')}`;
    const postId = `linkedin_${(raw.id || '').replace(/^urn:li:share:/, '').replace(/^urn:li:ugcPost:/, '')}`;
    const publishedAt = raw.createdAt
      ? typeof raw.createdAt === 'number'
        ? new Date(raw.createdAt).toISOString()
        : new Date(raw.createdAt).toISOString()
      : new Date().toISOString();

    return {
      externalId: postId,
      authorExternalId: authorId,
      publishedAt,
      rawPayload: {},
    };
  },
};
