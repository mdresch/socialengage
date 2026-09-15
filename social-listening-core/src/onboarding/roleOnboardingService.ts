import { PoolClient } from 'pg';
import { withTenant } from '../db/withTenant';
import { getPool } from '../db/pool';
import { AutomatedVerificationProbeRunner } from './automatedVerificationProbeRunner';

export type OnboardingRoleKind = 'admin' | 'care_agent' | 'social_seller' | 'brand_manager';

export interface RoleOnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  completedAt: string | null;
  probeKey: string;
  actionUrl: string;
  actionLabel: string;
}

export interface RoleJourneyResponse {
  role: OnboardingRoleKind;
  isComplete: boolean;
  completionPercentage: number;
  steps: RoleOnboardingStep[];
  roleJourneys?: Record<string, any>;
}

export interface StepTemplate {
  id: string;
  title: string;
  description: string;
  probeKey: string;
  actionUrl: string;
  actionLabel: string;
}

export const ROLE_STEP_TEMPLATES: Record<OnboardingRoleKind, StepTemplate[]> = {
  admin: [
    {
      id: 'connect_live_source',
      title: 'Connect Live Source',
      description: 'Connect and successfully ingest posts from a live platform connector.',
      probeKey: 'traffic_probe',
      actionUrl: '/tenant/connectors',
      actionLabel: 'Connect Source →',
    },
    {
      id: 'invite_team_member',
      title: 'Invite Team Member',
      description: 'Invite at least one team member to your tenant organization.',
      probeKey: 'invite_probe',
      actionUrl: '/tenant/users',
      actionLabel: 'Invite User →',
    },
    {
      id: 'configure_crisis_rule',
      title: 'Configure Crisis Escalation Rule',
      description: 'Set up crisis monitoring escalation rules and threshold alerts.',
      probeKey: 'crisis_probe',
      actionUrl: '/tenant/watchlists',
      actionLabel: 'Configure Rule →',
    },
  ],
  care_agent: [
    {
      id: 'open_inbox',
      title: 'Open Unified Inbox',
      description: 'Access the real-time social post stream and triage inbox.',
      probeKey: 'inbox_probe',
      actionUrl: '/tenant/posts',
      actionLabel: 'Open Inbox →',
    },
    {
      id: 'claim_ticket',
      title: 'Claim Ticket',
      description: 'Review and assign a customer support post or triage ticket.',
      probeKey: 'ticket_probe',
      actionUrl: '/tenant/posts',
      actionLabel: 'View Tickets →',
    },
    {
      id: 'dispatch_reply',
      title: 'Dispatch Outbound Reply',
      description: 'Send your first live care response to an ingested post.',
      probeKey: 'triage_probe',
      actionUrl: '/tenant/posts',
      actionLabel: 'Dispatch Reply →',
    },
  ],
  social_seller: [
    {
      id: 'search_creator_catalog',
      title: 'Search Creator Catalog',
      description: 'Discover creators and authors matching key topic engagement.',
      probeKey: 'catalog_probe',
      actionUrl: '/tenant/authors',
      actionLabel: 'Search Creators →',
    },
    {
      id: 'create_prospecting_list',
      title: 'Create Prospecting List',
      description: 'Organize qualified sales leads and creators into a prospecting list.',
      probeKey: 'list_probe',
      actionUrl: '/tenant/prospecting',
      actionLabel: 'Create List →',
    },
    {
      id: 'execute_crm_handoff',
      title: 'Execute CRM Handoff',
      description: 'Synchronize deduplicated prospecting contacts into your CRM.',
      probeKey: 'crm_push_probe',
      actionUrl: '/tenant/prospecting',
      actionLabel: 'Execute Handoff →',
    },
  ],
  brand_manager: [
    {
      id: 'define_boolean_watchlist',
      title: 'Define Boolean Watchlist',
      description: 'Create a boolean query watchlist that successfully matches incoming posts.',
      probeKey: 'query_match_probe',
      actionUrl: '/tenant/watchlists',
      actionLabel: 'Define Watchlist →',
    },
    {
      id: 'configure_notification_digest',
      title: 'Configure Notification Digest',
      description: 'Set up daily brand summary notifications and executive digests.',
      probeKey: 'digest_probe',
      actionUrl: '/tenant/settings',
      actionLabel: 'Configure Digest →',
    },
    {
      id: 'inspect_metric_anomaly',
      title: 'Inspect Metric Anomaly',
      description: 'Review statistically significant volume and sentiment anomalies.',
      probeKey: 'anomaly_probe',
      actionUrl: '/tenant/analytics',
      actionLabel: 'Inspect Anomaly →',
    },
  ],
};

export function normalizeRole(rawRole?: string | null): OnboardingRoleKind {
  if (!rawRole) return 'admin';
  const lower = rawRole.toLowerCase().replace(/[-_]/g, '');
  if (lower.includes('admin')) return 'admin';
  if (lower.includes('care') || lower.includes('support') || lower.includes('agent')) return 'care_agent';
  if (lower.includes('sell') || lower.includes('seller') || lower.includes('prospect')) return 'social_seller';
  if (lower.includes('brand') || lower.includes('reputation') || lower.includes('manager') || lower.includes('analyst'))
    return 'brand_manager';
  return 'admin';
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function getRoleOnboardingChecklist(
  tenantId: string,
  callerUserId: string,
  rawRole?: string | null
): Promise<RoleJourneyResponse | null> {
  const targetRole = normalizeRole(rawRole);

  return withTenant(
    tenantId,
    async (client: PoolClient) => {
      // 1. Fetch or create tenant_onboarding_state
      const { rows } = await client.query<{ role_journeys: Record<string, any> }>(
        `SELECT role_journeys FROM tenant_onboarding_state WHERE tenant_id = $1`,
        [tenantId]
      );

      let roleJourneys: Record<string, any>;
      if (rows.length === 0) {
        roleJourneys = {
          admin: { completed: false, steps: {} },
          care_agent: { completed: false, steps: {} },
          social_seller: { completed: false, steps: {} },
          brand_manager: { completed: false, steps: {} },
        };
        await client.query(
          `INSERT INTO tenant_onboarding_state (tenant_id, role_journeys)
           VALUES ($1, $2)
           ON CONFLICT (tenant_id) DO NOTHING`,
          [tenantId, JSON.stringify(roleJourneys)]
        );
      } else {
        roleJourneys = rows[0].role_journeys || {};
      }

      // 2. Run automated background probes
      const probeResults = await AutomatedVerificationProbeRunner.runProbes(client, tenantId, callerUserId);

      // 3. Reconcile steps for targetRole (and ensure all roles exist in roleJourneys)
      let stateChanged = false;
      const templates = ROLE_STEP_TEMPLATES[targetRole];

      if (!roleJourneys[targetRole]) {
        roleJourneys[targetRole] = { completed: false, steps: {} };
        stateChanged = true;
      }
      if (!roleJourneys[targetRole].steps) {
        roleJourneys[targetRole].steps = {};
        stateChanged = true;
      }

      const roleStepsStored = roleJourneys[targetRole].steps;
      const steps: RoleOnboardingStep[] = [];

      for (const tpl of templates) {
        const stored = roleStepsStored[tpl.id];
        let completed = stored?.completed === true;
        let completedAt = stored?.completedAt || null;

        // If not already completed, evaluate the probe
        if (!completed && probeResults[tpl.probeKey]) {
          completed = true;
          completedAt = nowIso();
          roleStepsStored[tpl.id] = { completed: true, completedAt };
          stateChanged = true;
        }

        steps.push({
          id: tpl.id,
          title: tpl.title,
          description: tpl.description,
          completed,
          completedAt,
          probeKey: tpl.probeKey,
          actionUrl: tpl.actionUrl,
          actionLabel: tpl.actionLabel,
        });
      }

      const completedCount = steps.filter((s) => s.completed).length;
      const isComplete = completedCount === steps.length;
      if (roleJourneys[targetRole].completed !== isComplete) {
        roleJourneys[targetRole].completed = isComplete;
        stateChanged = true;
      }

      // 4. Save updated state if changed
      if (stateChanged) {
        await client.query(
          `UPDATE tenant_onboarding_state
           SET role_journeys = $2, updated_at = now()
           WHERE tenant_id = $1`,
          [tenantId, JSON.stringify(roleJourneys)]
        );
      }

      return {
        role: targetRole,
        isComplete,
        completionPercentage: Math.round((completedCount / steps.length) * 100),
        steps,
        roleJourneys,
      };
    },
    getPool(),
    callerUserId
  );
}
