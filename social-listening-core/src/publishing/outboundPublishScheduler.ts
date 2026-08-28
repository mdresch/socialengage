import { getPlatformAdminPool } from '../db/platformAdminPool';
import { getLatestCredentialId, readCredential } from '../credentials/credentialStore';
import { getSocialConnector } from '../connectors/registry';
import { invoke } from '../outbound/outboundPublishService';

export interface ScheduledPublishBatchResult {
  processedCount: number;
  publishedCount: number;
  failedCount: number;
}

export interface RawScheduledOutboundActivityRow {
  id: string;
  tenant_id: string;
  user_id: string;
  provider_id: string;
  credential_id: string;
  target_asset_id: string | null;
  target_asset_type: string | null;
  body: string;
  payload: any;
  scheduled_for: Date | string | null;
}

/**
 * Story 11.7 (ADR-0098) — background scheduler worker that finds due scheduled
 * outbound posts and dispatches them via their connector's publish() method.
 */
export async function runScheduledPublishBatch(): Promise<ScheduledPublishBatchResult> {
  const pool = getPlatformAdminPool();

  // Find due scheduled posts
  const dueActivitiesRes = await pool.query<RawScheduledOutboundActivityRow>(
    `SELECT id, tenant_id, user_id, provider_id, credential_id,
            target_asset_id, target_asset_type, body, payload, scheduled_for
     FROM outbound_activities
     WHERE status = 'scheduled'
       AND scheduled_for <= now()
     ORDER BY scheduled_for ASC
     LIMIT 50`
  );

  const dueRows = dueActivitiesRes.rows;
  if (dueRows.length === 0) {
    return { processedCount: 0, publishedCount: 0, failedCount: 0 };
  }

  let publishedCount = 0;
  let failedCount = 0;

  for (const activity of dueRows) {
    // 1. Mark as publishing
    await pool.query(
      `UPDATE outbound_activities
       SET status = 'publishing'
       WHERE id = $1`,
      [activity.id]
    );

    const connector = getSocialConnector(activity.provider_id);
    if (!connector || !connector.publish) {
      await pool.query(
        `UPDATE outbound_activities
         SET status = 'failed', failed_at = now(), error_code = 'publish_not_supported'
         WHERE id = $1`,
        [activity.id]
      );
      failedCount++;
      continue;
    }

    let credential = '';
    try {
      let credId = activity.credential_id;
      if (!credId) {
        credId = (await getLatestCredentialId(
          activity.tenant_id,
          activity.provider_id,
          'user',
          activity.user_id
        )) || '';
      }
      if (credId) {
        credential = await readCredential(activity.tenant_id, credId);
      }
    } catch {
      // ignore credential read failure, let invoke handle it or fail gracefully
    }

    try {
      const result = await invoke({
        tenantId: activity.tenant_id,
        userId: activity.user_id,
        payload: {
          text: activity.body,
          targetAssetId: activity.target_asset_id || '',
          targetAssetType: activity.target_asset_type || `${activity.provider_id}_page`,
          ...(activity.payload || {}),
        },
        credential,
        connector,
      });

      if (result.status === 'sent') {
        await pool.query(
          `UPDATE outbound_activities
           SET status = 'published',
               published_at = now(),
               sent_at = now(),
               external_id = $2,
               external_url = $3
           WHERE id = $1`,
          [activity.id, result.externalId, result.externalUrl]
        );
        publishedCount++;
      } else {
        await pool.query(
          `UPDATE outbound_activities
           SET status = 'failed',
               failed_at = now(),
               error_code = $2
           WHERE id = $1`,
          [activity.id, result.errorCode || 'publish_failed']
        );
        failedCount++;
      }
    } catch (err: any) {
      await pool.query(
        `UPDATE outbound_activities
         SET status = 'failed',
             failed_at = now(),
             error_code = $2
         WHERE id = $1`,
        [activity.id, err.message || 'unknown_error']
      );
      failedCount++;
    }
  }

  return {
    processedCount: dueRows.length,
    publishedCount,
    failedCount,
  };
}
