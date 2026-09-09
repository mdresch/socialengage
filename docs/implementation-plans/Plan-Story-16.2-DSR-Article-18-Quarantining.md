# Implementation Plan — Story 16.2: DSR Article 18 Restriction Quarantining (Backend)

## 1. 7-Way Traceability Matrix
- **User Story:** [Story 16.2](../../user-stories/epic-16-adr-0125-to-0128.md#story-162--dsr-article-18-restriction-quarantining-backend)
- **Architecture Decision Record (ADR):** [ADR-0126](../../adr/0126-dsr-self-service-portal-refinements.md)
- **Business Requirements Document (BRD):** [BRD-0126](../project%20docs/Business-Requirements/BRD-0126-DSR-Self-Service-Portal-Refinements.md)
- **Functional Design Document (FDD):** [FDD-0126](../project%20docs/Functional-Design/FDD-0126-DSR-Self-Service-Portal-Refinements.md)
- **Technical Design Specification (TDS):** [TDS-0126](../project%20docs/Technical-Design/TDS-0126-DSR-Self-Service-Portal-Refinements.md)
- **Governing Skill:** [`social-listening-core/.claude/skills/data-governance/SKILL.md`](../../social-listening-core/.claude/skills/data-governance/SKILL.md)
- **Contract Test:** [`social-listening-core/contracts/epic-16/story-16.2.dsr-article-18-restriction.contract.test.ts`](../../social-listening-core/contracts/epic-16/story-16.2.dsr-article-18-restriction.contract.test.ts)

---

## 2. Intent Block
- **Story:** 16.2 — DSR Article 18 restriction quarantining (backend)
- **Source:** ADR-0126 (Accepted 2026-08-28)
- **Governed by:** BRD-0126, FDD-0126, TDS-0126
- **Scope:**
  - Database schema migration `0078_add_dsr_article_18_and_receipts.sql` adding `processing_restricted` column and partial index to `social_posts`, adding `request_type` to `data_subject_requests`, and creating `dsr_receipts` table with RLS.
  - Cryptographic HMAC-SHA256 receipt generation and constant-time verification service (`dsrReceipt.ts`).
  - DSR quarantine and receipt persistence store (`dsrQuarantineStore.ts`).
  - Public submission endpoint (`POST /public/v1/dsr/requests`) enforcing CAPTCHA and generating signed receipts.
  - Public receipt verification endpoint (`GET /public/v1/dsr/verify-receipt`).
  - Authenticated quarantine and unquarantine endpoints (`POST /v1/dsr/requests/:id/quarantine`, `POST /v1/dsr/requests/:id/unquarantine`).
  - Query interception excluding `processing_restricted = true` from analytics overview (`GET /v1/analytics/overview`), exports (`postExportEngine.ts`), and RAG vector search (`pgvectorConnector.ts`).
- **Contract to encode:**
  - `AC1: Mandatory Bot Mitigation & HMAC-SHA256 Receipt Issuance on Public DSR Submission`
  - `AC2: Public Constant-Time Receipt Verification & Anti-Tamper Protection`
  - `AC3: Role-Gated Article 18 Quarantine & Remediation Reversibility`
  - `AC4: Automatic Processing Exclusion from Analytics, Exports, and RAG Vector Retrieval`
- **Out of scope:**
  - UI frontend for DSR portal (separate story / epic-16 follow-up).
  - Permanent post deletion or irreversible erasure cascade (governed by ADR-0093 / Story 10.12).
  - External PDF generation for receipts (tracked in Q-0126-2).

---

## 3. Implementation Steps & Acceptance Verification
1. **Migration 0078:** Apply DDL schema adding `processing_restricted` to `social_posts`, `request_type` to `data_subject_requests`, and `dsr_receipts` table.
2. **Contract Test (RED phase):** Author `story-16.2.dsr-article-18-restriction.contract.test.ts` asserting all 4 ACs.
3. **Component Skill:** Update `data-governance/SKILL.md` with Article 18 invariants.
4. **Backend Implementation (GREEN phase):**
   - Author `dsrReceipt.ts` and `dsrQuarantineStore.ts`.
   - Author `dsrPublicRouter.ts` and `dsrRouter.ts`.
   - Update `postExportEngine.ts` and `analyticsViewsRouter.ts`.
   - Update `pgvectorConnector.ts`.
   - Wire routes into `app.ts` and `router.ts`.
5. **Validation:**
   - Execute contract test against template DB.
   - Run typecheck and full epic-16 suite.
