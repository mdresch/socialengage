import { Router } from 'express';
import {
  createWatchlist,
  listWatchlists,
  getWatchlistById,
  updateWatchlist,
  deleteWatchlist,
  CreateWatchlistInput,
  UpdateWatchlistInput,
  Watchlist,
} from '../../../watchlists/watchlistStore';

export const watchlistsRouter = Router();

/**
 * POST /v1/watchlists — create a new watchlist for the current tenant.
 * Tenant identity comes from the X-Tenant-Id header placeholder (Phase 1,
 * see .claude/skills/posts-api/SKILL.md Known gaps). Returns 201 with the
 * created watchlist, including generated id and timestamps.
 */
watchlistsRouter.post('/', async (req, res) => {
  const tenantId = req.header('X-Tenant-Id');
  if (!tenantId) {
    res.status(400).json({ error: 'X-Tenant-Id header is required.' });
    return;
  }

  const input: CreateWatchlistInput = {
    name: req.body.name,
    matchType: req.body.matchType,
    terms: req.body.terms,
    booleanQuery: req.body.booleanQuery,
    platformIds: req.body.platformIds,
    isActive: req.body.isActive,
  };

  // Validate required fields
  if (!input.name) {
    res.status(400).json({ error: 'name is required.' });
    return;
  }
  if (!input.matchType || !['keyword', 'hashtag', 'account', 'boolean'].includes(input.matchType)) {
    res.status(400).json({ error: 'matchType is required and must be one of: keyword, hashtag, account, boolean' });
    return;
  }

  // Validate booleanQuery is provided when matchType is 'boolean'
  if (input.matchType === 'boolean' && !input.booleanQuery) {
    res.status(400).json({ error: 'booleanQuery is required when matchType is boolean.' });
    return;
  }

  try {
    const watchlist = await createWatchlist(tenantId, input);
    res.status(201).json(watchlist);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create watchlist.' });
  }
});

/**
 * GET /v1/watchlists — list all watchlists for the current tenant.
 * Tenant identity comes from the X-Tenant-Id header placeholder.
 * Supports optional matchType query parameter to filter by match type.
 */
watchlistsRouter.get('/', async (req, res) => {
  const tenantId = req.header('X-Tenant-Id');
  if (!tenantId) {
    res.status(400).json({ error: 'X-Tenant-Id header is required.' });
    return;
  }

  const options = {
    matchType: typeof req.query.matchType === 'string' ? req.query.matchType : undefined,
  };

  try {
    const page = await listWatchlists(tenantId, options);
    res.json(page);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list watchlists.' });
  }
});

/**
 * PATCH /v1/watchlists/:id — update a watchlist by id for the current tenant.
 * Only updates fields provided in the request body (PATCH semantics).
 * Returns 404 if the watchlist doesn't exist or belongs to a different tenant.
 */
watchlistsRouter.patch('/:id', async (req, res) => {
  const tenantId = req.header('X-Tenant-Id');
  if (!tenantId) {
    res.status(400).json({ error: 'X-Tenant-Id header is required.' });
    return;
  }

  const input: UpdateWatchlistInput = {
    name: req.body.name,
    matchType: req.body.matchType,
    terms: req.body.terms,
    booleanQuery: req.body.booleanQuery,
    platformIds: req.body.platformIds,
    isActive: req.body.isActive,
  };

  // Validate matchType if provided
  if (input.matchType && !['keyword', 'hashtag', 'account', 'boolean'].includes(input.matchType)) {
    res.status(400).json({ error: 'matchType must be one of: keyword, hashtag, account, boolean' });
    return;
  }

  // Validate booleanQuery is provided when matchType is 'boolean'
  if (input.matchType === 'boolean' && !input.booleanQuery) {
    res.status(400).json({ error: 'booleanQuery is required when matchType is boolean.' });
    return;
  }

  try {
    const watchlist = await updateWatchlist(tenantId, req.params.id, input);
    if (!watchlist) {
      res.status(404).json({ error: 'Watchlist not found.' });
      return;
    }
    res.json(watchlist);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update watchlist.' });
  }
});

/**
 * DELETE /v1/watchlists/:id — delete a watchlist by id for the current tenant.
 * Returns 204 on success, 404 if the watchlist doesn't exist or belongs
 * to a different tenant.
 */
watchlistsRouter.delete('/:id', async (req, res) => {
  const tenantId = req.header('X-Tenant-Id');
  if (!tenantId) {
    res.status(400).json({ error: 'X-Tenant-Id header is required.' });
    return;
  }

  try {
    const deleted = await deleteWatchlist(tenantId, req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Watchlist not found.' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete watchlist.' });
  }
});
