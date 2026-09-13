# BRD-0137 — RAG Post Chunking and Embedding: Namespace Routing

> **Status note:** ADR-0137 is *Accepted* (2026-08-28). This BRD was drafted 2026-09-13, replacing the 2026-08-28 one-line stub — the same gap and resolution pattern already established for BRD-0131/ADR-0131 (Story 17.3, 2026-09-09) and BRD-0136/ADR-0136 (Story 19.1, earlier today). This BRD's content is derived strictly from ADR-0137's own newly-drafted Decision text plus direct inspection of the already-shipped `social-listening-core/src/rag/ragIndexingPipeline.ts`, `ragChunkingService.ts`, `backfill.ts`, and `ragReconciliationService.ts` — no new scope is introduced beyond what ADR-0137 authorizes.

## 1. Document Control

|| Field | Value |
|---|---|
|| Document Title | RAG Post Chunking and Embedding: Namespace Routing – Business Requirements Document |
|| Version | 1.0 |
|| Date | 2026-09-13 |
|| Author(s) | Business & Requirements Analyst persona |
|| Approver(s) | Menno — Business Sponsor / Product Owner / Technical Lead |
|| Status | Approved (source ADR-0137 Accepted 2026-08-28; this BRD's content written 2026-09-13) |

### Revision History

|| Version | Date | Author | Description of Changes |
|---|---|---|---|
|| 1.0 | 2026-09-13 | Business & Requirements Analyst | Initial real content, replacing the 2026-08-28 stub, drafted ahead of Story 19.2 implementation and consistent with ADR-0137's own newly-drafted Decision text (2026-09-13, source ADR Accepted 2026-08-28). |

---

## 2. Executive Summary

ADR-0136 (Accepted 2026-08-28, implemented as Story 19.1) made physical per-tenant isolation — namespace, shard, or database-enforced Row-Level Security — the *primary* tenant boundary for `RAGConnector` implementations, and added one new optional interface hook, `ensureTenantNamespace?(tenantId)`, for providers that need explicit per-tenant provisioning before first write. ADR-0136 twice forward-referenced ADR-0137 to confirm what does and does not need to change one layer up, in the chunking/embedding pipeline that calls `RAGConnector` — but ADR-0137 itself was a one-line stub until this pass, so that confirmation was never actually delivered.

**This BRD's concrete, evidence-verified finding**: direct inspection shows ADR-0136's forward-referenced claim is *true* — `RAGChunkingService.split()`/`.embed()` and `indexPostForRAG()`'s call to `connector.upsert(tenantId, embeddedChunks)` already carry no namespace/shard/RLS concept whatsoever and require no signature change. But inspection also surfaced two things ADR-0136's own framing did not anticipate: (1) the new `ensureTenantNamespace?()` hook ADR-0136 added has no caller anywhere in the shipped pipeline code, so a future namespace-capable provider (ADR-0138/Story 19.3) would still need a second, currently-unplanned pipeline change to get its per-tenant scope provisioned; and (2) `indexPostForRAG()` has its own direct `rag_chunks_sync` database write that bypasses that table's existing RLS policy via `getAdminPool()` — the identical admin-pool-bypass anti-pattern Story 19.1 already fixed for `rag_chunks` in `PgvectorRAGConnector`, on the sibling table Story 19.1's own scope (the connector layer) never reached.

ADR-0137 (this BRD's source) is the corrective, confirmatory decision: it formally delivers the zero-signature-change confirmation ADR-0136 already claimed, gives `ensureTenantNamespace?()` its one call site (immediately before `connector.upsert(...)`, inside the pipeline's existing bounded-retry block), and fixes `rag_chunks_sync`'s admin-pool bypass the same way Story 19.1 fixed `rag_chunks`'s. This BRD covers **ADR-0137 only** — Story 19.2's source.

---

## 3. Business Objectives

|| # | Objective | Success Measure |
|---|---|---|
|| 1 | Deliver the confirmation ADR-0136 already cited as existing, so ADR-0136's own "Relation to ADR-0136" forward reference is backed by real content, not a stub | ADR-0137's Decision §1 and its own "Relation to ADR-0136" section explicitly confirm `RAGChunkingService`/`indexPostForRAG()` require zero signature changes, verified against the shipped code, not merely restated from ADR-0136 |
|| 2 | Give the ADR-0136-authorized `ensureTenantNamespace?()` hook exactly one, well-defined call site before any provider needs it | `indexPostForRAG()` calls `connector.ensureTenantNamespace?.(tenantId)` immediately before `connector.upsert(...)`; the call is optional-chained and a verified no-op for the only currently-registered provider, `pgvector` |
|| 3 | Close the `rag_chunks_sync` admin-pool-bypass gap the same way Story 19.1 closed the identical `rag_chunks` gap | `indexPostForRAG()`'s `rag_chunks_sync` write routes through `withTenant(tenantId, ...)`; a contract test demonstrates the write executes under a non-superuser, RLS-subject role |
|| 4 | Preserve backward compatibility of the pipeline's existing bounded-retry/backoff/DLQ behavior | No new retry mechanism introduced; both new/changed call sites ride the existing 3-retry exponential-backoff loop (ADR-0082 Decision §5) |
|| 5 | Do not silently expand into ADR-0138/Story 19.3's or Story 9.8/ADR-0082's territory | No Pinecone/Azure AI Search connector work, no `ragReconciliationService.ts` fix, and no fix to the unrelated dead orphan-chunk-cleanup code found during inspection is delivered under Story 19.2 |

---

## 4. Scope

### 4.1 In Scope

- Formal confirmation (ADR-0137 Decision §1) that `RAGChunkingService.split()`/`.embed()` and `indexPostForRAG()`'s call to `connector.upsert(tenantId, embeddedChunks)` require zero signature or behavioral change under ADR-0136.
- A single new call, `await connector.ensureTenantNamespace?.(tenantId)`, added to `indexPostForRAG()` immediately before the existing `connector.upsert(...)` call, inside the function's existing per-attempt retry block (ADR-0137 Decision §2).
- Replacing `indexPostForRAG()`'s direct `rag_chunks_sync` write — currently `const pool = getAdminPool ? getAdminPool() : getPool(); await pool.query(...)` — with `await withTenant(tenantId, (client) => client.query(...))` (ADR-0137 Decision §3).
- A contract test (new, under `social-listening-core/contracts/epic-19/`, exact filename an implementation-time decision — ADR-0137 Open Question Q-0137-2) proving the `rag_chunks_sync` write no longer executes via the admin/superuser pool.
- (Should, not Must) A `FORCE ROW LEVEL SECURITY` migration on `rag_chunks_sync`, for parity with `rag_chunks`'s own `0082_force_rls_rag_chunks.sql` — recommended, not mandated (ADR-0137 Open Question Q-0137-1); migration number not assigned by this BRD.

### 4.2 Out of Scope

- Any Pinecone or Azure AI Search `RAGConnector` implementation, or the detailed per-provider physical-isolation mapping — that is ADR-0138/Story 19.3's job. `ensureTenantNamespace?()` gains a caller under this story, but no provider that actually implements it exists in this codebase today.
- Any change to `PgvectorRAGConnector` itself — Story 19.1 already made that connector's own queries RLS-enforced; this story touches the pipeline layer (`ragIndexingPipeline.ts`), not the connector layer.
- `ragReconciliationService.ts`'s separate, more severe defect (`reconcileOrphanedRAGChunks()` never calls `withTenant()` at all, fails closed unconditionally) — a different-shaped bug than this story's fix, explicitly flagged (ADR-0137 Context §4) for ADR-0138/Story 19.3, not this story.
- `backfill.ts` — confirmed (ADR-0137 Context §4) to be a legitimate, already-sanctioned cross-tenant admin/batch job, not an instance of the bug this story fixes. Not changed.
- The dead orphan-chunk-cleanup loop found during inspection in `indexPostForRAG()`'s Step 3 (computes `obsoleteId` but never deletes anything) — a real gap against ADR-0082 Decision §5, unrelated to namespace/RLS routing, flagged (ADR-0137 Context §5 / Open Question Q-0137-3) for a future ADR-0082/Story 9.8 revisit, not this story.
- Any change to `/v1/rag/search`, `/v1/rag/ask`, or `/v1/rag/status` — that is ADR-0139/Story 19.4's job.
- Any UI/UX change (ADR-0140/Story 19.5).
- Any new `RAGConnector` interface member — `ensureTenantNamespace?` already exists on the interface as of ADR-0136/Story 19.1; this story gives it a caller, it does not modify the interface.

### 4.3 Assumptions

- ADR-0137 (this BRD's source, drafted 2026-09-13) is the single source of truth for Story 19.2's authorized scope.
- `RAGChunkingService.split()`/`.embed()` carry no namespace/shard/RLS concept today — verified directly by reading `social-listening-core/src/rag/ragChunkingService.ts`.
- `indexPostForRAG()`'s call to `connector.upsert(tenantId, embeddedChunks)` already matches the unchanged ADR-0081/ADR-0136 `upsert(tenantId, vectors)` signature — verified directly by reading `social-listening-core/src/rag/ragIndexingPipeline.ts`.
- `ensureTenantNamespace?` exists on the `RAGConnector` interface (`social-listening-core/src/rag/types.ts`) but has no caller anywhere in the shipped codebase as of 2026-09-13 — verified by direct inspection; only `pgvector` is registered (`ragConnectorRegistry.ts`) and it does not implement the hook.
- `rag_chunks_sync` already carries `ENABLE ROW LEVEL SECURITY` and a `rag_chunks_sync_tenant_isolation` policy that accepts either `app.tenant_id` or `app.current_tenant_id` — verified directly against `social-listening-core/migrations/0046_create_rag_chunks_and_sync_tables.sql` and `0047_fix_rag_chunks_permissions_and_rls.sql`. No policy text change is required for this story's fix — only the call site.
- `indexPostForRAG()`'s `rag_chunks_sync` write runs via `getAdminPool()` (or `getPool()` as a fallback), never `withTenant()` — verified directly by reading `ragIndexingPipeline.ts`.
- `withTenant()` (`social-listening-core/src/db/withTenant.ts`) is this project's own established mechanism for setting RLS session context against a non-superuser role — verified by reading that file's docstring, and already used as the fix pattern for the analogous `rag_chunks` gap in Story 19.1.

### 4.4 Constraints

- No breaking change to `RAGChunkingService`'s or `indexPostForRAG()`'s public call signatures.
- No new retry/backoff/DLQ mechanism — both the new `ensureTenantNamespace?()` call and the corrected `rag_chunks_sync` write must use the pipeline's existing bounded-retry loop.
- No new `RAGConnector` interface member, no new table, and no change to the deterministic vector ID scheme (ADR-0137 explicitly authorizes none of these).
- The mechanism that fixes the `rag_chunks_sync` write must not grant broader privileges than the tenant-scoped operation requires — the same least-privilege bar Story 19.1 applied to `rag_chunks` (NFR-001 precedent, BRD-0136).

---

## 5. Stakeholders

|| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
|| Engineering Lead (Menno) | Implements Story 19.2 | High | A precisely scoped pipeline change plus one bugfix, without inheriting Story 19.3/Story 9.8's scope |
|| Future implementer of Story 19.3 (Pinecone/Azure AI Search isolation mapping) | Will build the first provider that actually implements `ensureTenantNamespace?()` | Medium today | A correctly-placed, already-wired call site to build against, so no second pipeline change is needed |
|| Future implementer of a Story 9.8/ADR-0082 revisit | Would fix the dead orphan-chunk-cleanup loop this BRD flags but does not fix | Low today | A clearly documented, evidence-backed description of the gap (ADR-0137 Context §5) rather than having to rediscover it |
|| Any tenant whose posts are indexed into `rag_chunks`/`rag_chunks_sync` (indirect) | Ultimate beneficiary of the isolation guarantee | High (in principle), Low (visibility) | The same real, DB-enforced isolation guarantee already delivered for `rag_chunks` under Story 19.1, now also covering the sibling bookkeeping table |

---

## 6. Current State (As-Is)

**Current implementation (Story 9.8, ADR-0082; Story 19.1, ADR-0136):** `indexPostForRAG()` chunks and embeds a post via `RAGChunkingService`, then upserts the resulting vectors through `connector.upsert(tenantId, embeddedChunks)` — this call already matches the ADR-0136-unchanged interface. Separately, `indexPostForRAG()` writes its own bookkeeping row directly to `rag_chunks_sync` via `getAdminPool()` (or `getPool()` as a fallback), bypassing that table's existing RLS policy exactly as `PgvectorRAGConnector` bypassed `rag_chunks`'s policy before Story 19.1. The new `ensureTenantNamespace?()` hook ADR-0136/Story 19.1 added to the `RAGConnector` interface has no caller anywhere in the codebase.

**Pain points:**
- `rag_chunks_sync`'s RLS policy provides zero actual protection today for the exact same reason `rag_chunks`'s did before Story 19.1 — the policy is structurally present but never evaluated because the executing role is a superuser.
- `ensureTenantNamespace?()` exists on the interface but is unreachable — a future namespace-capable provider (Story 19.3) would need an additional, currently-unplanned pipeline change to ever have it invoked.
- ADR-0136's own "Relation to ADR-0137" forward reference currently points at a stub, not real content, which is itself a documentation-integrity gap this BRD's source ADR closes.

---

## 7. Future State (To-Be)

**New or improved state:** `indexPostForRAG()` calls `connector.ensureTenantNamespace?.(tenantId)` before every `upsert()`, giving any future namespace-capable provider a working provisioning call site with zero additional pipeline change required when Story 19.3 ships. `indexPostForRAG()`'s `rag_chunks_sync` write executes via `withTenant()`, making that table's existing RLS policy the real, operative tenant boundary, matching `rag_chunks`'s post-Story-19.1 state. `RAGChunkingService` itself is unchanged. ADR-0136's forward reference to this ADR is backed by real, verified content.

**Expected capabilities:**
- A verifiable, testable claim that `rag_chunks_sync` writes no longer execute as superuser.
- A working, if currently unused, `ensureTenantNamespace?()` call site ready for Story 19.3 to build a provider against.
- Two adjacent, real, but differently-shaped issues (`ragReconciliationService.ts`, the dead orphan-cleanup loop) explicitly named and routed to their correct future owners rather than left to be rediscovered.

---

## 8. Business Requirements

### 8.1 Functional Requirements

|| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
|| BR-001 | `indexPostForRAG()` shall call `connector.ensureTenantNamespace?.(tenantId)` immediately before `connector.upsert(...)` | Must | Optional-chained; verified no-op for `pgvector`; located inside the existing per-attempt retry block | Engineering Lead |
|| BR-002 | `indexPostForRAG()`'s `rag_chunks_sync` write shall execute via `withTenant(tenantId, ...)`, not `getAdminPool()`/plain `getPool()` | Must | A contract test demonstrates the write no longer calls the admin/superuser pool and that cross-tenant `rag_chunks_sync` rows remain isolated | Engineering Lead |
|| BR-003 | `RAGChunkingService.split()`/`.embed()` shall remain unchanged | Must | No signature or behavioral change; existing epic-9 contract tests referencing these methods continue to pass unmodified | Engineering Lead |
|| BR-004 | No new retry/backoff/DLQ mechanism shall be introduced | Must | Both new/changed call sites use the existing 3-retry exponential-backoff loop already in `indexPostForRAG()` | Engineering Lead |
|| BR-005 | No new `RAGConnector` interface member shall be added | Must (scope guard) | `ensureTenantNamespace?` remains exactly as added by ADR-0136/Story 19.1 — this story adds a caller, not a new member | Engineering Lead |
|| BR-006 | The deterministic vector ID scheme shall remain unchanged | Must | `${tenantId}:${postId}:${chunkIndex}` unchanged; no backfill or migration of existing rows | Engineering Lead |
|| BR-007 | `backfill.ts` shall not be modified | Must (scope guard) | File unchanged at end of story; confirmed a legitimate exception, not an instance of the bug this story fixes | Engineering Lead |
|| BR-008 | `ragReconciliationService.ts`'s missing-`withTenant()` defect shall not be fixed under this story | Must (scope guard) | File unchanged at end of story; gap remains explicitly flagged (ADR-0137 Context §4) for Story 19.3 | Engineering Lead |
|| BR-009 | The dead orphan-chunk-cleanup loop in `indexPostForRAG()` Step 3 shall not be fixed under this story | Must (scope guard) | Loop unchanged at end of story; gap remains explicitly flagged (ADR-0137 Context §5 / Open Question Q-0137-3) for a future ADR-0082/Story 9.8 revisit | Engineering Lead |
|| BR-010 | (Should) `rag_chunks_sync` should receive a `FORCE ROW LEVEL SECURITY` migration for parity with `rag_chunks`'s `0082_force_rls_rag_chunks.sql` | Should | Not functionally required (per Story 19.1's own reasoning for `rag_chunks`); left as an implementation-time decision, migration number not assigned here | Engineering Lead |

Priority levels: Must / Should / Could / Won't (MoSCoW)

### 8.2 Non-Functional Requirements

|| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
|| NFR-001 | The role executing `indexPostForRAG()`'s `rag_chunks_sync` write must not be the superuser role reserved for schema-level DDL/archival | Security | Must | Verified against `adminPool.ts`'s own stated rationale, mirroring BRD-0136 NFR-001 |
|| NFR-002 | No regression to existing RAG contract tests from this change | Reliability | Must | `story-9.7`, `story-9.8`, `story-9.9`, `story-9.10`, and Story 19.1's `story-19.1.rag-connector-namespace-isolation` contract tests all continue to pass |
|| NFR-003 | The `ensureTenantNamespace?()` call must not measurably change indexing latency for the current no-op (`pgvector`) case | Performance | Should | Informal check only — optional-chaining a no-op method is expected to be effectively free; no SLA defined here |

Categories include: Performance, Security, Reliability, Scalability, Usability, Compliance, Maintainability, Accessibility, Transparency/Trust.

---

## 9. Business Rules

|| ID | Rule |
|---|---|
|| BRU-001 | Namespace/shard/RLS tenant-isolation routing is fully encapsulated inside the `RAGConnector` implementation (ADR-0136) — the chunking/embedding pipeline never implements or duplicates it. |
|| BRU-002 | `ensureTenantNamespace?()` is called unconditionally before every `upsert()`; idempotency of repeated calls is the responsibility of each provider's own implementation, not the pipeline's. |
|| BRU-003 | Physical/database-level isolation is primary where available; the pipeline's own bookkeeping table (`rag_chunks_sync`) must be written under the same non-superuser, RLS-subject discipline already applied to `rag_chunks`. |
|| BRU-004 | `backfill.ts`'s cross-tenant admin-pool reads remain a sanctioned exception (legitimate batch job), never treated as an instance of the bug this story fixes. |
|| BRU-005 | No breaking change to `RAGChunkingService` or `indexPostForRAG()`'s public call signatures. |

---

## 10. Data Requirements

|| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
|| `rag_chunks_sync` (existing) | Per-post/tenant indexing bookkeeping table; already carries `ENABLE ROW LEVEL SECURITY` and a `rag_chunks_sync_tenant_isolation` policy (migrations 0046/0047) | `indexPostForRAG()` | Platform (derived/operational data) | Tenant-scoped indexing status; not itself PII |
|| RLS enforcement call-site fix (`withTenant()`) | The mechanism making `rag_chunks_sync`'s existing policy actually operative for `indexPostForRAG()`'s write | Implementation, Story 19.2 | Engineering Lead | Internal infrastructure/access-control fix, reusing an already-established pattern |
|| `ensureTenantNamespace?()` call site (new, in `indexPostForRAG()`) | The one place in the pipeline this optional hook is invoked | `RAGConnector` interface (ADR-0136), called by the pipeline (ADR-0137) | Engineering Lead | Internal control-flow addition, no persisted data of its own |

---

## 11. Reporting and Analytics

|| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
|| Contract test result proving `rag_chunks_sync` no longer writes via the admin pool | Internal verification that the fix is real, not asserted | Engineering | On test run; no scheduled report introduced |

No new tenant-facing report or dashboard is introduced by this feature; it is an internal pipeline-layer correction plus a confirmatory decision, not a user-visible capability.

---

## 12. Risks and Mitigations

|| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
|| R-001 | `ensureTenantNamespace?()`'s call site is added but a future provider's implementation is not actually idempotent, causing repeated-call side effects once Story 19.3 ships | Low today (no provider implements it yet) | Medium (deferred) | ADR-0137 Decision §2 explicitly places idempotency responsibility on the provider, not the pipeline; flagged for whoever implements Story 19.3 | Future Story 19.3 implementer |
|| R-002 | A future engineer assumes `ragReconciliationService.ts`'s bug or the dead orphan-cleanup loop were fixed by this story because they live in the same directory | Medium (was already at risk of being missed) | Medium | Both are explicitly named as out of scope with reasons in ADR-0137 Context §4/§5 and this BRD §4.2 | Engineering Lead |
|| R-003 | The `rag_chunks_sync` fix accidentally widens rather than narrows admin-pool usage (e.g. a new helper that still defaults to admin pool under some condition) | Low | High | NFR-001 and §4.4's least-privilege constraint make this an explicit acceptance bar, mirroring the same guard Story 19.1 applied | Engineering Lead |
|| R-004 | Scope creep into Story 19.3's territory (e.g. building a namespace-capable connector "while we're in here") | Low (explicit scope guard) | Medium | BR-005/§4.2 make the guard explicit and testable | Engineering Lead |

---

## 13. Dependencies

|| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
|| D-001 | ADR-0082 — RAG post chunking and embedding pipeline (Accepted 2026-08-25) | Internal / Architectural | Engineering Lead | In place; this story refines it per ADR-0137's own Authorizes relationship |
|| D-002 | ADR-0136 — RAGConnector provider abstraction, namespace-per-tenant (Accepted 2026-08-28, Story 19.1 built) | Internal / Architectural | Engineering Lead | In place; source of the `ensureTenantNamespace?` hook and the primary/secondary isolation principle this story extends |
|| D-003 | ADR-0015 / ADR-0032 — established Postgres RLS pattern | Internal / Architectural | Engineering Lead | In place; this story applies it to `rag_chunks_sync`'s already-created policy |
|| D-004 | Story 9.8 — already-shipped `RAGChunkingService`/`indexPostForRAG()` | Internal / Implementation | Engineering Lead | Built; this story extends it, does not replace it |
|| D-005 | Story 19.1 — already-shipped `PgvectorRAGConnector` RLS fix (the pattern this story reuses) | Internal / Implementation | Engineering Lead | Built (`social-listening-core@pending` per `docs/implementation-log.md`'s 2026-09-13 entry) |
|| D-006 | Story 19.2 — this story | Internal / Implementation | Engineering Lead | Ready; this BRD's own subject |
|| D-007 | ADR-0138 / Story 19.3 — Pinecone/Azure AI Search isolation mapping, `ragReconciliationService.ts` fix | Internal / Architectural | Engineering Lead | Not started; explicitly out of this BRD's scope |

---

## 14. Acceptance Criteria

- `indexPostForRAG()` calls `connector.ensureTenantNamespace?.(tenantId)` immediately before `connector.upsert(...)`, inside the existing retry block.
- `indexPostForRAG()`'s `rag_chunks_sync` write executes via `withTenant(tenantId, ...)`, not `getAdminPool()`/plain `getPool()`.
- `RAGChunkingService.split()`/`.embed()` remain unchanged; existing epic-9 contract tests pass unmodified.
- No new retry mechanism, interface member, table, or change to the vector ID scheme.
- `backfill.ts` and `ragReconciliationService.ts` remain unchanged.
- The dead orphan-chunk-cleanup loop in `indexPostForRAG()` Step 3 remains unchanged (flagged, not fixed).
- Executable contract test citation: not yet created as of this writing — Story 19.2 is expected to add one under `social-listening-core/contracts/epic-19/`, following the naming convention of `story-19.1.rag-connector-namespace-isolation.contract.test.ts`.

---

## 15. Glossary

|| Term | Definition |
|---|---|
|| Pipeline layer | `RAGChunkingService` and `indexPostForRAG()` — chunks a post, embeds it, and calls the connector; distinct from the connector layer (`RAGConnector` implementations) ADR-0136 governs. |
|| `ensureTenantNamespace?` | The optional `RAGConnector` lifecycle hook (ADR-0136) for providers needing explicit per-tenant provisioning before first write; this story gives it its one call site. |
|| Inert RLS policy | A `CREATE POLICY` statement present in the schema but never evaluated against a given code path's real queries because those queries run under a superuser role. |
|| Dead orphan-cleanup loop | The Step 3 code in `indexPostForRAG()` that computes an obsolete vector ID but never deletes it — a real, verified, out-of-scope gap against ADR-0082 Decision §5. |

---

## 16. Appendices

### Reference documents

- ADR-0137 — `docs/adr/0137-rag-post-chunking-and-embedding-namespace-routing.md` (source, Accepted 2026-08-28, drafted 2026-09-13)
- ADR-0082 — `docs/adr/0082-rag-post-chunking-and-embedding.md` (refined by ADR-0137)
- ADR-0136 — `docs/adr/0136-rag-connector-provider-abstraction-namespace-per-tenant.md` (source of `ensureTenantNamespace?`)
- User stories — `docs/user-stories/epic-19-adr-0136-to-0140.md`, Story 19.2
- Already-shipped code inspected directly for this BRD: `social-listening-core/src/rag/ragIndexingPipeline.ts`, `ragChunkingService.ts`, `backfill.ts`, `ragReconciliationService.ts`, `pgvectorConnector.ts`, `social-listening-core/src/db/adminPool.ts`, `withTenant.ts`, `social-listening-core/migrations/0046_create_rag_chunks_and_sync_tables.sql`, `0047_fix_rag_chunks_permissions_and_rls.sql`, `0082_force_rls_rag_chunks.sql`
- Related ADRs — ADR-0015/ADR-0032 (tenant RLS pattern), ADR-0043 (tenant offboarding, non-bypassing-role precedent)
- Sibling ADRs in this batch (out of scope for this BRD) — ADR-0138 (Story 19.3), ADR-0139 (Story 19.4), ADR-0140 (Story 19.5)

### Missing source

- No dedicated deep-research report exists solely for ADR-0137; it derives from the same `raw/28-semantic-search-rag-deep-research.md` external brief that also informs ADR-0136/0138–0140.

---

## 17. Open Questions

ADR-0137 itself does not resolve these; they are implementation-level gaps this BRD deliberately does not close by inventing an answer:

|| ID | Question | Why it's open | Target Resolution |
|---|---|---|---|
|| Q1 | Should `rag_chunks_sync` receive a `FORCE ROW LEVEL SECURITY` migration for parity with `rag_chunks`'s `0082_force_rls_rag_chunks.sql`? | Recommended, not mandated, by ADR-0137 Decision §3; not functionally required | Implementation decision at Story 19.2 build time |
|| Q2 | What is the exact form of the contract test proving the `rag_chunks_sync` fix (new `epic-19` file vs. extending an existing `epic-9` test)? | Not specified by ADR-0137 | Implementation decision at Story 19.2 build time, per this project's contract-first convention |
|| Q3 | Should the dead orphan-chunk-cleanup loop (ADR-0137 Context §5) be fixed under a future ADR-0082/Story 9.8 revisit, and if so, how (explicit per-ID deletes vs. full `deletePost`-then-`upsert`)? | Explicitly out of ADR-0137's/this story's scope | Deferred; not decided by this BRD |

---

## 18. Approval

|| Role | Name | Signature | Date |
|---|---|---|---|
|| Business Sponsor | Menno | | |
|| Product Owner | Menno | | |
|| Technical Lead | Menno | | |
|| Other Stakeholder | | | |
