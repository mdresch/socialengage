// Story 17.3 (ADR-0131 §7/§8/§9, BRD-0131, FDD-0131 §5.4/§5.5) — incident
// lifecycle: acknowledge (halts the ack-timeout sweep) and resolve
// (mandatory root-cause notes). Error-mapping shape follows ADR-0044 §2,
// via a discriminated result the router switches on (watchlistsRouter.ts
// convention).

import { getPool } from '../db/pool';
import { withTenant } from '../db/withTenant';

export interface CrisisIncidentRow {
  id: string;
  tenant_id: string;
  status: 'open' | 'acknowledged' | 'resolved';
  acknowledged_by_user_id: string | null;
  acknowledged_at: Date | null;
  resolved_by_user_id: string | null;
  resolved_at: Date | null;
  root_cause_notes: string | null;
}

export type IncidentLifecycleResult =
  | { outcome: 'not_found' }
  | { outcome: 'invalid_state_transition'; currentStatus: string }
  | { outcome: 'acknowledged'; incident: CrisisIncidentRow }
  | { outcome: 'resolved'; incident: CrisisIncidentRow };

/**
 * Records the acknowledging responder and halts the ack-timeout sweep
 * (excluded from `WHERE status = 'open'` by construction once set).
 * Re-acknowledging an already-acknowledged incident is an idempotent
 * no-op (FDD-0131 §5.4 edge case), not a 409.
 */
export async function acknowledgeIncident(
  tenantId: string,
  userId: string,
  incidentId: string
): Promise<IncidentLifecycleResult> {
  return withTenant<IncidentLifecycleResult>(
    tenantId,
    async (client) => {
      const { rows } = await client.query<CrisisIncidentRow>(
        `SELECT * FROM crisis_incident_logs WHERE id = $1`,
        [incidentId]
      );
      if (rows.length === 0) return { outcome: 'not_found' };

      const existing = rows[0];
      if (existing.status === 'resolved') {
        return { outcome: 'invalid_state_transition', currentStatus: existing.status };
      }
      if (existing.status === 'acknowledged') {
        return { outcome: 'acknowledged', incident: existing };
      }

      const { rows: updated } = await client.query<CrisisIncidentRow>(
        `UPDATE crisis_incident_logs
         SET status = 'acknowledged', acknowledged_by_user_id = $1, acknowledged_at = now()
         WHERE id = $2
         RETURNING *`,
        [userId, incidentId]
      );
      return { outcome: 'acknowledged', incident: updated[0] };
    },
    getPool(),
    userId
  );
}

/**
 * Archives the incident with mandatory root-cause notes. Resolving an
 * incident that was never acknowledged is allowed — the two transitions
 * are independent (FDD-0131 §5.5 edge case). Caller must validate
 * rootCauseNotes is a non-empty string before calling this (422, before
 * any write) — this function assumes that's already been checked.
 */
export async function resolveIncident(
  tenantId: string,
  userId: string,
  incidentId: string,
  rootCauseNotes: string
): Promise<IncidentLifecycleResult> {
  return withTenant<IncidentLifecycleResult>(
    tenantId,
    async (client) => {
      const { rows } = await client.query<CrisisIncidentRow>(
        `SELECT * FROM crisis_incident_logs WHERE id = $1`,
        [incidentId]
      );
      if (rows.length === 0) return { outcome: 'not_found' };

      const existing = rows[0];
      if (existing.status === 'resolved') {
        return { outcome: 'invalid_state_transition', currentStatus: existing.status };
      }

      const { rows: updated } = await client.query<CrisisIncidentRow>(
        `UPDATE crisis_incident_logs
         SET status = 'resolved', resolved_by_user_id = $1, resolved_at = now(), root_cause_notes = $2
         WHERE id = $3
         RETURNING *`,
        [userId, rootCauseNotes, incidentId]
      );
      return { outcome: 'resolved', incident: updated[0] };
    },
    getPool(),
    userId
  );
}
