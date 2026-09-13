/**
 * Story 17.4 (ADR-0132, TDS-0132) — Pre-execution budget governor for governed
 * SQL paths. Runs EXPLAIN (FORMAT JSON) against the real planner, rejects
 * plans over budget with QueryCostExceededError (mapped to HTTP 422 by the
 * route), then applies transaction-local safeguards before execution.
 *
 * See .claude/skills/ad-hoc-query-engine/SKILL.md.
 */

import { PoolClient } from 'pg';

export interface QueryGovernorConfig {
  maxEstimatedCost: number;   // planner Total Cost ceiling; default 10,000
  statementTimeoutMs: number; // SET LOCAL statement_timeout; default 3,000
  workMem: string;            // SET LOCAL work_mem; default '32MB'
  maxRowsReturned: number;    // LIMIT bind cap; default 5,000
}

export const DEFAULT_GOVERNOR_CONFIG: QueryGovernorConfig = {
  maxEstimatedCost: 10000,
  statementTimeoutMs: 3000,
  workMem: '32MB',
  maxRowsReturned: 5000,
};

export function getGovernorConfig(overrides: Partial<QueryGovernorConfig> = {}): QueryGovernorConfig {
  return {
    maxEstimatedCost: process.env.QUERY_GOVERNOR_MAX_COST !== undefined
      ? Number(process.env.QUERY_GOVERNOR_MAX_COST)
      : DEFAULT_GOVERNOR_CONFIG.maxEstimatedCost,
    statementTimeoutMs: process.env.QUERY_GOVERNOR_STATEMENT_TIMEOUT_MS !== undefined
      ? Number(process.env.QUERY_GOVERNOR_STATEMENT_TIMEOUT_MS)
      : DEFAULT_GOVERNOR_CONFIG.statementTimeoutMs,
    workMem: process.env.QUERY_GOVERNOR_WORK_MEM ?? DEFAULT_GOVERNOR_CONFIG.workMem,
    maxRowsReturned: process.env.QUERY_GOVERNOR_MAX_ROWS !== undefined
      ? Number(process.env.QUERY_GOVERNOR_MAX_ROWS)
      : DEFAULT_GOVERNOR_CONFIG.maxRowsReturned,
    ...overrides,
  };
}

export class QueryCostExceededError extends Error {
  readonly estimatedCost: number;
  readonly budgetLimit: number;
  readonly suggestedAdjustments: string[];

  constructor(estimatedCost: number, budgetLimit: number, suggestedAdjustments: string[]) {
    super('The requested multi-dimensional query would scan too many partitions. Narrow your date range or add platform filters.');
    this.name = 'QueryCostExceededError';
    this.estimatedCost = estimatedCost;
    this.budgetLimit = budgetLimit;
    this.suggestedAdjustments = suggestedAdjustments;
  }
}

export interface GovernedQueryAst {
  readonly dimensions: readonly string[];
  readonly filters: {
    readonly startDate?: string;
    readonly platforms?: readonly unknown[];
    readonly watchlists?: readonly unknown[];
    readonly authors?: readonly unknown[];
  };
}

export function suggestFilterAdjustments(ast: GovernedQueryAst): string[] {
  const filters = ast.filters;
  const suggestions: string[] = [];
  if (!filters.startDate) suggestions.push('Add a startDate filter to narrow the scanned date range.');
  if (!filters.platforms || filters.platforms.length === 0) suggestions.push('Add platform filters to restrict the scan.');
  if (!filters.watchlists && !filters.authors) suggestions.push('Add a watchlist or author filter to reduce the result set.');
  if (suggestions.length === 0) suggestions.push('Narrow your date range or add platform filters.');
  return suggestions;
}

export interface GovernedQueryResult {
  rows: Record<string, unknown>[];
  estimatedCost: number;
  appliedSettings: { statement_timeout: string; work_mem: string };
}

/**
 * Runs the governor inside the caller's transaction (SET LOCAL requires one —
 * call inside withTenant()). Order: EXPLAIN cost check → SET LOCAL safeguards
 * → real session readback → bound execution.
 */
export async function executeGovernedQuery(
  client: PoolClient,
  sql: string,
  params: unknown[],
  ast: GovernedQueryAst,
  config: QueryGovernorConfig,
  context: { tenantId: string }
): Promise<GovernedQueryResult> {
  const explain = await client.query(`EXPLAIN (FORMAT JSON) ${sql}`, params);
  const plan = explain.rows[0]?.['QUERY PLAN']?.[0];
  const estimatedCost: number = plan?.Plan?.['Total Cost'] ?? 0;

  if (estimatedCost > config.maxEstimatedCost) {
    console.warn('query_governor_rejected', {
      tenant_id: context.tenantId,
      estimated_cost: estimatedCost,
      dimensions: ast.dimensions,
    });
    throw new QueryCostExceededError(estimatedCost, config.maxEstimatedCost, suggestFilterAdjustments(ast));
  }

  await client.query(`SET LOCAL statement_timeout = '${config.statementTimeoutMs}ms'`);
  await client.query(`SET LOCAL work_mem = '${config.workMem}'`);

  const applied = await client.query<{ statement_timeout: string; work_mem: string }>(
    `SELECT current_setting('statement_timeout') AS statement_timeout, current_setting('work_mem') AS work_mem`
  );

  const { rows } = await client.query(sql, params);

  return { rows, estimatedCost, appliedSettings: applied.rows[0] };
}
