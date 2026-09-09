import { randomUUID } from 'crypto';
import { PoolClient } from 'pg';
import { withTenant } from '../db/withTenant';
import { getPool } from '../db/pool';
import { validateCaptchaToken } from './captchaValidator';
import {
  generateSubjectHash,
  generateDSRReceipt,
  DSRReceiptPayload,
  SignedDSRReceipt,
} from './dsrReceipt';
import { getRagConnector } from '../rag/ragConnectorRegistry';

export interface SubmitDSRInput {
  postUrl: string;
  requesterEmail: string;
  requesterName?: string;
  requestType?: 'access' | 'rectification' | 'erasure' | 'restriction' | 'takedown';
  reason?: string;
  captchaToken: string;
}

export interface DSRSubmissionResult {
  requestId: string;
  status: string;
  receipt: SignedDSRReceipt;
}

export interface QuarantineResult {
  requestId: string;
  postId: string;
  processingRestricted: boolean;
}

/**
 * Submits a public Data Subject Request with mandatory CAPTCHA validation
 * and creates an immutable cryptographic HMAC-SHA256 receipt.
 */
export async function submitDSRRequest(
  tenantId: string,
  input: SubmitDSRInput
): Promise<DSRSubmissionResult> {
  const captchaResult = validateCaptchaToken(input.captchaToken);
  if (!captchaResult.valid) {
    throw new Error('CAPTCHA_VERIFICATION_FAILED');
  }

  const requestType = input.requestType || 'restriction';
  const subjectHash = generateSubjectHash(input.requesterEmail);
  const requestId = randomUUID();
  const timestamp = new Date().toISOString();

  return withTenant(tenantId, async (client: PoolClient) => {
    // 1. Resolve matching post if present
    const postLookup = await client.query<{ id: string }>(
      `SELECT id FROM social_posts WHERE tenant_id = $1 AND (raw_payload->>'url' = $2 OR raw_payload->>'postUrl' = $2) LIMIT 1`,
      [tenantId, input.postUrl]
    );
    const postId = postLookup.rows[0]?.id || null;

    // 2. Insert DSR request record
    await client.query(
      `INSERT INTO data_subject_requests (
        id, tenant_id, post_id, post_url, requester_email, requester_name,
        reason, status, request_type, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'received', $8, now(), now())`,
      [
        requestId,
        tenantId,
        postId,
        input.postUrl,
        input.requesterEmail,
        input.requesterName || null,
        input.reason || null,
        requestType,
      ]
    );

    // 3. Construct receipt payload and signature
    const payload: DSRReceiptPayload = {
      requestId,
      tenantId,
      subjectHash,
      requestType,
      timestamp,
    };

    const signature = generateDSRReceipt(payload);
    const receiptId = randomUUID();

    // 4. Persist signed receipt in dsr_receipts
    await client.query(
      `INSERT INTO dsr_receipts (
        id, tenant_id, request_id, subject_hash, receipt_signature, payload, issued_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        receiptId,
        tenantId,
        requestId,
        subjectHash,
        signature,
        JSON.stringify(payload),
        timestamp,
      ]
    );

    return {
      requestId,
      status: 'received',
      receipt: {
        receiptId,
        issuedAt: timestamp,
        payload,
        signature,
      },
    };
  }, getPool());
}

/**
 * Quarantines contested posts under GDPR Article 18 by setting processing_restricted = TRUE.
 */
export async function quarantineDSRRequest(
  tenantId: string,
  requestId: string,
  actorUserId?: string
): Promise<QuarantineResult> {
  return withTenant(tenantId, async (client: PoolClient) => {
    // 1. Find request
    const { rows: reqRows } = await client.query<{
      id: string;
      post_id: string | null;
      post_url: string;
    }>(
      `SELECT id, post_id, post_url FROM data_subject_requests WHERE tenant_id = $1 AND id = $2`,
      [tenantId, requestId]
    );

    if (reqRows.length === 0) {
      throw new Error('DSR_REQUEST_NOT_FOUND');
    }

    const dsr = reqRows[0];
    let targetPostId = dsr.post_id;

    if (!targetPostId) {
      const postLookup = await client.query<{ id: string }>(
        `SELECT id FROM social_posts WHERE tenant_id = $1 AND (raw_payload->>'url' = $2 OR raw_payload->>'postUrl' = $2) LIMIT 1`,
        [tenantId, dsr.post_url]
      );
      targetPostId = postLookup.rows[0]?.id || null;
    }

    if (!targetPostId) {
      throw new Error('TARGET_POST_NOT_FOUND');
    }

    // 2. Set processing_restricted = TRUE
    await client.query(
      `UPDATE social_posts SET processing_restricted = TRUE WHERE tenant_id = $1 AND id = $2`,
      [tenantId, targetPostId]
    );

    // 3. Update request status
    await client.query(
      `UPDATE data_subject_requests SET status = 'under_review', decided_by = $3, decided_at = now(), updated_at = now()
       WHERE tenant_id = $1 AND id = $2`,
      [tenantId, requestId, actorUserId || null]
    );

    // 4. Invalidate / purge in-memory chunk cache in RAG connector if present
    try {
      const rag = getRagConnector();
      await rag.deletePost(tenantId, targetPostId);
    } catch {
      // Best-effort cache eviction
    }

    return {
      requestId,
      postId: targetPostId,
      processingRestricted: true,
    };
  }, getPool(), actorUserId);
}

/**
 * Reverses Article 18 quarantine, setting processing_restricted = FALSE.
 */
export async function unquarantineDSRRequest(
  tenantId: string,
  requestId: string,
  actorUserId?: string
): Promise<QuarantineResult> {
  return withTenant(tenantId, async (client: PoolClient) => {
    const { rows: reqRows } = await client.query<{
      id: string;
      post_id: string | null;
      post_url: string;
    }>(
      `SELECT id, post_id, post_url FROM data_subject_requests WHERE tenant_id = $1 AND id = $2`,
      [tenantId, requestId]
    );

    if (reqRows.length === 0) {
      throw new Error('DSR_REQUEST_NOT_FOUND');
    }

    const dsr = reqRows[0];
    let targetPostId = dsr.post_id;

    if (!targetPostId) {
      const postLookup = await client.query<{ id: string }>(
        `SELECT id FROM social_posts WHERE tenant_id = $1 AND (raw_payload->>'url' = $2 OR raw_payload->>'postUrl' = $2) LIMIT 1`,
        [tenantId, dsr.post_url]
      );
      targetPostId = postLookup.rows[0]?.id || null;
    }

    if (!targetPostId) {
      throw new Error('TARGET_POST_NOT_FOUND');
    }

    // Reset processing_restricted to FALSE
    await client.query(
      `UPDATE social_posts SET processing_restricted = FALSE WHERE tenant_id = $1 AND id = $2`,
      [tenantId, targetPostId]
    );

    await client.query(
      `UPDATE data_subject_requests SET status = 'received', decided_by = $3, decided_at = now(), updated_at = now()
       WHERE tenant_id = $1 AND id = $2`,
      [tenantId, requestId, actorUserId || null]
    );

    return {
      requestId,
      postId: targetPostId,
      processingRestricted: false,
    };
  }, getPool(), actorUserId);
}
