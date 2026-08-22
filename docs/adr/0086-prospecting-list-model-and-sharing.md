# ADR-0086: Prospecting list model and sharing

**Status:** Proposed (2026-08-23)

**Authorizes:** the `prospecting_lists` and `prospecting_list_entries` data model, sharing rules, and export/CRM-push contract for the social-selling use case.

**Source:** `docs/product-research/feature-designs/18-prospecting-list.md` and `docs/product-research/feature-adr-scoping.md`

---

## Context

### 1. Social selling needs a lightweight lead list
`docs/product-research/feature-designs/18-prospecting-list.md` describes a tenant-scoped list where a `Social-Selling-Strategist` can save, score, and annotate authors discovered through influencer discovery or topic analysis. The list supports outreach and CRM handoff.

### 2. The underlying author and score data already exists
`AuthorTopicSignal` and the `Author` table (ADR-0004, ADR-0007) already capture author metadata and topical relevance. The prospecting list is a thin layer of user-curated lists and notes on top of these existing tables.

### 3. Sharing and export are constrained by PII and platform terms
Prospecting lists must not store private contact information scraped from profiles. Only public author metadata is kept. Export to CSV and CRM push must be tenant-scoped and permission-gated.

---

## Decision

### 1. New `prospecting_lists` and `prospecting_list_entries` tables
```sql
prospecting_lists (
  id uuid,
  tenant_id uuid,
  owner_id uuid,
  name text,
  description text,
  shared boolean default false,       -- visible to other tenant users
  created_at timestamptz,
  updated_at timestamptz
);

prospecting_list_entries (
  id uuid,
  prospecting_list_id uuid,
  tenant_id uuid,
  author_id uuid,                     -- references Author
  platform_id text,
  topic text,                         -- why this author was flagged
  engagement_score number,
  authenticity_score number,
  relationship_stage text,            -- 'new' | 'contacted' | 'engaged' | 'converted' | 'passed'
  notes text,
  tags text[],
  added_by_user_id uuid,
  added_at timestamptz
);
```

### 2. RLS and ownership
- Both tables are `tenant_id`-scoped and RLS-protected.
- A list is visible to its `owner_id` and, if `shared = true`, to all `tenant_user`/`tenant_admin` in the same tenant.
- Only `tenant_admin` can set `shared = true`.
- `prospecting_list_entries` inherits the list's visibility; if the list is private, the entries are private.

### 3. Relationship stage is data, not workflow
`relationship_stage` is a user-managed label. v1 does not enforce workflow transitions, email automations, or follow-up reminders. Future features may add workflow.

### 4. Add and remove endpoints
```ts
POST   /v1/prospecting-lists
GET    /v1/prospecting-lists
PATCH  /v1/prospecting-lists/:id
DELETE /v1/prospecting-lists/:id

POST   /v1/prospecting-lists/:id/entries         // add an author
PATCH  /v1/prospecting-lists/:id/entries/:entryId
DELETE /v1/prospecting-lists/:id/entries/:entryId

POST   /v1/prospecting-lists/:id/export          // CSV
POST   /v1/prospecting-lists/:id/crm-handoff     // see ADR-0091 (CRM connector)
```

### 5. Export is metadata-only by default
- CSV export includes `author_id`, `platform_id`, `topic`, `engagement_score`, `authenticity_score`, `relationship_stage`, `notes`, `tags`, and a link to the author's public profile (if available).
- It does **not** include email, phone, or any other private contact data unless the user explicitly adds it to `notes`, and then only the tenant's own data.

---

## Consequences

1. **Lightweight social-selling feature:** the prospecting list builds on `Author` and `AuthorTopicSignal` without duplicating them.
2. **Controlled collaboration:** sharing is explicit and limited to the tenant.
3. **No workflow engine v1:** relationship stage is a label, reducing initial scope.
4. **Foundation for CRM handoff:** `POST .../crm-handoff` is defined here but relies on the future `CRMConnector` ADR.

---

## Alternatives considered

1. **Reuse `watchlists` as prospecting lists.**
   - *Rejected:* `watchlists` are query-based and post-focused. Prospecting lists are author-focused and user-curated, with different fields and sharing rules.

2. **Store full author records inside `prospecting_list_entries`.**
   - *Rejected:* it duplicates `Author` and makes author-refresh harder. Only `author_id` is stored; live metadata is fetched from `Author`.

3. **Allow public/anonymous sharing of prospecting lists.**
   - *Rejected:* prospecting lists contain tenant strategy and PII risk. v1 keeps them strictly inside the tenant.

---

## Open questions

- Should `engagement_score` and `authenticity_score` be recomputed on demand or denormalized at add time?
- Should `prospecting_list_entries` support custom fields per tenant?
- What is the maximum number of entries per list? Is pagination required in v1?
- Should `relationship_stage` transitions be logged in `platform_admin_audit_log` in the future?

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/18-prospecting-list.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0004` (`Author` model), `ADR-0007` (`AuthorTopicSignal`), `ADR-0044` (watchlist ownership pattern)
