import { Router } from 'express';
import { randomUUID } from 'crypto';
import { requireTenantUserIdentity } from '../../auth/requireTenantUser';
import { storeCredential } from '../../../credentials/credentialStore';
import { setConnectorActivation } from '../../../connectors/connectorActivationStore';
import { FACEBOOK_PROVIDER_ID } from '../../../connectors/facebook/facebookConnector';
import { ClassifiableError } from '../../../ingestion/errorClassification';

const GRAPH_API_VERSION = 'v21.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

interface CachedPage {
  id: string;
  name: string;
  category?: string;
  accessToken: string;
}

interface SessionEntry {
  pages: CachedPage[];
  expiresAt: number;
}

/**
 * ADR-0059 Decision §4 / ADR-0036 — the connecting individual's own long-
 * lived user token and each Page's own access token must never reach
 * client-side JS (ADR-0036's "no bearer token in browser JS" posture,
 * applied here to Meta's own tokens rather than a SocialEngage-issued
 * one). The /exchange step calls Meta server-side and caches the full
 * page list (including each page's own real access token) only here, in
 * process, keyed by a fresh, random, single-use sessionToken returned to
 * the caller — the same short-TTL in-process Map pattern
 * connectorHealthCache.ts (ADR-0022) already established, reused for a
 * genuinely different purpose (ephemeral OAuth-flow state, not a derived-
 * data cache). /select-page looks the entry up by that token, stores the
 * chosen page's own access token as a real Tier 3 credential, and deletes
 * the entry — single-use, never re-readable after selection.
 */
const SESSION_TTL_MS = 5 * 60 * 1000;
const sessions = new Map<string, SessionEntry>();

function pruneExpired(): void {
  const now = Date.now();
  for (const [token, entry] of sessions) {
    if (entry.expiresAt <= now) sessions.delete(token);
  }
}

interface FacebookTokenResponse {
  access_token?: string;
  error?: { message: string };
}

async function exchangeCodeForShortLivedUserToken(code: string, redirectUri: string): Promise<string> {
  const url =
    `${GRAPH_API_BASE}/oauth/access_token?` +
    `client_id=${encodeURIComponent(process.env.FACEBOOK_APP_ID ?? '')}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&client_secret=${encodeURIComponent(process.env.FACEBOOK_APP_SECRET ?? '')}` +
    `&code=${encodeURIComponent(code)}`;
  const res = await fetch(url);
  const body = (await res.json()) as FacebookTokenResponse;
  if (!res.ok || !body.access_token) {
    throw new ClassifiableError('http_401', `Facebook code exchange failed: ${body.error?.message ?? res.status}`);
  }
  return body.access_token;
}

async function exchangeForLongLivedUserToken(shortLivedToken: string): Promise<string> {
  const url =
    `${GRAPH_API_BASE}/oauth/access_token?grant_type=fb_exchange_token` +
    `&client_id=${encodeURIComponent(process.env.FACEBOOK_APP_ID ?? '')}` +
    `&client_secret=${encodeURIComponent(process.env.FACEBOOK_APP_SECRET ?? '')}` +
    `&fb_exchange_token=${encodeURIComponent(shortLivedToken)}`;
  const res = await fetch(url);
  const body = (await res.json()) as FacebookTokenResponse;
  if (!res.ok || !body.access_token) {
    throw new ClassifiableError('http_401', `Facebook long-lived token exchange failed: ${body.error?.message ?? res.status}`);
  }
  return body.access_token;
}

interface MeAccountsResponse {
  data?: Array<{ id: string; name: string; category?: string; access_token: string }>;
  error?: { message: string };
}

async function listAccessiblePages(longLivedUserToken: string): Promise<CachedPage[]> {
  const url = `${GRAPH_API_BASE}/me/accounts?access_token=${encodeURIComponent(longLivedUserToken)}`;
  const res = await fetch(url);
  const body = (await res.json()) as MeAccountsResponse;
  if (!res.ok || body.error) {
    throw new ClassifiableError('http_401', `Facebook /me/accounts failed: ${body.error?.message ?? res.status}`);
  }
  return (body.data ?? []).map((p) => ({ id: p.id, name: p.name, category: p.category, accessToken: p.access_token }));
}

export const facebookOAuthRouter = Router();

/**
 * POST /v1/connectors/facebook/oauth/exchange — real, server-side code
 * exchange (short-lived user token -> long-lived user token) then
 * /me/accounts, per ADR-0059 Decision §4's own verified mechanics. Returns
 * the Page list WITHOUT access tokens (id/name/category only) plus a
 * single-use sessionToken — the actual tokens stay server-side.
 */
facebookOAuthRouter.post('/exchange', async (req, res) => {
  const identity = requireTenantUserIdentity(req, res);
  if (!identity) return;

  const { code, redirectUri } = req.body;
  if (!code || typeof code !== 'string' || !redirectUri || typeof redirectUri !== 'string') {
    res.status(400).json({ error: 'code and redirectUri (both strings) are required in request body.' });
    return;
  }

  try {
    const shortLivedToken = await exchangeCodeForShortLivedUserToken(code, redirectUri);
    const longLivedToken = await exchangeForLongLivedUserToken(shortLivedToken);
    const pages = await listAccessiblePages(longLivedToken);

    pruneExpired();
    const sessionToken = randomUUID();
    sessions.set(sessionToken, { pages, expiresAt: Date.now() + SESSION_TTL_MS });

    res.status(200).json({
      sessionToken,
      pages: pages.map((p) => ({ id: p.id, name: p.name, category: p.category })),
    });
  } catch (err) {
    res.status(401).json({ error: 'Facebook OAuth exchange failed.', details: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * POST /v1/connectors/facebook/oauth/select-page — stores the chosen
 * Page's own access token as a real Tier 3 (user-bound) credential
 * (ADR-0059 Decision §4/ADR-0028 §3) — userId is always the caller's own
 * resolved identity, never a request-body value, the same "never trust a
 * client-supplied userId" rule connectorsRouter.ts's own /connect already
 * establishes. Single-use: the session entry is deleted after a
 * successful selection (or a not-found pageId), never re-readable.
 */
facebookOAuthRouter.post('/select-page', async (req, res) => {
  const identity = requireTenantUserIdentity(req, res);
  if (!identity) return;
  const { tenantId, userId } = identity;

  const { sessionToken, pageId } = req.body;
  if (!sessionToken || typeof sessionToken !== 'string' || !pageId || typeof pageId !== 'string') {
    res.status(400).json({ error: 'sessionToken and pageId (both strings) are required in request body.' });
    return;
  }

  pruneExpired();
  const entry = sessions.get(sessionToken);
  if (!entry) {
    res.status(410).json({ error: 'This OAuth session has expired or was already used — reconnect from the start.' });
    return;
  }

  const page = entry.pages.find((p) => p.id === pageId);
  if (!page) {
    sessions.delete(sessionToken);
    res.status(400).json({ error: 'No Page with that id was found in this OAuth session\'s own account list.' });
    return;
  }

  const keyVaultKeyId = process.env.KEY_VAULT_KEY_ID;
  if (!keyVaultKeyId) {
    res.status(500).json({ error: 'Credential storage is not configured (KEY_VAULT_KEY_ID missing).' });
    return;
  }

  const credentialPlaintext = JSON.stringify({ pageId: page.id, pageAccessToken: page.accessToken, pageName: page.name });

  try {
    await storeCredential(tenantId, FACEBOOK_PROVIDER_ID, credentialPlaintext, keyVaultKeyId, 'user', userId);
    await setConnectorActivation(tenantId, FACEBOOK_PROVIDER_ID, 'user', true, userId, userId);
    sessions.delete(sessionToken);
    res.status(201).json({ platformId: FACEBOOK_PROVIDER_ID, ownerType: 'user', page: { id: page.id, name: page.name } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to store Facebook credential.', details: err instanceof Error ? err.message : String(err) });
  }
});
