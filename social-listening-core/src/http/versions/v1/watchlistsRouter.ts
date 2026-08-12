import { Router } from 'express';
import {
  createWatchlist,
  listWatchlists,
  getWatchlistById,
  updateWatchlist,
  deleteWatchlist,
  validateWatchlistShape,
  CreateWatchlistInput,
  WatchlistPatchInput,
} from '../../../watchlists/watchlistStore';
import { requireTenantUserIdentity } from '../../auth/requireTenantUser';

export const watchlistsRouter = Router();

const MATCH_TYPES = ['keyword', 'hashtag', 'account', 'boolean'];

/**
 * Strips RFC 7396 (ADR-0044 §1) quoting some clients put around an ETag-style
 * version token (`If-Match: "3"`), tolerating an unquoted one (`If-Match: 3`)
 * too. Returns null if what's left doesn't parse as an integer.
 */
function parseIfMatchVersion(headerValue: string): number | null {
  const unquoted = headerValue.replace(/^"|"$/g, '');
  if (!/^\d+$/.test(unquoted)) return null;
  return Number(unquoted);
}

/**
 * POST /v1/watchlists — create a new watchlist owned by the caller.
 * Tenant and owner identity come from the resolved, token-authenticated
 * caller (Story 5.10, ADR-0044 §5c) via requireTenantUserIdentity() — never
 * a client-supplied header or body field. Returns 201 with the created
 * watchlist, including generated id, version 1, and timestamps.
 */
watchlistsRouter.post('/', async (req, res) => {
  const identity = requireTenantUserIdentity(req, res);
  if (!identity) return;

  const { name, matchType, terms, booleanQuery, platformIds, isActive } = req.body;

  if (!name || typeof name !== 'string') {
    res.status(400).json({ code: 'bad_request' });
    return;
  }
  if (!matchType || !MATCH_TYPES.includes(matchType)) {
    res.status(400).json({ code: 'bad_request' });
    return;
  }
  if (terms !== undefined && terms !== null && !Array.isArray(terms)) {
    res.status(400).json({ code: 'bad_request' });
    return;
  }
  if (platformIds !== undefined && !Array.isArray(platformIds)) {
    res.status(400).json({ code: 'bad_request' });
    return;
  }

  const details = validateWatchlistShape(matchType, terms ?? null, booleanQuery ?? null);
  if (details.length > 0) {
    res.status(422).json({ code: 'validation_failed', details });
    return;
  }

  const input: CreateWatchlistInput = { name, matchType, terms, booleanQuery, platformIds, isActive };

  try {
    const watchlist = await createWatchlist(identity.tenantId, identity.userId, input);
    res.status(201).json(watchlist);
  } catch (err) {
    res.status(500).json({ code: 'internal_error' });
  }
});

/**
 * GET /v1/watchlists — list the caller's own watchlists. Supports an
 * optional matchType query parameter to filter by type.
 */
watchlistsRouter.get('/', async (req, res) => {
  const identity = requireTenantUserIdentity(req, res);
  if (!identity) return;

  const options = {
    matchType: typeof req.query.matchType === 'string' ? req.query.matchType : undefined,
  };

  try {
    const page = await listWatchlists(identity.tenantId, identity.userId, options);
    res.json(page);
  } catch (err) {
    res.status(500).json({ code: 'internal_error' });
  }
});

/**
 * GET /v1/watchlists/:id — fetch a single watchlist the caller owns.
 * 404 (not_found) whether the id doesn't exist, belongs to another tenant,
 * or belongs to another user in the same tenant — deliberately
 * indistinguishable (ADR-0044 §5c, Appendix A).
 */
watchlistsRouter.get('/:id', async (req, res) => {
  const identity = requireTenantUserIdentity(req, res);
  if (!identity) return;

  try {
    const watchlist = await getWatchlistById(identity.tenantId, identity.userId, req.params.id);
    if (!watchlist) {
      res.status(404).json({ code: 'not_found' });
      return;
    }
    res.json(watchlist);
  } catch (err) {
    res.status(500).json({ code: 'internal_error' });
  }
});

/**
 * PATCH /v1/watchlists/:id — RFC 7396 JSON Merge Patch update of a
 * watchlist the caller owns, with version-based optimistic locking
 * (ADR-0044 §1/§2/§3). `If-Match` is required (428 if absent); a stale
 * version returns 409 with the current version; a resulting
 * matchType/terms/booleanQuery combination that violates §5a's invariant
 * returns 422; a malformed body returns 400; a missing/not-owned watchlist
 * returns 404.
 */
watchlistsRouter.patch('/:id', async (req, res) => {
  const identity = requireTenantUserIdentity(req, res);
  if (!identity) return;

  const ifMatch = req.header('If-Match');
  if (ifMatch === undefined) {
    res.status(428).json({ code: 'precondition_required' });
    return;
  }
  const expectedVersion = parseIfMatchVersion(ifMatch);
  if (expectedVersion === null) {
    res.status(400).json({ code: 'bad_request' });
    return;
  }

  const body = req.body ?? {};
  const patch: WatchlistPatchInput = {};
  if ('name' in body) patch.name = body.name;
  if ('matchType' in body) patch.matchType = body.matchType;
  if ('terms' in body) patch.terms = body.terms;
  if ('booleanQuery' in body) patch.booleanQuery = body.booleanQuery;
  if ('platformIds' in body) patch.platformIds = body.platformIds;
  if ('isActive' in body) patch.isActive = body.isActive;

  if ('matchType' in patch && patch.matchType != null && !MATCH_TYPES.includes(patch.matchType)) {
    res.status(400).json({ code: 'bad_request' });
    return;
  }
  if ('terms' in patch && patch.terms != null && !Array.isArray(patch.terms)) {
    res.status(400).json({ code: 'bad_request' });
    return;
  }
  if ('platformIds' in patch && patch.platformIds != null && !Array.isArray(patch.platformIds)) {
    res.status(400).json({ code: 'bad_request' });
    return;
  }

  try {
    const result = await updateWatchlist(identity.tenantId, identity.userId, req.params.id, patch, expectedVersion);
    switch (result.outcome) {
      case 'updated':
        res.json(result.watchlist);
        return;
      case 'not_found':
        res.status(404).json({ code: 'not_found' });
        return;
      case 'version_conflict':
        res.status(409).json({ code: 'version_conflict', current_version: result.currentVersion });
        return;
      case 'validation_failed':
        res.status(422).json({ code: 'validation_failed', details: result.details });
        return;
    }
  } catch (err) {
    res.status(500).json({ code: 'internal_error' });
  }
});

/**
 * DELETE /v1/watchlists/:id — delete a watchlist the caller owns.
 * Returns 204 on success, 404 if the watchlist doesn't exist, belongs to a
 * different tenant, or belongs to a different user in the same tenant.
 */
watchlistsRouter.delete('/:id', async (req, res) => {
  const identity = requireTenantUserIdentity(req, res);
  if (!identity) return;

  try {
    const deleted = await deleteWatchlist(identity.tenantId, identity.userId, req.params.id);
    if (!deleted) {
      res.status(404).json({ code: 'not_found' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ code: 'internal_error' });
  }
});
