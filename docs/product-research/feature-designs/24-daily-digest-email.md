---
status: high-level
source: docs/project docs/Stakeholder Management/Feature-Persona-Acceptance-Mapping.md
created: 2026-08-23
---

# Daily digest email

### What it is

A scheduled email sent once per day to Tenant-Users and Tenant-Admins with an AI-generated summary of the tenant's mentions, sentiment, top topics, urgent alerts, and recommended actions. It is the email counterpart to the in-app dashboard.

### End-user benefits

- **Stay informed without logging in:** users get a quick morning briefing even when they are not in the app.
- **Prioritization:** the AI highlights the top 3–5 things that need attention.
- **Faster triage:** users can click through to the relevant inbox, dashboard, or alert view.
- **Habit-forming:** a daily email keeps the platform top-of-mind and drives engagement.

### Core details

- Sent once per day at a user-configured or tenant-configured time.
- Contains: mention volume, sentiment summary, top 3 topics, top 3 posts, open urgent alerts, and a short AI-generated narrative.
- Scoped to the user's accessible watchlists and connectors.
- Unsubscribe and frequency controls (daily, weekdays, off) are required.
- Uses the `real-time-alerts` and `dashboard` data as input.

### Implementation complexity

**Medium.** Requires a background job, email delivery, a template system, AI summary generation, and unsubscribe handling. The heavy part is reliable delivery and personalization.

### Growth and reach

A standard feature for social listening products. Improves activation and retention. Often a premium-tier feature.

---

## Technical design

- **Data flow:** scheduler triggers `dailyDigestJob` at configured time → `DailyDigestService` queries the tenant's aggregated data for the last 24h → `AIProviderConnector` generates a narrative and highlights → email template is rendered → email is sent via Azure Communication Services or SendGrid.
- **Component interactions:** `pg_cron` / Azure Function → `DailyDigestService` → `AIProviderConnector` → email provider.
- **REST/Service Bus contracts:** `GET /v1/me/digest-preferences`, `PATCH /v1/me/digest-preferences`. Email is out-of-band; no HTTP endpoint required for delivery.
- **Storage:** `user_digest_preferences` table with `frequency`, `time`, `timezone`, `last_sent_at`. `daily_digest_log` for tracking.
- **Security considerations:** Emails contain summary data only, not raw post bodies or PII. Unsubscribe links are unique and do not require authentication. Emails are tenant-scoped.

## Backend principles

- **Opt-in and configurable.** Users must explicitly enable the digest and choose frequency and time.
- **No raw content in email.** Summaries only; full posts require clicking through to the secure app.
- **Respectful delivery.** Handle bounces, unsubscribes, and timezone-aware scheduling.
- **Reliable and idempotent.** A user should not receive two digests for the same day.

## Frontend / UI principles

- **User flow:** user opens notification settings → toggles daily digest → selects time and timezone → sees a preview of the next email.
- **Component hierarchy:** `NotificationSettings` → `DigestPreferences` → `DigestPreview`.
- **State management:** Server state for preferences; local state for the preview.
- **Accessibility and responsive design:** Settings form is accessible; email template is readable on mobile and desktop.

## Open questions

- Should the digest be per user, per tenant, or both?
- Which email provider should be used, and how do we handle deliverability?
- Should the AI generate one narrative or multiple sections (volume, sentiment, topics, alerts)?
- Can the digest be sent in multiple languages?
- How do we prevent the digest from becoming spam if there are no meaningful updates?

## AI enhancements

- **Smart summarization:** the AI writes a concise, personalized summary based on the user's role and watchlists.
- **Action recommendations:** the AI suggests the next best action for each highlight, e.g., "Reply to this complaint within 2 hours."
- **Silence detection:** the AI suppresses the email when there is nothing notable to report.

## Persona acceptance

- **Tenant-User (primary):** receives a useful daily summary of their watchlists and can click into the app to act.
- **Tenant-Reader (primary):** can scan the email and understand the day's reputation state without logging in.
- **Tenant-Brand-Reputation-Manager (primary):** gets urgent alerts and crisis signals in the first section.
- **Tenant-Social-Care-Agent (secondary):** can see unresolved high-priority items in the digest.
- **Tenant-Admin (secondary):** can configure the default tenant digest settings for new users.
