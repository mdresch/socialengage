// Contract: Story 16.3 (ADR-0127, BRD-0127, FDD-0127, TDS-0127) — Cryptographic Audit Log Hash Chaining and Manifest Export (Backend)
// Intent:
// - Story: Story 16.3 (Epic 16)
// - ADR: ADR-0127 (Compliance audit pack refinements — Merkle-tree hash chaining and verifiable evidence bundles)
// - BRD/FDD/TDS: BRD-0127, FDD-0127, TDS-0127
// - Scope:
//   1. AC1: Audit log tables store previous_record_hash and record_hash with deterministic SHA-256 computation anchored to 64-zero genesis block.
//   2. AC2: Concurrency protection via row-level locking (FOR UPDATE) guarantees strict sequential hash chain appending.
//   3. AC3: GET /v1/compliance/audit-log/verify verifies cryptographic hash chain integrity and accurately detects/pinpoints tampered records.
//   4. AC4: POST /v1/compliance/audit-packs generates structured ZIP evidence bundle with manifest.json conforming to manifestVersion "1.0.0", file digests, Merkle root hash, and platform HMAC signature.
//   5. AC5: GET /v1/compliance/audit-packs/:id/download enforces 24-hour presigned URL window and 90-day retention lifecycle.
// - Out of scope:
//   - Trust and compliance UI dashboard (separate admin UI story).
//   - Asymmetric hardware HSM keys (Q-0127-2).

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { closeAdminPool, getAdminPool } from '../../src/db/adminPool';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import { closePool, getPool } from '../../src/db/pool';
import {
  computeRecordHash,
  appendChainedTenantAudit,
  GENESIS_HASH,
} from '../../src/compliance/auditHashChaining';
import { parseSimpleZip, ParsedZipFile } from '../../src/compliance/zipArchive';

jest.setTimeout(30000);

afterAll(async () => {
  await closeAdminPool();
  await closePlatformAdminPool();
  await closePool();
});

async function createTenantFixture(name: string): Promise<{ id: string }> {
  const { rows } = await getAdminPool().query<{ id: string }>(
    `INSERT INTO tenants (name, license_seat_count) VALUES ($1, $2) RETURNING id`,
    [name, 10]
  );
  return rows[0];
}

describe('Story 16.3 — Cryptographic Audit Log Hash Chaining and Manifest Export Contract', () => {
  const app = createApp();

  describe('AC1: Deterministic SHA-256 Hash Chaining & Genesis Block Anchor', () => {
    it('anchors genesis record to 64 zeros and chains subsequent records sequentially', async () => {
      const tenant = await createTenantFixture(`ac1-chain-${randomUUID()}`);

      // 1. Insert first audit log entry (Genesis block)
      const entry1 = await appendChainedTenantAudit({
        tenantId: tenant.id,
        actorId: 'user-1',
        action: 'tenant.create_watchlist',
        timestamp: new Date('2026-09-01T10:00:00.000Z').toISOString(),
        payload: { watchlistId: 'wl-100', name: 'Competitor Brand' },
      });

      expect(entry1.previousRecordHash).toBe(GENESIS_HASH);
      expect(entry1.recordHash).toBeDefined();
      expect(entry1.recordHash).toHaveLength(64);

      // Verify deterministic hash formula:
      const expectedHash1 = computeRecordHash({
        id: entry1.id,
        tenantId: tenant.id,
        actorId: 'user-1',
        action: 'tenant.create_watchlist',
        timestamp: entry1.timestamp,
        payload: { watchlistId: 'wl-100', name: 'Competitor Brand' },
        previousRecordHash: GENESIS_HASH,
      });
      expect(entry1.recordHash).toBe(expectedHash1);

      // 2. Insert second audit log entry
      const entry2 = await appendChainedTenantAudit({
        tenantId: tenant.id,
        actorId: 'user-2',
        action: 'tenant.update_role',
        timestamp: new Date('2026-09-01T10:05:00.000Z').toISOString(),
        payload: { targetUser: 'user-3', newRole: 'analyst' },
      });

      // Assert entry2 links to entry1
      expect(entry2.previousRecordHash).toBe(entry1.recordHash);
      expect(entry2.recordHash).toHaveLength(64);

      const expectedHash2 = computeRecordHash({
        id: entry2.id,
        tenantId: tenant.id,
        actorId: 'user-2',
        action: 'tenant.update_role',
        timestamp: entry2.timestamp,
        payload: { targetUser: 'user-3', newRole: 'analyst' },
        previousRecordHash: entry1.recordHash,
      });
      expect(entry2.recordHash).toBe(expectedHash2);
    });
  });

  describe('AC2: Concurrency Race Condition Prevention via Row-Level Locking', () => {
    it('serializes concurrent appends under row-level locking producing an unbroken chain', async () => {
      const tenant = await createTenantFixture(`ac2-race-${randomUUID()}`);

      // Fire 5 concurrent appends in parallel
      const promises = Array.from({ length: 5 }).map((_, idx) =>
        appendChainedTenantAudit({
          tenantId: tenant.id,
          actorId: `user-concurrent-${idx}`,
          action: `action-${idx}`,
          timestamp: new Date(`2026-09-01T11:0${idx}:00.000Z`).toISOString(),
          payload: { index: idx, nonce: randomUUID() },
        })
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(5);

      // Fetch all entries ordered by sequence
      const { rows } = await getAdminPool().query<{
        id: string;
        previous_record_hash: string;
        record_hash: string;
      }>(
        `SELECT id, previous_record_hash, record_hash FROM tenant_audit_log WHERE tenant_id = $1 ORDER BY seq ASC`,
        [tenant.id]
      );

      expect(rows).toHaveLength(5);
      expect(rows[0].previous_record_hash).toBe(GENESIS_HASH);

      // Verify every subsequent row strictly points to the prior row's record_hash
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i].previous_record_hash).toBe(rows[i - 1].record_hash);
      }
    });
  });

  describe('AC3: Continuous Chain Verification & Tamper Detection Endpoint', () => {
    it('verifies a genuine unbroken chain returning isValid: true', async () => {
      const tenant = await createTenantFixture(`ac3-valid-${randomUUID()}`);
      const adminHeaders = {
        'x-test-identity': testIdentityHeaderValue(tenant.id, {
          role: 'tenant_admin',
        }),
      };

      // Add 3 chained entries
      await appendChainedTenantAudit({
        tenantId: tenant.id,
        actorId: 'admin-1',
        action: 'tenant.login',
        timestamp: new Date('2026-09-02T10:00:00.000Z').toISOString(),
        payload: { ip: '10.0.0.1' },
      });
      await appendChainedTenantAudit({
        tenantId: tenant.id,
        actorId: 'admin-1',
        action: 'tenant.create_connector',
        timestamp: new Date('2026-09-02T10:10:00.000Z').toISOString(),
        payload: { connectorType: 'reddit' },
      });
      await appendChainedTenantAudit({
        tenantId: tenant.id,
        actorId: 'admin-1',
        action: 'tenant.export_data',
        timestamp: new Date('2026-09-02T10:20:00.000Z').toISOString(),
        payload: { format: 'csv' },
      });

      const res = await request(app)
        .get('/v1/compliance/audit-log/verify')
        .set(adminHeaders);

      expect(res.status).toBe(200);
      expect(res.body.isValid).toBe(true);
      expect(res.body.verifiedRecordsCount).toBe(3);
      expect(res.body.chainStartHash).toBe(GENESIS_HASH);
      expect(res.body.chainEndHash).toBeDefined();
    });

    it('pinpoints exact compromised record ID and position when a historical record is tampered', async () => {
      const tenant = await createTenantFixture(`ac3-tamper-${randomUUID()}`);
      const adminHeaders = {
        'x-test-identity': testIdentityHeaderValue(tenant.id, {
          role: 'tenant_admin',
        }),
      };

      const e1 = await appendChainedTenantAudit({
        tenantId: tenant.id,
        actorId: 'user-1',
        action: 'item.created',
        timestamp: new Date('2026-09-02T11:00:00.000Z').toISOString(),
        payload: { amount: 100 },
      });
      const e2 = await appendChainedTenantAudit({
        tenantId: tenant.id,
        actorId: 'user-1',
        action: 'item.updated',
        timestamp: new Date('2026-09-02T11:01:00.000Z').toISOString(),
        payload: { amount: 200 },
      });
      const e3 = await appendChainedTenantAudit({
        tenantId: tenant.id,
        actorId: 'user-1',
        action: 'item.finalized',
        timestamp: new Date('2026-09-02T11:02:00.000Z').toISOString(),
        payload: { amount: 300 },
      });

      // Maliciously tamper with row 2's payload directly in Postgres without updating hashes
      await getAdminPool().query(
        `UPDATE tenant_audit_log SET payload = $1 WHERE id = $2`,
        [JSON.stringify({ amount: 999999, tampered: true }), e2.id]
      );

      const res = await request(app)
        .get('/v1/compliance/audit-log/verify')
        .set(adminHeaders);

      expect(res.status).toBe(200);
      expect(res.body.isValid).toBe(false);
      expect(res.body.compromisedRecordId).toBe(e2.id);
      expect(res.body.sequencePosition).toBe(2);
      expect(res.body.expectedHash).toBeDefined();
      expect(res.body.actualHash).toBe(e2.recordHash);
    });
  });

  describe('AC4: Structured ZIP Evidence Bundle Export & Manifest Verification', () => {
    it('forbids unauthorized non-admin users from generating audit packs', async () => {
      const tenant = await createTenantFixture(`ac4-auth-${randomUUID()}`);
      const nonAdminHeaders = {
        'x-test-identity': testIdentityHeaderValue(tenant.id, {
          role: 'analyst',
        }),
      };

      const res = await request(app)
        .post('/v1/compliance/audit-packs')
        .set(nonAdminHeaders)
        .send({
          packType: 'full',
          startDate: '2026-01-01T00:00:00.000Z',
          endDate: '2026-12-31T23:59:59.000Z',
        });

      expect(res.status).toBe(403);
    });

    it('generates structured ZIP archive with manifest.json conforming to 1.0.0 schema', async () => {
      const tenant = await createTenantFixture(`ac4-pack-${randomUUID()}`);
      const adminHeaders = {
        'x-test-identity': testIdentityHeaderValue(tenant.id, {
          role: 'tenant_admin',
        }),
      };

      // Seed audit entries
      await appendChainedTenantAudit({
        tenantId: tenant.id,
        actorId: 'admin-1',
        action: 'policy.update',
        timestamp: new Date('2026-09-03T10:00:00.000Z').toISOString(),
        payload: { policy: 'gdpr_retention' },
      });

      // Seed DSR requests
      await getAdminPool().query(
        `INSERT INTO data_subject_requests (
          id, tenant_id, post_url, requester_email, status, request_type, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, 'granted', 'restriction', now(), now())`,
        [randomUUID(), tenant.id, 'https://example.com/post/1', 'author@domain.com']
      );

      // Generate pack
      const res = await request(app)
        .post('/v1/compliance/audit-packs')
        .set(adminHeaders)
        .send({
          packType: 'full',
          startDate: '2026-09-01T00:00:00.000Z',
          endDate: '2026-09-30T23:59:59.000Z',
        });

      expect(res.status).toBe(201);
      expect(res.body.packId).toBeDefined();
      expect(res.body.status).toBe('ready');
      expect(res.body.manifest).toBeDefined();

      const manifest = res.body.manifest;
      expect(manifest.manifestVersion).toBe('1.0.0');
      expect(manifest.packId).toBe(res.body.packId);
      expect(manifest.tenantId).toBe(tenant.id);
      expect(manifest.generatedAt).toBeDefined();
      expect(manifest.timeRange).toEqual({
        startDate: '2026-09-01T00:00:00.000Z',
        endDate: '2026-09-30T23:59:59.000Z',
      });
      expect(manifest.files).toBeInstanceOf(Array);
      expect(manifest.files.length).toBeGreaterThanOrEqual(2);

      // Check file digest descriptors
      const auditLogsFile = manifest.files.find((f: any) => f.path === 'audit_logs.csv');
      const dsrLogsFile = manifest.files.find((f: any) => f.path === 'dsr_proof_logs.csv');
      expect(auditLogsFile).toBeDefined();
      expect(auditLogsFile.sha256).toHaveLength(64);
      expect(auditLogsFile.rowCount).toBeGreaterThanOrEqual(1);
      expect(auditLogsFile.byteSize).toBeGreaterThan(0);

      expect(dsrLogsFile).toBeDefined();
      expect(dsrLogsFile.sha256).toHaveLength(64);

      // Merkle root and cryptographic signature
      expect(manifest.merkleRootHash).toHaveLength(64);
      expect(manifest.verificationSignature).toBeDefined();
    });
  });

  describe('AC5: Presigned Download & Retention Lifecycle Enforcement', () => {
    it('returns download metadata with 24-hour expiration and provides raw ZIP archive download', async () => {
      const tenant = await createTenantFixture(`ac5-dl-${randomUUID()}`);
      const adminHeaders = {
        'x-test-identity': testIdentityHeaderValue(tenant.id, {
          role: 'tenant_admin',
        }),
      };

      // Create pack
      const createRes = await request(app)
        .post('/v1/compliance/audit-packs')
        .set(adminHeaders)
        .send({
          packType: 'full',
          startDate: '2026-09-01T00:00:00.000Z',
          endDate: '2026-09-30T23:59:59.000Z',
        });
      expect(createRes.status).toBe(201);
      const { packId } = createRes.body;

      // Request download URL
      const dlRes = await request(app)
        .get(`/v1/compliance/audit-packs/${packId}/download`)
        .set(adminHeaders);

      expect(dlRes.status).toBe(200);
      expect(dlRes.body.downloadUrl).toBeDefined();
      expect(dlRes.body.expiresAt).toBeDefined();

      // Verify expiration is within ~24 hours
      const now = Date.now();
      const expires = new Date(dlRes.body.expiresAt).getTime();
      const diffHours = (expires - now) / (1000 * 60 * 60);
      expect(diffHours).toBeGreaterThan(23);
      expect(diffHours).toBeLessThanOrEqual(25);

      // Direct download of ZIP buffer
      const rawRes = await request(app)
        .get(`/v1/compliance/audit-packs/${packId}/download?direct=true`)
        .set(adminHeaders)
        .buffer(true)
        .parse((res, callback) => {
          const data: Buffer[] = [];
          res.on('data', (chunk) => data.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(data)));
        });

      expect(rawRes.status).toBe(200);
      expect(rawRes.headers['content-type']).toContain('application/zip');
      const zipBuffer = rawRes.body as Buffer;
      expect(Buffer.isBuffer(zipBuffer)).toBe(true);

      // Validate ZIP archive contents using parser
      const parsedZip = parseSimpleZip(zipBuffer);
      const manifestFile = parsedZip.find((f: ParsedZipFile) => f.name === 'manifest.json');
      expect(manifestFile).toBeDefined();
      const manifestObj = JSON.parse(manifestFile!.content.toString('utf8'));
      expect(manifestObj.manifestVersion).toBe('1.0.0');
    });

    it('rejects download request for expired audit pack (>90 days old) with 410 GONE', async () => {
      const tenant = await createTenantFixture(`ac5-expired-${randomUUID()}`);
      const adminHeaders = {
        'x-test-identity': testIdentityHeaderValue(tenant.id, {
          role: 'tenant_admin',
        }),
      };

      const expiredPackId = randomUUID();
      // Insert pack with past expiration date
      await getAdminPool().query(
        `INSERT INTO compliance_audit_packs (
          id, tenant_id, pack_type, start_date, end_date, status, sha256, merkle_root, manifest,
          generated_at, expires_at
        ) VALUES ($1, $2, 'full', now() - interval '100 days', now() - interval '90 days', 'expired',
          'sha-mock', 'merkle-mock', '{}'::jsonb, now() - interval '95 days', now() - interval '5 days')`,
        [expiredPackId, tenant.id]
      );

      const res = await request(app)
        .get(`/v1/compliance/audit-packs/${expiredPackId}/download`)
        .set(adminHeaders);

      expect(res.status).toBe(410);
      expect(res.body.code).toBe('EXPIRED_AUDIT_PACK');
    });
  });
});
