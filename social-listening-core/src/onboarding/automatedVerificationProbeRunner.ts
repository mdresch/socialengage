import { PoolClient } from 'pg';

export interface ProbeEvaluationResult {
  traffic_probe: boolean;
  query_match_probe: boolean;
  triage_probe: boolean;
  crm_push_probe: boolean;
  invite_probe: boolean;
  list_probe: boolean;
  catalog_probe: boolean;
  inbox_probe: boolean;
  ticket_probe: boolean;
  crisis_probe: boolean;
  digest_probe: boolean;
  anomaly_probe: boolean;
  [key: string]: boolean;
}

export class AutomatedVerificationProbeRunner {
  /**
   * Executes synthetic database probes to verify live operational traffic
   * across tenant data streams.
   */
  public static async runProbes(
    client: PoolClient,
    tenantId: string,
    callerUserId: string
  ): Promise<ProbeEvaluationResult> {
    const query = `
      SELECT
        EXISTS(
          SELECT 1 FROM ingestion_runs
          WHERE tenant_id = $1 AND status IN ('succeeded', 'success') AND posts_ingested > 0
          LIMIT 1
        ) AS traffic_probe,
        EXISTS(
          SELECT 1 FROM post_watchlist_matches
          WHERE tenant_id = $1
          LIMIT 1
        ) AS query_match_probe,
        EXISTS(
          SELECT 1 FROM outbound_activities
          WHERE tenant_id = $1 AND activity_type = 'reply' AND status IN ('sent', 'dispatched')
          LIMIT 1
        ) AS triage_probe,
        EXISTS(
          SELECT 1 FROM outbound_activities
          WHERE tenant_id = $1 AND activity_type IN ('crm_handoff', 'crm_prospect') AND status IN ('sent', 'dispatched')
          LIMIT 1
        ) AS crm_push_probe,
        EXISTS(
          SELECT 1 FROM users
          WHERE tenant_id = $1 AND id != $2
          LIMIT 1
        ) AS invite_probe,
        EXISTS(
          SELECT 1 FROM prospecting_lists
          WHERE tenant_id = $1
          LIMIT 1
        ) AS list_probe,
        EXISTS(
          SELECT 1 FROM authors
          WHERE tenant_id = $1
          LIMIT 1
        ) AS catalog_probe,
        EXISTS(
          SELECT 1 FROM social_posts
          WHERE tenant_id = $1
          LIMIT 1
        ) AS inbox_probe,
        EXISTS(
          SELECT 1 FROM social_posts
          WHERE tenant_id = $1
          LIMIT 1
        ) AS ticket_probe,
        EXISTS(
          SELECT 1 FROM watchlists
          WHERE tenant_id = $1
          LIMIT 1
        ) AS crisis_probe,
        EXISTS(
          SELECT 1 FROM watchlists
          WHERE tenant_id = $1
          LIMIT 1
        ) AS digest_probe,
        EXISTS(
          SELECT 1 FROM social_posts
          WHERE tenant_id = $1
          LIMIT 1
        ) AS anomaly_probe
    `;

    const { rows } = await client.query(query, [tenantId, callerUserId]);
    const r = rows[0] || {};

    return {
      traffic_probe: Boolean(r.traffic_probe),
      query_match_probe: Boolean(r.query_match_probe),
      triage_probe: Boolean(r.triage_probe),
      crm_push_probe: Boolean(r.crm_push_probe),
      invite_probe: Boolean(r.invite_probe),
      list_probe: Boolean(r.list_probe),
      catalog_probe: Boolean(r.catalog_probe),
      inbox_probe: Boolean(r.inbox_probe),
      ticket_probe: Boolean(r.ticket_probe),
      crisis_probe: Boolean(r.crisis_probe),
      digest_probe: Boolean(r.digest_probe),
      anomaly_probe: Boolean(r.anomaly_probe),
    };
  }
}
