import { randomUUID, createHash, createHmac } from 'crypto';
import { getAdminPool } from '../db/adminPool';
import {
  ComplianceAuditPackManifest,
  FileDigestEntry,
  CreateAuditPackInput,
  AuditPackSummary,
} from './types';
import { computeMerkleRoot, GENESIS_HASH } from './auditHashChaining';
import { createSimpleZip } from './zipArchive';

const PLATFORM_SIGNING_SECRET = process.env.COMPLIANCE_SIGNING_KEY || 'socialengage-compliance-signing-key-2026';

function signManifest(manifestWithoutSig: Omit<ComplianceAuditPackManifest, 'verificationSignature'>): string {
  const canonicalString = JSON.stringify(manifestWithoutSig, Object.keys(manifestWithoutSig).sort());
  return createHmac('sha256', PLATFORM_SIGNING_SECRET).update(canonicalString).digest('hex');
}

/**
 * Compiles a structured compliance evidence bundle with root manifest.json into a ZIP archive.
 */
export async function createAuditPack(
  tenantId: string,
  input: CreateAuditPackInput,
  userId?: string
): Promise<AuditPackSummary> {
  const packId = randomUUID();
  const packType = input.packType || 'full';
  const generatedAt = new Date().toISOString();
  const pool = getAdminPool();

  // 1. Fetch tenant audit records
  const { rows: auditRows } = await pool.query<{
    id: string;
    actor_id: string;
    action: string;
    payload: Record<string, unknown>;
    previous_record_hash: string;
    record_hash: string;
    created_at: Date;
  }>(
    `SELECT id, actor_id, action, payload, previous_record_hash, record_hash, created_at
     FROM tenant_audit_log
     WHERE tenant_id = $1 AND created_at >= $2 AND created_at <= $3
     ORDER BY created_at ASC, id ASC`,
    [tenantId, input.startDate, input.endDate]
  );

  // 2. Fetch DSR records
  const { rows: dsrRows } = await pool.query<{
    id: string;
    post_url: string;
    requester_email: string;
    status: string;
    request_type: string;
    created_at: Date;
  }>(
    `SELECT id, post_url, requester_email, status, request_type, created_at
     FROM data_subject_requests
     WHERE tenant_id = $1 AND created_at >= $2 AND created_at <= $3
     ORDER BY created_at ASC, id ASC`,
    [tenantId, input.startDate, input.endDate]
  );

  // 3. Build CSV payloads
  // Audit logs CSV
  const auditCsvHeader = 'id,actor_id,action,created_at,previous_record_hash,record_hash\n';
  const auditCsvBody = auditRows
    .map(
      r =>
        `"${r.id}","${r.actor_id}","${r.action}","${r.created_at.toISOString()}","${r.previous_record_hash}","${r.record_hash}"`
    )
    .join('\n');
  const auditCsvContent = auditCsvHeader + auditCsvBody + (auditRows.length > 0 ? '\n' : '');

  // DSR Proof logs CSV
  const dsrCsvHeader = 'id,request_type,status,created_at,post_url\n';
  const dsrCsvBody = dsrRows
    .map(
      r =>
        `"${r.id}","${r.request_type}","${r.status}","${r.created_at.toISOString()}","${r.post_url}"`
    )
    .join('\n');
  const dsrCsvContent = dsrCsvHeader + dsrCsvBody + (dsrRows.length > 0 ? '\n' : '');

  // 4. Compute file digests
  const auditCsvBuffer = Buffer.from(auditCsvContent, 'utf8');
  const dsrCsvBuffer = Buffer.from(dsrCsvContent, 'utf8');

  const files: FileDigestEntry[] = [
    {
      path: 'audit_logs.csv',
      sha256: createHash('sha256').update(auditCsvBuffer).digest('hex'),
      rowCount: auditRows.length,
      byteSize: auditCsvBuffer.length,
    },
    {
      path: 'dsr_proof_logs.csv',
      sha256: createHash('sha256').update(dsrCsvBuffer).digest('hex'),
      rowCount: dsrRows.length,
      byteSize: dsrCsvBuffer.length,
    },
  ];

  // 5. Compute Merkle root of all enclosed records
  const allRecordHashes = auditRows.map(r => r.record_hash);
  const merkleRootHash = computeMerkleRoot(allRecordHashes);

  // 6. Assemble and sign manifest.json
  const manifestBase: Omit<ComplianceAuditPackManifest, 'verificationSignature'> = {
    manifestVersion: '1.0.0',
    packId,
    tenantId,
    generatedAt,
    timeRange: {
      startDate: input.startDate,
      endDate: input.endDate,
    },
    merkleRootHash,
    files,
  };

  const verificationSignature = signManifest(manifestBase);
  const manifest: ComplianceAuditPackManifest = {
    ...manifestBase,
    verificationSignature,
  };

  const manifestJsonContent = JSON.stringify(manifest, null, 2);

  // 7. Package ZIP archive
  const zipBuffer = createSimpleZip([
    { name: 'manifest.json', content: manifestJsonContent },
    { name: 'audit_logs.csv', content: auditCsvBuffer },
    { name: 'dsr_proof_logs.csv', content: dsrCsvBuffer },
  ]);

  const zipSha256 = createHash('sha256').update(zipBuffer).digest('hex');
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  // 8. Persist pack in compliance_audit_packs
  await pool.query(
    `INSERT INTO compliance_audit_packs (
      id, tenant_id, generated_by_user_id, pack_type, start_date, end_date, status,
      sha256, merkle_root, manifest, zip_data, generated_at, expires_at
    ) VALUES ($1, $2, $3, $4, $5, $6, 'ready', $7, $8, $9, $10, $11, $12)`,
    [
      packId,
      tenantId,
      userId || null,
      packType,
      input.startDate,
      input.endDate,
      zipSha256,
      merkleRootHash,
      JSON.stringify(manifest),
      zipBuffer,
      generatedAt,
      expiresAt,
    ]
  );

  return {
    packId,
    tenantId,
    packType,
    status: 'ready',
    startDate: input.startDate,
    endDate: input.endDate,
    sha256: zipSha256,
    merkleRoot: merkleRootHash,
    manifest,
    generatedAt,
    expiresAt,
  };
}

export interface PackDownloadResult {
  expired: boolean;
  pack?: {
    id: string;
    tenantId: string;
    downloadUrl: string;
    expiresAt: string;
    zipData: Buffer;
    manifest: ComplianceAuditPackManifest;
  };
}

/**
 * Retrieves audit pack download metadata and enforces 90-day retention and 24-hour token expiry.
 */
export async function getAuditPackDownload(
  tenantId: string,
  packId: string
): Promise<PackDownloadResult> {
  const pool = getAdminPool();
  const { rows } = await pool.query<{
    id: string;
    tenant_id: string;
    status: string;
    manifest: ComplianceAuditPackManifest;
    zip_data: Buffer;
    generated_at: Date;
    expires_at: Date;
  }>(
    `SELECT id, tenant_id, status, manifest, zip_data, generated_at, expires_at
     FROM compliance_audit_packs
     WHERE id = $1 AND tenant_id = $2`,
    [packId, tenantId]
  );

  if (rows.length === 0) {
    return { expired: false };
  }

  const pack = rows[0];
  const now = new Date();

  // Check 90-day retention lifecycle
  if (pack.expires_at < now || pack.status === 'expired') {
    // Mark expired if not already marked
    if (pack.status !== 'expired') {
      await pool.query(`UPDATE compliance_audit_packs SET status = 'expired' WHERE id = $1`, [packId]);
    }
    return { expired: true };
  }

  // 24-hour presigned expiration window
  const presignedExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const token = createHmac('sha256', PLATFORM_SIGNING_SECRET)
    .update(`${packId}|${presignedExpiresAt}`)
    .digest('hex');

  const downloadUrl = `/v1/compliance/audit-packs/${pack.id}/download?direct=true&expires=${encodeURIComponent(
    presignedExpiresAt
  )}&token=${token}`;

  return {
    expired: false,
    pack: {
      id: pack.id,
      tenantId: pack.tenant_id,
      downloadUrl,
      expiresAt: presignedExpiresAt,
      zipData: pack.zip_data,
      manifest: pack.manifest,
    },
  };
}
