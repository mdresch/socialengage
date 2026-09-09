# Technical Design Specification (TDS) — Cursor-Based Pagination for Posts API

## 1. Document Control & Traceability Linkage

### 1.1 Metadata
| Attribute | Value |
|---|---|
| **Document Title** | TDS-0011: Cursor-Based Pagination for Posts API (`GET /v1/posts`) |
| **Document ID** | `TDS-0011` |
| **Feature Name** | High-Throughput Keyset/Cursor-Based Pagination Engine |
| **Version** | `1.0.0` |
| **Status** | Approved |
| **Author(s)** | Core API & Query Architecture Team |
| **Created Date** | 2026-09-04 |
| **Last Updated** | 2026-09-04 |
| **Governing Skill** | `social-listening-core/.claude/skills/posts-api/SKILL.md` |

### 1.2 Upstream & Downstream Traceability Matrix
| Artifact Type | Reference Identifier | Title / Link | Alignment Status |
|---|---|---|---|
| **Architecture Decision Record** | `ADR-0011` | [ADR-0011: Cursor-based pagination for posts API](../../adr/0011-cursor-based-pagination-for-posts-api.md) | Invariant Source |
| **Business Requirements Doc** | `BRD-0011` | [BRD-0011: Cursor-Based Pagination For Posts API](../Business-Requirements/BRD-0011-Cursor-Based-Pagination-For-Posts-API.md) | Fully Aligned |
| **Functional Design Doc** | `FDD-0011` | [FDD-0011: Cursor-Based Pagination For Posts API](../Functional-Design/FDD-0011-Cursor-Based-Pagination-For-Posts-API.md) | Fully Aligned |
| **Governing User Story** | `Story 3.4` | [Epic 3: Data Model, Storage, and Archival](../../user-stories/epic-3-data-model-storage-and-archival.md#story-34--cursor-based-pagination-for-posts-api) | Acceptance Target |
| **Executable Contract Test** | `Story 3.4 Contract` | `contracts/epic-3/story-3.4.cursor-pagination.contract.test.ts` | 100% Passing |

---

## 2. System Context & Architecture Topology

### 2.1 Context Diagram
```mermaid
flowchart TD
    subgraph ClientApp["Admin UI / API Client"]
        ReqInitial["1. GET /v1/posts?limit=50"]
        ReqNext["3. GET /v1/posts?limit=50&cursor=eyJwdWIi..."]
    end

    subgraph API["postsRouter.ts"]
        DecodeCursor["2. Decode Base64 Cursor -> (publishedAt, id)"]
        QueryBuilder["3. Construct Keyset WHERE Clause"]
        EncodeNext["4. Encode (lastItem.publishedAt, lastItem.id) -> nextCursor"]
    end

    subgraph Database["PostgreSQL (Index Scans)"]
        CompoundIndex["(tenant_id, published_at DESC, id DESC)"]
        PostRows["social_posts rows"]
    end

    ReqInitial --> QueryBuilder
    ReqNext --> DecodeCursor
    DecodeCursor --> QueryBuilder
    QueryBuilder -->|WHERE (published_at, id) < (cursorPub, cursorId)| CompoundIndex
    CompoundIndex --> PostRows
    PostRows --> EncodeNext
    EncodeNext -->|200 OK: { data: [...], nextCursor }| ClientApp
```

### 2.2 Architectural Boundaries & Invariants
- **Keyset Ordering Invariant:** Results are ordered deterministically by `published_at DESC, id DESC`. The primary key UUID breaks ties when two posts share an identical publish timestamp.
- **Opaque Cursor Tokens:** Cursors are serialized as base64-encoded JSON strings (`{"publishedAt": "...", "id": "..."}`) that clients treat as completely opaque. Clients must never construct or parse cursor tokens manually.
- **Concurrent Ingestion Immunity:** Under active ingestion, newly inserted posts arriving ahead of the cursor are not returned in the current stream; they will be retrieved on the next top-level query without producing duplicates or skipped rows.
- **Fetch Limit Bounds:** The query enforces a default limit of 50 and a hard ceiling of 100 items per request (`limit = Math.min(requestedLimit || 50, 100)`).

---

## 3. Data Architecture & Persistence Design

### 3.1 Keyset Paging SQL Query
```sql
-- Query executed by getPostsCursorPaginated()
SELECT 
    p.id,
    p.tenant_id,
    p.platform_id,
    p.external_id,
    p.content,
    p.published_at,
    p.ingested_at,
    p.sentiment,
    a.display_name AS author_name,
    a.handle AS author_handle
FROM social_posts p
JOIN authors a ON p.author_id = a.id
WHERE p.tenant_id = $1
  -- Keyset cursor condition (row-value comparison)
  AND ($2::timestamptz IS NULL OR (p.published_at, p.id) < ($2::timestamptz, $3::uuid))
ORDER BY p.published_at DESC, p.id DESC
LIMIT $4;
```

### 3.2 Index Optimization DDL
```sql
CREATE INDEX IF NOT EXISTS idx_social_posts_cursor_pagination 
    ON social_posts (tenant_id, published_at DESC, id DESC);
```

---

## 4. API, Interface & Integration Contract Design

### 4.1 TypeScript Types (`src/posts/types.ts`)
```typescript
export interface CursorPayload {
  publishedAt: string; // ISO 8601
  id: string;          // UUID
}

export interface PaginatedPostsResponse {
  data: SocialPostSummary[];
  nextCursor: string | null;
  limit: number;
}
```

### 4.2 Cursor Serialization & Deserialization (`src/posts/cursorCodec.ts`)
```typescript
export function encodeCursor(item: { publishedAt: Date; id: string }): string {
  const payload: CursorPayload = {
    publishedAt: item.publishedAt.toISOString(),
    id: item.id
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function decodeCursor(cursorStr: string): CursorPayload {
  try {
    const raw = Buffer.from(cursorStr, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw);
    if (!parsed.publishedAt || !parsed.id) {
      throw new Error('Malformed cursor payload');
    }
    return parsed;
  } catch (err) {
    throw new Error('Invalid cursor token provided');
  }
}
```

---

## 5. Rate Limiting, Concurrency & Flow Control

- **Predictable Query Latency:** Because the query avoids `OFFSET`, execution time remains $O(\text{limit})$ regardless of whether paging through page 1 or page 5,000.
- **Buffer Pool Efficiency:** Postgres scans index pages sequentially and terminates immediately after retrieving `limit + 1` rows.

---

## 6. Security, Identity & Credential Governance

- **Tenant Isolation Enforcement:** The `tenant_id` is derived from the authenticated session context and bound to the query parameters, preventing callers from tampering with the cursor to read other tenants' posts.

---

## 7. Error Handling, Resilience & Failure Classification

| Condition | HTTP Status | Error Message |
|---|---|---|
| Invalid base64 or malformed JSON in `cursor` | `400 Bad Request` | `"Invalid cursor parameter provided"` |
| Non-existent cursor UUID | Handled gracefully | Queries all records where timestamp is older than cursor timestamp. |
| Negative or zero `limit` | `400 Bad Request` | `"Limit must be a positive integer"` |

---

## 8. Testing & Contract Gate Plan

### 8.1 Contract Tests
Contract test file: `contracts/epic-3/story-3.4.cursor-pagination.contract.test.ts`.

| Test ID | Scenario | Verification Method |
|---|---|---|
| `TEST-CUR-01` | First page retrieval | Query with `limit=10`; assert 10 posts returned and valid `nextCursor` string. |
| `TEST-CUR-02` | Consecutive page continuity | Pass `nextCursor` into second call; verify page 2 starts strictly after last item of page 1. |
| `TEST-CUR-03` | Final page termination | Page to end of dataset; assert `nextCursor` returns `null`. |
| `TEST-CUR-04` | Concurrent insert stability | Insert new post with recent timestamp while paging; assert no duplicates on subsequent pages. |
| `TEST-CUR-05` | Malformed cursor rejection | Supply `cursor="not-a-valid-token"`; assert HTTP 400 response. |

---

## 9. Component Skill (`SKILL.md`) Documentation Updates

Updates to `.claude/skills/posts-api/SKILL.md`:
- **Pagination Standard:** Mandate that all post retrieval endpoints use cursor-based pagination.
- **Compound Sort Requirement:** Document that queries must order by `published_at DESC, id DESC`.

---

## 10. Observability, Metrics & Operational Telemetry

- `posts_api_requests_total{status_code}` (counter)
- `posts_api_cursor_query_duration_ms` (histogram)

---

## 11. Migration, Rollout & Feature Gating

- Migration `0011_add_cursor_pagination_index.sql` creates the compound index.
- Applied globally across all active tenants.

---

## 12. Technical Assumptions, Dependencies & Open Questions

### 12.1 Assumptions & Dependencies
- **[A-0011-1]** Post `id` UUID values are unique across all rows.
- **[D-0011-1]** Postgres support for row-value tuples `(a, b) < ($1, $2)`.

### 12.2 Open Questions
- [x] **[Q-0011-1]** *Total Result Count:* Total count omitted from paginated response for performance; separate count endpoint provided if needed.
