---
title: "Walkthrough — Story 15.2: Data Export Lookback Bounding and Representative Sampling (Backend)"
artifact_id: "Walkthrough-Story-15.2"
entity_id: "b8a630095d812fb89a57c1ee4fb20d7e"
version: "1.0.0"
source_document: "docs/walkthroughs/walkthrough-story-15.2.md"
created_at: "2026-09-07T21:10:00.000Z"
modified_at: "2026-09-07T21:10:00.000Z"
authority_level: 1
confidence_score: 1.0
type: "walkthrough"
status: "Verified"
pm_class: "DeliveryArtifact"
pm_subclass: "VerificationWalkthrough"
pm_relationships:
  - verifiesStory: "[[Story 15.2]]"
  - executesTDS: "[[TDS-0124]]"
  - validatesContract: "[[contracts/epic-15/story-15.2.data-export-sampling.contract.test.ts]]"
  - informsGovernance: "[[ADR-0124]]"
domain_cluster: "Platform Architecture & Foundations"
dmbok_category: "Data Integration & Interoperability"
pmbok_category: "Integration Management"
babok_category: "Solution Evaluation"
tags:
  - walkthrough
  - proof-of-execution
  - empirical-verification
  - story/15.2
  - epic/15
  - dmbok/data-integration-interoperability
  - pmbok/integration-management
  - babok/solution-evaluation
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

# Walkthrough — Story 15.2: Data Export Lookback Bounding and Representative Sampling (Backend)

We have implemented, contract-tested, validated, and verified **Story 15.2** (*Data export lookback bounding and representative sampling (backend)*), completing **Epic 15** in accordance with the contract-first methodology and grounded by [[ADR-0124]], [[BRD-0124]], [[FDD-0124]], and [[TDS-0124]].

---

## 1. Executable Contract Test Suite

We authored and verified the contract test suite in `social-listening-core/contracts/epic-15/story-15.2.data-export-sampling.contract.test.ts`:

| Contract Test Assertion | Focus Area | Status |
| :--- | :--- | :--- |
| `rejects date range exceeding 24 months with 400 EXPORT_RANGE_TOO_LARGE` | Validates lookback window upper bound $[1, 24]$ months on `GET /v1/posts/export.csv` | ✅ PASS |
| `rejects date range exceeding 24 months in async export POST /v1/posts/export` | Validates lookback ceiling enforcement on asynchronous background jobs | ✅ PASS |
| `rejects invalid date formats with 400 INVALID_DATE_FORMAT` | Asserts date string validation and standard error response | ✅ PASS |
| `accepts valid date range within 24 months` | Asserts queries within valid 24-month span succeed with `200 OK` | ✅ PASS |
| `returns representative systematic sample with headers and in-file metadata when matched > limit` | Verifies opt-in systematic stride sampling ($k = \lfloor N / S \rfloor$), transparent headers (`X-SocialEngage-Sampled: true`, `X-SocialEngage-Sample-Fraction`, `X-SocialEngage-Total-Matched`), and `# socialengage_export:` metadata line | ✅ PASS |
| `returns full dataset without sampled header when matched <= limit` | Verifies small result set fallback where $N \le S$ (omits stride downsampling, writes `sampled=false`) | ✅ PASS |
| `returns standard CSV without sampling metadata line when sample is false or omitted` | Preserves standard CSV structure for default non-sampled requests | ✅ PASS |
| `enforces strict tenant isolation during count, stride, and sampling queries` | Asserts multi-tenant partition isolation during count, stride, and row cursor queries | ✅ PASS |

### Test Suite Execution Output
```
PASS contracts/epic-15/story-15.2.data-export-sampling.contract.test.ts (16.565 s)
  Story 15.2 — Data Export Lookback Bounding and Representative Sampling Contract
    AC1: Maximum Lookback Date Range Validation
      √ rejects date range exceeding 24 months with 400 EXPORT_RANGE_TOO_LARGE (129 ms)
      √ rejects date range exceeding 24 months in async export POST /v1/posts/export (70 ms)
      √ rejects invalid date formats with 400 INVALID_DATE_FORMAT (23 ms)
      √ accepts valid date range within 24 months (97 ms)
    AC2: Opt-In Systematic Stride Sampling (sample=true)
      √ returns representative systematic sample with headers and in-file metadata when matched > limit (291 ms)
    AC3: Non-Sampled Path When Matched Set <= Limit
      √ returns full dataset without sampled header when matched <= limit (73 ms)
    AC4: Default Path (sample=false or omitted)
      √ returns standard CSV without sampling metadata line when sample is false or omitted (57 ms)
    AC5: Tenant Isolation Invariant
      √ enforces strict tenant isolation during count, stride, and sampling queries (132 ms)

Test Suites: 1 passed, 1 total
Tests:       8 passed, 8 total
Snapshots:   0 total
Time:        16.848 s
```

---

## 2. Core Implementation Deliverables

### `social-listening-core/src/posts/postExportEngine.ts`
1. **Lookback Bounding (`MAX_EXPORT_LOOKBACK_MONTHS = 24`)**:
   - Implemented `validateLookbackWindow(start?: string, end?: string)` validating temporal ranges and date formats.
   - Computes calendar-month boundaries with DST safety margin, returning `{ valid: false, code: 'EXPORT_RANGE_TOO_LARGE' }` when `end - start > 24` months.
2. **Systematic Stride Sampling**:
   - Implemented `countTotalMatchedPosts(tenantId, userId, filters)` for accurate match counting across tenant partitions.
   - Implemented `exportSampledPostRows(tenantId, userId, filters, stride, limit)` using SQL window ranking:
     ```sql
     WITH ranked_posts AS (
       SELECT sp.*, ROW_NUMBER() OVER (ORDER BY sp.published_at DESC) AS row_num
       FROM social_posts sp ...
     )
     SELECT * FROM ranked_posts
     WHERE (row_num % $stride) = 0
     ORDER BY published_at DESC
     LIMIT $limit
     ```
   - Added `SyncExportResult` returning CSV content, sample fraction, total matched, and sampled boolean.

### `social-listening-core/src/http/versions/v1/postsExportRouter.ts`
- **Lookback Pre-Flight Guard**: Rejects queries exceeding 24 months with `400 EXPORT_RANGE_TOO_LARGE` prior to query execution on both `GET /v1/posts/export.csv` and `POST /v1/posts/export`.
- **Sampling Transparency**: Injects headers `X-SocialEngage-Sampled: true`, `X-SocialEngage-Sample-Fraction`, and `X-SocialEngage-Total-Matched` when `sample=true` and downsampling occurred.

### `social-listening-admin/src/app/api/posts/export.csv/route.ts`
- Transparently forwards `X-SocialEngage-Sampled*` headers from core to downstream client consumers.

---

## 3. Second Brain Automated Post-Commit Hook

Created `scripts/sync-committed-to-secondbrain.mjs` and wired it into `scripts/git-hooks/post-commit`:
- Automatically mirrors committed walkthroughs to `wiki/Projects/SocialEngage/06.5 Implementation Walkthroughs/`.
- Automatically mirrors committed plans to `wiki/Projects/SocialEngage/04.5 Implementation Plans/`.
- Executes `export-to-obsidian.mjs` to keep 4-way traceability links updated.
- Executes `compile-obsidian-telemetry.mjs` to refresh the Project Progress Dashboard.
- Executes `backfill-obsidian-frontmatter.mjs` to stamp commit hashes and timestamps onto affected Second Brain pages.

---

## 4. Regression & Typecheck Verification

- **Story 10.8 (`data-export-posts-csv`)**: 2/2 tests PASS
- **Story 13.4 (`export-bounding-streaming-and-size-caps`)**: 7/7 tests PASS
- **Story 15.1 (`alert-rules-refinements`)**: 5/5 tests PASS
- **Typecheck (`social-listening-core`)**: `tsc --noEmit` exited with 0 errors
- **Typecheck (`social-listening-admin`)**: `tsc --noEmit` exited with 0 errors
