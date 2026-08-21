import { Router } from 'express';
import { randomUUID } from 'crypto';
import { requireTenantUserIdentity } from '../../auth/requireTenantUser';
import { storeCredential } from '../../../credentials/credentialStore';
import { setConnectorActivation } from '../../../connectors/connectorActivationStore';
import { INSTAGRAM_PROVIDER_ID } from '../../../connectors/instagram/instagramConnector';
import { ClassifiableError } from '../../../ingestion/errorClassification';
import {
  markMissingAccountsOrphaned,
  upsertConnectedAccount,
} from '../../../connectors/instagram/instagramConnectedAccountsStore';

const GRAPH_API_VERSION = 'v21.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

interface CachedInstagramAccount {
  igUserId: string;
  username: string;
  name?: string;
  profilePictureUrl?: string;
  followersCount?: number;
  pageId: string;
  pageName: string;
  pageAccessToken: string;
}

interface SessionEntry {
  accounts: CachedInstagramAccount[];
  expiresAt: number;
}

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
    throw new ClassifiableError('http_401', `Meta code exchange failed: ${body.error?.message ?? res.status}`);
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
    throw new ClassifiableError('http_401', `Meta long-lived token exchange failed: ${body.error?.message ?? res.status}`);
  }
  return body.access_token;
}

interface MeAccountsPageWithInstagram {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: {
    id: string;
    username: string;
    name?: string;
    profile_picture_url?: string;
    followers_count?: number;
  };
}

interface MeAccountsResponse {
  data?: MeAccountsPageWithInstagram[];
  error?: { message: string };
}

async function listAccessibleInstagramAccounts(longLivedUserToken: string): Promise<CachedInstagramAccount[]> {
  const url = `${GRAPH_API_BASE}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name,profile_picture_url,followers_count}&access_token=${encodeURIComponent(longLivedUserToken)}`;
  const res = await fetch(url);
  const body = (await res.json()) as MeAccountsResponse;
  if (!res.ok || body.error) {
    throw new ClassifiableError('http_401', `Meta /me/accounts discovery failed: ${body.error?.message ?? res.status}`);
  }

  const accounts: CachedInstagramAccount[] = [];
  for (const page of body.data ?? []) {
    if (page.instagram_business_account && page.instagram_business_account.id) {
      accounts.push({
        igUserId: page.instagram_business_account.id,
        username: page.instagram_business_account.username,
        name: page.instagram_business_account.name,
        profilePictureUrl: page.instagram_business_account.profile_picture_url,
        followersCount: page.instagram_business_account.followers_count,
        pageId: page.id,
        pageName: page.name,
        pageAccessToken: page.access_token,
      });
    }
  }

  return accounts;
}

export const instagramOAuthRouter = Router();

/**
 * POST /v1/connectors/instagram/oauth/exchange — Exchanges OAuth code for tokens,
 * discovers linked Instagram Business accounts across Facebook Pages, and returns
 * a single-use sessionToken with discovery list.
 */
instagramOAuthRouter.post('/exchange', async (req, res) => {
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
    const accounts = await listAccessibleInstagramAccounts(longLivedToken);

    try {
      await markMissingAccountsOrphaned(identity.tenantId, identity.userId, accounts.map((a) => a.igUserId));
    } catch (err) {
      console.error(`[instagram-oauth] Failed to mark missing accounts orphaned (tenant=${identity.tenantId} user=${identity.userId}):`, err);
    }

    pruneExpired();
    const sessionToken = randomUUID();
    sessions.set(sessionToken, { accounts, expiresAt: Date.now() + SESSION_TTL_MS });

    res.status(200).json({
      sessionToken,
      accounts: accounts.map((a) => ({
        igUserId: a.igUserId,
        username: a.username,
        name: a.name,
        profilePictureUrl: a.profilePictureUrl,
        followersCount: a.followersCount,
        pageId: a.pageId,
        pageName: a.pageName,
      })),
    });
  } catch (err) {
    res.status(401).json({ error: 'Instagram OAuth exchange failed.', details: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * POST /v1/connectors/instagram/oauth/select-accounts — Stores credentials for selected
 * Instagram accounts, registers rows in instagram_connected_accounts, and activates the connector.
 */
instagramOAuthRouter.post('/select-accounts', async (req, res) => {
  const identity = requireTenantUserIdentity(req, res);
  if (!identity) return;
  const { tenantId, userId } = identity;

  const { sessionToken, igUserIds } = req.body;
  if (!sessionToken || typeof sessionToken !== 'string' || !Array.isArray(igUserIds) || igUserIds.length === 0 || !igUserIds.every((id) => typeof id === 'string')) {
    res.status(400).json({ error: 'sessionToken (string) and igUserIds (a non-empty array of strings) are required in request body.' });
    return;
  }

  pruneExpired();
  const entry = sessions.get(sessionToken);
  if (!entry) {
    res.status(410).json({ error: 'This OAuth session has expired or was already used — reconnect from the start.' });
    return;
  }

  const keyVaultKeyId = process.env.KEY_VAULT_KEY_ID;
  if (!keyVaultKeyId) {
    res.status(500).json({ error: 'Credential storage is not configured (KEY_VAULT_KEY_ID missing).' });
    return;
  }

  const connected: { igUserId: string; username: string; pageName: string }[] = [];
  const errors: { igUserId: string; reason: string }[] = [];

  for (const igUserId of igUserIds) {
    const account = entry.accounts.find((a) => a.igUserId === igUserId);
    if (!account) {
      errors.push({ igUserId, reason: 'No Instagram account with that id was found in this OAuth session.' });
      continue;
    }
    try {
      const credentialPlaintext = JSON.stringify({
        igUserId: account.igUserId,
        pageAccessToken: account.pageAccessToken,
        username: account.username,
        pageId: account.pageId,
        pageName: account.pageName,
      });
      const credential = await storeCredential(tenantId, INSTAGRAM_PROVIDER_ID, credentialPlaintext, keyVaultKeyId, 'user', userId);
      await upsertConnectedAccount(tenantId, userId, {
        igUserId: account.igUserId,
        username: account.username,
        pageId: account.pageId,
        pageName: account.pageName,
        credentialId: credential.id,
      });
      connected.push({ igUserId: account.igUserId, username: account.username, pageName: account.pageName });
    } catch {
      errors.push({ igUserId, reason: 'Failed to store credential.' });
    }
  }

  if (connected.length > 0) {
    await setConnectorActivation(tenantId, INSTAGRAM_PROVIDER_ID, 'user', true, userId, userId);
  }
  sessions.delete(sessionToken);
  res.status(201).json({ connected, errors });
});
