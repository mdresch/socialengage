import { PoolClient } from 'pg';
import { withTenant } from '../db/withTenant';

/**
 * Story 9.5 (ADR-0080): tenant-scoped onboarding checklist state — a
 * mostly-derived progress tracker for new-tenant setup. See
 * .claude/skills/onboarding-checklist/SKILL.md.
 */

const CORE_STEP_NAMES = ['connect_source', 'build_watchlist', 'invite_user', 'verify_posts'] as const;
type CoreStepName = (typeof CORE_STEP_NAMES)[number];

const ADVANCED_STEP_NAMES = ['enable_enrichment', 'configure_alerts'] as const;
type AdvancedStepName = (typeof ADVANCED_STEP_NAMES)[number];

interface StoredStep {
  completed: boolean;
  completed_at: string | null;
}

/** The raw JSONB shape persisted in tenants.onboarding_checklist (migration 0043). */
interface StoredChecklist {
  steps: Record<CoreStepName, StoredStep>;
  advanced_steps: Record<AdvancedStepName, StoredStep>;
  dismissed_at: string | null;
  dismissed_by_user_id: string | null;
  /** Additive beyond ADR-0080 Decision §1's literal default — see migration 0043's own comment. */
  hidden_advanced_steps: string[];
}

export interface ChecklistStep {
  completed: boolean;
  completedAt: string | null;
  deepLink: string;
}

export interface AdvancedChecklistStep extends ChecklistStep {
  hidden: boolean;
}

/** REST shape for GET/PATCH /v1/tenants/:id/onboarding-checklist (ADR-0080 Decision §3). */
export interface OnboardingChecklistResponse {
  isComplete: boolean;
  progressPercentage: number;
  dismissed: boolean;
  dismissedAt: string | null;
  steps: {
    connect_source: ChecklistStep;
    build_watchlist: ChecklistStep;
    invite_user: ChecklistStep;
    verify_posts: ChecklistStep;
  };
  advancedSteps: {
    enable_enrichment: AdvancedChecklistStep;
    configure_alerts: AdvancedChecklistStep;
  };
}

/** Request shape for PATCH (ADR-0080 Decision §3's literal TypeScript contract). */
export interface PatchOnboardingChecklistRequest {
  dismissed?: boolean;
  reset?: boolean;
  hiddenAdvancedSteps?: string[];
}

const DEEP_LINKS: Record<CoreStepName | AdvancedStepName, string> = {
  connect_source: '/tenant/connectors',
  build_watchlist: '/tenant/watchlists',
  invite_user: '/tenant/users',
  verify_posts: '/tenant/posts',
  enable_enrichment: '/tenant/connectors',
  configure_alerts: '/tenant/watchlists',
};

/**
 * Per-step live-derivation SQL fragments for the bundled `SELECT EXISTS`
 * query (ADR-0080 Decision §2's "Bundled Single-Query Evaluation"). Each
 * fragment is tenant-scoped ($1) and, for invite_user, excludes the caller
 * ($2) — the ADR's own literal SQL parameterizes a second argument without
 * naming what it represents; this resolves that ambiguity as "the calling
 * user's own id" (the only value available without a schema change), not
 * "the tenant's original creator," which has no dedicated column anywhere
 * in the `users` table.
 *
 * configure_alerts has no fragment here: no `alert_rules` table exists
 * anywhere in this codebase yet (it is Story 9.3/ADR-0079's own new table,
 * not merged at the time of this story) — see this file's own "Known gaps"
 * note and .claude/skills/onboarding-checklist/SKILL.md.
 */
const DERIVATION_SQL: Record<Exclude<CoreStepName | AdvancedStepName, 'configure_alerts'>, string> = {
  connect_source: `EXISTS(SELECT 1 FROM connector_activations WHERE tenant_id = $1 AND is_active = true) AS connect_source`,
  build_watchlist: `EXISTS(SELECT 1 FROM watchlists WHERE tenant_id = $1) AS build_watchlist`,
  invite_user: `EXISTS(SELECT 1 FROM users WHERE tenant_id = $1 AND id != $2) AS invite_user`,
  verify_posts: `EXISTS(SELECT 1 FROM social_posts WHERE tenant_id = $1 LIMIT 1) AS verify_posts`,
  enable_enrichment: `EXISTS(SELECT 1 FROM social_posts WHERE tenant_id = $1 AND enrichment IS NOT NULL LIMIT 1) AS enable_enrichment`,
};

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Runs the bundled EXISTS query for exactly the still-pending step names
 * (ADR-0080 Decision §2's "Fast-Path Cache Check" — a step already
 * completed:true is never re-checked, so it never appears in `pending`).
 * Returns a map of stepName -> whether it is now satisfied.
 */
async function evaluatePendingSteps(
  client: PoolClient,
  tenantId: string,
  callerUserId: string,
  pending: Array<Exclude<CoreStepName | AdvancedStepName, 'configure_alerts'>>
): Promise<Record<string, boolean>> {
  if (pending.length === 0) return {};
  const fragments = pending.map((name) => DERIVATION_SQL[name]);
  const { rows } = await client.query(`SELECT ${fragments.join(',\n  ')}`, [tenantId, callerUserId]);
  return rows[0] as Record<string, boolean>;
}

function mapStep(stored: StoredStep, deepLink: string): ChecklistStep {
  return { completed: stored.completed, completedAt: stored.completed_at, deepLink };
}

function toResponse(checklist: StoredChecklist): OnboardingChecklistResponse {
  const coreCompletedCount = CORE_STEP_NAMES.filter((name) => checklist.steps[name].completed).length;
  return {
    isComplete: coreCompletedCount === CORE_STEP_NAMES.length,
    progressPercentage: Math.round((coreCompletedCount / CORE_STEP_NAMES.length) * 100),
    dismissed: checklist.dismissed_at !== null,
    dismissedAt: checklist.dismissed_at,
    steps: {
      connect_source: mapStep(checklist.steps.connect_source, DEEP_LINKS.connect_source),
      build_watchlist: mapStep(checklist.steps.build_watchlist, DEEP_LINKS.build_watchlist),
      invite_user: mapStep(checklist.steps.invite_user, DEEP_LINKS.invite_user),
      verify_posts: mapStep(checklist.steps.verify_posts, DEEP_LINKS.verify_posts),
    },
    advancedSteps: {
      enable_enrichment: {
        ...mapStep(checklist.advanced_steps.enable_enrichment, DEEP_LINKS.enable_enrichment),
        hidden: checklist.hidden_advanced_steps.includes('enable_enrichment'),
      },
      configure_alerts: {
        ...mapStep(checklist.advanced_steps.configure_alerts, DEEP_LINKS.configure_alerts),
        hidden: checklist.hidden_advanced_steps.includes('configure_alerts'),
      },
    },
  };
}

/**
 * Reconciles and returns the checklist for one tenant (GET). `callerUserId`
 * both scopes the RLS session (ADR-0015, matching watchlists' own
 * tenant+user pattern) and is the "exclude me" argument for invite_user's
 * derivation. Returns null if the tenant row itself doesn't exist (RLS
 * hides it, or it's been deleted) — the router maps that to 404.
 */
export async function getOnboardingChecklist(
  tenantId: string,
  callerUserId: string
): Promise<OnboardingChecklistResponse | null> {
  return withTenant(
    tenantId,
    async (client) => {
      const { rows } = await client.query<{ onboarding_checklist: StoredChecklist }>(
        `SELECT onboarding_checklist FROM tenants WHERE id = $1`,
        [tenantId]
      );
      if (rows.length === 0) return null;

      const checklist = rows[0].onboarding_checklist;

      const pendingCore = CORE_STEP_NAMES.filter((name) => !checklist.steps[name].completed);
      const pendingAdvanced = ADVANCED_STEP_NAMES.filter(
        (name) => name !== 'configure_alerts' && !checklist.advanced_steps[name].completed
      ) as Array<Exclude<AdvancedStepName, 'configure_alerts'>>;
      const pending = [...pendingCore, ...pendingAdvanced];

      const evaluated = await evaluatePendingSteps(client, tenantId, callerUserId, pending);

      let changed = false;
      const at = nowIso();
      for (const name of pendingCore) {
        if (evaluated[name]) {
          checklist.steps[name] = { completed: true, completed_at: at };
          changed = true;
        }
      }
      for (const name of pendingAdvanced) {
        if (evaluated[name]) {
          checklist.advanced_steps[name] = { completed: true, completed_at: at };
          changed = true;
        }
      }

      if (changed) {
        await client.query(`UPDATE tenants SET onboarding_checklist = $2 WHERE id = $1`, [
          tenantId,
          JSON.stringify(checklist),
        ]);
      }

      return toResponse(checklist);
    },
    undefined,
    callerUserId
  );
}

/** The only PATCH body keys this endpoint recognizes (ADR-0080 Decision §3). */
const ALLOWED_PATCH_KEYS = new Set(['dismissed', 'reset', 'hiddenAdvancedSteps']);

export type PatchOnboardingChecklistResult =
  | { kind: 'ok'; response: OnboardingChecklistResponse }
  | { kind: 'not_found' }
  | { kind: 'invalid_request'; message: string };

/**
 * Validates a raw PATCH request body before any mutation. Rejects (rather
 * than silently ignoring) any key outside `dismissed`/`reset`/
 * `hiddenAdvancedSteps` — FDD-0080 §5.2's own error-handling requirement,
 * which is how BRU-001/BR1 ("core steps may not be marked complete
 * manually") is enforced: there is no recognized field that could even
 * attempt it, and an unrecognized field (e.g. `steps`) is a 400, not a
 * no-op.
 */
export function validatePatchBody(body: unknown): { ok: true; value: PatchOnboardingChecklistRequest } | { ok: false; message: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, message: 'Request body must be a JSON object.' };
  }
  const keys = Object.keys(body as Record<string, unknown>);
  const unknownKeys = keys.filter((k) => !ALLOWED_PATCH_KEYS.has(k));
  if (unknownKeys.length > 0) {
    return {
      ok: false,
      message: `Unrecognized field(s): ${unknownKeys.join(', ')}. Core and advanced step completion cannot be set manually.`,
    };
  }

  const value = body as PatchOnboardingChecklistRequest;
  if (value.dismissed !== undefined && typeof value.dismissed !== 'boolean') {
    return { ok: false, message: 'dismissed must be a boolean.' };
  }
  if (value.reset !== undefined && typeof value.reset !== 'boolean') {
    return { ok: false, message: 'reset must be a boolean.' };
  }
  if (value.hiddenAdvancedSteps !== undefined) {
    if (!Array.isArray(value.hiddenAdvancedSteps) || !value.hiddenAdvancedSteps.every((s) => typeof s === 'string')) {
      return { ok: false, message: 'hiddenAdvancedSteps must be an array of strings.' };
    }
    const invalid = value.hiddenAdvancedSteps.filter((s) => !ADVANCED_STEP_NAMES.includes(s as AdvancedStepName));
    if (invalid.length > 0) {
      return { ok: false, message: `Unknown advanced step(s): ${invalid.join(', ')}.` };
    }
  }
  return { ok: true, value };
}

/**
 * Applies a validated PATCH (dismiss/reopen/reset + advanced-step
 * visibility). Never touches `steps`/`advanced_steps` completion —
 * validatePatchBody() has already rejected any attempt to. Re-derives
 * (via getOnboardingChecklist's own reconciliation) before responding, so
 * the returned shape is never stale.
 */
export async function patchOnboardingChecklist(
  tenantId: string,
  callerUserId: string,
  patch: PatchOnboardingChecklistRequest
): Promise<OnboardingChecklistResponse | null> {
  return withTenant(
    tenantId,
    async (client) => {
      const { rows } = await client.query<{ onboarding_checklist: StoredChecklist }>(
        `SELECT onboarding_checklist FROM tenants WHERE id = $1`,
        [tenantId]
      );
      if (rows.length === 0) return null;

      const checklist = rows[0].onboarding_checklist;

      if (patch.dismissed === true) {
        checklist.dismissed_at = nowIso();
        checklist.dismissed_by_user_id = callerUserId;
      } else if (patch.dismissed === false || patch.reset === true) {
        checklist.dismissed_at = null;
        checklist.dismissed_by_user_id = null;
      }

      if (patch.hiddenAdvancedSteps !== undefined) {
        checklist.hidden_advanced_steps = [...new Set(patch.hiddenAdvancedSteps)];
      }

      await client.query(`UPDATE tenants SET onboarding_checklist = $2 WHERE id = $1`, [
        tenantId,
        JSON.stringify(checklist),
      ]);

      return toResponse(checklist);
    },
    undefined,
    callerUserId
  );
}
