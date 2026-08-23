# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0116 Semantic Drift Detection — Functional Design Document |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer — Batch Agent |
| Reviewer(s) | Product Owner / Technical Lead |
| Status | Draft (ADR status: Proposed (2026-08-23); BRD status: Draft for review) |
| Related Documents | ADR-0116, BRD-0116, related feature designs, user stories |

---

## 2. Purpose and Scope

### 2.1 Purpose
**Note:** The source ADR is currently **Proposed**. This FDD is a draft for review and may change.

Topics, brand names, products, and hashtags are not static. A single term can take on very different meanings over time—"Swift" may refer to a programming language, a singer, or a bank depending on the current conversation. Today, users of the SocialEngage platform can track topic volume, source mix, and sentiment, but they lack a systematic way to detect when the *meaning* of a topic has shifted.

This FDD translates the accepted architecture and business requirements from ADR-0116 and BRD-0116 into a coherent functional design for implementation.

### 2.2 Scope

- **In scope:** - A backend `SemanticDriftService` that computes a drift score between two user-selected time windows for a given topic.
- Vector centroid comparison and semantic clustering of RAG chunks within each time window.
- A tenant-scoped `GET /v1/topics/:id/drift` endpoint returning a structured drift result.
- 24-hour caching of drift results.
- Warning levels: none, mild, and significant, based on the drift score.
- UI integration with the Topic Evolution Timeline to display a drift warning icon for significant drift.
- A `DriftExplanationCard` that explains the shift using existing AI explanation capabilities (`RAGAsk`).
- Sample posts and top cluster labels for each time window.
- **Out of scope:** - v1 topic evolution timeline features (this capability is a v2 enhancement).
- Pre-computing drift for all topics every day (only on-demand drift with caching is in scope).
- Detecting drift by keyword frequency or volume counts alone.
- Support for sub-topic drift in the initial release (unless the ADR later resolves this open question in scope).
- Mutating topic data or automatic topic reclassification.
- **Assumptions and constraints:** - The RAG pipeline and vector store are production-ready and contain enough indexed chunks for the topic and windows requested.
- Users are authenticated and tenant-scoped; the topic belongs to their tenant.
- The Topic Evolution Timeline and `RAGAsk` (plain-language explanation) capabilities are available for UI integration.

### 2.3 Target Audience
Engineers, QA, product owners, UX, and platform operations.

---

## 3. Context and Background

### 1. Topics are not static
A brand name, product, or hashtag can shift in meaning. "Swift" can mean a programming language, a singer, or a bank. `docs/product-research/feature-designs/25-topic-evolution-timeline.md` v2 requires semantic-drift detection so users can see when a topic's conversation has changed.

### 2. RAG provides the embedding layer
`ADR-0082` (chunking and embedding) and `ADR-0083` (vector-store metadata) store post chunks as vectors. The drift service can compare vectors from different time windows.

### 3. Drift is an advanced, v2 feature
This ADR is intentionally scoped for v2. It depends on a working RAG pipeline and is not required for v1 topic evolution.

---

---

## 4. Goals and Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Enable users to detect when a topic's meaning has changed between two time windows | Drift score and warning level are returned for any topic with sufficient RAG chunks |
| 2 | Improve trend validation and crisis early warning | Users can distinguish volume spikes from genuine semantic shifts within the Topic Evolution Timeline |
| 3 | Support strategic research and reporting | Analysts can export or share drift results and plain-language explanations |
| 4 | Keep the platform cost-efficient | Drift computations are cached for 24 hours to reduce repeated expensive vector operations |

---

---

## 5. Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall compute a semantic drift score between two time windows for a selected topic | Must | A `driftScore` between 0.0 and 1.0 is returned when sufficient RAG chunks exist for both windows | Product Owner |
| BR-002 | The system shall identify the top semantic clusters in each time window | Must | `topClustersNow` and `topClustersThen` are returned as human-readable labels | Product Owner |
| BR-003 | The system shall surface representative sample posts from each time window | Must | `samplePostsNow` and `samplePostsThen` contain posts near the computed centroids | Product Owner |
| BR-004 | The system shall classify drift into warning levels (none, mild, significant) | Must | `warning` is `none` for `driftScore < 0.2`, `mild` for 0.2–0.5, and `significant` for `driftScore >= 0.5` | Product Owner |
| BR-005 | The system shall expose a tenant-scoped endpoint to request drift results | Must | `GET /v1/topics/:id/drift` returns `DriftResult` only for the user's own tenant | Product Owner |
| BR-006 | The system shall cache drift results to reduce compute cost | Must | Identical requests within 24 hours return the cached result | Product Owner |
| BR-007 | The Topic Evolution Timeline shall display a drift warning icon for significant drift | Should | `driftScore >= 0.5` triggers a visible warning on the relevant period | Product Owner |
| BR-008 | The system shall provide a plain-language explanation of the drift | Should | `DriftExplanationCard` uses `RAGAsk` to summarize the shift in non-technical language | Product Owner |
| BR-009 | Users shall be able to select the two time windows for comparison | Should | The `start` and `end` parameters are accepted and validated | Product Owner |

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Topic-Center-Analyst (primary) | Daily analyst exploring topic evolution | High | Understand when a topic's meaning changes; compare time windows; see representative posts |
| Tenant-Brand-Reputation-Manager (primary) | Reputation and crisis monitoring | High | Receive early warning of significant semantic drift on brand-related topics |
| Tenant-Business-Analyst (secondary) | Reporting and insights consumption | Medium | Export or summarize drift findings for stakeholders |
| Tenant-Reader (secondary) | Reads simplified explanations | Low | See plain-language drift summaries without technical detail |
| Backend Engineering | Builds and operates the service | High | Clear boundaries, caching strategy, and RAG dependencies |
| Platform Operations | Cost and performance oversight | Medium | Compute is bounded and cacheable |

---

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| 13.11 | backend engineer | `SemanticDriftService` and `GET /v1/topics/:id/drift`, | `Topic-Center-Analyst` can see when a topic's meaning shifts over time. | Compute centroid vectors for two time windows and return `driftScore`.; Cluster chunks in each window and produce `topClustersNow` and `topClustersThen`.; `driftScore >= 0.5` triggers `warning: 'significant'`. |
| 13.12 | `Topic-Center-Analyst` | a drift warning on the topic evolution timeline and a card explaining the shift, | I can react to a topic changing meaning. | Drift warning icon on `TopicEvolutionTimeline` for significant drift.; `DriftExplanationCard` shows `topClustersNow/Then` and sample posts.; `RAGAsk` (ADR-0084) can generate a plain-language drift summary. |

### 6.3 Workflow Diagrams / Steps

### 1. `SemanticDriftService`
```ts
interface SemanticDriftService {
  computeDrift(topicId: string, start: ISOString, end: ISOString): Promise<DriftResult>;
}

interface DriftResult {
  topicId: string;
  start: string;
  end: string;
  driftScore: number;           // 0.0 (same) to 1.0 (completely different)
  topClustersNow: string[];     // current semantic cluster labels
  topClustersThen: string[];    // previous semantic cluster labels
  samplePostsNow: string[];
  samplePostsThen: string[];
  warning: 'none' | 'mild' | 'significant';
}
```

### 2. Drift computation
- Select `RAG` chunks for the topic in the `start` window and the `end` window.
- Compute the centroid vector for each window.
- `driftScore = 1 - cosine_similarity(centroid_then, centroid_now)`.
- Run k-means or HDBSCAN on each window's chunks to produce `topClusters`.
- Pick sample posts near each centroid for `samplePosts`.

### 3. Drift score thresholds
- `warning = 'none'` if `driftScore < 0.2`.
- `warning = 'mild'` if `0.2 <= driftScore < 0.5`.
- `warning = 'significant'` if `driftScore >= 0.5`.

### 4. `GET /v1/topics/:id/drift` endpoint
```
GET /v1/topics/:id/drift?start=...&end=...
```

- Tenant-scoped; the `topic_id` must belong to the tenant.
- Returns `DriftResult`.
- Cached for 24 hours because drift is expensive to compute.

### 5. UI integration
- The Topic Evolution Timeline (ADR-0097) shows a `warning` icon on periods where `driftScore` is high.
- A `DriftExplanationCard` explains the shift in plain language using `RAGAsk` (ADR-0084).

---

---

## 7. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| RAG vector chunks | Embedded post chunks per topic and time window | `RAGConnector` / vector store | Backend Engineering | Tenant-scoped content |
| Centroid vectors | Computed average vector for each time window | Derived from RAG chunks | Backend Engineering | Derived, tenant-scoped |
| Cluster labels | Top semantic cluster names for each window | Derived from RAG chunks | Backend Engineering | Derived |
| Sample posts | Representative posts near each centroid | `social_posts` (via RAG) | Backend Engineering | Tenant content |
| Drift result cache | Cached `DriftResult` for 24 hours | `GET /v1/topics/:id/drift` | Backend Engineering | Tenant-scoped, temporary |
| Drift score | Quantitative 0.0–1.0 score | Derived from centroids | Backend Engineering | Derived |
| Warning level | `none`, `mild`, or `significant` | Derived from drift score | Backend Engineering | Derived |

---

---

## 8. Business Rules and Logic

| ID | Rule |
|---|---|
| BRU-001 | A user may only request drift for a `topic_id` that belongs to their tenant. |
| BRU-002 | Drift warning is `none` when `driftScore < 0.2`. |
| BRU-003 | Drift warning is `mild` when `0.2 <= driftScore < 0.5`. |
| BRU-004 | Drift warning is `significant` when `driftScore >= 0.5`. |
| BRU-005 | Drift results for the same topic and time windows are cached for 24 hours. |
| BRU-006 | Drift is computed only from RAG vector chunks with tenant-scoped access. |
| BRU-007 | Drift computation is on-demand; no periodic pre-computation is required. |

---

---

## 9. Interfaces and Integrations

### 1. `SemanticDriftService`
```ts
interface SemanticDriftService {
  computeDrift(topicId: string, start: ISOString, end: ISOString): Promise<DriftResult>;
}

interface DriftResult {
  topicId: string;
  start: string;
  end: string;
  driftScore: number;           // 0.0 (same) to 1.0 (completely different)
  topClustersNow: string[];     // current semantic cluster labels
  topClustersThen: string[];    // previous semantic cluster labels
  samplePostsNow: string[];
  samplePostsThen: string[];
  warning: 'none' | 'mild' | 'significant';
}
```

### 2. Drift computation
- Select `RAG` chunks for the topic in the `start` window and the `end` window.
- Compute the centroid vector for each window.
- `driftScore = 1 - cosine_similarity(centroid_then, centroid_now)`.
- Run k-means or HDBSCAN on each window's chunks to produce `topClusters`.
- Pick sample posts near each centroid for `samplePosts`.

### 3. Drift score thresholds
- `warning = 'none'` if `driftScore < 0.2`.
- `warning = 'mild'` if `0.2 <= driftScore < 0.5`.
- `warning = 'significant'` if `driftScore >= 0.5`.

### 4. `GET /v1/topics/:id/drift` endpoint
```
GET /v1/topics/:id/drift?start=...&end=...
```

- Tenant-scoped; the `topic_id` must belong to the tenant.
- Returns `DriftResult`.
- Cached for 24 hours because drift is expensive to compute.

### 5. UI integration
- The Topic Evolution Timeline (ADR-0097) shows a `warning` icon on periods where `driftScore` is high.
- A `DriftExplanationCard` explains the shift in plain language using `RAGAsk` (ADR-0084).

---

---

## 10. Non-Functional Considerations

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Drift results shall be tenant-isolated | Security | Must | The endpoint enforces that `topic_id` belongs to the requesting tenant |
| NFR-002 | Drift computation response time should be under 30 seconds for typical time windows | Performance | Should | Measured via monitoring in a staging environment |
| NFR-003 | Expensive drift operations shall be cached for 24 hours | Performance | Must | Repeated identical requests do not recompute for 24 hours |
| NFR-004 | The feature shall remain optional and not degrade v1 topic evolution | Maintainability | Must | The Topic Evolution Timeline works without drift if RAG is unavailable |
| NFR-005 | Drift results shall be read-only and not mutate topic or post data | Security | Must | No writes to `social_posts`, `topics`, or related tables during drift computation |

---

---

## 11. Error Handling and Exceptions

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | RAG pipeline is not production-ready when v2 is planned | Medium | High | Scope drift as v2 and gate behind feature-availability checks | Technical Lead |
| R-002 | Centroid and clustering compute is too expensive or slow | Medium | High | Cache results for 24 hours; compute on-demand only | Backend Engineering |
| R-003 | Drift results are hard for users to interpret | Medium | Medium | Provide warning levels, sample posts, cluster labels, and plain-language AI explanations | Product Owner |
| R-004 | Insufficient chunks in a time window produce unreliable scores | Medium | Medium | Document minimum data thresholds; handle low-confidence windows gracefully | Backend Engineering |
| R-005 | Auto-generated cluster labels are ambiguous or tied | Low | Medium | Define deterministic tie-breaking rules; allow human review in later iterations | Product Owner |

---

---

## 12. Assumptions and Dependencies

- The RAG pipeline and vector store are production-ready and contain enough indexed chunks for the topic and windows requested.
- Users are authenticated and tenant-scoped; the topic belongs to their tenant.
- The Topic Evolution Timeline and `RAGAsk` (plain-language explanation) capabilities are available for UI integration.

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | RAG chunking and embedding pipeline (ADR-0082) | Internal / Technical | Backend Engineering | In place before v2 |
| D-002 | Vector-store metadata and tenant scoping (ADR-0083) | Internal / Technical | Backend Engineering | In place before v2 |
| D-003 | `RAGAsk` plain-language explanation service (ADR-0084) | Internal / Technical | Backend Engineering | In place before v2 |
| D-004 | Topic Evolution Timeline (ADR-0097) | Internal / Feature | Frontend Engineering | In place before UI integration |
| D-005 | Feature-gate support (ADR-0112) | Internal / Feature | Backend Engineering | Required if drift is gated by plan |

---

---

## 13. Open Questions

- How many chunks per time window should be sampled? 100? 1,000?
- Should drift use all chunks for the topic or only those with high confidence?
- How are ties in `topClusters` handled if cluster names are auto-generated?
- Should drift be computed for sub-topics or only root topics?

---

---

## 14. Appendix

### Reference Documents

- ADR-0116: `docs/adr/0116-semantic-drift-detection.md`
- BRD-0116: `docs/project docs/Business-Requirements/BRD-0116-Semantic-Drift-Detection.md`
- Feature design: `docs/product-research/feature-designs/25-topic-evolution-timeline.md`
- User stories: `docs/user-stories/epic-13-adr-0109-to-0117.md`

### Missing Sources Noted

- No matching deep-research report found in `docs/product-research/reports/`.

### Revision History

| Version | Date | Author | Description |
|---|---|---|---|
| 0.1 | 2026-08-23 | FDD Writer — Batch Agent | Initial synthesis from ADR-0116 and BRD-0116. |