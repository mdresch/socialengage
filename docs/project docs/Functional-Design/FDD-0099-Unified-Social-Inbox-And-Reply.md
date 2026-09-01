# Functional Design Document

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | FDD-0099 Unified Social Inbox and Reply — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0099-unified-social-inbox-and-reply.md, ../Business-Requirements/BRD-0099-Unified-Social-Inbox-And-Reply.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0099-unified-social-inbox-and-reply.md and the business requirements in BRD-0099-Unified-Social-Inbox-And-Reply.md into functional design for **Unified Social Inbox And Reply**.
Social listening currently surfaces matched posts through the `GET /v1/posts` feed, but there is no structured workflow for acting on those posts. Customer-care teams lack a single place to triage mentions, assign ownership, track resolution, and reply directly. This initiative introduces a **unified social inbox and reply capability** as a workflow layer over the existing post feed.

The proposed solution creates an `inbox_items` queue for every matched `(post, watchlist)` pair, adds triage states (priority, assignment, resolution, snooze), and lets authorized agents reply from inside the inbox by reusing the outbound-reply infrastructure already authorized by ADR-0073. The inbox becomes the primary surface for social care, reputation response, and team accountability.

Expected business value includes faster response times to public complaints, clear ownership and audit trail for every interaction, and a bridge from passive listening to active customer care.

---

### 2.2 Scope
**In scope:**
- A tenant-scoped `inbox_items` workflow queue derived from matching posts.
- Triage properties: priority, status, assigned user, notes, tags, and snooze.
- Inbox list and detail views with filtering, sorting, and bulk actions.
- Assignment, snooze, resolve, and update actions.
- Reply from the inbox that reuses the existing reply endpoint (ADR-0073).
- Default priority rules driven by sentiment and author reach.
- Automatic creation of inbox items on `IngestionPostMatchedEvent`.
- Automatic resolution handling when a post is redacted (ADR-0092).
- Role-based access and audit for all inbox actions.

**Out of scope:**
- Real-time WebSocket or push delivery for inbox updates (v1 uses list refresh; near-real-time updates are v2).
- New connector implementations beyond the existing `SocialConnector.reply?()` framework.
- AI-generated reply suggestions and tone adaptation (future enhancement).
- Separate DM-only queue; v1 provides one unified queue with filters.
- Configurable per-watchlist priority rules (v2).

## 3. Context and Background
See ADR Context.
Social listening currently surfaces matched posts through the `GET /v1/posts` feed, but there is no structured workflow for acting on those posts. Customer-care teams lack a single place to triage mentions, assign ownership, track resolution, and reply directly. This initiative introduces a **unified social inbox and reply capability** as a workflow layer over the existing post feed.

The proposed solution creates an `inbox_items` queue for every matched `(post, watchlist)` pair, adds triage states (priority, assignment, resolution, snooze), and lets authorized agents reply from inside the inbox by reusing the outbound-reply infrastructure already authorized by ADR-0073. The inbox becomes the primary surface for social care, reputation response, and team accountability.

Expected business value includes faster response times to public complaints, clear ownership and audit trail for every interaction, and a bridge from passive listening to active customer care.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Reduce average response time to high-priority social mentions | 90% of urgent/high-priority items assigned or resolved within SLA target |
| 2 | Improve accountability for social-care actions | Every inbox item shows current owner, status, and resolution history |
| 3 | Turn the post feed into an actionable care queue | Tenant agents can triage, assign, snooze, resolve, and reply without leaving the inbox |
| 4 | Maintain a defensible audit trail for replies | Each reply is linked to the original mention with actor and timestamp |
| 5 | Support safe team scaling | Concurrent edits, tenant isolation, and role-based access prevent cross-tenant actions |

---

**Positive consequences (from ADR):**
1. **Actionable workflow:** the inbox turns the post feed into a customer-care queue.
2. **Clear state model:** `priority`, `status`, and `assigned_to` support team triage.
3. **Reuses reply infrastructure:** the reply path is the same as `ADR-0073`.
4. **Data growth:** one row per match means `inbox_items` can grow quickly. Indexes and retention are required.

---

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall create an inbox item for each matched `(post, watchlist)` pair. | Must | Newly matched posts appear in the inbox within seconds of the match event. | Product Owner |
| BR-002 | The system shall derive a default priority for each inbox item. | Must | Urgent for negative sentiment + high reach, high for negative sentiment, normal otherwise. | Product Owner |
| BR-003 | The system shall allow users to manually override priority, status, assigned owner, notes, and tags. | Must | PATCH update succeeds and persists for authorized tenant users. | Product Owner |
| BR-004 | The system shall support assigning an inbox item to a tenant user. | Must | Assignment sets `assigned_to` and `assigned_at`; assignee can view and act on the item. | Product Owner |
| BR-005 | The system shall support snoozing an item until a future time. | Should | Snoozed items are hidden from default views until `snoozed_until` passes. | Product Owner |
| BR-006 | The system shall allow resolving an item with an optional note. | Must | Resolved items are marked with `resolved_at`, `resolved_by`, and status `resolved`. | Product Owner |
| BR-007 | The system shall let agents reply to a post from the inbox detail. | Must | Reply is stored as an outbound activity, linked to the parent post, and can auto-resolve the item. | Product Owner |
| BR-008 | The system shall list inbox items with filters for status, priority, assigned user, watchlist, and platform. | Must | `GET /v1/inbox` returns a tenant-scoped, filtered, sorted list. | Product Owner |
| BR-009 | The system shall sort the default inbox view by priority then creation time. | Should | Urgent items appear before older normal items. | Product Owner |
| BR-010 | The system shall support bulk actions: assign, resolve, snooze, and tag. | Could | User can select multiple items and apply an action in one step. | Product Owner |
| BR-011 | The system shall automatically resolve items when the parent post is redacted. | Must | Redaction event sets status to `resolved` with a redaction note. | Product Owner |

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Social-Care-Agent | Primary daily user | High | Single triaged queue, SLA timers, one-click reply and resolve |
| Tenant-User | End user of assigned conversations | High | Clear status, connector-specific reply options, audit trail |
| Tenant-Brand-Reputation-Manager | Routes high-risk mentions | Medium | Filter by priority, sentiment, reach; escalate and coordinate response |
| Tenant-Admin | Configures workflows and permissions | Medium | Configure queues and permissions without code changes |
| Product Owner / Technical Lead | Sponsor and owner | High | Maintainable architecture, clear scope, reuse of existing outbound infrastructure |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 11.9 | epic-11-adr-0095-to-0100.md | As backend engineer, I want `inbox_items`, triage state, and `POST /v1/inbox/:id/reply`, so that `Tenant-Social-Care-Agent` can manage and respond to matched... | `inbox_items` table with `priority`, `status`, `assigned_to`, `snoozed_until`, `notes`, and `tags`.; `GET /v1/inbox` supports filters for status, priority, a... |
| Story 11.10 | epic-11-adr-0095-to-0100.md | As `Tenant-Social-Care-Agent`, I want an inbox with filters, priority, assignment, and a reply composer, so that I can triage and respond to mentions efficie... | `InboxView` with filter chips, sort by priority, and bulk actions.; `InboxItemDetail` shows the post, notes, tags, and a reply composer.; Users can assign, s... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| Inbox item workflow state | `priority`, `status`, `assigned_to`, `notes`, `tags`, `snoozed_until`, `resolved_at`, `resolved_by` | Derived from `IngestionPostMatchedEvent` and user actions | Tenant | Business / operational |
| Parent post metadata | Author, platform, content, sentiment, reach | `social_posts` | Tenant | Public/social data; may contain personal data depending on platform |
| Assignment history | Who was assigned, when, and by whom | Derived from `inbox_items` update events | Tenant | Internal operational |
| Reply activity | Outbound reply content and outcome | `outbound_activities` via ADR-0073 | Tenant | Business / operational; may contain personal data |
| Resolution reason | `notes` or `resolution_note` explaining closure | User input | Tenant | Internal operational |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | One `inbox_item` is created per matching `post_watchlist_match` in v1. |
| BRU-002 | Default priority is: `urgent` if negative sentiment and high author reach; `high` if negative sentiment; `normal` otherwise. |
| BRU-003 | Manual priority, status, owner, notes, and tags always override defaults. |
| BRU-004 | A successful reply from the inbox may automatically resolve the item unless the user opts out. |
| BRU-005 | A redacted parent post resolves all related inbox items with a redaction note. |
| BRU-006 | Inbox actions are restricted to users of the same tenant and appropriate role. |
| BRU-007 | Replies are only possible for connectors that support `SocialConnector.reply?()`. |
| BRU-008 | Snoozed items remain hidden from default open queues until the snooze time expires. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0073 outbound reply (`SocialConnector.reply?()`, `POST /v1/posts/:id/replies`) | Internal / Architectural | Technical Lead | Already accepted; must be in place before inbox reply ships. |
| D-002 | ADR-0092 takedown/redaction handling | Internal / Architectural | Technical Lead | Already accepted; defines redact-to-resolve behavior. |
| D-003 | ADR-0044 watchlist matching and `post_watchlist_match` | Internal / Architectural | Technical Lead | Already accepted; source of `IngestionPostMatchedEvent`. |
| D-004 | `GET /v1/posts` and existing post metadata | Internal / Existing | Technical Lead | Already built. |
| D-005 | Tenant identity, RLS, and role gating | Internal / Existing | Technical Lead | Already enforced. |
| D-006 | v2 research on SLA alerting and real-time updates | Future | Product Owner | Post-v1. |

---

- The existing `GET /v1/posts` feed, `outbound_activities`, and `SocialConnector.reply?()` infrastructure (ADR-0073) are in place.
- Multi-tenant RLS and identity resolution are already enforced.
- Watchlist matching already emits `IngestionPostMatchedEvent`.
- At least Facebook Pages and X support reply in v1; unsupported connectors fail gracefully.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Inbox list loads within 2 seconds for 95th percentile under normal load. | Performance | Must | Measured in contract and production monitoring. |
| NFR-002 | Inbox data is strictly tenant-scoped; no cross-tenant reads or writes. | Security | Must | Verified by RLS policy and contract tests. |
| NFR-003 | Inbox actions are auditable (who, when, what changed). | Compliance | Must | Every status/priority/assignment/reply records actor and timestamp. |
| NFR-004 | The feature remains available when a reply connector is unavailable. | Reliability | Should | Reply failures are recorded; inbox can still triage and assign. |
| NFR-005 | Inbox UI supports keyboard navigation, focus management, and screen-reader announcements. | Accessibility | Should | Passes WCAG 2.1 AA contract checks for the list and composer. |
| NFR-006 | Table growth and query patterns must be supportable with indexing and retention. | Scalability | Should | Contract suite validates query plans and retention path. |

---

## 11. Error Handling and Exceptions
1. **Actionable workflow:** the inbox turns the post feed into a customer-care queue.
2. **Clear state model:** `priority`, `status`, and `assigned_to` support team triage.
3. **Reuses reply infrastructure:** the reply path is the same as `ADR-0073`.
4. **Data growth:** one row per match means `inbox_items` can grow quickly. Indexes and retention are required.

---

## 12. Assumptions and Dependencies
- The existing `GET /v1/posts` feed, `outbound_activities`, and `SocialConnector.reply?()` infrastructure (ADR-0073) are in place.
- Multi-tenant RLS and identity resolution are already enforced.
- Watchlist matching already emits `IngestionPostMatchedEvent`.
- At least Facebook Pages and X support reply in v1; unsupported connectors fail gracefully.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | `inbox_items` table grows rapidly, degrading list performance. | Medium | High | Add indexes, partitioning plan, and retention/archival policy aligned with data-retention ADRs. | Technical Lead |
| R-002 | Concurrent edits by multiple agents cause lost updates. | Medium | Medium | Use tenant-scoped writes and `updated_at` checks; document concurrency model before v1 ship. | Technical Lead |
| R-003 | Reply is unsupported or fails for many connectors, frustrating agents. | Medium | Medium | Disable reply where `reply?()` is not supported; clear error messages; defer immature platforms. | Product Owner |
| R-004 | SLA alerting is over-promised in v1. | Low | Medium | v1 exposes metrics and manual triage; automated SLA alerts are deferred to v2. | Product Owner |
| R-005 | Agents adopt slowly without training. | Medium | Medium | Provide in-product filter chips, status legend, and help text; document workflow. | Product Owner |

---

## 14. Appendix
- ADR: `../../adr/0099-unified-social-inbox-and-reply.md`
- BRD: `../Business-Requirements/BRD-0099-Unified-Social-Inbox-And-Reply.md`
- Feature design: `docs/product-research/feature-designs/06-unified-social-inbox.md``
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above

> **Technical Revision (2026-08-28):** Added WebSocket presence payload schema and collision detection lock endpoint contracts.