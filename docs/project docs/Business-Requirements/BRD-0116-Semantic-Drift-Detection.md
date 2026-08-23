# Business Requirements Document (BRD)

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | Semantic Drift Detection – Business Requirements Document |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno, Product Owner / Technical Lead |
| Status | Draft for review |

> **Note:** The source ADR (ADR-0116) is currently in **Proposed** status. This BRD is therefore a draft for review and may change pending ADR acceptance.

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | BRD Writer Agent | Initial draft from ADR-0116, feature design 25-topic-evolution-timeline, and Epic 13 stories |

---

## 2. Executive Summary

Topics, brand names, products, and hashtags are not static. A single term can take on very different meanings over time—"Swift" may refer to a programming language, a singer, or a bank depending on the current conversation. Today, users of the SocialEngage platform can track topic volume, source mix, and sentiment, but they lack a systematic way to detect when the *meaning* of a topic has shifted.

The proposed Semantic Drift Detection capability addresses this gap by comparing vector embeddings of social-post chunks across two time windows. It produces a quantitative drift score, identifies the dominant semantic clusters in each window, surfaces sample posts, and assigns a warning level. The capability is delivered through a backend service, a tenant-scoped API endpoint, and integration with the Topic Evolution Timeline and AI explanation features. Because it relies on an operational RAG (retrieval-augmented generation) pipeline, it is intentionally scoped as a v2 enhancement.

The expected business value is a deeper, more actionable understanding of topic evolution: analysts can validate whether a spike is a real shift in conversation or simply noise, brand managers receive an early warning when reputation-related topics change meaning, and strategic researchers can present evidence-based narratives about how language and audiences evolve over time.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Enable users to detect when a topic's meaning has changed between two time windows | Drift score and warning level are returned for any topic with sufficient RAG chunks |
| 2 | Improve trend validation and crisis early warning | Users can distinguish volume spikes from genuine semantic shifts within the Topic Evolution Timeline |
| 3 | Support strategic research and reporting | Analysts can export or share drift results and plain-language explanations |
| 4 | Keep the platform cost-efficient | Drift computations are cached for 24 hours to reduce repeated expensive vector operations |

---

## 4. Scope

### 4.1 In Scope

- A backend `SemanticDriftService` that computes a drift score between two user-selected time windows for a given topic.
- Vector centroid comparison and semantic clustering of RAG chunks within each time window.
- A tenant-scoped `GET /v1/topics/:id/drift` endpoint returning a structured drift result.
- 24-hour caching of drift results.
- Warning levels: none, mild, and significant, based on the drift score.
- UI integration with the Topic Evolution Timeline to display a drift warning icon for significant drift.
- A `DriftExplanationCard` that explains the shift using existing AI explanation capabilities (`RAGAsk`).
- Sample posts and top cluster labels for each time window.

### 4.2 Out of Scope

- v1 topic evolution timeline features (this capability is a v2 enhancement).
- Pre-computing drift for all topics every day (only on-demand drift with caching is in scope).
- Detecting drift by keyword frequency or volume counts alone.
- Support for sub-topic drift in the initial release (unless the ADR later resolves this open question in scope).
- Mutating topic data or automatic topic reclassification.

### 4.3 Assumptions

- The RAG pipeline and vector store are production-ready and contain enough indexed chunks for the topic and windows requested.
- Users are authenticated and tenant-scoped; the topic belongs to their tenant.
- The Topic Evolution Timeline and `RAGAsk` (plain-language explanation) capabilities are available for UI integration.

### 4.4 Constraints

- Compute cost: centroid and clustering operations are expensive, so on-demand computation with 24-hour caching is required.
- The feature is explicitly v2; it must not block v1 topic evolution timeline delivery.
- Tenant isolation must be preserved; users may only request drift for topics in their own tenant.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Topic-Center-Analyst (primary) | Daily analyst exploring topic evolution | High | Understand when a topic's meaning changes; compare time windows; see representative posts |
| Tenant-Brand-Reputation-Manager (primary) | Reputation and crisis monitoring | High | Receive early warning of significant semantic drift on brand-related topics |
| Tenant-Business-Analyst (secondary) | Reporting and insights consumption | Medium | Export or summarize drift findings for stakeholders |
| Tenant-Reader (secondary) | Reads simplified explanations | Low | See plain-language drift summaries without technical detail |
| Backend Engineering | Builds and operates the service | High | Clear boundaries, caching strategy, and RAG dependencies |
| Platform Operations | Cost and performance oversight | Medium | Compute is bounded and cacheable |

---

## 6. Current State (As-Is)

**Current process:**

Users can track a topic's volume, source mix, sentiment, and top authors over time. They can view a timeline and inspect spikes or anomalies manually. However, the platform does not provide an automated, quantitative signal for when the *meaning* of a topic has changed.

**Pain points:**

- A sudden spike in volume may be misread as a crisis when it is actually a different conversation using the same term.
- Analysts must manually compare posts across time periods to infer whether a topic has shifted in meaning.
- There is no early warning or alerting mechanism for semantic drift.
- Keyword-frequency analysis is too noisy to reliably capture meaning changes.

---

## 7. Future State (To-Be)

**New or improved process:**

When a user opens the Topic Evolution Timeline for a topic, the platform can compare the semantic content of two time windows. The user selects a topic and a start and end window; the platform computes a drift score, identifies the most important semantic clusters in each window, and returns sample posts. If the drift is significant, a warning icon appears on the timeline. The user can open a `DriftExplanationCard` to read a plain-language summary of how the topic's meaning has shifted. Results are cached for 24 hours.

**Expected capabilities:**

- On-demand semantic drift computation between two time windows.
- Quantified drift score from 0.0 (same meaning) to 1.0 (completely different meaning).
- Cluster labels and sample posts for both windows.
- Three warning levels: none, mild, and significant.
- 24-hour result caching to manage compute cost.
- AI-generated plain-language drift explanation.
- Tenant-scoped, read-only access.

---

## 8. Business Requirements

### 8.1 Functional Requirements

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

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Drift results shall be tenant-isolated | Security | Must | The endpoint enforces that `topic_id` belongs to the requesting tenant |
| NFR-002 | Drift computation response time should be under 30 seconds for typical time windows | Performance | Should | Measured via monitoring in a staging environment |
| NFR-003 | Expensive drift operations shall be cached for 24 hours | Performance | Must | Repeated identical requests do not recompute for 24 hours |
| NFR-004 | The feature shall remain optional and not degrade v1 topic evolution | Maintainability | Must | The Topic Evolution Timeline works without drift if RAG is unavailable |
| NFR-005 | Drift results shall be read-only and not mutate topic or post data | Security | Must | No writes to `social_posts`, `topics`, or related tables during drift computation |

---

## 9. Business Rules

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

## 10. Data Requirements

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

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Drift score by topic and time window | Track semantic change of monitored topics | Topic-Center-Analyst, Tenant-Brand-Reputation-Manager | On-demand |
| Significant drift warning count | Identify topics requiring immediate attention | Tenant-Brand-Reputation-Manager | On-demand / ad hoc |
| Drift cache hit rate | Monitor cost and compute efficiency | Platform Operations | Daily |
| Average drift computation latency | Track performance of expensive vector operations | Backend Engineering, Platform Operations | Hourly |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | RAG pipeline is not production-ready when v2 is planned | Medium | High | Scope drift as v2 and gate behind feature-availability checks | Technical Lead |
| R-002 | Centroid and clustering compute is too expensive or slow | Medium | High | Cache results for 24 hours; compute on-demand only | Backend Engineering |
| R-003 | Drift results are hard for users to interpret | Medium | Medium | Provide warning levels, sample posts, cluster labels, and plain-language AI explanations | Product Owner |
| R-004 | Insufficient chunks in a time window produce unreliable scores | Medium | Medium | Document minimum data thresholds; handle low-confidence windows gracefully | Backend Engineering |
| R-005 | Auto-generated cluster labels are ambiguous or tied | Low | Medium | Define deterministic tie-breaking rules; allow human review in later iterations | Product Owner |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | RAG chunking and embedding pipeline (ADR-0082) | Internal / Technical | Backend Engineering | In place before v2 |
| D-002 | Vector-store metadata and tenant scoping (ADR-0083) | Internal / Technical | Backend Engineering | In place before v2 |
| D-003 | `RAGAsk` plain-language explanation service (ADR-0084) | Internal / Technical | Backend Engineering | In place before v2 |
| D-004 | Topic Evolution Timeline (ADR-0097) | Internal / Feature | Frontend Engineering | In place before UI integration |
| D-005 | Feature-gate support (ADR-0112) | Internal / Feature | Backend Engineering | Required if drift is gated by plan |

---

## 14. Acceptance Criteria

- `SemanticDriftService` computes a `driftScore` by comparing the centroid vectors of two topic time windows.
- Each window is clustered and `topClustersNow` and `topClustersThen` are returned.
- `driftScore >= 0.5` produces `warning: 'significant'`.
- `GET /v1/topics/:id/drift` is tenant-scoped and returns a `DriftResult`.
- Identical drift requests are served from cache within a 24-hour window.
- The Topic Evolution Timeline shows a drift warning icon when a significant drift is detected.
- `DriftExplanationCard` explains the shift using `RAGAsk` and shows sample posts and cluster labels.
- No topic or post data is mutated during drift computation.

---

## 15. Glossary

| Term | Definition |
|---|---|
| Semantic drift | The change in meaning of a topic, brand, or term over time as measured by the similarity of its associated vector embeddings. |
| Centroid vector | The average vector of a set of embeddings, representing the central semantic meaning of a time window. |
| Cosine similarity | A measure of how similar two vectors are, ranging from -1 (opposite) to 1 (identical). |
| Drift score | A normalized value from 0.0 (same meaning) to 1.0 (completely different meaning) derived from 1 minus the cosine similarity between centroids. |
| Warning level | A classification (`none`, `mild`, `significant`) that indicates the severity of detected semantic drift. |
| RAG | Retrieval-Augmented Generation; the platform's vector-embedding and semantic-retrieval pipeline. |
| Topic Evolution Timeline | The analytics view that shows how a topic's meaning, volume, sources, and authors change over time. |
| `DriftExplanationCard` | A UI component that explains a detected drift in plain language, powered by `RAGAsk`. |

---

## 16. Appendices

### Reference Documents

- ADR-0116: Semantic drift detection (`docs/adr/0116-semantic-drift-detection.md`) — **Proposed**
- Feature design: Topic evolution timeline (`docs/product-research/feature-designs/25-topic-evolution-timeline.md`)
- Feature-ADR scoping notes (`docs/product-research/feature-adr-scoping.md`)
- Epic 13 user stories (`docs/user-stories/epic-13-adr-0109-to-0117.md`)
  - Story 13.11 — Semantic drift detection (backend)
  - Story 13.12 — Semantic drift UI (frontend)

### Missing Sources

- No `docs/product-research/reports/<feature>-deep-research.md` file was found for semantic drift or topic evolution timeline. The BRD therefore relies on the feature design and ADR directly for background and rationale.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
