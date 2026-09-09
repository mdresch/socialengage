import { Router } from 'express';
import { requireTenantUserIdentity } from '../../auth/requireTenantUser';
import {
  getMentionSuggestions,
  MentionSuggestionsError,
} from '../../../composer/mentionSuggestionsService';

export const mentionSuggestionsRouter = Router();

/**
 * Story 11.11 (ADR-0100) — POST /v1/composer/mention-suggestions
 */
mentionSuggestionsRouter.post('/mention-suggestions', async (req, res) => {
  const identity = requireTenantUserIdentity(req, res);
  if (!identity) return;
  const { tenantId } = identity;

  const { text, targetPlatforms, watchlistId, maxSuggestions } = req.body || {};

  if (!targetPlatforms || !Array.isArray(targetPlatforms)) {
    res.status(422).json({
      error: 'targetPlatforms array is required.',
      code: 'INVALID_PLATFORMS',
    });
    return;
  }

  try {
    const result = await getMentionSuggestions(tenantId, {
      text: typeof text === 'string' ? text : '',
      targetPlatforms,
      watchlistId,
      maxSuggestions: maxSuggestions ? parseInt(maxSuggestions, 10) : undefined,
    });

    res.json(result);
  } catch (err: any) {
    if (err instanceof MentionSuggestionsError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    res.status(500).json({ error: err.message || 'Failed to get mention suggestions' });
  }
});
