---
status: high-level
source: docs/project docs/Stakeholder Management/Feature-Persona-Acceptance-Mapping.md
created: 2026-08-23
---

# Prospecting list

### What it is

A tenant-scoped list where a Social-Selling-Strategist can save, score, annotate, and export authors discovered through influencer discovery or topic analysis. The list supports outreach and relationship-building workflows.

### End-user benefits

- **Organized outreach:** keep track of high-value authors and leads in one place.
- **Prioritization:** rank prospects by relevance, engagement, authenticity, and relationship stage.
- **Team collaboration:** share lists within a tenant and add notes or tags.
- **CRM handoff:** export the list to CSV or push to a CRM through the API and integrations feature.

### Core details

- Create multiple named lists per tenant or per user.
- Add authors from influencer discovery, topic views, or search.
- Fields: author, topic, engagement score, authenticity score, relationship stage (`new`, `contacted`, `engaged`, `converted`, `passed`), notes, and tags.
- Export to CSV for manual outreach or to a connected CRM via webhook/API.
- RLS-scoped: lists can be private, shared within the tenant, or read-only for certain roles.

### Implementation complexity

**Low-to-medium.** A new `prospecting_lists` / `prospecting_list_entries` junction plus a UI. The hard part is the CRM integration and scoring model, which are already supported by other features.

### Growth and reach

Bridges the gap between listening/social selling and outbound. A common enterprise sales and PR use case.

---

## Technical design

- **Data flow:** user finds an author in `influencer-discovery` or `topic-center` → clicks "Add to prospecting list" → `POST /v1/prospecting-lists/:listId/entries` adds a row → list view shows aggregated authors with scores and notes → user exports or pushes to CRM.
- **Component interactions:** `ProspectingListPage` → `prospectingListStore` → `authors` / `author_topic_signals` → `outbound_activities` or webhook for CRM push.
- **REST/Service Bus contracts:** `POST /v1/prospecting-lists`, `GET /v1/prospecting-lists`, `POST /v1/prospecting-lists/:id/entries`, `DELETE /v1/prospecting-lists/:id/entries/:entryId`, `POST /v1/prospecting-lists/:id/export`. `ProspectAddedToCRMEvent` in v2.
- **Storage:** `prospecting_lists` and `prospecting_list_entries` tables, both tenant-scoped.
- **Security considerations:** Lists are strictly tenant-scoped. PII/contact hints (e.g., email) are not harvested automatically; only public metadata is stored.

## Backend principles

- **Tenant-scoped and shareable.** Lists belong to a tenant but can have an `owner_id` and `shared` flag.
- **Public metadata only.** Do not scrape or store private contact information without consent.
- **CRUD with optimistic locking.** Lists support concurrent editing; use the same pattern as `watchlist-crud` (ADR-0044).
- **Export-aware.** CSV/JSON export respects tenant and user permissions.

## Frontend / UI principles

- **User flow:** user discovers an author → clicks "Add to list" → selects existing or new list → opens list to review, score, and export.
- **Component hierarchy:** `ProspectingListPage` → `ProspectingListTable` → `AddToListButton` → `ProspectDetailDrawer` → `Export/PushToCRM` actions.
- **State management:** Server state for the list; local state for inline edits and filters.
- **Accessibility and responsive design:** Tables support keyboard sorting, screen-reader labels for score badges, and touch-friendly row actions.

## Open questions

- Should prospecting lists be private to a user, shared within a tenant, or both?
- Should the system store free-text notes and tags, or a structured relationship-stage field?
- Which CRMs should be supported in v1, or should the feature rely on generic CSV export?
- Should the AI recommend which stage a prospect is in based on engagement history?
- How do we prevent a list from being used to spam or scrape authors?

## AI enhancements

- **Stage recommendation:** the AI suggests a relationship stage based on the author's recent engagement and topic overlap.
- **Outreach message draft:** the AI writes a personalized first-contact message for each prospect.
- **Deduplication:** the AI flags when the same author appears on multiple lists.

## Persona acceptance

- **Social-Selling-Strategist (primary):** can create lists, add authors, rank them, and export for outreach.
- **Tenant-Business-Analyst (secondary):** can export list data and correlate it with sales or CRM data.
- **Tenant-User (secondary):** can view shared lists and add authors from search results.
- **Tenant-Admin (secondary):** can configure sharing and export permissions for lists.
