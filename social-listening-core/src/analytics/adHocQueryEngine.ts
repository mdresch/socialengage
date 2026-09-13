/**
 * Story 10.4 (ADR-0088) + Story 17.4 (ADR-0132, TDS-0132) — Ad-Hoc Analytics
 * Query Engine.
 *
 * compileAdHocQuery() validates a request against the allowlist enums and
 * compiles it into an immutable AST template — every user-supplied value binds
 * as a positional $N parameter; no request data is ever interpolated into SQL
 * text. executeAdHocQuery() then runs the template through the ADR-0132 budget
 * governor (EXPLAIN cost ceiling, 3s statement_timeout, 32MB work_mem,
 * 5,000-row cap) inside withTenant()'s transaction.
 *
 * See .claude/skills/ad-hoc-query-engine/SKILL.md.
 */

import { withTenant } from '../db/withTenant';
import { getPool } from '../db/pool';
import { PoolClient } from 'pg';
import {
  executeGovernedQuery,
  getGovernorConfig,
  QueryGovernorConfig,
} from './queryGovernor';

export const ALLOWED_DIMENSIONS = ['platform', 'sentiment', 'watchlist', 'author', 'date', 'hour'] as const;
export type Dimension = typeof ALLOWED_DIMENSIONS[number];

export const ALLOWED_METRICS = [
  'post_count',
  'positive_count',
  'neutral_count',
  'negative_count',
  'engagement_total',
] as const;
export type Metric = typeof ALLOWED_METRICS[number];

export const ALLOWED_TIME_GRAINS = ['day', 'hour', 'week', 'month'] as const;
export type TimeGrain = typeof ALLOWED_TIME_GRAINS[number];

export interface QueryFilters {
  startDate?: string;
  endDate?: string;
  platforms?: string[];
  sentiments?: string[];
  watchlists?: string[];
  authors?: string[];
}

export interface AdHocQueryRequest {
  dimensions?: Dimension[];
  metrics?: Metric[];
  timeGrain?: TimeGrain;
  filters?: QueryFilters;
  limit?: number;
  format?: 'json' | 'csv';
}

export interface FrozenQueryFilters {
  readonly startDate?: string;
  readonly endDate?: string;
  readonly platforms?: readonly string[];
  readonly sentiments?: readonly string[];
  readonly watchlists?: readonly string[];
  readonly authors?: readonly string[];
}

/** Frozen, tenant-independent query template. $1 is reserved for tenantId. */
export interface AdHocQueryAst {
  dimensions: readonly Dimension[];
  metrics: readonly Metric[];
  timeGrain: TimeGrain;
  filters: FrozenQueryFilters;
  limit: number;
  needsWatchlistJoin: boolean;
}

export interface CompiledAdHocQuery {
  ast: AdHocQueryAst;
  sql: string;
  /** Bind values for $2..$N — tenantId ($1) is prepended at execution. */
  params: readonly unknown[];
}

export interface AdHocQueryResponse {
  dimensions: Dimension[];
  metrics: Metric[];
  rowCount: number;
  executionTimeMs: number;
  data: Record<string, any>[];
  csv?: string;
  governor?: {
    estimatedCost: number;
    rowCap: number;
    appliedSettings: { statement_timeout: string; work_mem: string };
  };
}

const DIMENSION_EXPRESSIONS: Record<Exclude<Dimension, 'date' | 'hour'>, string> = {
  platform: `COALESCE(sp.raw_payload->>'providerId', 'unknown')`,
  sentiment: `COALESCE(sp.enrichment->>'sentiment', 'neutral')`,
  author: `sp.author_id`,
  watchlist: `pwm.watchlist_id`,
};

const METRIC_EXPRESSIONS: Record<Metric, string> = {
  post_count: `COUNT(DISTINCT sp.id)`,
  positive_count: `COUNT(DISTINCT sp.id) FILTER (WHERE sp.enrichment->>'sentiment' = 'positive')`,
  neutral_count: `COUNT(DISTINCT sp.id) FILTER (WHERE sp.enrichment->>'sentiment' = 'neutral')`,
  negative_count: `COUNT(DISTINCT sp.id) FILTER (WHERE sp.enrichment->>'sentiment' = 'negative')`,
  engagement_total: `COALESCE(SUM(sp.author_follower_count_at_publish), 0)`,
};

const TIME_GRAIN_EXPRESSIONS: Record<TimeGrain, string> = {
  day: `DATE(sp.published_at)`,
  hour: `date_trunc('hour', sp.published_at)`,
  week: `date_trunc('week', sp.published_at)`,
  month: `date_trunc('month', sp.published_at)`,
};

function freezeFilters(filters: QueryFilters): FrozenQueryFilters {
  return Object.freeze({
    ...filters,
    platforms: filters.platforms ? Object.freeze([...filters.platforms]) : undefined,
    sentiments: filters.sentiments ? Object.freeze([...filters.sentiments]) : undefined,
    watchlists: filters.watchlists ? Object.freeze([...filters.watchlists]) : undefined,
    authors: filters.authors ? Object.freeze([...filters.authors]) : undefined,
  });
}

/**
 * Compiles a request into an immutable AST template. $1 is always the
 * tenantId tenant-isolation predicate; every other user value becomes a
 * bound positional parameter in `params` ($2..$N). Throws on any dimension,
 * metric, or grain outside the allowlists.
 */
export function compileAdHocQuery(
  request: AdHocQueryRequest,
  config: QueryGovernorConfig = getGovernorConfig()
): CompiledAdHocQuery {
  const dimensions = request.dimensions || ['date'];
  const metrics = request.metrics || ['post_count'];
  const timeGrain = request.timeGrain || 'day';
  const limit = Math.min(config.maxRowsReturned, Math.max(1, request.limit ?? 500));

  for (const dim of dimensions) {
    if (!ALLOWED_DIMENSIONS.includes(dim)) {
      throw new Error(`Invalid dimension '${dim}'. Allowed: ${ALLOWED_DIMENSIONS.join(', ')}`);
    }
  }
  for (const metric of metrics) {
    if (!ALLOWED_METRICS.includes(metric)) {
      throw new Error(`Invalid metric '${metric}'. Allowed: ${ALLOWED_METRICS.join(', ')}`);
    }
  }
  if (!ALLOWED_TIME_GRAINS.includes(timeGrain)) {
    throw new Error(`Invalid time grain '${timeGrain}'. Allowed: ${ALLOWED_TIME_GRAINS.join(', ')}`);
  }

  const filters = freezeFilters(request.filters || {});
  const needsWatchlistJoin =
    dimensions.includes('watchlist') || (filters.watchlists !== undefined && filters.watchlists.length > 0);

  const ast: AdHocQueryAst = Object.freeze({
    dimensions: Object.freeze([...dimensions]),
    metrics: Object.freeze([...metrics]),
    timeGrain,
    filters,
    limit,
    needsWatchlistJoin,
  });

  // Emit SQL from fixed fragment tables keyed by the frozen AST. $1 = tenantId.
  const selectParts: string[] = [];
  const groupByParts: string[] = [];
  const whereClauses: string[] = ['sp.tenant_id = $1'];
  const params: unknown[] = [];
  let paramIdx = 2;

  for (const dim of ast.dimensions) {
    if (dim === 'date' || dim === 'hour') {
      const expr = TIME_GRAIN_EXPRESSIONS[ast.timeGrain];
      selectParts.push(`${expr} AS ${dim}`);
      groupByParts.push(expr);
    } else {
      const expr = DIMENSION_EXPRESSIONS[dim];
      selectParts.push(`${expr} AS ${dim}`);
      groupByParts.push(expr);
    }
  }
  for (const metric of ast.metrics) {
    selectParts.push(`${METRIC_EXPRESSIONS[metric]} AS ${metric}`);
  }

  if (filters.startDate) {
    whereClauses.push(`sp.published_at >= $${paramIdx++}::timestamptz`);
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    whereClauses.push(`sp.published_at <= $${paramIdx++}::timestamptz`);
    params.push(filters.endDate);
  }
  if (filters.platforms && filters.platforms.length > 0) {
    whereClauses.push(`${DIMENSION_EXPRESSIONS.platform} = ANY($${paramIdx++})`);
    params.push(filters.platforms);
  }
  if (filters.sentiments && filters.sentiments.length > 0) {
    whereClauses.push(`${DIMENSION_EXPRESSIONS.sentiment} = ANY($${paramIdx++})`);
    params.push(filters.sentiments);
  }
  if (filters.authors && filters.authors.length > 0) {
    whereClauses.push(`sp.author_id = ANY($${paramIdx++}::uuid[])`);
    params.push(filters.authors);
  }

  const joins: string[] = [];
  if (ast.needsWatchlistJoin) {
    joins.push(`LEFT JOIN post_watchlist_matches pwm ON pwm.post_id = sp.id`);
    if (filters.watchlists && filters.watchlists.length > 0) {
      whereClauses.push(`pwm.watchlist_id = ANY($${paramIdx++}::uuid[])`);
      params.push(filters.watchlists);
    }
  }

  params.push(limit);
  const limitParamIdx = paramIdx;

  const sql = `
    SELECT ${selectParts.join(', ')}
    FROM social_posts sp
    ${joins.join('\n')}
    WHERE ${whereClauses.join(' AND ')}
    ${groupByParts.length > 0 ? `GROUP BY ${groupByParts.join(', ')}` : ''}
    ORDER BY 1 DESC
    LIMIT $${limitParamIdx}
  `;

  return Object.freeze({ ast, sql, params: Object.freeze(params) });
}

export async function executeAdHocQuery(
  tenantId: string,
  userId: string,
  request: AdHocQueryRequest,
  governorOverrides: Partial<QueryGovernorConfig> = {}
): Promise<AdHocQueryResponse> {
  const startTime = Date.now();
  const config = getGovernorConfig(governorOverrides);
  const format = request.format || 'json';
  const compiled = compileAdHocQuery(request, config);

  const governed = await withTenant(
    tenantId,
    async (client: PoolClient) =>
      executeGovernedQuery(
        client,
        compiled.sql,
        [tenantId, ...compiled.params],
        compiled.ast,
        config,
        { tenantId }
      ),
    getPool(),
    userId
  );

  const { rows } = governed;
  const executionTimeMs = Date.now() - startTime;

  let csv: string | undefined;
  if (format === 'csv') {
    const headers = [...compiled.ast.dimensions, ...compiled.ast.metrics];
    const csvRows = [headers.join(',')];
    for (const row of rows) {
      const line = headers.map(h => {
        const val = row[h];
        if (val === null || val === undefined) return '';
        if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return String(val);
      }).join(',');
      csvRows.push(line);
    }
    csv = csvRows.join('\n');
  }

  return {
    dimensions: [...compiled.ast.dimensions],
    metrics: [...compiled.ast.metrics],
    rowCount: rows.length,
    executionTimeMs,
    data: rows,
    csv,
    governor: {
      estimatedCost: governed.estimatedCost,
      rowCap: config.maxRowsReturned,
      appliedSettings: governed.appliedSettings,
    },
  };
}
