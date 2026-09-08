# Walkthrough — Story 16.2: DSR Article 18 Restriction Quarantining (Backend)

## 1. Summary of Accomplishments
Implemented GDPR Article 18 data processing restriction quarantining and cryptographically signed submission receipts in `social-listening-core` per **ADR-0126**, **BRD-0126**, **FDD-0126**, **TDS-0126**, and **Story 16.2**:
- **DDL Migration `0078_add_dsr_article_18_and_receipts.sql`:**
  - Added `processing_restricted BOOLEAN NOT NULL DEFAULT FALSE` to `social_posts`.
  - Created partial index `idx_social_posts_active_processing ON social_posts (tenant_id, created_at) WHERE processing_restricted = FALSE`.
  - Added `request_type` column to `data_subject_requests` with check constraint.
  - Created `dsr_receipts` table with RLS tenant isolation and app_user permissions.
- **Cryptographic Confirmation Receipts (`dsrReceipt.ts`):**
  - Normalized SHA-256 one-way hashing (`subjectHash`) shielding raw author email addresses in receipts.
  - Canonical key-ordered HMAC-SHA256 digital signature generation.
  - Public constant-time verification using `crypto.timingSafeEqual` preventing timing attacks.
- **Public & Authenticated Endpoints:**
  - `POST /public/v1/dsr/requests`: Validates CAPTCHA, creates DSR record, issues & persists signed receipt, returns `201 Created`.
  - `GET /public/v1/dsr/verify-receipt`: Public verification of receipt signature and authenticity.
  - `POST /v1/dsr/requests/:id/quarantine`: Role-gated (`tenant_admin` / `legal_advisor`), soft-quarantines contested posts (`processing_restricted = true`).
  - `POST /v1/dsr/requests/:id/unquarantine`: Role-gated reversal (`processing_restricted = false`).
- **Processing Exclusion Invariants:**
  - `GET /v1/analytics/overview` dynamically excludes restricted posts from metric totals and aggregations.
  - `GET /v1/posts/export.csv` and async export jobs exclude restricted posts.
  - RAG vector search (`pgvectorConnector.ts`) filters out chunks whose parent post is restricted.
  - Underlying database rows and payload data are strictly preserved pending legal resolution.

---

## 2. Verification Results

### 2.1 Contract Test Suite
Executed against physically isolated PostgreSQL test container on port `5434` (`social_listening_template`):
```bash
npm test contracts/epic-16/story-16.2.dsr-article-18-restriction.contract.test.ts
```
**Output:**
```
PASS contracts/epic-16/story-16.2.dsr-article-18-restriction.contract.test.ts
  Story 16.2 — DSR Article 18 Restriction Quarantining and Verified Receipts Contract
    AC1: Mandatory Bot Mitigation & HMAC-SHA256 Receipt Issuance on Public DSR Submission
      √ rejects public DSR requests missing captchaToken with 400 CAPTCHA_VERIFICATION_FAILED (88 ms)
      √ rejects public DSR requests with invalid captchaToken with 400 CAPTCHA_VERIFICATION_FAILED (15 ms)
      √ accepts valid restriction request returning 201 Created with cryptographically signed HMAC-SHA256 receipt (65 ms)
    AC2: Public Constant-Time Receipt Verification & Anti-Tamper Protection
      √ validates genuine HMAC-SHA256 receipt successfully returning verified: true (32 ms)
      √ rejects tampered receipt payload with 400 INVALID_RECEIPT_SIGNATURE (31 ms)
      √ rejects invalid or forged receipt signature with 400 INVALID_RECEIPT_SIGNATURE (10 ms)
    AC3: Role-Gated Article 18 Quarantine & Remediation Reversibility
      √ forbids non-admin / unauthorized tenant users from executing quarantine (42 ms)
      √ allows tenant_admin to quarantine contested post and reverse via unquarantine (90 ms)
    AC4: Automatic Processing Exclusion from Analytics, Exports, and RAG Vector Retrieval
      √ excludes processing_restricted posts from analytics overview, exports, and RAG search without deleting underlying row (166 ms)

Test Suites: 1 passed, 1 total
Tests:       9 passed, 9 total
```

### 2.2 Epic 16 Suite Regression Check
```bash
npm test contracts/epic-16
```
**Output:**
```
PASS contracts/epic-16/story-16.2.dsr-article-18-restriction.contract.test.ts
PASS contracts/epic-16/story-16.1.takedown-sla-and-enrichment-cascade.contract.test.ts

Test Suites: 2 passed, 2 total
Tests:       18 passed, 18 total
```

### 2.3 Typecheck
```bash
npm run typecheck
```
**Output:** `tsc --noEmit` returned 0 errors.
