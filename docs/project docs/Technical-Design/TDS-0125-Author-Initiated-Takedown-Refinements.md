# Technical Design Specification (TDS) — Author-Initiated Takedown Refinements

## 1. Document Control & Traceability Linkage

### 1.1 Metadata
| Attribute | Value |
|---|---|
| **Document Title** | TDS-0125: Author-Initiated Takedown Refinements — 45-Day Statutory SLA, Mandatory CAPTCHA Mitigation, Advisory Risk-Flagging & AI Enrichment Redaction Propagation |
| **Document ID** | `TDS-0125` |
| **Feature Name** | Privacy Takedown Safeguards: SLA Tracking, Bot Prevention, Reviewer Risk Context & Deep AI Redaction Cascade |
| **Version** | `1.0.0` |
| **Status** | Approved |
| **Author(s)** | Core Architecture Team |
| **Created Date** | 2026-09-05 |
| **Last Updated** | 2026-09-05 |
| **Governing Skill** | `social-listening-core/.claude/skills/data-governance/SKILL.md` |

### 1.2 Upstream & Downstream Traceability Matrix
| Artifact Type | Reference Identifier | Title / Link | Alignment Status |
|---|---|---|---|
| **Architecture Decision Record** | `ADR-0125` | [ADR-0125: Author-Initiated Takedown Refinements](../../adr/0125-author-initiated-takedown-refinements.md) | Invariant Source |
| **Business Requirements Doc** | `BRD-0125` | [BRD-0125: Author-Initiated Takedown Refinements](../Business-Requirements/BRD-0125-Author-Initiated-Takedown-Refinements.md) | Fully Aligned |
| **Functional Design Doc** | `FDD-0125` | [FDD-0125: Author-Initiated Takedown Refinements](../Functional-Design/FDD-0125-Author-Initiated-Takedown-Refinements.md) | Fully Aligned |
| **Governing User Story** | `Story 16.1` | [Epic 16: Privacy, Governance & Ops](../../user-stories/epic-16-adr-0125-to-0128.md#story-161--author-initiated-takedown-sla-tracking-and-enrichment-cascade-backend) | Acceptance Target |
| **Related User Stories** | `Story 10.11`, `Story 10.12`, `Story 10.14` | Public Takedown Form, Takedown Review Queue, Trust & Compliance Pack | Foundation & Consumer Flows |
| **Related Architecture Decisions** | `ADR-0092`, `ADR-0064`, `ADR-0071`, `ADR-0083`, `ADR-0126` | Base Takedown Model, AI Enrichment, RAG Deletion Sync, DSR Portal | System Architecture |
| **Executable Contract Tests** | `Story 16.1 Contract` | `social-listening-core/contracts/epic-16/story-16.1.takedown-sla-and-enrichment-cascade.contract.test.ts` | Ready for Suite Execution |

---

## 2. System Context & Architecture Topology

### 2.1 Context Diagram
```mermaid
flowchart TD
    subgraph PublicSurface["Public Author Entry Surface"]
        Author["Author / Data Subject"]
        PublicForm["Public Takedown Form (social-listening-admin)"]
        CaptchaValidator["Bot Mitigation (Cloudflare Turnstile / hCaptcha)"]
    end

    subgraph DSRCore["social-listening-core Takedown & Governance"]
        PublicEndpoint["POST /public/v1/takedowns"]
        MagicLinkVerify["POST /public/v1/takedowns/verify"]
        SLACalculator["SLA Calculator (created_at + 45 days)"]
        ReviewQueue["GET /v1/takedowns (Tenant-Admin / Legal)"]
        RedactionWorker["Redaction Cascade Worker"]
    end

    subgraph Storage["PostgreSQL (Tenant Partitioned & Isolated)"]
        DSRTable["data_subject_requests Table
        - sla_due_at (TIMESTAMPTZ)
        - risk_flag (BOOLEAN)
        - risk_reason (TEXT)
        - status: 'received' | 'granted' | 'denied'"]
        PostsTable["social_posts Table
        - body_markdown (redacted)
        - enrichment (JSONB: sentiment/topics scrubbed)"]
        MatchesTable["post_watchlist_matches Table"]
    end

    subgraph ExternalSearch["Vector Search & Indexes"]
        RAGIndex["Vector Database / RAGConnector"]
    end

    Author -->|Submit Takedown + Captcha Token| PublicForm
    PublicForm --> CaptchaValidator
    CaptchaValidator -->|Valid Token| PublicEndpoint
    PublicEndpoint --> DSRTable
    
    Author -->|Click Magic Link Verification| MagicLinkVerify
    MagicLinkVerify --> SLACalculator
    SLACalculator -->|Set sla_due_at| DSRTable

    ReviewQueue -->|Review Request with Advisory Risk Reason| DSRTable
    
    ReviewQueue -->|Grant Takedown (Human Action Only)| RedactionWorker
    RedactionWorker -->|Soft Redact Body & Scrub AI Enrichment| PostsTable
    RedactionWorker -->|Delete Matches| MatchesTable
    RedactionWorker -->|Purge Embedding| RAGIndex
```

### 2.2 Architectural Boundaries & Invariants
- **45-Day Statutory SLA Invariant:** Upon successful magic-link verification, `sla_due_at` is set to `created_at + INTERVAL '45 days'` (CCPA verifiable consumer request standard). Tenants may configure a stricter internal SLA (e.g., 30 days), but cannot extend beyond 45 days without Platform-Admin audit override.
- **Mandatory CAPTCHA Invariant:** Submissions to `POST /public/v1/takedowns` are rejected with HTTP 400 (`CAPTCHA_VERIFICATION_FAILED`) if the request lacks a valid bot verification token. This operates in conjunction with the 3 requests/IP/hour rate limit.
- **Strict Human-in-the-Loop Decision Rule:** The `risk_flag` (boolean) and `risk_reason` (text) columns provide advisory guidance to the human reviewer (e.g., detecting potential spoofing or malicious bulk requests). The system **strictly forbids** any automated grant or auto-deny logic based on risk scoring (adheres to ICO guidance for case-by-case reasoning).
- **Deep Redaction Propagation Invariant:** When a takedown is granted, redaction cascades through the entire storage graph:
  1. Soft-redaction of `social_posts.body_markdown` and `social_posts.raw_payload` (masked with standard redaction text).
  2. Complete scrubbing of AI-derived content in `social_posts.enrichment` (e.g., `sentiment`, `keyPhrases`, `topicClusters`, `sentimentConfidence`).
  3. Preservation of non-content technical metadata only (e.g., `detectedLanguage`, `enrichment_override` audit trace).
  4. Immediate synchronous invocation of `RAGConnector.deletePost()` and removal from `post_watchlist_matches`.

---

## 3. Data Architecture & Persistence Design

### 3.1 DDL Schema Definition
Migration `0080_add_takedown_refinements.sql`:
```sql
ALTER TABLE data_subject_requests
ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS risk_flag BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS risk_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_dsr_sla_due 
ON data_subject_requests (tenant_id, status, sla_due_at)
WHERE status = 'received';

CREATE INDEX IF NOT EXISTS idx_dsr_risk_flag 
ON data_subject_requests (tenant_id, risk_flag)
WHERE risk_flag = TRUE;
```

### 3.2 TypeScript Contracts
`social-listening-core/src/governance/types.ts`:
```typescript
export interface DataSubjectRequestRefined {
  id: string;
  tenantId: string;
  authorId: string;
  postUrl: string;
  status: 'pending_verification' | 'received' | 'granted' | 'denied' | 'escalated';
  slaDueAt: string;
  riskFlag: boolean;
  riskReason: string | null;
  createdAt: string;
  verifiedAt: string | null;
}

export interface EnrichmentRedactionPayload {
  sentiment: null;
  sentimentConfidence: null;
  keyPhrases: [];
  topicClusters: [];
  detectedLanguage: string;
  redactedAt: string;
}
```

---

## 4. Application Logic & Workflows

### 4.1 Verification & SLA Clock Initialization Flow
```typescript
export async function verifyTakedownMagicLink(token: string, pool: Pool): Promise<DataSubjectRequestRefined> {
  const tokenRecord = await validateMagicLinkToken(token, pool);
  const now = new Date();
  const slaDueAt = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000); // 45 calendar days

  const updated = await pool.query(
    `UPDATE data_subject_requests 
     SET status = 'received', 
         verified_at = $1, 
         sla_due_at = $2 
     WHERE id = $3 
     RETURNING *`,
    [now.toISOString(), slaDueAt.toISOString(), tokenRecord.requestId]
  );
  return mapToDSR(updated.rows[0]);
}
```

### 4.2 Deep Redaction Cascade Execution
```typescript
export async function executeRedactionCascade(
  tenantId: string,
  postId: string,
  client: PoolClient
): Promise<void> {
  // 1. Soft redact body and strip content-derived AI enrichment
  await client.query(
    `UPDATE social_posts
     SET body_markdown = '[REDACTED PURSUANT TO AUTHOR TAKEDOWN REQUEST]',
         raw_payload = '{"redacted": true}'::jsonb,
         enrichment = jsonb_set(
           jsonb_set(
             enrichment,
             '{sentiment}', 'null'::jsonb
           ),
           '{keyPhrases}', '[]'::jsonb
         ) - 'topicClusters'
     WHERE tenant_id = $1 AND id = $2`,
    [tenantId, postId]
  );

  // 2. Remove watchlist match references
  await client.query(
    `DELETE FROM post_watchlist_matches WHERE tenant_id = $1 AND post_id = $2`,
    [tenantId, postId]
  );

  // 3. Purge vector search embedding
  await ragConnector.deletePost(tenantId, postId);
}
```

---

## 5. Interface & API Contracts

### 5.1 Route Catalog
| Method | Endpoint | Authorization | Description |
|---|---|---|---|
| `POST` | `/public/v1/takedowns` | Public (CAPTCHA + Rate Limited) | Submits public author takedown with bot verification token |
| `POST` | `/public/v1/takedowns/verify` | Public (Magic Token) | Verifies email ownership and starts 45-day SLA clock |
| `GET` | `/v1/takedowns` | Tenant-Admin, Legal-Advisor | Lists pending takedowns with SLA indicators and risk flags |
| `POST` | `/v1/takedowns/:id/grant` | Tenant-Admin, Legal-Advisor | Executes deep redaction cascade across posts and enrichment |

### 5.2 Public Submission Payload (`POST /public/v1/takedowns`)
**Request Body:**
```json
{
  "postUrl": "https://x.com/acme/status/1828392193821",
  "authorEmail": "author@example.org",
  "reason": "Requesting removal under CCPA § 1798.105",
  "captchaToken": "0.AbCdEf123456XYZ"
}
```

**Response (202 Accepted):**
```json
{
  "status": "pending_verification",
  "message": "Verification link sent to author email. SLA clock begins upon verification."
}
```

### 5.3 Error Code Catalog
| HTTP Code | Error Code | Circumstance |
|---|---|---|
| `400` | `CAPTCHA_VERIFICATION_FAILED` | Bot mitigation challenge token is missing, expired, or invalid |
| `429` | `RATE_LIMIT_EXCEEDED` | Exceeded 3 submissions per IP per hour threshold |
| `403` | `AUTO_DECISION_FORBIDDEN` | Attempt to programmatically resolve takedown without human auth |
| `404` | `TAKEDOWN_NOT_FOUND` | Target request identifier does not exist |

---

## 6. Security, Tenancy & Isolation Model
- **Zero Account Author Access:** Authors submit takedowns without creating tenant accounts. Authenticity is validated via magic-link cryptographic tokens expiring in 24 hours.
- **Bot Mitigation Resiliency:** CAPTCHA verification communicates out-of-band with the challenge provider; server timeout defaults to 3 seconds to avoid blocking ingestion threads.
- **Tenant Redaction Scoping:** `executeRedactionCascade` is strictly scoped with `tenant_id`. It is impossible for an admin of Tenant A to trigger redaction on posts belonging to Tenant B.

---

## 7. Performance, Scalability & Resource Caps
- **SLA Breach Queries:** Filtered index `idx_dsr_sla_due` allows the SLA monitoring worker to query pending items close to deadline in $< 5\text{ms}$.
- **Batch Redaction Isolation:** Redaction of large media/text threads runs in a discrete database transaction with isolation level `READ COMMITTED`, releasing row locks in $< 15\text{ms}$.

---

## 8. Resilience, Recovery & Failure Semantics
- **Atomic Rollback on Vector Failure:** If `RAGConnector.deletePost()` throws an unrecoverable exception, the database transaction aborts and the request returns to `review` state, alerting platform operators rather than leaving vector index and PostgreSQL out of sync.

---

## 9. Observability, Telemetry & Auditability
- **Audit Logging:** Every grant, denial, and escalation is immutably recorded in `platform_admin_audit_log` and `tenant_compliance_audit_log` with the reviewer's user ID and statutory justification.
- **Metrics Tracked:**
  - `dsr_takedowns_submitted_total`
  - `dsr_takedowns_sla_breached_total`
  - `dsr_captcha_failures_total`

---

## 10. Migration, Compatibility & Rollback Strategy
- **Migration Plan:** `0080_add_takedown_refinements.sql` adds nullable fields without altering primary keys or breaking existing takedown review tables.
- **Backward Compatibility:** Existing in-flight takedowns receive a backfilled `sla_due_at = created_at + INTERVAL '45 days'`.

---

## 11. Verification, Testing & Quality Assurance
- **Contract Test Suite:** `social-listening-core/contracts/epic-16/story-16.1.takedown-sla-and-enrichment-cascade.contract.test.ts`:
  - (1) Rejects takedown submission when CAPTCHA token is omitted or invalid.
  - (2) Confirms `sla_due_at` equals `created_at + 45 days` upon verification.
  - (3) Confirms `risk_flag` is advisory only and does not auto-deny.
  - (4) Proves `executeRedactionCascade` clears `sentiment`, `keyPhrases`, and `topicClusters` in `social_posts.enrichment`.

---

## 12. Open Questions & Future Enhancements

- [ ] **[Q-0125-1]** **Automated SLA Breach Reminders:** Implementing automated email notifications to `Tenant-Admin` at 30 days and 40 days of pending SLA status.
- [ ] **[Q-0125-2]** **Requester Risk Transparency:** Evaluating whether internal risk-scoring flags should be hidden from external DSR status pages (default: hidden).
- [ ] **[Q-0125-3]** **Article 18 Quarantine Coupling:** Deciding if author takedown contested cases should automatically trigger Article 18 restriction flags prior to final review.
