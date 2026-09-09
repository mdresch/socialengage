# ADR-0086: Prospecting list model and sharing

**Status:** Accepted (2026-08-27)

**Acceptance note (2026-08-27):** Accepted by Menno, verbatim: *"Ready with my approval for ADR 0086."* Accepted as revised — all three in-place, pre-acceptance revisions are in effect, not just the original 2026-08-23 draft: the second-pass fixes (footnote corrections, `author_id`/`owner_id` FK corrections, dropped invented entry cap, full ADR-0108 four-score snapshot, `custom_attributes`) and the third-pass resolution of the sharing-permission question (owner-only `shared` toggle, no `tenant_admin` override, read-only for teammates) — see the Revision notes below for the full record. Stories 10.1/10.2 (`docs/user-stories/epic-10-adr-0086-to-0094.md`) move to **Ready**.

**Drafted 2026-08-23 · Revised 2026-08-27.** Authorizes the `prospecting_lists` and `prospecting_list_entries` data model, RLS scoping, add-time score snapshots, deduplication constraints, and the CRM/export privacy boundary for the social-selling use case.

**Source:** `docs/product-research/feature-designs/18-prospecting-list.md`, `docs/product-research/feature-adr-scoping.md`, and ADR-0004/ADR-0007/ADR-0044/ADR-0108/ADR-0117.

---

## Context

### 1. Social selling needs a lightweight lead list
`docs/product-research/feature-designs/18-prospecting-list.md` describes a tenant-scoped list where a `Social-Selling-Strategist` can save, qualify, annotate, and manage authors discovered through influencer discovery or topic analysis, for outreach and CRM handoff.

### 2. Relation to Author data and discovery scores
The `Author` table (ADR-0004) captures baseline author metadata, and `AuthorTopicSignal` (ADR-0007) captures raw topical-relevance signals — by design, ADR-0007 stores no computed score. Computed scores (`engagement_score`, `authenticity_score`, `influence_score`, `reach_score`) are added to `Author` by **ADR-0108** (Influencer discovery and scoring). The prospecting list is a user-curated qualification layer that references `Author`, capturing discovery-time snapshots and notes rather than duplicating the underlying entity.

### 3. PII and platform privacy constraints
Prospecting lists must not store private contact data scraped from profiles. Only public author handles and platform metadata are referenced. Export to CSV and CRM push must be tenant-scoped, permission-gated, and metadata-only.

---

## Decision

### 1. Database schema (`prospecting_lists` and `prospecting_list_entries`)

```sql
CREATE TABLE prospecting_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  shared boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE prospecting_list_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospecting_list_id uuid NOT NULL REFERENCES prospecting_lists(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES authors(id),
  platform_id text NOT NULL,
  topic text,                         -- Qualification context: why this author was flagged
  engagement_score numeric(5,2),      -- Add-time snapshot (ADR-0108); not kept in sync
  authenticity_score numeric(5,2),    -- Add-time snapshot (ADR-0108); not kept in sync
  influence_score numeric(5,2),       -- Add-time snapshot (ADR-0108); not kept in sync
  reach_score numeric(5,2),           -- Add-time snapshot (ADR-0108); not kept in sync
  relationship_stage text NOT NULL DEFAULT 'new'
    CHECK (relationship_stage IN ('new', 'contacted', 'engaged', 'converted', 'passed')),
  notes text,
  tags text[] DEFAULT '{}',
  custom_attributes jsonb NOT NULL DEFAULT '{}',
  added_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_prospecting_list_author UNIQUE (prospecting_list_id, author_id)
);

CREATE INDEX idx_prospecting_lists_tenant_owner ON prospecting_lists(tenant_id, owner_id, shared);
CREATE INDEX idx_prospecting_entries_list ON prospecting_list_entries(prospecting_list_id, relationship_stage);
CREATE INDEX idx_prospecting_entries_tenant_author ON prospecting_list_entries(tenant_id, author_id);
```

- **Point-in-time score snapshot:** the four scoring columns record why an author was qualified at the moment they were added, using ADR-0108's exact field set and precision. Current values are always available by joining `authors` on `author_id`; these columns are never recomputed in place.
- **Deduplication:** `UNIQUE (prospecting_list_id, author_id)` guarantees an author appears at most once per list. `POST .../entries` returns `409 Conflict` for a duplicate add (this project's existing convention for a request that conflicts with current state, per ADR-0044 §2/§3); to change `topic`/`notes`/`tags`/`custom_attributes` for an author already on the list, use `PATCH .../entries/:entryId` instead.
- **`author_id` carries no `ON DELETE` cascade**, matching every other `author_id` foreign key in this codebase (`author_topic_signals`, `social_posts`). Author-initiated takedown (ADR-0092) never deletes an `authors` row — it soft-redacts `social_posts` and explicitly *preserves* `author_id` "for audit and continuity" — so there is no author-erasure path a cascade here would ever need to serve. If an `authors` row is ever deleted for some unrelated reason, this FK fails closed instead of silently discarding a tenant's sales-qualification history.
- **`owner_id`/`added_by_user_id` cascade on user deletion**, consistent with `watchlists.user_id` and `connector_activations.user_id` elsewhere in this codebase — a personal-resource ownership FK deletes with its owning user rather than blocking that user's offboarding (BRD-0039/BRD-0043).
- List size is bounded by pagination on read (§4), not a hard per-list cap — see Open Questions.

### 2. RLS and ownership
- Both tables are `tenant_id`-scoped and RLS-protected.
- A list's row is visible (`SELECT`) to its `owner_id` and, if `shared = true`, to every `tenant_user`/`tenant_admin` in the same tenant.
- **Only the list's own `owner_id` may set `shared = true`/`false`, or `INSERT`/`UPDATE`/`DELETE` the list or its entries — including while `shared = true`.** There is no `tenant_admin` override. This matches ADR-0044 §5c's precedent for the structurally identical watchlist-ownership case: a personal, curated resource doesn't become tenant-wide-writable because of who holds a role.
- Sharing therefore grants **read-only** visibility to teammates, not collaborative editing: a non-owner `tenant_user`/`tenant_admin` can view a shared list and its entries, but cannot add, edit, or remove entries, change `relationship_stage`, rename the list, un-share it, or delete it.
- Enforced per-command RLS (`SELECT` vs. `INSERT`/`UPDATE`/`DELETE`), via the same `app.user_id` session-variable mechanism ADR-0044 §5c already established (propagated through `withTenant`) — not an application-layer role check.
- `prospecting_list_entries` inherits the list's visibility and write-ownership: private list → private entries; shared list → entries readable tenant-wide but still mutable only by `owner_id`.
- A non-owner's `PATCH`/`DELETE` on a list or entry — even one visible to them because it's shared — matches zero rows under RLS and returns `404`, never `403`, mirroring ADR-0044 §2's ownership-boundary convention (no role-check branch; RLS alone decides).

### 3. Relationship stage is data, not workflow
`relationship_stage` is a user-managed label. v1 does not enforce workflow transitions, email automations, or follow-up reminders. Future features may add workflow.

### 4. Endpoints
```ts
// List management
POST   /v1/prospecting-lists                      // Create a list
GET    /v1/prospecting-lists                       // List lists (owned + shared)
GET    /v1/prospecting-lists/:id                    // Get list details
PATCH  /v1/prospecting-lists/:id                    // Update name, description, shared
DELETE /v1/prospecting-lists/:id                    // Delete list (cascades to entries)

// Entry management
POST   /v1/prospecting-lists/:id/entries            // Add an author to the list
GET    /v1/prospecting-lists/:id/entries            // Paginated entries (limit default 50, max 200; cursor-based)
PATCH  /v1/prospecting-lists/:id/entries/:entryId   // Update stage, notes, tags, custom_attributes
DELETE /v1/prospecting-lists/:id/entries/:entryId   // Remove an author from the list

// Export & CRM handoff — contract owned by ADR-0117, reuses CRMConnector (ADR-0095)
GET    /v1/prospecting-lists/:id/export.csv
POST   /v1/prospecting-lists/:id/crm-handoff
```

### 5. Export is metadata-only by default
- Export and CRM push are metadata-only: no email, phone, or other private contact data is exposed unless the user explicitly put it in `notes`, and then only the tenant's own data.
- The exact export column set, CRM payload shape, and endpoint contracts (`GET .../export.csv`, `POST .../crm-handoff`) are authoritative in **ADR-0117**, which builds directly on this ADR's data model — this ADR states the PII policy those contracts must honor, not the wire shapes themselves.

---

## Consequences

**Positive**
1. **Lightweight social-selling feature:** the prospecting list builds on `Author`, `AuthorTopicSignal`, and the ADR-0108 scoring columns without duplicating them.
2. **Controlled collaboration:** sharing is explicit, owner-controlled, read-only for teammates, and limited to the tenant — no admin override, matching ADR-0044 §5c.
3. **Data integrity:** `UNIQUE (prospecting_list_id, author_id)` prevents duplicate outreach records and ambiguous CRM syncing.
4. **Immutable qualification context:** add-time score snapshots record why a lead was qualified, independent of later score drift.
5. **Foundation for CRM handoff:** the `crm-handoff` endpoint is scoped here; its wire contract and the `CRMConnector` it reuses are defined in ADR-0117 and ADR-0095 respectively.

**Trade-offs**
1. **No workflow engine v1:** `relationship_stage` is a manual label; changing it only touches `updated_at`. Audit trail and automated transitions are deferred to a future workflow-engine ADR alongside webhook automation.
2. **Denormalized score storage:** four `numeric(5,2)` columns per entry. Not bounded by a fixed list-size cap (see Open Questions) — bounded instead by cursor pagination on every read.

---

## Alternatives considered

1. **Reuse `watchlists` as prospecting lists.**
   - *Rejected:* `watchlists` are query-based and post-focused. Prospecting lists are author-focused and user-curated, with different fields and sharing rules.

2. **Store full author records inside `prospecting_list_entries`.**
   - *Rejected:* it duplicates `Author` and makes author-refresh harder. Only `author_id` is stored; live metadata is fetched from `Author`.

3. **Allow public/anonymous sharing of prospecting lists.**
   - *Rejected:* prospecting lists contain tenant strategy and PII risk. v1 keeps them strictly inside the tenant.

---

## Open Questions

- [x] **[Q-0086-1]** ~~Should `engagement_score`/`authenticity_score` be recomputed on demand or denormalized at add time?~~ **Resolved:** all four ADR-0108 scores (`engagement_score`, `authenticity_score`, `influence_score`, `reach_score`) are denormalized as an add-time snapshot, never recomputed in place.
- [x] **[Q-0086-2]** ~~~~Should `prospecting_list_entries` support custom fields per tenant?~~ **Resolved by ADR-0129:** `custom_attributes jsonb` and tenant-wide sharing rules locked.~~ **Resolved:** `custom_attributes jsonb`.
- [x] **[Q-0086-3]** ~~Should `relationship_stage` transitions be logged?~~ **Resolved:** deferred. v1 only touches `updated_at`; an audit trail arrives with the future workflow-engine ADR, not `platform_admin_audit_log` (that log is scoped to platform-admin actions elsewhere in this codebase — the analogous pattern for tenant-level outward actions is `outbound_activities`, per ADR-0073/ADR-0075/ADR-0095/ADR-0117).
- [ ] **[Q-0086-4]** **Is a maximum entries-per-list ceiling needed?** No fixed number is adopted here — inventing one without usage data would repeat the precedent ADR-0044 and ADR-0020 already declined for the analogous per-user watchlist-count question. `GET .../entries` is cursor-paginated (default 50, max 200) regardless; revisit with a real cap only once usage data justifies one.
- [x] **[Q-0086-5]** ~~Who may set `shared = true`, and what can non-owners do with a shared list?~~ **Resolved (2026-08-27):** owner-only, no `tenant_admin` override — true parity with ADR-0044 §5c. Sharing grants read-only visibility to teammates; only `owner_id` can mutate the list or its entries. See §2.

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/18-prospecting-list.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs:
  - `ADR-0004` — `Author` model (`docs/adr/0004-author-normalized-separately-from-post.md`)
  - `ADR-0007` — `AuthorTopicSignal` (`docs/adr/0007-author-topic-signal-minimal-v1.md`)
  - `ADR-0044` — watchlist ownership/sharing pattern (`docs/adr/0044-watchlist-api-design-and-database-schema-standardization.md`)
  - `ADR-0092` — author-initiated takedown / redaction, not deletion (`docs/adr/0092-author-initiated-takedown.md`)
  - `ADR-0108` — `Author` scoring columns (`docs/adr/0108-influencer-discovery-and-scoring.md`)
  - `ADR-0095` — `CRMConnector` (`docs/adr/0095-case-handoff-to-crm.md`)
  - `ADR-0117` — export/CRM-push contract, builds on this ADR (`docs/adr/0117-prospecting-list-export-and-crm-push.md`)

---

*Revised 2026-08-27 (pre-acceptance), second pass: fixed four fabricated footnote paths; dropped `author_id ON DELETE CASCADE` (its GDPR justification doesn't match ADR-0092's actual soft-redaction/no-author-deletion design) back to this codebase's existing no-cascade convention for `author_id` FKs; changed `owner_id`/`added_by_user_id` to `ON DELETE CASCADE` to match the `watchlists.user_id`/`connector_activations.user_id` precedent; dropped the invented 5,000-entry cap in favor of pagination-only, consistent with ADR-0044/ADR-0020's precedent against unjustified limits; added all four ADR-0108 score columns and `custom_attributes jsonb`.*

*Revised 2026-08-27 (pre-acceptance), third pass: resolved the `shared`-permission open question — owner-only toggle, no `tenant_admin` override, matching ADR-0044 §5c exactly; sharing now grants read-only visibility to teammates, with `INSERT`/`UPDATE`/`DELETE` restricted to `owner_id` at all times, enforced per-command via RLS. §2 rewritten accordingly; a non-owner mutation attempt on a shared resource now explicitly documented as `404`, not `403`, per ADR-0044 §2's existing convention.*

### Pending supersession note (2026-08-28)

If ADR-0129 (Proposed, 2026-08-28) is accepted, this ADR's Decision §2 would be refined by ADR-0129's own §1–§3 — specifically deduplicated Apollo/CRM export payloads and scoped team sharing permissions. This is a pending note only: ADR-0129 is currently Proposed, not accepted.