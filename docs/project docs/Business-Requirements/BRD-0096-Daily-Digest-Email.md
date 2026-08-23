# BRD-0096: Daily Digest Email

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | Daily Digest Email — Business Requirements Document |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno (Business Sponsor / Product Owner / Technical Lead) |
| Status | Draft for Review — ADR-0096 is currently Proposed and may change |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | BRD Writer Agent | Initial draft derived from ADR-0096, feature design, and Epic 11 stories |

---

## 2. Executive Summary

Many tenant users do not log into the SocialEngage application every day, yet they still need a quick, reliable pulse on their brand, watchlists, and urgent reputation signals. The Daily Digest Email initiative proposes a single, timezone-aware email sent once per day that summarizes the previous 24 hours of watchlist activity — mention volume, sentiment, top topics, top platforms, and notable posts — using the precomputed analytics views already established under ADR-0087.

The digest is configurable per user. Each user can choose the send time in their local timezone, select which watchlists to include, and decide whether to include an optional AI-generated narrative. A one-off preview endpoint lets users see what the email will look like before enabling it. Delivery is handled through Azure Communication Services or a tenant-configured SMTP relay.

This feature primarily serves `Tenant-Reader` and `Tenant-Brand-Reputation-Manager` personas, keeping the platform top-of-mind and driving re-engagement without requiring users to open the application. It also creates a foundation for more advanced AI-driven summaries tied to ADR-0084 `ask`.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Increase daily re-engagement of tenant users who do not log in | Share of enabled users opening the digest email weekly exceeds 60% within six months of release |
| 2 | Reduce time to identify urgent reputation events | Users can identify a critical item from the email within 30 seconds of scanning the subject and first section |
| 3 | Improve retention and platform habit formation | Weekly active user retention improves by a measurable baseline lift within one quarter |
| 4 | Monetize engagement as a premium-tier feature | Digest usage and satisfaction support a future premium packaging decision |

---

## 4. Scope

### 4.1 In Scope

- Per-user `user_digest_preferences` storage with send time, timezone, watchlists, content toggles, and last-sent tracking
- Hourly digest scheduler that determines which users are due based on their local `send_at_utc`
- Generation of a daily 24-hour summary including total mentions, sentiment breakdown, top topics, top platforms, and notable posts
- Optional, bounded AI summary of notable posts (one call per user per day)
- Email rendering in plain text and HTML with the subject pattern `"<tenant> daily digest — <date>"`
- Email delivery via Azure Communication Services or a tenant-configured SMTP relay
- `POST /v1/users/me/digest-preferences` to configure preferences
- `POST /v1/users/me/digest-previews` to request a one-off preview
- Timezone-aware scheduling and idempotent send behavior (no duplicate daily email)
- Rate limiting to protect email provider quotas

### 4.2 Out of Scope

- Real-time notifications for every mention (already covered by ADR-0091 alerts)
- Generating the digest on demand when the recipient opens the email
- Direct scans of `social_posts` for aggregation; all digest data is sourced from precomputed views
- Multi-language email generation and per-tenant default digest configuration in v1
- Subscription of other users to a digest by an admin

### 4.3 Assumptions

- ADR-0087 precomputed `*DailyCount` analytics tables are available and populated
- The tenant or platform has a configured email provider (Azure Communication Services or SMTP)
- Users have at least one accessible watchlist or an explicit watchlist selection
- Email clients can receive and render HTML email

### 4.4 Constraints

- Ongoing email cost scales with the number of active, opted-in users
- AI summary must be cost-capped at one generation per user per day
- Email content must not contain raw post bodies or personally identifiable information
- Delivery must respect email provider rate limits and unsubscribe expectations

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Reader | Primary recipient | High | Receives a scannable morning summary of watchlist activity |
| Tenant-Brand-Reputation-Manager | Primary recipient | High | Sees urgent alerts and crisis signals near the top of the email |
| Tenant-Social-Care-Agent | Secondary recipient | Medium | Can identify unresolved high-priority items requiring triage |
| Tenant-Admin | Secondary stakeholder | Medium | Can influence default settings and understand email costs |
| Product Owner | Business owner | High | Clear engagement and retention lift without excessive cost |
| Backend Engineering | Implementation owner | High | Reliable scheduler, idempotent sends, and bounded AI calls |
| Frontend Engineering | UI owner | Medium | Intuitive preferences and preview experience |

---

## 6. Current State (As-Is)

Users must log into the SocialEngage web application to view mentions, sentiment, top topics, and watchlist activity. There is no out-of-app summary or push-style communication that brings key insights to users without their active participation.

**Pain points:**
- Users who do not log in daily can miss urgent brand or reputational events
- There is no habit-forming touchpoint to keep the platform top-of-mind
- Brand managers and social-care agents must manually scan the dashboard to find notable posts
- Morning triage is delayed by the need to open the app, navigate watchlists, and read through individual posts

---

## 7. Future State (To-Be)

A user who opts in to the digest chooses a local send time and timezone, selects the watchlists to include, and toggles which content sections to receive. An hourly background scheduler evaluates `user_digest_preferences` for users whose local `send_at_utc` has passed and whose `last_sent_at` is older than 20 hours. For each qualifying user, the system generates a digest for the previous 24-hour window ending at that scheduled time.

**Expected capabilities:**
- Users receive a single, personalized email at their chosen morning time
- The email shows total mentions, sentiment counts, top topics, top platforms, and a short list of notable posts
- An optional AI summary gives a brief narrative of the most important highlights
- Users can preview the email before enabling it
- The digest is suppressed or delivered only when there is meaningful activity to report
- One-click entry points lead the recipient back into the relevant app views

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall allow a user to enable or disable the daily digest email | Must | Toggle is persisted and honored by the scheduler | Product Owner |
| BR-002 | The system shall let a user set a send time, timezone, and watchlist scope for the digest | Must | Preferences are validated, timezone-corrected, and used by the scheduler | Product Owner |
| BR-003 | The system shall generate a 24-hour summary using precomputed `*DailyCount` analytics tables | Must | Digest uses ADR-0087 views for total mentions, sentiment, and top topics | Backend Engineering |
| BR-004 | The system shall include up to five notable posts scoped to the user's watchlists | Must | Notable posts are selected by reach or engagement and rendered as excerpts | Backend Engineering |
| BR-005 | The system shall optionally include an AI-generated summary when enabled | Should | One AI call is made per user per day and may be omitted if no notable posts | Backend Engineering |
| BR-006 | The system shall send the digest via Azure Communication Services or a tenant-configured SMTP relay | Must | Email is delivered in both plain text and HTML formats | Backend Engineering |
| BR-007 | The system shall provide a one-off preview of the digest without scheduling it | Should | `POST /v1/users/me/digest-previews` returns rendered content for review | Product Owner |
| BR-008 | The system shall support unsubscribe or disable links in the email | Must | Recipients can stop the digest without logging into the app | Product Owner |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | The scheduler shall complete an hourly sweep within one minute | Performance | Should | Measured in production over a 30-day window |
| NFR-002 | Digest data shall be scoped to the recipient's accessible watchlists and tenant | Security | Must | Unauthorized watchlists are never included in the email |
| NFR-003 | No two digests shall be sent for the same user on the same day | Reliability | Must | Duplicate send rate is zero for a 30-day sample |
| NFR-004 | AI summary calls shall not exceed one per enabled user per day | Scalability | Must | Verified by quota tracking and monitoring |
| NFR-005 | Email content must render on mobile and desktop clients | Usability | Should | Tested in common email clients |
| NFR-006 | The feature shall be opt-in and respect unsubscribe requests | Compliance | Must | Unsubscribe mechanism is functional and auditable |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | A user must explicitly opt in to the daily digest before any email is sent |
| BRU-002 | The digest is sent at most once per day per user at the configured local time |
| BRU-003 | An empty `watchlist_ids` array means all watchlists the user owns or can see |
| BRU-004 | The AI summary is generated only if `include_ai_summary` is true and notable posts exist |
| BRU-005 | Notable posts are capped at five per digest |
| BRU-006 | Each digest is scoped to a single tenant and the user's authorized watchlists |
| BRU-007 | Email bodies contain excerpts and summaries only; raw post content and PII are excluded |
| BRU-008 | Hourly delivery is rate-limited to avoid email provider quota exhaustion |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| user_digest_preferences | Stores user send time, timezone, watchlists, content toggles, and last sent timestamp | New table | Backend | User preference data |
| *DailyCount tables | Precomputed daily aggregates for mentions, sentiment, topics, and platforms | ADR-0087 analytics | Backend | Tenant analytics data |
| notable posts | Top 1–5 posts by reach or engagement from the user's watchlists | social_posts and match tables | Backend | Tenant content excerpts |
| daily_digest_log | Tracking of send attempts, successes, and failures | New table | Backend | Operational telemetry |
| ai_summary | Optional one-paragraph narrative generated from notable posts | AI provider | Backend | Tenant content summary |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Daily digest send volume | Track delivery scale and cost | Product Owner | Daily |
| Digest open/click rates (if trackable) | Measure engagement | Product Owner | Weekly |
| Opt-in and opt-out rates | Understand user adoption | Product Owner | Weekly |
| AI summary usage | Track AI cost and value | Product Owner | Weekly |
| Send failure and bounce rate | Monitor deliverability | Backend Engineering | Daily |
| Hourly recipient queue size | Observe scheduler pressure | Backend Engineering | Real-time |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Email delivery costs grow with every opted-in user | High | Medium | Keep the feature opt-in and rate-limited; monitor volume and cost daily | Product Owner |
| R-002 | Emails are marked as spam or ignored, damaging sender reputation | Medium | High | Provide unsubscribe, suppress low-value sends, and use a reputable email provider | Product Owner |
| R-003 | Timezone and scheduling errors cause missed or duplicate sends | Medium | High | Store `send_at_utc` per user, guard `last_sent_at`, and test across timezones | Backend Engineering |
| R-004 | Low adoption makes the feature not worth the cost | Medium | Medium | Measure preview usage and opt-in conversion; promote the value in onboarding | Product Owner |
| R-005 | AI summary is inaccurate or adds cost without value | Medium | Medium | Bound AI calls to one per user per day and make the section optional | Backend Engineering |
| R-006 | Email provider rate limits delay or block delivery | Medium | High | Implement hourly recipient caps and retry/back-off logic | Backend Engineering |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0087 — Preconfigured analytics views | Internal | Backend Engineering | Available at implementation start |
| D-002 | ADR-0091 — Alert rules | Internal | Product Owner | Alerts inform urgency signals in the digest |
| D-003 | ADR-0084 — RAG `ask` | Internal | Product Owner | Future enhancement for richer AI summaries |
| D-004 | Azure Communication Services or tenant SMTP relay | External / Platform | Backend Engineering | Configured before delivery testing |
| D-005 | Digest scheduler runtime (`pg_cron` or Azure Function) | Internal | Backend Engineering | Available in target environment |
| D-006 | Story 11.3 — Daily digest email backend | Internal | Backend Engineering | Ready |
| D-007 | Story 11.4 — Daily digest email UI | Internal | Frontend Engineering | Ready (depends on 11.3) |

---

## 14. Acceptance Criteria

- A user can enable the digest, set a local send time, and select watchlists and content sections
- The scheduler triggers once per hour and identifies users whose send time has passed and who have not already received a digest in the past 20 hours
- Each generated digest reflects the previous 24-hour window and uses precomputed analytics views
- The email includes total mentions, sentiment breakdown, top topics, top platforms, and up to five notable posts
- The optional AI summary is generated at most once per user per day and can be disabled
- The email is delivered in plain text and HTML with the correct tenant and date in the subject
- A one-off preview endpoint returns the same rendered content without scheduling or sending an email
- Delivery is rate-limited and duplicate sends for the same day are prevented

---

## 15. Glossary

| Term | Definition |
|---|---|
| Daily digest | A single email sent once per day summarizing the prior 24 hours of a user's watchlist activity |
| Notable post | A high-reach or high-engagement post selected from the user's watchlists for inclusion in the digest |
| Precomputed analytics views | Aggregated daily tables (`*DailyCount`) produced by ADR-0087 for fast reporting |
| AI summary | A short narrative generated by `AIProviderConnector.research()` from notable post snippets |
| Tenant-Reader | A persona that monitors watchlists without needing full administrative rights |
| Tenant-Brand-Reputation-Manager | A persona focused on identifying urgent brand and reputation signals |

---

## 16. Appendices

### Reference documents

- ADR-0096 — Daily digest email (`docs/adr/0096-daily-digest-email.md`) — Proposed
- Feature design — Daily digest email (`docs/product-research/feature-designs/24-daily-digest-email.md`)
- Epic 11 — Engagement, workflow, and composer (`docs/user-stories/epic-11-adr-0095-to-0100.md`)

### Missing source materials

- No `docs/product-research/reports/<feature>-deep-research.md` file was found for the daily digest feature.

### Related user stories

- **Story 11.3 — Daily digest email (backend)**
  - Source: ADR-0096
  - Status: Ready
  - Key acceptance criteria: `user_digest_preferences` table, hourly scheduler, `*DailyCount` aggregation, bounded AI summary, email delivery, and one-off preview

- **Story 11.4 — Daily digest email UI (frontend)**
  - Source: ADR-0096
  - Status: Ready (depends on Story 11.3)
  - Key acceptance criteria: `DigestPreferencesView`, preview, timezone conversion, and enable/disable toggle

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
