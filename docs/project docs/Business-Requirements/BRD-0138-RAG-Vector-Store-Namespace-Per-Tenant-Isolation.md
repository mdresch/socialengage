# BRD-0138 — RAG Vector Store: Namespace-Per-Tenant Isolation and pgvector RLS

> **Status note:** ADR-0138 is *Accepted* (2026-08-28). This BRD was drafted 2026-09-14, replacing the 2026-08-28 one-line stub — the same gap and resolution pattern already established for BRD-0131/ADR-0131 (Story 17.3), BRD-0136/ADR-0136 (Story 19.1), and BRD-0137/ADR-0137 (Story 19.2). This BRD's content is derived strictly from ADR-0138's own newly-drafted Decision text plus direct inspection of the already-shipped `social-listening-core/src/rag/ragReconciliationService.ts`, `pgvectorConnector.ts`, `types.ts`, and `ragConnectorRegistry.ts` — no new scope is introduced beyond what ADR-0138 authorizes.

## 1. Document Control

|| Field | Value |
|---|---|
|| Document Title | RAG Vector Store: Namespace-Per-Tenant Isolation and pgvector RLS – Business Requirements Document |
|| Version | 1.0 |
|| Date | 2026-09-14 |
|| Author(s) | Business & Requirements Analyst persona |
|| Approver(s) | Menno — Business Sponsor / Product Owner / Technical Lead |
|| Status | Approved (source ADR-0138 Accepted 2026-08-28; this BRD's content written 2026-09-14) |

### Revision History

|| Version | Date | Author | Description of Changes |
|---|---|---|---|
|| 1.0 | 2026-09-14 | Business & Requirements Analyst | Initial real content, replacing the 2026-08-28 stub, drafted ahead of Story 19.3 implementation and consistent with ADR-0138's own newly-drafted Decision text (2026-09-14, source ADR Accepted 2026-08-28). |

---

## 2. Executive Summary

ADR-0136 (Accepted 2026-08-28, Story 19.1) named ADR-0138 as the ADR that "owns the detailed, per-provider physical-isolation mapping" — the pgvector RLS policy shape, the Pinecone namespace mechanics, and the Azure AI Search open case. ADR-0138 itself was a one-line stub until this pass, so that ownership was never actually exercised in writing.

**This BRD's concrete, evidence-verified finding**: direct inspection shows the pgvector piece of that mapping is *already done* — Story 19.1 delivered it in full (`withTenant()`/`app_user`, `FORCE ROW LEVEL SECURITY` migration `0082`, `isolationModel: 'row-level-rls'`) before ADR-0138's own Decision text ever existed. What inspection also surfaced, and what ADR-0138 (this BRD's source) actually decides, is narrower and different from what its own stub implied: (1) `RAGReconciliationService.reconcileOrphanedRAGChunks()` has a real, verified defect — its real-DB branch never calls `withTenant()` at all, so its orphan-cleanup query returns zero rows unconditionally in production, a fail-closed bug that has silently disabled reconciliation since Story 9.9; and (2) no Pinecone or Weaviate connector exists anywhere in this codebase, so the "physical namespace isolation on Pinecone" and "dedicated shards on Weaviate" pieces of ADR-0138's original stub are necessarily architecture-only documentation, not buildable code, until a future story actually adds one of those providers.

This BRD covers **ADR-0138 only** — Story 19.3's source. Its one concretely buildable requirement is the `RAGReconciliationService` fix.

---

## 3. Business Objectives

|| # | Objective | Success Measure |
|---|---|---|
|| 1 | Confirm, with citation, that pgvector's RLS-based isolation is already delivered, so ADR-0136's forward reference to this ADR is backed by real content for that piece | ADR-0138 Decision §1 and its "Relation to ADR-0136" section cite the specific already-shipped mechanism, verified against `pgvectorConnector.ts`, not re-derived |
|| 2 | Close the fail-closed defect in `RAGReconciliationService.reconcileOrphanedRAGChunks()` so its query is correct when invoked | `reconcileOrphanedRAGChunks()`'s real-DB branch routes through `withTenant()`; a contract test demonstrates a cross-tenant orphan-detection query is correctly scoped and no longer returns zero rows unconditionally |
|| 3 | Document Pinecone namespace-per-tenant and Weaviate shard-per-tenant isolation mechanics at a level of detail a future provider-adding story can build against, without building any connector now | ADR-0138 Decision §3/§4 map `upsert`/`search`/`deletePost`/`deleteTenant`/`ensureTenantNamespace?` onto each provider's own primitive; `ragConnectorRegistry.ts` still registers only `pgvector` at the end of this story |
|| 4 | Name, rather than silently fix or silently ignore, the still-unfulfilled "periodic worker" promise (ADR-0083 Decision §4, item 5) | ADR-0138 Decision §6/Open Questions explicitly flag that no scheduler invokes `RAGReconciliationService` anywhere in the codebase, and that this remains a gap against ADR-0083 itself |
|| 5 | Do not silently expand into a Pinecone/Weaviate connector build, an Azure AI Search decision, or a reconciliation-scheduler design | No connector code, no Azure AI Search research, and no scheduler/cron wiring is delivered under Story 19.3 |

---

## 4. Scope

### 4.1 In Scope

- Formal confirmation (ADR-0138 Decision §1) that pgvector's RLS-based tenant isolation on `rag_chunks` was already delivered by Story 19.1/ADR-0136 — cited, not re-implemented.
- Fixing `RAGReconciliationService.reconcileOrphanedRAGChunks()`'s real-DB branch: wrapping its orphan-detection `SELECT` (joining `rag_chunks` and `social_posts`) and its loop's `DELETE FROM rag_chunks_sync` in a single `withTenant(tenantId, async (client) => { ... })` call (ADR-0138 Decision §2).
- A contract test proving the fix: that a cross-tenant orphan-detection query, run through the real `reconcileOrphanedRAGChunks()` call site, is correctly tenant-scoped rather than unconditionally empty.
- Architecture-level documentation (no code) of Pinecone namespace-per-tenant and Weaviate dedicated-shard-per-tenant isolation mechanics, mapping each onto `upsert`/`search`/`deletePost`/`deleteTenant`/`ensureTenantNamespace?` (ADR-0138 Decision §3/§4).

### 4.2 Out of Scope

- **A scheduler, cron job, or any periodic invocation of `RAGReconciliationService`.** Confirmed by direct codebase-wide search that nothing calls this service today — this is a real, separate, pre-existing gap against ADR-0083 Decision §4, item 5 ("a periodic background worker"), not this story's to close (ADR-0138 Context §4/Decision §6).
- **Any Pinecone or Weaviate `RAGConnector` implementation.** `ragConnectorRegistry.ts` registers only `pgvector` before and after this story — Decision §3/§4 are architecture documentation only, not buildable code.
- **Azure AI Search.** Explicitly out of ADR-0138's own Authorizes line; still open per ADR-0136's own Q-0136-1, not this story's job.
- **Any change to `PgvectorRAGConnector` itself.** Already fixed under Story 19.1; this story touches only `ragReconciliationService.ts`.
- **Any change to `RAGChunkMetadata`, the `RAGConnector` interface, the deterministic vector ID scheme, or `ensureTenantNamespace?()`'s existing call site** (already wired in by Story 19.2/ADR-0137). ADR-0138 Decision §5 confirms the metadata schema unchanged.
- **A "Supersession update" note on ADR-0083 itself**, even though ADR-0138's own acceptance would formally trigger one per `docs/adr/README.md`'s governance convention — flagged by ADR-0138 (Relation to ADR-0083, Q-0138-4) as a required follow-up edit to ADR-0083, outside this BRD's/this story's file scope.
- Any change to `/v1/rag/search`, `/v1/rag/ask`, or `/v1/rag/status` (ADR-0139/Story 19.4's job), or any UI/UX change (ADR-0140/Story 19.5).

### 4.3 Assumptions

- ADR-0138 (this BRD's source, drafted 2026-09-14) is the single source of truth for Story 19.3's authorized scope.
- `PgvectorRAGConnector`'s tenant-scoped queries already execute via `withTenant()`/`app_user`, and `rag_chunks` already carries `FORCE ROW LEVEL SECURITY` (migration `0082`) — verified directly by reading `social-listening-core/src/rag/pgvectorConnector.ts` and `social-listening-core/migrations/0082_force_rls_rag_chunks.sql`. No further pgvector connector change is required by this story.
- `RAGReconciliationService.reconcileOrphanedRAGChunks()`'s real-DB branch calls `getPool()` directly and never calls `withTenant()` — verified directly by reading `social-listening-core/src/rag/ragReconciliationService.ts`.
- `rag_chunks`, `rag_chunks_sync`, and `social_posts` all already carry an RLS policy matching on `app.tenant_id` (and, for `rag_chunks`/`rag_chunks_sync`, also `app.current_tenant_id`) — verified directly against migrations `0002`, `0046`, `0047`, `0082`, `0083`. No policy text change or new migration is required for this story's fix.
- No caller of `RAGReconciliationService`/`reconcileOrphanedRAGChunks` exists anywhere in the codebase, and no scheduler references it — verified by a codebase-wide search across `social-listening-core/src`.
- `ragConnectorRegistry.ts` registers only `pgvector` — verified directly; no Pinecone or Weaviate connector exists.
- `withTenant()` (`social-listening-core/src/db/withTenant.ts`) is this project's own established mechanism for setting RLS session context, already used as the fix pattern for the analogous `rag_chunks` gap (Story 19.1) and `rag_chunks_sync` gap (Story 19.2).

### 4.4 Constraints

- No breaking change to `RAGReconciliationService`'s public method signature (`reconcileOrphanedRAGChunks(tenantId, existingPostIds?)` and its `{ deletedOrphansCount: number }` return shape are unchanged).
- The mocked/in-memory branch (used when `existingPostIds` is supplied) is unaffected — it performs no DB query and requires no change.
- No new database migration — `rag_chunks` and `rag_chunks_sync` already carry `FORCE ROW LEVEL SECURITY`; this story's fix is a call-site-only change.
- No new retry/backoff/scheduling infrastructure introduced.
- The mechanism that fixes the query must not grant broader privileges than the tenant-scoped operation requires — the same least-privilege bar Story 19.1 (BRD-0136 NFR-001) and Story 19.2 (BRD-0137 NFR-001) already applied.

---

## 5. Stakeholders

|| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
|| Engineering Lead (Menno) | Implements Story 19.3 | High | A precisely scoped fix to one method, without inheriting a scheduler design, a connector build, or an Azure AI Search decision |
|| Future implementer of a Pinecone or Weaviate `RAGConnector` | Would build the first provider that actually implements the Decision §3/§4 architecture | Medium today | A concrete, sourced design to implement against, including which providers need `ensureTenantNamespace?()` and which don't |
|| Future implementer of an ADR-0083 reconciliation-scheduler revisit | Would decide how/when `RAGReconciliationService` is actually invoked | Low today | A clearly documented, evidence-backed description of the gap (ADR-0138 Context §4, Q-0138-3) rather than having to rediscover it |
|| Any tenant whose posts are indexed into `rag_chunks`/`rag_chunks_sync` (indirect) | Ultimate beneficiary of correct orphan cleanup, once a scheduler eventually calls it | Low today (no operational effect until a scheduler exists), High in principle | A reconciliation query that is actually correct once it is eventually invoked |

---

## 6. Current State (As-Is)

**Current implementation (Story 9.9, ADR-0083 §4.5; Story 19.1, ADR-0136):** `PgvectorRAGConnector`'s own queries are RLS-enforced via `withTenant()`. Separately, `RAGReconciliationService.reconcileOrphanedRAGChunks()`'s real-DB branch queries `rag_chunks`/`social_posts` and writes to `rag_chunks_sync` via a plain `getPool().query(...)` call with no `withTenant()` wrapper at all — no `app.tenant_id` session variable is ever set. Because both source tables carry `FORCE ROW LEVEL SECURITY`, this means the orphan-detection `SELECT` returns zero rows unconditionally, regardless of how many orphaned chunks actually exist for a given tenant. No code anywhere in the codebase ever calls this service.

**Pain points:**
- Reconciliation has been silently non-functional since Story 9.9 shipped it — not because of a leak, but because the query fails closed and finds nothing, every time, for every tenant.
- The class's own docstring cites "ADR-0083 §4.5" as its authority, but that decision's "periodic background worker" framing was never actually fulfilled by any caller — a second, independent way the original promise is unmet.
- ADR-0136's forward reference to this ADR for "the pgvector RLS policy shape, Pinecone namespace mechanics, the Azure AI Search open case" pointed at a stub, not real content, until this pass.

---

## 7. Future State (To-Be)

**New or improved state:** `reconcileOrphanedRAGChunks()`'s real-DB branch executes its orphan-detection query and its cleanup delete under a correctly tenant-scoped RLS session, making its logic correct whenever it is eventually invoked. A documented, sourced architecture exists for Pinecone and Weaviate isolation, ready for a future provider-adding story. ADR-0136's forward reference to this ADR is backed by real, verified content. The remaining gap — nothing invokes this service — is explicitly named rather than silently left unexamined.

**Expected capabilities:**
- A verifiable, testable claim that `reconcileOrphanedRAGChunks()` no longer fails closed on every call.
- A concrete design a future Pinecone or Weaviate connector implementer can build directly against, including which of the two needs `ensureTenantNamespace?()`.
- An explicit, traceable record that the reconciliation-scheduler gap belongs to a future ADR-0083 revisit, not to Story 19.3.

---

## 8. Business Requirements

### 8.1 Functional Requirements

|| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
|| BR-001 | `reconcileOrphanedRAGChunks()`'s real-DB branch shall wrap its orphan-detection `SELECT` and its cleanup `DELETE FROM rag_chunks_sync` in a single `withTenant(tenantId, ...)` call | Must | No `getPool().query(...)` call remains outside a `withTenant()` context in this method's real-DB branch; a contract test proves the query is tenant-scoped, not unconditionally empty | Engineering Lead |
|| BR-002 | The method's public signature and `{ deletedOrphansCount: number }` return shape shall remain unchanged | Must | No breaking change; existing/mocked callers unaffected | Engineering Lead |
|| BR-003 | The mocked/in-memory branch (`existingPostIds` supplied) shall remain unchanged | Must (scope guard) | No DB query is added to this branch; behavior identical to today | Engineering Lead |
|| BR-004 | `this.connector.deletePost(tenantId, row.post_id)`'s own independent `withTenant()` call shall not be modified or duplicated | Must (scope guard) | `PgvectorRAGConnector.deletePost()` unchanged; the fix relies on it continuing to manage its own transaction | Engineering Lead |
|| BR-005 | No new database migration shall be introduced for this fix | Must (scope guard) | `rag_chunks`/`rag_chunks_sync`'s existing `FORCE ROW LEVEL SECURITY` (migrations `0082`/`0083`) is sufficient; no new migration file | Engineering Lead |
|| BR-006 | No Pinecone or Weaviate `RAGConnector` shall be implemented under this story | Must (scope guard) | `ragConnectorRegistry.ts` registers only `pgvector` at the end of this story | Engineering Lead |
|| BR-007 | No scheduler, cron job, or periodic invocation of `RAGReconciliationService` shall be built under this story | Must (scope guard) | No new file or wiring calls `reconcileOrphanedRAGChunks()`; the gap remains explicitly flagged (ADR-0138 Q-0138-3) for a future ADR-0083 revisit | Engineering Lead |
|| BR-008 | No change to `RAGChunkMetadata`, the `RAGConnector` interface, or the deterministic vector ID scheme | Must (scope guard) | `types.ts` unchanged | Engineering Lead |

Priority levels: Must / Should / Could / Won't (MoSCoW)

### 8.2 Non-Functional Requirements

|| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
|| NFR-001 | The role executing `reconcileOrphanedRAGChunks()`'s queries must not be the superuser role reserved for schema-level DDL/archival | Security | Must | Verified against `adminPool.ts`'s own stated rationale; `withTenant()`'s default pool (`getPool()`) connects as `app_user`, mirroring BRD-0136/BRD-0137 NFR-001 |
|| NFR-002 | No regression to existing RAG contract tests from this change | Reliability | Must | `story-9.7`, `story-9.8`, `story-9.9`, `story-9.10`, `story-19.1`, and `story-19.2` contract tests all continue to pass |
|| NFR-003 | The fix must not change `reconcileOrphanedRAGChunks()`'s error-handling shape (degrade gracefully, return `{ deletedOrphansCount: 0 }` on failure) | Reliability | Must | The existing `try { ... } catch { /* Handled gracefully */ }` wrapper remains in place around the new `withTenant()` call |

Categories include: Performance, Security, Reliability, Scalability, Usability, Compliance, Maintainability, Accessibility, Transparency/Trust.

---

## 9. Business Rules

|| ID | Rule |
|---|---|
|| BRU-001 | Every tenant-scoped query against `rag_chunks`, `rag_chunks_sync`, or `social_posts` must set RLS session context via `withTenant()` — no exceptions for background/reconciliation code paths, the same discipline already applied to the connector layer (Story 19.1) and the pipeline layer (Story 19.2). |
|| BRU-002 | Physical/database-level isolation (RLS for pgvector; namespace/shard for a future Pinecone/Weaviate connector) is the primary tenant boundary; the application-level `tenant_id` filter remains mandatory defense-in-depth in every case (ADR-0083 Decision §2, ADR-0136 Decision §2). |
|| BRU-003 | Architecture decisions for a not-yet-built provider (Pinecone, Weaviate) may be documented ahead of their buildable moment, but must not be accompanied by connector code until a story actually authorizes building one. |
|| BRU-004 | A named, unresolved gap (the missing reconciliation scheduler; Azure AI Search's isolation research) must be recorded as an open question against its correct owning ADR, not silently fixed or silently dropped. |

---

## 10. Data Requirements

|| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
|| `rag_chunks` / `rag_chunks_sync` / `social_posts` (existing) | Source tables for the orphan-detection query; all three already carry `FORCE ROW LEVEL SECURITY` | `reconcileOrphanedRAGChunks()` | Platform (derived/operational data) | Tenant-scoped indexing/content bookkeeping; `social_posts` carries the underlying post content |
|| RLS enforcement call-site fix (`withTenant()`) | The mechanism making the existing policies the real, operative boundary for this method's queries | Implementation, Story 19.3 | Engineering Lead | Internal infrastructure/access-control fix, reusing an already-established pattern |
|| Pinecone/Weaviate isolation mapping (documentation only) | The architecture recorded in ADR-0138 Decision §3/§4 for a future connector implementer | ADR-0138 | Engineering Lead | No persisted data; documentation only |

---

## 11. Reporting and Analytics

|| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
|| Contract test result proving `reconcileOrphanedRAGChunks()` is correctly tenant-scoped | Internal verification that the fix is real, not asserted | Engineering | On test run; no scheduled report introduced |

No new tenant-facing report or dashboard is introduced by this feature; it is an internal correctness fix to a not-yet-invoked background service, plus forward-looking architecture documentation.

---

## 12. Risks and Mitigations

|| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
|| R-001 | A future engineer assumes the reconciliation worker is fully "fixed" (i.e., running in production) because this story closed its RLS bug | Medium | Medium | ADR-0138 Decision §6/Consequence 6 and this BRD §6/§7 explicitly state the worker still has no caller after this story | Engineering Lead |
|| R-002 | Scope creep into building a Pinecone or Weaviate connector "since the architecture is already documented" | Low (explicit scope guard, BR-006) | Medium | `ragConnectorRegistry.ts` registering only `pgvector` at story end is a directly testable acceptance bar | Engineering Lead |
|| R-003 | Scope creep into designing a reconciliation scheduler "while fixing the query anyway" | Low (explicit scope guard, BR-007) | Medium | Q-0138-3/BR-007 make the guard explicit and testable | Engineering Lead |
|| R-004 | The `withTenant()` fix accidentally widens rather than narrows privilege (e.g., a fallback path that still reaches for an admin pool) | Low | High | NFR-001 and §4.4's least-privilege constraint make this an explicit acceptance bar, mirroring the same guard Stories 19.1/19.2 applied | Engineering Lead |

---

## 13. Dependencies

|| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
|| D-001 | ADR-0083 — RAG vector-store RLS and metadata (Accepted 2026-08-27) | Internal / Architectural | Engineering Lead | In place; this story refines it per ADR-0138's own Authorizes relationship |
|| D-002 | ADR-0136 — RAGConnector provider abstraction, namespace-per-tenant (Accepted 2026-08-28, Story 19.1 built) | Internal / Architectural | Engineering Lead | In place; source of the `ensureTenantNamespace?` hook and the primary/secondary isolation principle this story confirms and extends |
|| D-003 | ADR-0137 — RAG chunking/embedding namespace routing (Accepted 2026-08-28, Story 19.2 built) | Internal / Architectural | Engineering Lead | In place; immediately prior ADR in the same batch, established the `rag_chunks_sync` RLS-parity precedent (migration `0083`) this story's fix relies on |
|| D-004 | ADR-0015 / ADR-0032 — established Postgres RLS pattern | Internal / Architectural | Engineering Lead | In place; this story applies it to `reconcileOrphanedRAGChunks()`'s existing queries |
|| D-005 | Story 19.1 — already-shipped `PgvectorRAGConnector` RLS fix (`social-listening-core@8962e1d`) | Internal / Implementation | Engineering Lead | Built; the pattern this story's fix reuses |
|| D-006 | Story 19.2 — already-shipped `rag_chunks_sync` RLS-parity migration `0083` and `withTenant()` fix (`social-listening-core@a12b947`) | Internal / Implementation | Engineering Lead | Built; this story relies on `rag_chunks_sync` already carrying `FORCE ROW LEVEL SECURITY` |
|| D-007 | Story 19.3 — this story | Internal / Implementation | Engineering Lead | Ready; this BRD's own subject |
|| D-008 | A future ADR-0083 revisit — reconciliation-scheduler design | Internal / Architectural | Engineering Lead | Not started; explicitly out of this BRD's scope |
|| D-009 | A future Pinecone/Weaviate provider-adding story | Internal / Implementation | Engineering Lead | Not started; this BRD/ADR-0138 documents the architecture it would build against |

---

## 14. Acceptance Criteria

- `reconcileOrphanedRAGChunks()`'s real-DB branch executes its orphan-detection `SELECT` and cleanup `DELETE FROM rag_chunks_sync` via `withTenant(tenantId, ...)`.
- The mocked/in-memory branch and the method's public signature/return shape are unchanged.
- No new database migration; `rag_chunks`/`rag_chunks_sync`'s existing `FORCE ROW LEVEL SECURITY` is sufficient.
- `ragConnectorRegistry.ts` still registers only `pgvector` at the end of this story.
- No scheduler/cron wiring is added for `RAGReconciliationService`.
- Executable contract test citation: not yet created as of this writing — Story 19.3 is expected to add one under `social-listening-core/contracts/epic-19/`, following the naming convention of `story-19.1.rag-connector-namespace-isolation.contract.test.ts` / `story-19.2.rag-chunking-embedding-namespace-routing.contract.test.ts`.

---

## 15. Glossary

|| Term | Definition |
|---|---|
|| Fail-closed defect | A bug where a missing security/session-context mechanism causes a query to return no results rather than the wrong results — here, `reconcileOrphanedRAGChunks()` silently finding nothing, rather than leaking cross-tenant data. |
|| Reconciliation worker | `RAGReconciliationService.reconcileOrphanedRAGChunks()` (Story 9.9, ADR-0083 §4.5) — compares `rag_chunks`/`rag_chunks_sync` against `social_posts` to garbage-collect orphaned vector records. Exists and is callable, but has no caller anywhere in the codebase. |
|| Namespace-per-tenant (Pinecone) | Pinecone's own multi-tenancy primitive — one namespace per tenant, created lazily on first write. |
|| Shard-per-tenant (Weaviate) | Weaviate's own native multi-tenancy primitive — one physical shard per tenant, requiring explicit tenant creation before first write. |

---

## 16. Appendices

### Reference documents

- ADR-0138 — `docs/adr/0138-rag-vector-store-namespace-per-tenant-isolation.md` (source, Accepted 2026-08-28, drafted 2026-09-14)
- ADR-0083 — `docs/adr/0083-rag-vector-store-rls-and-metadata.md` (refined by ADR-0138)
- ADR-0136 — `docs/adr/0136-rag-connector-provider-abstraction-namespace-per-tenant.md` (source of `ensureTenantNamespace?`)
- ADR-0137 — `docs/adr/0137-rag-post-chunking-and-embedding-namespace-routing.md` (immediately prior ADR in the same batch)
- User stories — `docs/user-stories/epic-19-adr-0136-to-0140.md`, Story 19.3
- Already-shipped code inspected directly for this BRD: `social-listening-core/src/rag/ragReconciliationService.ts`, `pgvectorConnector.ts`, `types.ts`, `ragConnectorRegistry.ts`, `social-listening-core/src/db/withTenant.ts`, `adminPool.ts`, `social-listening-core/migrations/0002_enable_rls_social_posts.sql`, `0046_create_rag_chunks_and_sync_tables.sql`, `0047_fix_rag_chunks_permissions_and_rls.sql`, `0082_force_rls_rag_chunks.sql`, `0083_force_rls_rag_chunks_sync.sql`
- Related ADRs — ADR-0015/ADR-0032 (tenant RLS pattern), ADR-0043 (tenant offboarding)
- Sibling ADRs in this batch (out of scope for this BRD) — ADR-0139 (Story 19.4), ADR-0140 (Story 19.5)

### Missing source

- No dedicated deep-research report exists solely for ADR-0138; it derives from the same `raw/28-semantic-search-rag-deep-research.md` external brief that also informs ADR-0136/0137/0139/0140.

---

## 17. Open Questions

ADR-0138 itself does not resolve these; they are implementation-level or architectural gaps this BRD deliberately does not close by inventing an answer:

|| ID | Question | Why it's open | Target Resolution |
|---|---|---|---|
|| Q1 | What is the exact form of the contract test proving the `withTenant()` fix (new `epic-19` file vs. extending an existing `epic-9` test)? | Not specified by ADR-0138 | Implementation decision at Story 19.3 build time, per this project's contract-first convention |
|| Q2 | How and when should `RAGReconciliationService` actually be invoked periodically? | Explicitly out of ADR-0138's/this story's scope — a gap against ADR-0083 Decision §4, item 5 | Deferred to a future ADR-0083 revisit; not decided by this BRD |
|| Q3 | What is the exact `RAGFilter`-to-native-filter translation for a future Weaviate connector? | Not covered by the research brief findings ADR-0136/ADR-0138 cite | Deferred to whoever implements a Weaviate `RAGConnector` |
|| Q4 | Should ADR-0083 receive its own dated "Supersession update" note now that ADR-0138 carries real content? | A documentation-governance follow-up, not a Story 19.3 deliverable | Flagged for a future documentation pass on ADR-0083 itself |

---

## 18. Approval

|| Role | Name | Signature | Date |
|---|---|---|---|
|| Business Sponsor | Menno | | |
|| Product Owner | Menno | | |
|| Technical Lead | Menno | | |
|| Other Stakeholder | | | |
