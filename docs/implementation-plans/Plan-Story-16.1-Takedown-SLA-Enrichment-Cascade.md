---
title: "Implementation Plan — Story 16.1: Author-Initiated Takedown SLA Tracking and Enrichment Cascade (Backend)"
artifact_id: "Plan-Story-16.1"
entity_id: "e1a92c4b78912dfa88234cde45671234"
version: "1.0.0"
source_document: "docs/implementation-plans/Plan-Story-16.1-Takedown-SLA-Enrichment-Cascade.md"
created_at: "2026-09-08T00:00:00.000Z"
modified_at: "2026-09-08T00:00:00.000Z"
authority_level: 1
confidence_score: 1.0
type: "plan"
status: "Approved"
pm_class: "DeliveryArtifact"
pm_subclass: "ImplementationPlan"
pm_relationships:
  - plansStory: "[[Story 16.1]]"
  - executesTDS: "[[TDS-0125]]"
  - validatesContract: "[[contracts/epic-16/story-16.1.takedown-sla-and-enrichment-cascade.contract.test.ts]]"
  - informsGovernance: "[[ADR-0125]]"
domain_cluster: "Platform Architecture & Foundations"
dmbok_category: "Data Security & Governance"
pmbok_category: "Integration Management"
babok_category: "Requirements Life Cycle Management"
tags:
  - plan
  - implementation-plan
  - story/16.1
  - epic/16
  - dmbok/data-security-governance
  - pmbok/integration-management
  - babok/requirements-life-cycle-management
  - project/socialengage
---

> [!NOTE] 🔗 **7-Way Heptagonal Traceability Mesh (ADR ↔ BRD ↔ FDD ↔ TDS ↔ Story ↔ Plan ↔ Walkthrough)**
> - 🏛️ **Architecture Decision:** [[ADR-0125|ADR-0125: Author-initiated takedown refinements — SLA, risk-flagging, and redaction propagation scope]]
> - 📋 **Business Requirements:** [[BRD-0125|BRD-0125: Author-Initiated Takedown Refinements]]
> - 📐 **Functional Design:** [[FDD-0125|FDD-0125: Author-Initiated Takedown Refinements]]
> - 🛠️ **Technical Design (TDS):** [[TDS-0125|TDS-0125: Author-Initiated Takedown Refinements — 45-Day Statutory SLA, Mandatory CAPTCHA Mitigation, Advisory Risk-Flagging & AI Enrichment Redaction Propagation]]
> - 🎯 **User Stories & Delivery:** [[Story 16.1]] (✅ Built)
> - 📋 **Pre-Execution Blueprint:** [[Plan-Story-16.1-Takedown-SLA-Enrichment-Cascade|Plan: Story 16.1]] (✅ Approved)
> - 📜 **Proof of Execution:** [[Walkthrough-Story-16.1-Takedown-SLA-Enrichment-Cascade|Walkthrough: Story 16.1]] (🟢 100% Passing Gate)

# Implementation Plan — Story 16.1: Author-Initiated Takedown SLA Tracking and Enrichment Cascade (Backend)

We are implementing **Story 16.1** (*Author-initiated takedown SLA tracking and enrichment cascade (backend)*), opening **Epic 16** in accordance with [[ADR-0125]], [[BRD-0125]], [[FDD-0125]], and [[TDS-0125]].

---

## 1. Architectural Invariants

1. **Mandatory Bot Mitigation (CAPTCHA):**
   `POST /public/v1/takedowns` enforces mandatory bot verification challenge tokens (`captchaToken`). Submissions missing or failing token validation return `400 CAPTCHA_VERIFICATION_FAILED`.
2. **Statutory 45-Day Response SLA Clock:**
   Upon magic-link token verification (`POST /public/v1/takedowns/verify`), requests transition from `pending_verification` to `received`, setting `sla_due_at = now() + 45 days`. Tenants may shorten this window via configuration, but cannot extend it past 45 days without Platform-Admin override.
3. **Strict Human-in-the-Loop Decision Rule:**
   `data_subject_requests` stores advisory fields `risk_flag` and `risk_reason` to inform human reviewers (`Tenant-Admin`, `Legal-Advisor`). Automated resolution and auto-denials are strictly forbidden (`403 AUTO_DECISION_FORBIDDEN`).
4. **Deep AI Redaction Cascade:**
   Granting a takedown soft-redacts post text and payload, clears AI-derived enrichment (`sentiment = null`, `sentimentConfidence = null`, `keyPhrases = []`, removes `topicClusters`), cleans up watchlist matches, and synchronously purges RAG vector chunks.

---

## 2. Proposed Changes

### Database & Migrations
- `social-listening-core/migrations/0077_create_data_subject_requests_and_refinements.sql`:
  - Table `data_subject_requests` with SLA, risk, and status tracking.
  - Columns `redacted_at` and `redaction_request_id` on `social_posts`.
  - Indexes: `idx_dsr_tenant_status`, `idx_dsr_sla_due`, `idx_dsr_risk_flag`, `idx_dsr_verification_token`.
  - Strict RLS isolation and permissions.

### Core Data & Service Layer
- `social-listening-core/src/governance/types.ts`:
  - Request and cascade type contracts.
- `social-listening-core/src/governance/captchaValidator.ts`:
  - Bot challenge validation helper.
- `social-listening-core/src/governance/takedownStore.ts`:
  - Persistence logic for creation, magic-link verification, review queue listing, and transactional deep redaction cascade.

### HTTP Routing & API Exposure
- `social-listening-core/src/http/versions/v1/takedownsPublicRouter.ts`:
  - `POST /public/v1/takedowns` and `POST /public/v1/takedowns/verify`.
- `social-listening-core/src/http/versions/v1/takedownsRouter.ts`:
  - `GET /v1/takedowns`, `POST /v1/takedowns/:id/grant`, `POST /v1/takedowns/:id/deny`, `POST /v1/takedowns/:id/escalate`.
- `social-listening-core/src/http/app.ts` & `src/http/versions/v1/router.ts`:
  - Route wiring and mount points.

### Contract Test Suite
- `social-listening-core/contracts/epic-16/story-16.1.takedown-sla-and-enrichment-cascade.contract.test.ts`:
  - 9 contract assertions covering AC1 to AC4.
