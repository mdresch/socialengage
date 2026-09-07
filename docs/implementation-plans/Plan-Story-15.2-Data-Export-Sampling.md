---
title: "Implementation Plan — Story 15.2: Data Export Lookback Bounding and Representative Sampling (Backend)"
artifact_id: "Plan-Story-15.2"
entity_id: "b8a630095d812fb89a57c1ee4fb20d7e"
version: "1.0.0"
source_document: "docs/implementation-plans/Plan-Story-15.2-Data-Export-Sampling.md"
created_at: "2026-09-07T20:50:00.000Z"
modified_at: "2026-09-07T20:50:00.000Z"
authority_level: 1
confidence_score: 1.0
type: "plan"
status: "Approved"
pm_class: "DeliveryArtifact"
pm_subclass: "ImplementationPlan"
pm_relationships:
  - plansStory: "[[Story 15.2]]"
  - executesTDS: "[[TDS-0124]]"
  - validatesContract: "[[contracts/epic-15/story-15.2.data-export-sampling.contract.test.ts]]"
  - informsGovernance: "[[ADR-0124]]"
domain_cluster: "Platform Architecture & Foundations"
dmbok_category: "Data Integration & Interoperability"
pmbok_category: "Integration Management"
babok_category: "Requirements Life Cycle Management"
tags:
  - plan
  - implementation-plan
  - story/15.2
  - epic/15
  - dmbok/data-integration-interoperability
  - pmbok/integration-management
  - babok/requirements-life-cycle-management
  - project/socialengage
---

> [!NOTE] 🔗 **7-Way Heptagonal Traceability Mesh (ADR ↔ BRD ↔ FDD ↔ TDS ↔ Story ↔ Plan ↔ Walkthrough)**
> - 🏛️ **Architecture Decision:** [[ADR-0124|ADR-0124: Data export — posts CSV sampling and bounded lookback]]
> - 📋 **Business Requirements:** [[BRD-0124|BRD-0124: Data Export Posts CSV Sampling And Bounded Lookback]]
> - 📐 **Functional Design:** [[FDD-0124|FDD-0124: Data Export Posts CSV Sampling And Bounded Lookback]]
> - 🛠️ **Technical Design (TDS):** [[TDS-0124|TDS-0124: Data Export — Posts CSV Sampling and Bounded Lookback]]
> - 🎯 **User Stories & Delivery:** [[Story 15.2]] (✅ Built)
> - 📋 **Pre-Execution Blueprint:** [[Plan-Story-15.2-Data-Export-Sampling|Plan: Story 15.2]] (✅ Approved)
> - 📜 **Proof of Execution:** [[Walkthrough-Story-15.2-Data-Export-Sampling|Walkthrough: Story 15.2]] (🟢 100% Passing Gate)

# Implementation Plan — Story 15.2: Data Export Lookback Bounding and Representative Sampling (Backend)

We are implementing **Story 15.2** (*Data export lookback bounding and representative sampling (backend)*), completing **Epic 15** in accordance with [[ADR-0124]], [[BRD-0124]], [[FDD-0124]], and [[TDS-0124]].

---

## 1. Architectural Invariants

1. **Temporal Lookback Ceiling (24 Months)**: Queries specifying a `start` and `end` spanning $> 24$ months are rejected with `400 EXPORT_RANGE_TOO_LARGE` prior to query execution.
2. **Opt-In Systematic Stride Sampling (`sample=true`)**: Never substituted by default. When `sample=true` is requested on datasets exceeding the sync threshold ($S = 5,000$), the engine uses a deterministic stride $k = \lfloor N / S \rfloor$ ordered by `published_at DESC` to stream a representative sample.
3. **Dual Transparency Protocol**: Sampled CSVs explicitly advertise sampling via both:
   - HTTP Headers: `X-SocialEngage-Sampled: true`, `X-SocialEngage-Sample-Fraction: <f>`, `X-SocialEngage-Total-Matched: <N>`
   - Leading In-File Metadata: `# socialengage_export: sampled=true; sample_fraction=<f>; total_matched=<N>; sample_size=<S>`

---

## 2. Proposed Changes

### Core Post Export Engine & Sampling Logic
- `social-listening-core/src/posts/postExportEngine.ts`:
  - `MAX_EXPORT_LOOKBACK_MONTHS = 24`.
  - `validateLookbackWindow(start?, end?)`.
  - `countTotalMatchedPosts(tenantId, userId, filters)`.
  - `exportSampledPostRows(tenantId, userId, filters, stride, limit)`.
  - `fetchPostsForSyncExport(..., sample = false): Promise<SyncExportResult>`.

### HTTP Route Handlers
- `social-listening-core/src/http/versions/v1/postsExportRouter.ts`:
  - Enforce lookback pre-flight checks on `GET /v1/posts/export.csv` and `POST /v1/posts/export`.
  - Attach transparent sampling headers when sampled.
- `social-listening-admin/src/app/api/posts/export.csv/route.ts`:
  - Forward sampling headers to downstream callers.

### Contract Test Suite
- `social-listening-core/contracts/epic-15/story-15.2.data-export-sampling.contract.test.ts`:
  - 8 contract assertions covering AC1 to AC5.
