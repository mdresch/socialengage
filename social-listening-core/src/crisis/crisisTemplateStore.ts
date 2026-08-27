import { getPool } from '../db/pool';
import { withTenant } from '../db/withTenant';

export interface CrisisTemplateParameter {
  key: string;
  label: string;
  type: string;
  required?: boolean;
}

export interface CrisisPlaybookStep {
  step: number;
  owner: string;
  action: string;
  slaMinutes?: number;
  sla_minutes?: number;
}

export interface CrisisTemplateThresholds {
  volumeSpikePct?: number;
  negativeSentimentPct?: number;
  timeWindowMinutes?: number;
  volume_spike_pct?: number;
  negative_sentiment_pct?: number;
  time_window_minutes?: number;
  [key: string]: any;
}

export interface CrisisTemplateRow {
  id: string;
  template_key: string;
  name: string;
  description: string;
  default_query: string;
  default_ast: any;
  parameters: CrisisTemplateParameter[];
  default_thresholds: CrisisTemplateThresholds;
  playbook: CrisisPlaybookStep[];
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CrisisTemplate {
  templateKey: string;
  name: string;
  description: string;
  defaultQuery: string;
  defaultAst: any;
  parameters: CrisisTemplateParameter[];
  defaultThresholds: CrisisTemplateThresholds;
  playbook: CrisisPlaybookStep[];
  isActive: boolean;
}

export interface ActivateCrisisTemplateInput {
  name?: string;
  variables: Record<string, string | string[]>;
  customQuery?: string;
  customThresholds?: CrisisTemplateThresholds;
  notificationChannelIds: string[];
}

export interface CrisisActivationResult {
  tenantCrisisTemplateId: string;
  watchlistId: string;
  status: 'active';
  playbook: CrisisPlaybookStep[];
  thresholds: CrisisTemplateThresholds;
  notificationChannelIds: string[];
}

export function mapRowToCrisisTemplate(row: CrisisTemplateRow): CrisisTemplate {
  return {
    templateKey: row.template_key,
    name: row.name,
    description: row.description,
    defaultQuery: row.default_query,
    defaultAst: row.default_ast,
    parameters: row.parameters ?? [],
    defaultThresholds: row.default_thresholds ?? {},
    playbook: row.playbook ?? [],
    isActive: row.is_active,
  };
}

/**
 * Replaces mustache tokens (e.g. {{brand_name}}) with provided variable values.
 */
export function interpolateString(templateStr: string, variables: Record<string, string | string[]>): string {
  let result = templateStr;
  for (const [key, val] of Object.entries(variables)) {
    const formatted = Array.isArray(val) ? val.join(' OR ') : String(val);
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, formatted);
  }
  return result;
}

/**
 * Deeply interpolates string placeholders inside JSON AST structures.
 */
export function interpolateAst(ast: any, variables: Record<string, string | string[]>): any {
  if (!ast || typeof ast !== 'object') return ast;
  if (Array.isArray(ast)) {
    return ast.map((item) => interpolateAst(item, variables));
  }
  const result: any = {};
  for (const [k, v] of Object.entries(ast)) {
    if (typeof v === 'string') {
      result[k] = interpolateString(v, variables);
    } else if (typeof v === 'object') {
      result[k] = interpolateAst(v, variables);
    } else {
      result[k] = v;
    }
  }
  return result;
}

/**
 * Lists all active platform crisis templates available for preview and activation.
 */
export async function listActiveCrisisTemplates(): Promise<CrisisTemplate[]> {
  const pool = getPool();
  const { rows } = await pool.query<CrisisTemplateRow>(
    `SELECT * FROM crisis_templates WHERE is_active = true ORDER BY name ASC`
  );
  return rows.map(mapRowToCrisisTemplate);
}

/**
 * Fetches a single platform crisis template by its unique template_key.
 */
export async function getCrisisTemplateByKey(templateKey: string): Promise<CrisisTemplate | null> {
  const pool = getPool();
  const { rows } = await pool.query<CrisisTemplateRow>(
    `SELECT * FROM crisis_templates WHERE template_key = $1`,
    [templateKey]
  );
  if (rows.length === 0) return null;
  return mapRowToCrisisTemplate(rows[0]);
}

/**
 * Activates a crisis template for a tenant inside a single database transaction.
 * Creates the concrete watchlist and the tenant_crisis_templates record.
 */
export async function activateCrisisTemplate(
  tenantId: string,
  userId: string,
  templateKey: string,
  input: ActivateCrisisTemplateInput
): Promise<{ ok: true; result: CrisisActivationResult } | { ok: false; status: number; error: string; details?: any }> {
  const template = await getCrisisTemplateByKey(templateKey);
  if (!template || !template.isActive) {
    return { ok: false, status: 404, error: 'Crisis template not found or inactive.' };
  }

  // Validate required parameters
  const variables = input.variables || {};
  for (const param of template.parameters) {
    if (param.required) {
      const val = variables[param.key];
      if (val === undefined || val === null || (Array.isArray(val) && val.length === 0) || (typeof val === 'string' && val.trim() === '')) {
        return {
          ok: false,
          status: 422,
          error: `Missing required template parameter: ${param.label || param.key}`,
          details: { parameter: param.key },
        };
      }
    }
  }

  // Validate notificationChannelIds
  if (!Array.isArray(input.notificationChannelIds) || input.notificationChannelIds.length === 0) {
    return {
      ok: false,
      status: 422,
      error: 'Select at least one notification channel destination.',
      details: { field: 'notificationChannelIds' },
    };
  }

  // Validate customThresholds if supplied
  if (input.customThresholds) {
    if (typeof input.customThresholds !== 'object') {
      return { ok: false, status: 422, error: 'Invalid customThresholds format.' };
    }
    const { volumeSpikePct, negativeSentimentPct, timeWindowMinutes } = input.customThresholds;
    if (volumeSpikePct !== undefined && (typeof volumeSpikePct !== 'number' || volumeSpikePct < 0)) {
      return { ok: false, status: 422, error: 'volumeSpikePct must be a positive number.' };
    }
    if (negativeSentimentPct !== undefined && (typeof negativeSentimentPct !== 'number' || negativeSentimentPct < 0 || negativeSentimentPct > 100)) {
      return { ok: false, status: 422, error: 'negativeSentimentPct must be between 0 and 100.' };
    }
    if (timeWindowMinutes !== undefined && (typeof timeWindowMinutes !== 'number' || timeWindowMinutes <= 0)) {
      return { ok: false, status: 422, error: 'timeWindowMinutes must be greater than 0.' };
    }
  }

  const concreteQuery = input.customQuery || interpolateString(template.defaultQuery, variables);
  const concreteAst = interpolateAst(template.defaultAst, variables);
  const effectiveThresholds = {
    ...template.defaultThresholds,
    ...(input.customThresholds || {}),
  };

  const watchlistName = input.name || `[Crisis] ${template.name}`;

  const result = await withTenant<CrisisActivationResult>(
    tenantId,
    async (client) => {
      // 1. Create watchlist
      const watchlistRes = await client.query(
        `INSERT INTO watchlists (
          tenant_id, user_id, name, match_type, terms, boolean_query, platform_ids, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id`,
        [
          tenantId,
          userId,
          watchlistName,
          'boolean',
          null,
          concreteQuery,
          ['gnews', 'newswire', 'tenant-owned-feed'],
          true,
        ]
      );
      const watchlistId = watchlistRes.rows[0].id;

      // 2. Create tenant_crisis_templates record
      const tenantCrisisRes = await client.query(
        `INSERT INTO tenant_crisis_templates (
          tenant_id, template_key, watchlist_id, thresholds, notification_channel_ids,
          variables, custom_thresholds, playbook, created_by_user_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id`,
        [
          tenantId,
          templateKey,
          watchlistId,
          JSON.stringify(effectiveThresholds),
          JSON.stringify(input.notificationChannelIds),
          JSON.stringify(variables),
          input.customThresholds ? JSON.stringify(input.customThresholds) : null,
          JSON.stringify(template.playbook),
          userId,
        ]
      );
      const tenantCrisisTemplateId = tenantCrisisRes.rows[0].id;

      return {
        tenantCrisisTemplateId,
        watchlistId,
        status: 'active' as const,
        playbook: template.playbook,
        thresholds: effectiveThresholds,
        notificationChannelIds: input.notificationChannelIds,
      };
    },
    getPool(),
    userId
  );

  return { ok: true, result };
}
