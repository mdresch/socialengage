# BRD-0136 — RAG Connector Provider Abstraction: Namespace-Per-Tenant Isolation

> **Status note:** ADR-0136 is *Accepted* (2026-08-28). This BRD was drafted 2026-09-13, replacing the 2026-08-28 one-line stub — the same gap and resolution pattern already established for BRD-0131/ADR-0131 (see `docs/implementation-log.md`'s 2026-09-09 Story 17.3 entry, and originally ADR-0079's 2026-08-25 correction). This BRD's content is derived strictly from ADR-0136's own already-Accepted Decision text plus direct inspection of the already-shipped Story 9.7/9.8/9.9 code it supersedes — no new scope is introduced beyond what ADR-0136 authorizes.

## 1. Document Control

|| Field | Value |
|---|---|
|| Document Title | RAG Connector Provider Abstraction: Namespace-Per-Tenant Isolation – Business Requirements Document |
|| Version | 1.0 |
|| Date | 2026-09-13 |
|| Author(s) | Business & Requirements Analyst persona |
|| Approver(s) | Menno — Business Sponsor / Product Owner / Technical Lead |
|| Status | Approved (source ADR-0136 Accepted 2026-08-28; this BRD's content written 2026-09-13) |

### Revision History

|| Version | Date | Author | Description of Changes |
|---|---|---|---|
|| 1.0 | 2026-09-13 | Business & Requirements Analyst | Initial real content, replacing the 2026-08-28 stub, drafted ahead of Story 19.1 implementation and consistent with ADR-0136's own already-Accepted Decision text (2026-08-28). |

---

## 2. Executive Summary

ADR-0081 (Accepted 2026-08-25) authorized a provider-agnostic `RAGConnector` interface and shipped it against a single v1 default provider, pgvector (Story 9.7, `social-listening-core/src/rag/pgvectorConnector.ts`). ADR-0081 Decision §11 treated a **shared index with mandatory `tenant_id` metadata filtering** as the *primary* tenant-isolation mechanism, with namespace-per-tenant framed as an optional connector-internal optimization.

An external deep-research pass (`raw/28-semantic-search-rag-deep-research.md`, 2026-08-28) found this framing backwards relative to vendor guidance: Pinecone's own multi-tenancy documentation calls large-scale metadata filtering an anti-pattern and recommends namespace-per-tenant instead; Weaviate independently implements multi-tenancy as one physical shard per tenant. The same research also surfaced that pgvector — the actual v1 default this project already runs — has a stronger mechanism sitting unused: this project's own established Postgres Row-Level Security pattern (ADR-0015, ADR-0032), which ADR-0081/ADR-0083 never made the pgvector connector's actual enforcement boundary.

ADR-0136 (Accepted 2026-08-28) is the corrective, superseding decision: physical per-tenant isolation (namespace, shard, or RLS) becomes the *primary* mechanism where a provider supports it, with the metadata filter retained everywhere as mandatory defense-in-depth (never removed). It is the first of a five-ADR batch (ADR-0136–0140); this BRD covers **ADR-0136 only**, which is Story 19.1's source.

**This BRD's concrete, evidence-verified finding**: direct inspection of the already-shipped code shows the gap ADR-0136 describes is real and more specific than "no RLS policy exists." `rag_chunks` *does* already carry an `ENABLE ROW LEVEL SECURITY` statement and a `tenant_isolation` policy (migrations `0046_create_rag_chunks_and_sync_tables.sql`, `0047_fix_rag_chunks_permissions_and_rls.sql`). But `PgvectorRAGConnector`'s own queries run exclusively through `getAdminPool()` (`social-listening-core/src/db/adminPool.ts`), which connects as the Postgres superuser (`PGUSER ?? 'postgres'`) — a role that bypasses RLS unconditionally, regardless of any `FORCE ROW LEVEL SECURITY` setting (which migration 0046 does not even set). Story 9.9's own contract test (`social-listening-core/contracts/epic-9/story-9.9.rag-vector-rls.contract.test.ts`, "guarantees tenant isolation") never exercises that policy at all — it proves only that the connector's in-process, application-level `tenant_id` equality check works, which is real and valuable, but is not what the test's filename claims. So, in ADR-0136's own primary/secondary framing (Decision §2), pgvector today has **zero primary (physical) isolation and one secondary (application-level filter) isolation** — the filter is doing 100% of the enforcement work, the opposite of what Decision §2 requires once implemented.

This BRD scopes **Story 19.1's** buildable surface only: the `RAGConnector` interface addition (`ensureTenantNamespace?`, `status()` gaining an isolation-model field) and making Postgres RLS the *actually enforced* tenant boundary for `PgvectorRAGConnector`, with the existing application-level filter retained as defense-in-depth. It explicitly does not cover Pinecone/Azure AI Search provider-level isolation mapping (ADR-0138, Story 19.3 — and no such provider is even implemented in this codebase today), chunking/embedding namespace routing (ADR-0137, Story 19.2), or search/ask endpoint namespace resolution (ADR-0139, Story 19.4).

---

## 3. Business Objectives

|| # | Objective | Success Measure |
|---|---|---|
|| 1 | Make database-enforced isolation the *real*, primary tenant boundary for the v1 default provider (pgvector), not solely an application-level filter | A contract test demonstrates that even if `PgvectorRAGConnector`'s own `tenant_id` application filter were hypothetically bypassed or buggy, the executing database role/session context still prevents cross-tenant rows from being returned — i.e., the existing `rag_chunks` RLS policy is the actual backstop, not a dormant `CREATE POLICY` statement behind a superuser connection |
|| 2 | Extend the `RAGConnector` interface per ADR-0136 Decision §1 without a breaking change to any existing caller | `ensureTenantNamespace?` added as optional; `upsert`/`search`/`deletePost`/`deleteTenant` signatures unchanged; `ragIndexingPipeline.ts`, `ragSearchService.ts`, `ragReconciliationService.ts`, and `ragRouter.ts` require zero signature-level changes |
|| 3 | Report the connector's actual, currently-in-effect isolation mechanism, not an aspirational label | Once RLS is genuinely enforced, `PgvectorRAGConnector.status()` reports an isolation-model value corresponding to `'row-level-rls'`; the value is never set to a mechanism that isn't actually operative for that connector instance |
|| 4 | Preserve backward compatibility of already-shipped data and identifiers | No change to the `${tenantId}:${postId}:${chunkIndex}` vector ID scheme; no backfill or re-indexing of existing `rag_chunks` rows required |
|| 5 | Do not silently expand into ADR-0137/0138/0139's territory | No Pinecone/Azure AI Search connector implementation, no chunking/embedding routing change, and no search/ask endpoint change is delivered under Story 19.1 |

---

## 4. Scope

### 4.1 In Scope

- `RAGConnector` interface addition: optional `ensureTenantNamespace?(tenantId: string): Promise<void>` (ADR-0136 Decision §1) — a backward-compatible, opt-in lifecycle hook for providers that require explicit per-tenant provisioning before first write.
- A connector-status field reporting which physical-isolation mechanism is actually in effect for that connector instance (ADR-0136 Decision §1's `isolationModel: 'namespace' | 'shard' | 'row-level-rls' | 'metadata-filter-only'`) — see §4.4/Open Questions for the concrete, currently-unresolved question of which existing status type this attaches to.
- Making the already-present `rag_chunks` RLS policy (migrations `0046`/`0047`) the **actually enforced** isolation mechanism for `PgvectorRAGConnector`'s real query path (currently inert behind a superuser/admin-pool connection), per ADR-0136 Decision §2's pgvector clause.
- Retaining the existing application-level `tenant_id` equality checks in `PgvectorRAGConnector.upsert()`/`search()`/`deletePost()`/`deleteTenant()` unchanged, now serving explicitly as mandatory defense-in-depth rather than the sole mechanism (Decision §2).
- Confirming `deleteTenant()`'s deletion mechanics for pgvector are unchanged — still a `DELETE ... WHERE tenant_id = $1` statement; only who/what can see the rows being deleted changes once RLS is the real backstop (Decision §3).
- Confirming the deterministic vector ID scheme (`${tenantId}:${postId}:${chunkIndex}`) is unchanged (Decision §4) — no code or data migration.

### 4.2 Out of Scope

- Any Pinecone or Azure AI Search `RAGConnector` implementation or its per-provider physical-isolation mapping — that is ADR-0138 / Story 19.3's job. As of this writing, `social-listening-core/src/rag/ragConnectorRegistry.ts` registers **only** `pgvector`; no Pinecone or Azure AI Search connector exists in this codebase at all, so ADR-0138/Story 19.3's mapping work is against connectors not yet built.
- Any change to chunking, embedding generation, or namespace-aware routing in `RAGChunkingService`/`ragIndexingPipeline.ts` — that is ADR-0137 / Story 19.2's job.
- Any change to the `/v1/rag/search`, `/v1/rag/ask`, or `/v1/rag/status` REST contracts or their namespace-resolution behavior at query dispatch — that is ADR-0139 / Story 19.4's job. This BRD does **not** authorize changing `ragRouter.ts`'s response shapes.
- Resolving ADR-0136's own [Q-0136-1] (Azure AI Search per-tenant physical isolation) — explicitly deferred by ADR-0136 itself to a future ADR.
- Any UI/UX change (ADR-0140 / Story 19.5).
- Backfilling, re-embedding, or re-indexing existing `rag_chunks` rows — no schema or ID-scheme change authorized by ADR-0136 requires this.
- Introducing any new external vector-store account or vendor dependency.

### 4.3 Assumptions

- ADR-0136 is the single source of truth for Story 19.1's authorized scope — read in full, 2026-09-13.
- Only `PgvectorRAGConnector` (Story 9.7) is a real, registered `RAGConnector` implementation as of 2026-09-13 — verified directly against `social-listening-core/src/rag/ragConnectorRegistry.ts`.
- `rag_chunks` already has `ENABLE ROW LEVEL SECURITY` and a `tenant_isolation` policy — verified directly by reading `social-listening-core/migrations/0046_create_rag_chunks_and_sync_tables.sql` and `0047_fix_rag_chunks_permissions_and_rls.sql`.
- `PgvectorRAGConnector`'s queries run exclusively via `getAdminPool()` (`social-listening-core/src/db/adminPool.ts`), a Postgres-superuser connection (`PGUSER ?? 'postgres'`) that bypasses RLS unconditionally — verified directly by reading `pgvectorConnector.ts` and `adminPool.ts`. This means the existing RLS policy is not currently the operative isolation mechanism for this connector's real query path, notwithstanding its presence in migration history.
- `withTenant()` (`social-listening-core/src/db/withTenant.ts`) is this project's own established mechanism for setting the RLS session context (`set_config('app.tenant_id', ...)`) a non-superuser, RLS-subject role needs for a policy to actually take effect — verified by reading that file's own docstring, which also documents its ADR-0043/tenant-deletion precedent for a role that deliberately does *not* bypass RLS.
- Story 9.9's contract test named `story-9.9.rag-vector-rls.contract.test.ts` (`social-listening-core/contracts/epic-9/`) does not itself exercise the Postgres RLS policy — its "guarantees tenant isolation" assertion is satisfied entirely by the connector's own in-process application-level filter, verified by reading the test file directly.

### 4.4 Constraints

- Tenant data isolation must not regress relative to what is already true today; this feature closes a gap, it does not introduce a new one.
- No breaking change to `RAGChunkingService`, `ragIndexingPipeline.ts`, `RAGSearchService`/`ragSearchService.ts`, `ragReconciliationService.ts`, or `ragRouter.ts` call signatures (Decision §1, Consequence #4).
- No new external vector-store account or vendor dependency — pgvector is the only in-scope provider and already runs on the existing Azure Postgres instance.
- Whatever mechanism makes RLS actually operative (a role change, a `withTenant()`-style wrapper, `FORCE ROW LEVEL SECURITY`, or some combination) must not grant `PgvectorRAGConnector`'s runtime queries broader privileges than the tenant-scoped operations require — `adminPool.ts`'s own docstring states its superuser/DDL privilege level is reserved for schema-level maintenance, not normal app runtime, and this feature should not quietly widen that boundary's usage instead of narrowing it. **ADR-0136 does not specify the exact mechanism**, and this BRD does not invent one — see Open Questions.

---

## 5. Stakeholders

|| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
|| Engineering Lead (Menno) | Implements Story 19.1; owns the choice of RLS-enforcement mechanism | High | A precisely scoped interface change plus a concrete, testable definition of "RLS actually enforced," without inheriting Story 19.2/19.3/19.4's scope |
|| Future implementers of Story 19.2 (chunking/embedding) and Story 19.4 (search/ask) | Consume `RAGConnector` via the same call signatures | Medium | Zero breaking change to `upsert`/`search`/`deletePost`/`deleteTenant`; a stable, documented `ensureTenantNamespace?`/`isolationModel` addition to build on |
|| Future implementer of Story 19.3 (Pinecone/Azure AI Search isolation mapping) | Will implement `ensureTenantNamespace?` for namespace/shard-capable providers | Low today | A correctly-shaped optional interface hook to implement against once that story starts |
|| Any tenant whose posts are embedded into `rag_chunks` (indirect, via existing RAG search/Q&A/Composer Deep Research features) | Ultimate beneficiary of the isolation guarantee | High (in principle), Low (visibility) | Cross-tenant data leakage prevention that is real and DB-enforced, not solely application logic that a future code change could silently weaken |

---

## 6. Current State (As-Is)

**Current implementation (Story 9.7/9.8/9.9, ADR-0081/0082/0083):** `PgvectorRAGConnector` enforces tenant isolation entirely at the application layer — an explicit `WHERE tenant_id = $1` predicate in every SQL statement, plus an in-process `chunk.metadata.tenant_id !== tenantId` filter for its in-memory fallback path. Both paths run through `getAdminPool()`, a Postgres superuser connection. `rag_chunks` does carry an `ENABLE ROW LEVEL SECURITY` statement and a `tenant_isolation` policy from migrations `0046`/`0047`, but because the connector's own queries always execute as superuser, that policy is never actually evaluated against this connector's real traffic — a superuser bypasses RLS unconditionally. `status()` returns `{ provider, isAvailable, dimension, indexedChunksCount, lastError }` (per `social-listening-core/src/rag/types.ts`'s `RAGConnectorStatus`) with no isolation-model field. Only `pgvector` is a registered provider.

**Pain points:**
- The database-level backstop that exists on paper (the RLS policy) provides zero actual protection today — if the connector's own application-level filter ever had a bug, there is currently no second line of defense, contrary to the defense-in-depth principle every other tenant-scoped table in this project follows (ADR-0015, ADR-0032).
- A contract test's own name (`story-9.9.rag-vector-rls.contract.test.ts`) currently overstates what it verifies, which risks a false sense of assurance about DB-level enforcement if not corrected as part of closing this gap.
- No signal exists anywhere (interface, status response) describing which isolation mechanism is actually operative for a given connector/tenant.

---

## 7. Future State (To-Be)

**New or improved state:** `PgvectorRAGConnector`'s queries make the existing `rag_chunks` RLS policy the real, actually-enforced tenant boundary — the application-level `tenant_id` filter remains, now correctly framed as mandatory defense-in-depth rather than the sole mechanism. `status()` reports an isolation-model value that accurately reflects this (`'row-level-rls'` for pgvector once implemented). The `RAGConnector` interface gains the optional `ensureTenantNamespace?` hook, unused by pgvector (whose isolation is a static, already-provisioned table-level policy, not a per-tenant-provisioned resource) but available for a future namespace/shard-capable provider (Story 19.3) to implement. No caller of `RAGConnector` (`ragIndexingPipeline.ts`, `ragSearchService.ts`, `ragReconciliationService.ts`, `ragRouter.ts`) requires any change.

**Expected capabilities:**
- A verifiable, testable claim that cross-tenant `rag_chunks` access is blocked at the database layer, independent of the application-level filter.
- An honest, accurate isolation-model signal on `status()`.
- A stable interface surface ready for Story 19.2/19.3/19.4 to build on without a second breaking change.

---

## 8. Business Requirements

### 8.1 Functional Requirements

|| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
|| BR-001 | The `RAGConnector` interface shall gain an optional `ensureTenantNamespace?(tenantId: string): Promise<void>` method | Must | Added to the interface in `social-listening-core/src/rag/types.ts` (or successor location); no existing implementer is required to implement it; `PgvectorRAGConnector` is not required to implement it (see §9 BRU-003) | Engineering Lead |
|| BR-002 | The connector status shape shall report which physical-isolation mechanism is actually in effect | Must | An isolation-model field with an enum including at minimum `'row-level-rls'` is present and, for `PgvectorRAGConnector`, returns `'row-level-rls'` once BR-003 is satisfied — see Open Questions for which existing status type this attaches to | Engineering Lead |
|| BR-003 | `PgvectorRAGConnector`'s own queries shall execute such that the existing `rag_chunks` RLS policy is the actually-enforced tenant boundary, not a policy inert behind a superuser-bypass connection | Must | A contract test demonstrates cross-tenant rows are unreachable at the database layer under the role/session-context this story establishes, independent of the connector's own application-level `tenant_id` predicate | Engineering Lead |
|| BR-004 | The existing application-level `tenant_id` equality checks in `upsert()`/`search()`/`deletePost()`/`deleteTenant()` shall remain in place, unchanged in behavior, as mandatory defense-in-depth | Must | Existing checks are not removed; any test currently passing because of them continues to pass | Engineering Lead |
|| BR-005 | `deleteTenant()`'s deletion mechanics for pgvector shall remain a `DELETE ... WHERE tenant_id = $1` statement | Must | No change to the SQL statement shape; only the executing role/session context may change per BR-003 | Engineering Lead |
|| BR-006 | The deterministic vector ID scheme shall remain unchanged | Must | `${tenantId}:${postId}:${chunkIndex}` unchanged; no backfill or migration of existing rows | Engineering Lead |
|| BR-007 | No new `RAGConnector` provider implementation shall be delivered under this story | Must (scope guard) | `ragConnectorRegistry.ts` registers only `pgvector` at the end of Story 19.1, unchanged from today | Engineering Lead |
|| BR-008 | Story 9.9's contract test naming/assertions shall not continue to misrepresent what is verified, once RLS enforcement is real | Should | Either the existing `story-9.9.rag-vector-rls.contract.test.ts` is extended with an assertion that actually exercises the DB-level policy, or a new Story 19.1 contract test explicitly does so, so that a test named "RLS" actually tests RLS | Engineering Lead |

Priority levels: Must / Should / Could / Won't (MoSCoW)

### 8.2 Non-Functional Requirements

|| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
|| NFR-001 | The role executing `PgvectorRAGConnector`'s tenant-scoped runtime queries must not be the same unrestricted superuser role reserved for schema-level DDL/archival | Security | Must | Verified against `adminPool.ts`'s own stated rationale (DDL-level access reserved for migration/archival, not normal app runtime) |
|| NFR-002 | No regression to existing RAG contract tests from changing which pool/role `PgvectorRAGConnector` uses | Reliability | Must | `story-9.7.rag-connector.contract.test.ts`, `story-9.8.rag-chunking-pipeline.contract.test.ts`, `story-9.9.rag-vector-rls.contract.test.ts`, and `story-9.10.rag-endpoints.contract.test.ts` all continue to pass |
|| NFR-003 | RLS-enforced queries must not introduce a materially different latency profile for the current `rag_chunks` table size | Performance | Should | Informal check only — no SLA is defined in this document; not benchmarked here |

Categories include: Performance, Security, Reliability, Scalability, Usability, Compliance, Maintainability, Accessibility, Transparency/Trust.

---

## 9. Business Rules

|| ID | Rule |
|---|---|
|| BRU-001 | `tenant_id` is never a value the caller supplies directly for isolation purposes — only the mandatory `tenantId` parameter, unchanged from ADR-0081. |
|| BRU-002 | Physical/database-level isolation is the primary mechanism where available; the application-level metadata filter is mandatory secondary defense-in-depth and is never removed, even once DB-level isolation is in place (Decision §2). |
|| BRU-003 | `ensureTenantNamespace?` is optional; `PgvectorRAGConnector` may omit implementing it, because pgvector's isolation is a static, already-provisioned table-level RLS policy, not a resource requiring per-tenant provisioning on first write. |
|| BRU-004 | An isolation-model value must accurately reflect the mechanism actually in effect for that connector instance — `PgvectorRAGConnector` may not report `'row-level-rls'` while its queries still execute under a role that bypasses RLS. |
|| BRU-005 | No breaking change to `upsert`/`search`/`deletePost`/`deleteTenant` signatures. |
|| BRU-006 | Cross-tenant `rag_chunks` visibility must be blocked at the database layer independent of any application-level bug, once this story is complete. |

---

## 10. Data Requirements

|| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
|| `rag_chunks` (existing) | Tenant-scoped vector-chunk storage table; already carries `ENABLE ROW LEVEL SECURITY` and a `tenant_isolation` policy (migrations 0046/0047) | `PgvectorRAGConnector` | Platform (derived data; source of truth remains `social_posts`) | Tenant-scoped content and derived signals (sentiment, topics); not itself new PII |
|| RLS enforcement role/session-context mechanism (to be determined by implementation) | Whatever database role and/or session-context wrapper (e.g. `withTenant()`) makes the existing policy actually operative for `PgvectorRAGConnector`'s runtime queries | Implementation decision, Story 19.1 | Engineering Lead | Internal infrastructure/access-control configuration — see Open Questions; this BRD does not prescribe the specific mechanism |
|| `isolationModel` status field (new) | Reports which physical-isolation mechanism (`namespace`/`shard`/`row-level-rls`/`metadata-filter-only`) is actually in effect | `RAGConnector.status()` | Engineering Lead | Internal operational signal, not tenant-facing data |

---

## 11. Reporting and Analytics

|| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
|| `isolationModel` value surfaced via `RAGConnector.status()` | Internal operational visibility into which isolation mechanism is actually protecting a given provider's data | Engineering | On-demand (via `status()` call); no scheduled report is introduced by this story |
|| Whether `GET /v1/rag/status` (Story 9.10, ADR-0084) surfaces `isolationModel` to callers | Not decided by ADR-0136 or this BRD | N/A | See Open Questions — this BRD does not authorize a change to that endpoint's response contract |

No new tenant-facing report or dashboard is introduced by this feature; it is an internal isolation-mechanism correction, not a user-visible capability.

---

## 12. Risks and Mitigations

|| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
|| R-001 | The mechanism chosen to make RLS operative accidentally grants `PgvectorRAGConnector` broader privileges than needed, widening rather than narrowing the admin-pool exposure this story is meant to reduce | Medium | High | NFR-001 and §4.4's constraint make least-privilege an explicit acceptance bar; the specific mechanism is deliberately left as an Open Question rather than prescribed here, so it can be reviewed against this constraint at implementation time | Engineering Lead |
|| R-002 | A future engineer sees the pre-existing `rag_chunks` RLS policy and the pre-existing "RLS" contract test and assumes DB-level isolation was already verified, missing that neither was actually true before Story 19.1 | Medium (was already occurring) | High | This BRD documents the finding explicitly and BR-008 requires the test naming/assertions to be corrected as part of this story | Engineering Lead |
|| R-003 | `isolationModel` is added to the wrong status type (the ADR's literal, never-shipped `ConnectorStatus` interface name rather than the actually-shipped `RAGConnectorStatus` in `types.ts`), producing a field nothing in the real codebase ever reads | Medium | Medium | Flagged explicitly as an Open Question rather than resolved here; implementation should verify against the shipped type before adding the field | Engineering Lead |
|| R-004 | Scope creep into Story 19.2/19.3/19.4's territory (e.g. building a Pinecone connector "while we're in here") | Low (explicit scope guard in place) | Medium | BR-007 and §4.2 make the scope boundary explicit and testable (`ragConnectorRegistry.ts` registers only `pgvector` at story end) | Engineering Lead |

---

## 13. Dependencies

|| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
|| D-001 | ADR-0081 — RAGConnector provider abstraction (Accepted 2026-08-25, partially superseded) | Internal / Architectural | Engineering Lead | In place; ADR-0136 supersedes its Decision §11 only |
|| D-002 | ADR-0015 / ADR-0032 — established Postgres RLS pattern | Internal / Architectural | Engineering Lead | In place; this story applies the existing pattern to `rag_chunks`'s already-created policy |
|| D-003 | ADR-0043 — self-service tenant-initiated deletion (precedent for a non-superuser-bypassing role under RLS) | Internal / Architectural | Engineering Lead | In place; `withTenant.ts`'s own docstring cites this precedent directly |
|| D-004 | Story 9.7/9.8/9.9 — already-shipped `RAGConnector`, `PgvectorRAGConnector`, RLS migrations | Internal / Implementation | Engineering Lead | Built; this story revises/extends it, does not replace it |
|| D-005 | Story 19.1 — this story | Internal / Implementation | Engineering Lead | Ready; this BRD's own subject |
|| D-006 | ADR-0138 / Story 19.3 — Pinecone/Azure AI Search per-provider isolation mapping | Internal / Architectural | Engineering Lead | Not started; explicitly out of this BRD's scope |
|| D-007 | ADR-0137 / Story 19.2 — chunking/embedding namespace routing | Internal / Architectural | Engineering Lead | Not started; explicitly out of this BRD's scope |
|| D-008 | ADR-0139 / Story 19.4 — search/ask endpoint namespace resolution | Internal / Architectural | Engineering Lead | Not started; explicitly out of this BRD's scope |

---

## 14. Acceptance Criteria

- `RAGConnector` gains the optional `ensureTenantNamespace?(tenantId: string): Promise<void>` method; no existing implementer or caller requires a change.
- `PgvectorRAGConnector`'s status response reports an isolation-model value corresponding to `'row-level-rls'`, and that value is only ever true because the underlying mechanism (§Open Questions) is genuinely operative — not asserted without a backing test.
- A contract test proves cross-tenant `rag_chunks` access is blocked at the database layer under the role/session-context this story establishes, independent of the connector's own application-level filter.
- The existing application-level `tenant_id` checks remain unchanged and continue to pass all pre-existing tests.
- `deleteTenant()` remains a `DELETE ... WHERE tenant_id = $1` statement; the vector ID scheme is unchanged.
- `ragConnectorRegistry.ts` registers only `pgvector` at the end of this story.
- No signature change to `upsert`/`search`/`deletePost`/`deleteTenant` on `RAGConnector`.
- Executable contract test citation: not yet created as of this writing — Story 19.1 is expected to add one under `social-listening-core/contracts/epic-19/`, following the naming convention of `social-listening-core/contracts/epic-9/story-9.9.rag-vector-rls.contract.test.ts` and `story-9.7.rag-connector.contract.test.ts`.

---

## 15. Glossary

|| Term | Definition |
|---|---|
|| Physical isolation | Tenant separation enforced by a structural mechanism the database/vector-store itself guarantees (a namespace, a shard, or an RLS policy) rather than solely by application code choosing to filter. |
|| Metadata filter | The application-level `tenant_id` equality check every `RAGConnector` operation already applies; retained everywhere as mandatory defense-in-depth under ADR-0136. |
|| `isolationModel` | The new `status()` field reporting which physical-isolation mechanism (`namespace`/`shard`/`row-level-rls`/`metadata-filter-only`) is actually in effect for a connector instance. |
|| `ensureTenantNamespace?` | The new optional `RAGConnector` lifecycle hook for providers that need explicit per-tenant provisioning before first write; not needed by pgvector. |
|| Inert RLS policy | A `CREATE POLICY` statement that exists in the schema but is never evaluated against a given code path's actual queries — here, because those queries run under a superuser role that bypasses RLS regardless of the policy's presence. |

---

## 16. Appendices

### Reference documents

- ADR-0136 — `docs/adr/0136-rag-connector-provider-abstraction-namespace-per-tenant.md` (source, Accepted 2026-08-28)
- ADR-0081 — `docs/adr/0081-rag-connector-provider-abstraction.md` (superseded in part; Decision §§1, 4–10, 12, 13 remain live and are carried forward by ADR-0136)
- User stories — `docs/user-stories/epic-19-adr-0136-to-0140.md`, Story 19.1
- Already-shipped code inspected directly for this BRD: `social-listening-core/src/rag/types.ts`, `social-listening-core/src/rag/pgvectorConnector.ts`, `social-listening-core/src/rag/ragConnectorRegistry.ts`, `social-listening-core/src/db/adminPool.ts`, `social-listening-core/src/db/withTenant.ts`, `social-listening-core/src/http/versions/v1/ragRouter.ts`, `social-listening-core/migrations/0046_create_rag_chunks_and_sync_tables.sql`, `social-listening-core/migrations/0047_fix_rag_chunks_permissions_and_rls.sql`, `social-listening-core/contracts/epic-9/story-9.9.rag-vector-rls.contract.test.ts`
- Related ADRs — ADR-0002 (`AIProviderConnector` precedent), ADR-0028 (credential ownership tiers), ADR-0015/ADR-0032 (tenant RLS pattern), ADR-0043 (tenant offboarding, non-bypassing-role precedent)
- Sibling ADRs in this batch (out of scope for this BRD) — ADR-0137 (Story 19.2), ADR-0138 (Story 19.3), ADR-0139 (Story 19.4), ADR-0140 (Story 19.5)

### Missing source

- No dedicated deep-research report exists solely for ADR-0136; it derives from the same `raw/28-semantic-search-rag-deep-research.md` external brief that also informs ADR-0137–0140.

---

## 17. Open Questions

ADR-0136 itself does not specify these; they are implementation-level gaps this BRD deliberately does not close by inventing an answer, per this role's own discipline against fabricating scope an ADR doesn't authorize:

|| ID | Question | Why it's open | Target Resolution |
|---|---|---|---|
|| Q1 | Which database role and/or session-context mechanism (a new dedicated role plus `withTenant()`-style wrapper, a change to which pool `PgvectorRAGConnector` uses, `FORCE ROW LEVEL SECURITY`, or some combination) actually makes the existing `rag_chunks` RLS policy operative? | ADR-0136 Decision §2 requires RLS to be "the exact RLS pattern already established project-wide," but does not specify how `PgvectorRAGConnector` itself should stop using a superuser connection for its runtime queries | Implementation decision at Story 19.1 build time, reviewed against NFR-001's least-privilege constraint |
|| Q2 | Does the new `isolationModel` field attach to the ADR's literal `ConnectorStatus` interface name (as ADR-0081/ADR-0136's Decision text writes it) or to the actually-shipped `RAGConnectorStatus` interface in `social-listening-core/src/rag/types.ts` (which already has a different field set — `provider`/`isAvailable`/`dimension`/`indexedChunksCount`/`lastError` — and is what `ragRouter.ts`'s `GET /v1/rag/status` endpoint actually consumes)? | ADR-0081's Decision text `ConnectorStatus` shape was never what Story 9.7 actually shipped; ADR-0136 restates that same original text without reconciling the drift | Implementation decision at Story 19.1 build time; this BRD recommends attaching it to the shipped `RAGConnectorStatus` type since that is what real callers use, but does not mandate this |
|| Q3 | Should `GET /v1/rag/status` (Story 9.10, ADR-0084) be changed to surface `isolationModel` in its response body? | Not addressed by ADR-0136, ADR-0084, or ADR-0139; a REST response-contract change is arguably ADR-0139/Story 19.4's territory (search/ask endpoint namespace resolution), not this story's | Deferred; not decided by this BRD |

---

## 18. Approval

|| Role | Name | Signature | Date |
|---|---|---|---|
|| Business Sponsor | Menno | | |
|| Product Owner | Menno | | |
|| Technical Lead | Menno | | |
|| Other Stakeholder | | | |
