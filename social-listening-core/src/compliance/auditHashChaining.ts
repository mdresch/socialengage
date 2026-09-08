import { createHash, randomUUID } from 'crypto';
import { PoolClient } from 'pg';
import { getPool } from '../db/pool';
import { getAdminPool } from '../db/adminPool';
import { withTenant } from '../db/withTenant';
import {
  AuditLogChainEntry,
  AuditChainVerificationResult,
} from './types';

export const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Normalizes an arbitrary JSON payload into a deterministic key-sorted string representation.
 */
export function canonicalizePayload(payload?: Record<string, unknown> | null): string {
  if (!payload || typeof payload !== 'object') {
    return '{}';
  }
  const sortedKeys = Object.keys(payload).sort();
  const sortedObj: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    sortedObj[key] = payload[key];
  }
  return JSON.stringify(sortedObj);
}

/**
 * Deterministically computes SHA-256 record hash over canonical audit fields per ADR-0127:
 * record_hash = SHA256(id | tenant_id | actor_id | action | timestamp | canonical_payload | previous_record_hash)
 */
export function computeRecordHash(params: {
  id: string;
  tenantId: string | null;
  actorId: string;
  action: string;
  timestamp: string;
  payload?: Record<string, unknown> | null;
  previousRecordHash: string;
}): string {
  const canonicalPayload = canonicalizePayload(params.payload);
  const serialized = `${params.id}|${params.tenantId || ''}|${params.actorId}|${params.action}|${params.timestamp}|${canonicalPayload}|${params.previousRecordHash}`;
  return createHash('sha256').update(serialized).digest('hex');
}

/**
 * Computes a balanced binary Merkle tree root hash across an array of SHA-256 hashes per TDS-0127 §4.2.
 */
export function computeMerkleRoot(hashes: string[]): string {
  if (hashes.length === 0) {
    return GENESIS_HASH;
  }
  let currentLevel = [...hashes];

  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
      const combined = createHash('sha256').update(left + right).digest('hex');
      nextLevel.push(combined);
    }
    currentLevel = nextLevel;
  }
  return currentLevel[0];
}

export interface AppendTenantAuditInput {
  tenantId: string;
  actorId: string;
  action: string;
  timestamp?: string;
  payload?: Record<string, unknown>;
}

/**
 * Appends a chained record to `tenant_audit_log` using row-level locking (FOR UPDATE)
 * on the latest sequence record to serialize concurrent writers.
 */
export async function appendChainedTenantAudit(
  input: AppendTenantAuditInput
): Promise<AuditLogChainEntry> {
  const pool = getAdminPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Lock the tenant record to serialize concurrent appends for this tenant partition
    await client.query('SELECT id FROM tenants WHERE id = $1 FOR UPDATE', [input.tenantId]);

    // 2. Lock and retrieve the latest record for this tenant partition
    const lastRowRes = await client.query<{ record_hash: string }>(
      `SELECT record_hash FROM tenant_audit_log
       WHERE tenant_id = $1
       ORDER BY seq DESC
       LIMIT 1 FOR UPDATE`,
      [input.tenantId]
    );

    const previousRecordHash = lastRowRes.rows[0]?.record_hash || GENESIS_HASH;
    const id = randomUUID();
    const timestamp = input.timestamp || new Date().toISOString();
    const payload = input.payload || {};

    const recordHash = computeRecordHash({
      id,
      tenantId: input.tenantId,
      actorId: input.actorId,
      action: input.action,
      timestamp,
      payload,
      previousRecordHash,
    });

    await client.query(
      `INSERT INTO tenant_audit_log (
        id, tenant_id, actor_id, action, payload, previous_record_hash, record_hash, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        input.tenantId,
        input.actorId,
        input.action,
        JSON.stringify(payload),
        previousRecordHash,
        recordHash,
        timestamp,
      ]
    );

    await client.query('COMMIT');

    return {
      id,
      tenantId: input.tenantId,
      actorId: input.actorId,
      action: input.action,
      timestamp,
      payload,
      previousRecordHash,
      recordHash,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export interface VerifyChainOptions {
  tenantId?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Sequentially traverses and verifies the cryptographic audit chain across the requested partition/window.
 * Accurately detects and pinpoints tampered rows, sequence position, and mismatched digests.
 */
export async function verifyAuditLogChain(
  options: VerifyChainOptions = {}
): Promise<AuditChainVerificationResult> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options.tenantId) {
    params.push(options.tenantId);
    conditions.push(`tenant_id = $${params.length}`);
  }
  if (options.startDate) {
    params.push(options.startDate);
    conditions.push(`created_at >= $${params.length}`);
  }
  if (options.endDate) {
    params.push(options.endDate);
    conditions.push(`created_at <= $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await getAdminPool().query<{
    id: string;
    tenant_id: string;
    actor_id: string;
    action: string;
    payload: Record<string, unknown>;
    previous_record_hash: string;
    record_hash: string;
    created_at: Date;
  }>(
    `SELECT id, tenant_id, actor_id, action, payload, previous_record_hash, record_hash, created_at
     FROM tenant_audit_log
     ${whereClause}
     ORDER BY seq ASC`,
    params
  );

  if (rows.length === 0) {
    return {
      isValid: true,
      verifiedRecordsCount: 0,
      chainStartHash: GENESIS_HASH,
      chainEndHash: GENESIS_HASH,
    };
  }

  let expectedPreviousHash = rows[0].previous_record_hash;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const timestamp = row.created_at.toISOString();

    // 1. Verify link to preceding record
    if (row.previous_record_hash !== expectedPreviousHash) {
      return {
        isValid: false,
        compromisedRecordId: row.id,
        sequencePosition: i + 1,
        expectedHash: expectedPreviousHash,
        actualHash: row.previous_record_hash,
      };
    }

    // 2. Verify row's internal hash integrity
    const calculatedHash = computeRecordHash({
      id: row.id,
      tenantId: row.tenant_id,
      actorId: row.actor_id,
      action: row.action,
      timestamp,
      payload: row.payload,
      previousRecordHash: row.previous_record_hash,
    });

    if (row.record_hash !== calculatedHash) {
      return {
        isValid: false,
        compromisedRecordId: row.id,
        sequencePosition: i + 1,
        expectedHash: calculatedHash,
        actualHash: row.record_hash,
      };
    }

    expectedPreviousHash = row.record_hash;
  }

  return {
    isValid: true,
    verifiedRecordsCount: rows.length,
    chainStartHash: rows[0].previous_record_hash,
    chainEndHash: rows[rows.length - 1].record_hash,
  };
}
