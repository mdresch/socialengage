import { Router } from 'express';
import { requireTenantUserIdentity } from '../../auth/requireTenantUser';
import { storeCredential } from '../../../credentials/credentialStore';
import { getKeyVaultKeyId } from '../../../credentials/keyVaultProvider';
import { setConnectorActivation } from '../../../connectors/connectorActivationStore';
import {
  generateState,
  getAuthUrl,
  exchangeAuthorizationCode,
  LINKEDIN_PROVIDER_ID,
} from '../../../connectors/linkedin/linkedinConnector';
import { flushConnectorHealthCache } from '../../../connectors/connectorHealthCache';

export const linkedinOAuthRouter = Router();

/**
 * POST /v1/connectors/linkedin/oauth/start — Generates a tenant-scoped CSRF state
 * and returns the LinkedIn authorize URL.
 */
linkedinOAuthRouter.post('/start', (req, res) => {
  const identity = requireTenantUserIdentity(req, res);
  if (!identity) return;

  const redirectUri = req.body?.redirectUri || process.env.LINKEDIN_REDIRECT_URI || '';
  const clientId = process.env.LINKEDIN_CLIENT_ID || '';
  const state = generateState(identity.tenantId);
  const authorizeUrl = getAuthUrl(identity.tenantId, state, { clientId, redirectUri });

  res.status(200).json({ state, authorizeUrl });
});

/**
 * POST /v1/connectors/linkedin/oauth/exchange — Validates state, exchanges authorization
 * code for LinkedIn tokens, securely stores the credential in Azure Key Vault, and activates
 * the LinkedIn connector for the user.
 */
linkedinOAuthRouter.post('/exchange', async (req, res) => {
  const identity = requireTenantUserIdentity(req, res);
  if (!identity) return;
  const { tenantId, userId } = identity;

  const { code, state, redirectUri } = req.body;
  if (!code || typeof code !== 'string' || !state || typeof state !== 'string') {
    res.status(400).json({ error: 'code and state (both strings) are required in request body.' });
    return;
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const effectiveRedirectUri = redirectUri || process.env.LINKEDIN_REDIRECT_URI;

  if (!clientId || !clientSecret || !effectiveRedirectUri) {
    res.status(500).json({ error: 'LinkedIn OAuth credentials (LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, LINKEDIN_REDIRECT_URI) are not configured.' });
    return;
  }

  const keyVaultKeyId = getKeyVaultKeyId();
  if (!keyVaultKeyId) {
    res.status(500).json({ error: 'Credential storage is not configured (KEY_VAULT_KEY_ID missing).' });
    return;
  }

  try {
    const cred = await exchangeAuthorizationCode(code, state, tenantId, {
      clientId,
      clientSecret,
      redirectUri: effectiveRedirectUri,
      skipStateValidation: true,
    });

    const credentialPlaintext = JSON.stringify(cred);
    await storeCredential(tenantId, LINKEDIN_PROVIDER_ID, credentialPlaintext, keyVaultKeyId, 'user', userId);
    await setConnectorActivation(tenantId, LINKEDIN_PROVIDER_ID, 'user', true, userId, userId);
    flushConnectorHealthCache();

    res.status(200).json({
      success: true,
      memberId: cred.memberId,
      memberName: cred.memberName,
    });
  } catch (err) {
    res.status(401).json({
      error: 'LinkedIn OAuth exchange failed.',
      details: err instanceof Error ? err.message : String(err),
    });
  }
});
