import { randomBytes } from 'crypto';
import { Pool } from 'pg';
import { getAdminPool } from '../db/adminPool';
import { getRagConnector } from '../rag/ragConnectorRegistry';
import {
  DataSubjectRequest,
  CreateTakedownSubmissionInput,
  DataSubjectRequestStatus,
} from './types';

function mapRowToDSR(row: any): DataSubjectRequest {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    postId: row.post_id,
    postUrl: row.post_url,
    requesterEmail: row.requester_email,
    requesterName: row.requester_name,
    requesterAffirmation: row.requester_affirmation,
    reason: row.reason,
    status: row.status as DataSubjectRequestStatus,
    verificationToken: row.verification_token,
    verificationTokenExpiresAt: row.verification_token_expires_at?.toISOString?.() || row.verification_token_expires_at || null,
    verifiedAt: row.verified_at?.toISOString?.() || row.verified_at || null,
    slaDueAt: row.sla_due_at?.toISOString?.() || row.sla_due_at || null,
    riskFlag: Boolean(row.risk_flag),
    riskReason: row.risk_reason || null,
    decisionReason: row.decision_reason || null,
    decidedBy: row.decided_by || null,
    decidedAt: row.decided_at?.toISOString?.() || row.decided_at || null,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
  };
}

export async function createTakedownRequest(
  input: CreateTakedownSubmissionInput,
  pool: Pool = getAdminPool()
): Promise<DataSubjectRequest> {
  const token = randomBytes(32).toString('hex');
  const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24-hour magic link

  // If no explicit postId was passed, try to look it up from postUrl or raw_payload if available
  let resolvedPostId = input.postId || null;
  if (!resolvedPostId && input.postUrl) {
    const postLookup = await pool.query<{ id: string }>(
      `SELECT id FROM social_posts WHERE tenant_id = $1 AND (raw_payload->>'url' = $2 OR raw_payload->>'postUrl' = $2) LIMIT 1`,
      [input.tenantId, input.postUrl]
    );
    if (postLookup.rows.length > 0) {
      resolvedPostId = postLookup.rows[0].id;
    }
  }

  // Heuristic / advisory risk flagging (never auto-denies)
  let isRisk = Boolean(input.riskFlag);
  let riskReason = input.riskReason || null;
  if (!isRisk && input.authorEmail && (input.authorEmail.includes('bulk') || input.authorEmail.includes('bot'))) {
    isRisk = true;
    riskReason = 'Automated or bulk submission pattern detected.';
  }

  const { rows } = await pool.query(
    `INSERT INTO data_subject_requests (
      tenant_id, post_id, post_url, requester_email, requester_name,
      reason, status, verification_token, verification_token_expires_at,
      risk_flag, risk_reason
    ) VALUES ($1, $2, $3, $4, $5, $6, 'pending_verification', $7, $8, $9, $10)
    RETURNING *`,
    [
      input.tenantId,
      resolvedPostId,
      input.postUrl,
      input.authorEmail,
      input.authorName || null,
      input.reason || null,
      token,
      tokenExpiresAt.toISOString(),
      isRisk,
      riskReason,
    ]
  );

  return mapRowToDSR(rows[0]);
}

export async function verifyTakedownMagicLink(
  token: string,
  pool: Pool = getAdminPool()
): Promise<DataSubjectRequest | null> {
  const tokenRecord = await pool.query(
    `SELECT * FROM data_subject_requests WHERE verification_token = $1`,
    [token]
  );

  if (tokenRecord.rows.length === 0) {
    return null;
  }

  const request = tokenRecord.rows[0];
  const now = new Date();

  // 45-day statutory SLA clock starting at verification
  const slaDueAt = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);

  const { rows } = await pool.query(
    `UPDATE data_subject_requests
     SET status = 'received',
         verified_at = $1,
         sla_due_at = $2,
         updated_at = now()
     WHERE id = $3
     RETURNING *`,
    [now.toISOString(), slaDueAt.toISOString(), request.id]
  );

  return mapRowToDSR(rows[0]);
}

export async function listTakedowns(
  tenantId: string,
  filters: { status?: string; riskFlag?: boolean } = {},
  pool: Pool = getAdminPool()
): Promise<DataSubjectRequest[]> {
  const conditions: string[] = ['tenant_id = $1'];
  const params: any[] = [tenantId];

  if (filters.status) {
    params.push(filters.status);
    conditions.push(`status = $${params.length}`);
  }

  if (typeof filters.riskFlag === 'boolean') {
    params.push(filters.riskFlag);
    conditions.push(`risk_flag = $${params.length}`);
  }

  const { rows } = await pool.query(
    `SELECT * FROM data_subject_requests
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC`,
    params
  );

  return rows.map(mapRowToDSR);
}

export async function getTakedownById(
  tenantId: string,
  id: string,
  pool: Pool = getAdminPool()
): Promise<DataSubjectRequest | null> {
  const { rows } = await pool.query(
    `SELECT * FROM data_subject_requests WHERE tenant_id = $1 AND id = $2`,
    [tenantId, id]
  );
  if (rows.length === 0) return null;
  return mapRowToDSR(rows[0]);
}

export async function executeRedactionCascade(
  tenantId: string,
  takedownId: string,
  decidedByUserId: string,
  reason: string = 'Author takedown request granted',
  pool: Pool = getAdminPool()
): Promise<DataSubjectRequest> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Update data_subject_requests record
    const dsrRes = await client.query(
      `UPDATE data_subject_requests
       SET status = 'granted',
           decided_at = now(),
           decided_by = $1,
           decision_reason = $2,
           updated_at = now()
       WHERE tenant_id = $3 AND id = $4
       RETURNING *`,
      [decidedByUserId, reason, tenantId, takedownId]
    );

    if (dsrRes.rows.length === 0) {
      throw new Error(`Takedown request ${takedownId} not found for tenant ${tenantId}`);
    }

    const dsr = dsrRes.rows[0];
    const postId = dsr.post_id;

    if (postId) {
      // 2. Soft-redact social_posts body & raw payload, and scrub AI enrichment
      // Keeps technical metadata: detectedLanguage, enrichment_override
      await client.query(
        `UPDATE social_posts
         SET body_markdown = '[REDACTED PURSUANT TO AUTHOR TAKEDOWN REQUEST]',
             raw_payload = '{"redacted": true}'::jsonb,
             redacted_at = now(),
             redaction_request_id = $1,
             enrichment = (
               (enrichment - 'topicClusters') ||
               jsonb_build_object(
                 'sentiment', null,
                 'sentimentConfidence', null,
                 'keyPhrases', '[]'::jsonb
               )
             )
         WHERE tenant_id = $2 AND id = $3`,
        [takedownId, tenantId, postId]
      );

      // 3. Delete matching post_watchlist_matches
      await client.query(
        `DELETE FROM post_watchlist_matches WHERE tenant_id = $1 AND post_id = $2`,
        [tenantId, postId]
      );

      // 4. Synchronously purge vector embeddings in RAG store
      try {
        const rag = getRagConnector();
        await rag.deletePost(tenantId, postId);
      } catch (err) {
        // Log vector purge failure if any
        console.warn(`[Takedown] RAG vector deletion failed for post ${postId}:`, err);
      }
    }

    await client.query('COMMIT');
    return mapRowToDSR(dsr);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function updateTakedownStatus(
  tenantId: string,
  takedownId: string,
  status: 'denied' | 'escalated',
  decidedByUserId: string,
  decisionReason: string,
  pool: Pool = getAdminPool()
): Promise<DataSubjectRequest> {
  const { rows } = await pool.query(
    `UPDATE data_subject_requests
     SET status = $1,
         decided_at = now(),
         decided_by = $2,
         decision_reason = $3,
         updated_at = now()
     WHERE tenant_id = $4 AND id = $5
     RETURNING *`,
    [status, decidedByUserId, decisionReason, tenantId, takedownId]
  );

  if (rows.length === 0) {
    throw new Error(`Takedown request ${takedownId} not found`);
  }

  return mapRowToDSR(rows[0]);
}
