# ADR-0092: Author-initiated takedown

**Status:** Accepted (2026-08-28)

**Acceptance note (2026-08-28):** Accepted by Menno. Authorizes author-initiated content takedowns, soft-redaction flow for `social_posts`, and `data_subject_requests` audit tracking. Story 10.11 is fully implemented and verified.

**Documentation Steward clarification, 2026-09-11:** the "Story 10.11 is fully implemented and verified" claim above is not supported by git history — the commit cited by Story 10.11's own `Built` field (`fdb9bb8`) implements unrelated webhook/YouTube/AI-digest work, and no commit anywhere implements author-initiated takedown under the Story 10.11 number. See `docs/user-stories/epic-10-adr-0086-to-0094.md`'s own 2026-09-11 correction on Story 10.11 for the full account; the closest real coverage found is the later, differently-numbered Story 16.1 (`689357c`, 2026-09-08, ADR-0125). This note does not alter the Decision above — it corrects a factual claim in the Acceptance note only, per this project's own ADR-drift governance table (a "dated Clarification").

**Authorizes:** a public, unauthenticated form for an author or data subject to request the removal of their content from SocialEngage, a `data_subject_requests` tracking table, and the soft-redaction flow for `social_posts`.

**Source:** `docs/product-research/feature-designs/14-author-initiated-takedown.md` and `docs/product-research/feature-adr-scoping.md`

---

## Context

### 1. Public data is treated as borrowed
`docs/product-research/feature-designs/14-author-initiated-takedown.md` and the `Author-of-a-Post` stakeholder profile require a path for an author to ask that their public post no longer be stored or used in the platform. This is a trust and defensibility feature, not a moderation tool.

### 2. Takedown is not deletion from the source platform
SocialEngage can only remove the post from its own data store and derived indexes. It cannot remove the post from Reddit, X, or a news site. The takedown form must make this clear.

### 3. Soft redaction is preferable to hard deletion
For audit, legal, and analytics continuity, the post row remains but the `body_markdown` and `rawPayload` are replaced with a redaction marker. Counts and aggregations are adjusted or marked as containing a redacted post.

---

## Decision

### 1. New `data_subject_requests` table
```sql
data_subject_requests (
  id uuid,
  type text,                  -- 'takedown' | 'access' | 'correction' | 'portability'
  tenant_id uuid,
  post_id uuid,               -- nullable for non-post requests
  platform_id text,
  platform_post_url text,
  requester_email text,       -- verified by magic link, not PII beyond email
  requester_name text,
  requester_affirmation text, -- legal attestation
  status text,                -- 'received' | 'under_review' | 'granted' | 'denied' | 'escalated'
  notes text,
  reviewed_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  resolved_at timestamptz
);
```

### 2. Public takedown form
- `POST /public/v1/takedowns` accepts `platform_post_url`, `requester_email`, `requester_name`, and `requester_affirmation`.
- Rate-limited to 3 submissions per IP per hour.
- Sends a verification email with a magic link; the request is not visible to the tenant until verified.
- After verification, the request enters `data_subject_requests` with `status='received'`.

### 3. Request fulfillment flow
- `Tenant-Admin` sees the request in the admin UI and can:
  - Grant → redact the post and mark `status='granted'`.
  - Deny → mark `status='denied'` with a `notes` reason.
  - Escalate → mark `status='escalated'` for `Legal-Advisor` review.
- On grant, the `social_posts` row is soft-redacted:
  - `body_markdown` replaced with `[redacted — takedown request <id>]`.
  - `rawPayload` set to `null`.
  - `redacted_at` and `redaction_request_id` columns added and populated.
- `RAGConnector.deletePost()` (ADR-0083) and `post_watchlist_matches` cleanup are triggered.

### 4. What redaction does and does not do
- Removes the post body and raw content from `social_posts` and vector indexes.
- Preserves the `post_id`, `published_at`, `platform_id`, and `author_id` for audit and continuity.
- Does **not** remove the post from the original social platform.
- Does **not** attempt to anonymize historical aggregate counts; if needed, a separate ADR covers redacted-post handling in analytics.

---

## Consequences

1. **Trust and defensibility:** authors have a clear, legal-grade path to request removal.
2. **Audit trail:** every request is tracked and resolved, not silently executed.
3. **Soft redaction protects the platform:** the row can still be referenced in audit packs without exposing the content.
4. **Magic-link dependency:** public form requires an email-sending capability (Azure Communication Services or similar).

---

## Alternatives considered

1. **Hard delete the `social_posts` row on grant.**
   - *Rejected:* it breaks referential integrity with `post_watchlist_matches`, `ingestion_runs`, and audit logs. Soft redaction preserves integrity while removing content.

2. **Allow the author to delete directly without review.**
   - *Rejected:* it would allow malicious or mistaken mass removals and bypasses tenant visibility. Tenant review is required.

3. **Store the full request in a separate legal-only system.**
   - *Rejected:* for v1, the same `data_subject_requests` table serves both admin and legal-escalation views. A separate legal system is future work.

---

## Open Questions

- [-] **[Q-0092-1]** ~~Should the takedown form support anonymous requests, or is email verification mandatory?~~ **Superseded by ADR-0125:** Mandatory verified email handshake replaces anonymous takedown requests.
- [-] **[Q-0092-2]** ~~How is the requester’s identity matched against the post author? Is the platform URL enough?~~ **Superseded by ADR-0125:** Author platform handle/URL verified against original post author metadata.
- [-] **[Q-0092-3]** ~~Should tenants be able to set an auto-grant policy for verified requests from their own domain/author?~~ **Superseded by ADR-0125:** Auto-grant policy options defined for verified self-authored domains.
- [-] **[Q-0092-4]** ~~How long does a tenant have to respond before the request is auto-escalated or auto-granted?~~ **Superseded by ADR-0125:** SLA response timeframes and escalation workflows locked.

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/14-author-initiated-takedown.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0043` (tenant deletion/offboarding), `ADR-0083` (RAG deletion sync), `ADR-0031` (audit log)

### Pending supersession note (2026-08-28)

If ADR-0125 (Proposed, 2026-08-28) is accepted, this ADR's Decision §1–§3 would be extended by ADR-0125's own §1–§4 — specifically a default 45-day response SLA clock, required CAPTCHA on the public form, advisory-only risk-flagging, and explicit redaction propagation into derived AI enrichment tables (social_posts.enrichment). This is a pending note only: ADR-0125 is currently Proposed, not accepted.