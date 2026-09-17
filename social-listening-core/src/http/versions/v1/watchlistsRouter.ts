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
import { previewWatchlistVolume, watchlistToAst } from '../../../watchlists/previewVolumeService';
import { requireTenantUserIdentity } from '../../auth/requireTenantUser';
import {
  shareWatchlist,
  listWatchlistShares,
  removeWatchlistShare,
} from '../../../watchlists/watchlistShareStore';

import {
  WatchlistAST,
  validateWatchlistAst,
  parseBooleanQueryToAst,
} from '../../../watchlists/ast';
import { validateAstForConnector } from '../../../connectors/queryCapabilities';
import { registerOpenApiOperation } from '../../openapi/registry';
import { requireFeatureGate } from '../../auth/featureGates';

/**
 * Story 20.1 (ADR-0144): the two read operations FDD-0144's watchlist
 * reference screen (Stories 20.3-20.5) actually needs, registered at module
 * load so they show up in the generated OpenAPI document regardless of
 * whether this router is ever mounted — see
 * .claude/skills/openapi-spec-generation/SKILL.md.
 */
registerOpenApiOperation('get', '/v1/watchlists', {
  summary: "List the caller's own watchlists, optionally filtered by matchType.",
  responses: {
    '200': { description: "The caller's watchlists." },
    '500': { description: 'Internal error.' },
  },
});
registerOpenApiOperation('get', '/v1/watchlists/{id}', {
  summary: 'Fetch a single watchlist the caller owns.',
  responses: {
    '200': { description: 'The watchlist.' },
    '404': { description: "Not found, not the caller's, or belongs to another tenant." },
    '500': { description: 'Internal error.' },
  },
});

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
watchlistsRouter.post('/', requireFeatureGate('watchlists'), async (req, res) => {
  const identity = requireTenantUserIdentity(req, res);
  if (!identity) return;

  const { name, matchType, terms, booleanQuery, ast, platformIds, isActive } = req.body;

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

  const details = validateWatchlistShape(matchType, terms ?? null, booleanQuery ?? null, ast ?? null);
  if (details.length > 0) {
    res.status(422).json({ code: 'validation_failed', details });
    return;
  }

  // Story 12.3: Per-connector query AST capability validation
  const effectiveAst: WatchlistAST | null = ast ?? (booleanQuery ? parseBooleanQueryToAst(booleanQuery) : null);
  if (effectiveAst && Array.isArray(platformIds)) {
    for (const platformId of platformIds) {
      const astCheck = validateAstForConnector(effectiveAst, platformId);
      if (!astCheck.valid) {
        res.status(422).json({
          code: astCheck.code ?? 'UNSUPPORTED_QUERY_CLAUSE',
          offendingClause: astCheck.offendingClause,
          reason: astCheck.reason,
        });
        return;
      }
    }
  }

  const input: CreateWatchlistInput = { name, matchType, terms, booleanQuery, ast, platformIds, isActive };

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
  if ('ast' in body) patch.ast = body.ast;
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

  // Story 12.3: Per-connector query AST capability validation on patch
  if (patch.ast && patch.platformIds) {
    for (const platformId of patch.platformIds) {
      const astCheck = validateAstForConnector(patch.ast, platformId);
      if (!astCheck.valid) {
        res.status(422).json({
          code: astCheck.code ?? 'UNSUPPORTED_QUERY_CLAUSE',
          offendingClause: astCheck.offendingClause,
          reason: astCheck.reason,
        });
        return;
      }
    }
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

/**
 * Story 9.1 (ADR-0077 §4) — POST /v1/watchlists/preview-volume. Tenant-scoped
 * and RLS-gated via requireTenantUserIdentity() (and, for the watchlistId
 * path, getWatchlistById()'s ownership-scoped RLS — a cross-tenant caller
 * gets 404). Accepts either a `watchlistId` (loaded under RLS, AST derived
 * from the stored query) or an inline `ast`, plus `connectorIds` and an
 * optional `timeWindow`. Returns WatchlistVolumePreview with a per-connector
 * breakdown; a single connector failure is returned as
 * `confidence: 'unavailable'` without failing the HTTP request (ADR-0077 §4).
 */
watchlistsRouter.post('/preview-volume', async (req, res) => {
  const identity = requireTenantUserIdentity(req, res);
  if (!identity) return;

  const body = req.body ?? {};
  const connectorIds: string[] = Array.isArray(body.connectorIds) ? body.connectorIds : [];
  const timeWindow = body.timeWindow ?? undefined;

  let ast;
  let resolvedConnectorIds = connectorIds;
  if (body.watchlistId && typeof body.watchlistId === 'string') {
    try {
      const watchlist = await getWatchlistById(identity.tenantId, identity.userId, body.watchlistId);
      if (!watchlist) {
        res.status(404).json({ code: 'not_found' });
        return;
      }
      ast = watchlistToAst(watchlist);
      if (connectorIds.length === 0) {
        resolvedConnectorIds = watchlist.platformIds ?? [];
      }
    } catch (err) {
      res.status(500).json({ code: 'internal_error' });
      return;
    }
  } else if (body.ast && typeof body.ast === 'object') {
    ast = body.ast;
  }

  if (!ast) {
    res.status(400).json({ code: 'bad_request' });
    return;
  }

    try {
    const preview = await previewWatchlistVolume({
      tenantId: identity.tenantId,
      ast,
      connectorIds: resolvedConnectorIds,
      timeWindow,
    });
    res.json(preview);
  } catch (err) {
    res.status(500).json({ code: 'internal_error' });
  }
});

// ─── Story 12.13 (ADR-0107): Watchlist sharing endpoints ───────────────────────

/**
 * POST /v1/watchlists/:id/shares — share a watchlist with another user.
 */
watchlistsRouter.post('/:id/shares', async (req, res) => {
  const identity = requireTenantUserIdentity(req, res);
  if (!identity) return;

  const { sharedWithUserId, permission } = req.body || {};
  if (!sharedWithUserId) {
    res.status(400).json({ error: 'sharedWithUserId is required.' });
    return;
  }

  try {
    const share = await shareWatchlist(identity.tenantId, identity.userId, {
      watchlistId: req.params.id,
      sharedWithUserId,
      permission,
    });
    res.status(201).json(share);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to share watchlist.' });
  }
});

/**
 * GET /v1/watchlists/:id/shares — list shares for a watchlist.
 */
watchlistsRouter.get('/:id/shares', async (req, res) => {
  const identity = requireTenantUserIdentity(req, res);
  if (!identity) return;

  try {
    const shares = await listWatchlistShares(identity.tenantId, req.params.id, identity.userId);
    res.json({ shares });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to list shares.' });
  }
});

/**
 * DELETE /v1/watchlists/:id/shares/:userId — remove a share.
 */
watchlistsRouter.delete('/:id/shares/:userId', async (req, res) => {
  const identity = requireTenantUserIdentity(req, res);
  if (!identity) return;

  try {
    await removeWatchlistShare(identity.tenantId, req.params.id, req.params.userId, identity.userId);
    res.status(204).end();
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to remove share.' });
  }
});
