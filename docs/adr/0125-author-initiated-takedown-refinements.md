# ADR-0125: Author-initiated takedown refinements — SLA, risk-flagging, and redaction propagation scope

**Status:** Accepted (2026-08-28)

**Authorizes:** research-driven refinements to ADR-0092's author-initiated takedown flow: a default response SLA on `data_subject_requests`, an explicit CAPTCHA requirement on the public form, a human-reviewed (never auto-deciding) risk-flag field, and an explicit, enumerated list of derived tables a granted takedown must propagate into.

**Source:** `docs/product-research/feature-designs/14-author-initiated-takedown.md`, `docs/product-research/feature-adr-scoping.md`, and `C:/Users/menno/Documents/Second Brain/raw/14-author-initiated-takedown-deep-research.md` (Deep Research Brief — Author-Initiated Takedown, generated 2026-08-28)

---

## Relation to ADR-0092

ADR-0092 (Accepted 2026-08-28) is the accepted decision authorizing the `data_subject_requests` table, the public takedown form, the Grant/Deny/Escalate review flow, and the soft-redaction mechanics on `social_posts`. That Decision and its Consequences are a historical record and are not rewritten here — see ADR-0092 directly.

This ADR does **not** replace ADR-0092. It supersedes/refines four specific parts of it, each traced to a finding in the deep-research brief:

1. **Response SLA** — ADR-0092's Open Questions explicitly left "how long does a tenant have to respond" undecided. This ADR decides it: default to a 45-day SLA clock (CCPA's stricter reference point vs. GDPR's one month), starting at verified submission, not at review-queue pickup.
2. **CAPTCHA** — ADR-0092 Decision §2 says the form is "rate-limited to 3 submissions per IP per hour" but never mandates CAPTCHA; BRD-0092 only "recommends" it. This ADR makes CAPTCHA (or equivalent bot mitigation) a required v1 control, not a recommendation.
3. **Risk-scoring / manifestly-unfounded handling** — not present in ADR-0092 at all. This ADR adds an optional risk-flag surfaced to the human reviewer, explicitly forbidding any auto-deny or auto-grant path.
4. **Redaction propagation scope** — ADR-0092 Decision §3 names only `RAGConnector.deletePost()` and `post_watchlist_matches` cleanup. This ADR widens the enumerated propagation scope to include AI enrichment/sentiment and topic-cluster outputs stored in `social_posts.enrichment`, closing a gap the research brief identifies directly.

Everything else in ADR-0092 (the `data_subject_requests` schema, the public endpoint shape, the Grant/Deny/Escalate states, and the "takedown is not deletion from the source platform" framing) stands unchanged and is inherited by reference, not restated.

---

## Context

### 1. ADR-0092 left the response SLA as an open question
ADR-0092's own "Open questions" section asked: *"How long does a tenant have to respond before the request is auto-escalated or auto-granted?"* No default was set. The research brief (source #5, ZenGRC) gives a concrete, defensible number: CCPA's 45-day verifiable-consumer-request clock, which starts on the day the request is received (not when review begins), with confirmation of receipt required within 10 business days and any extension communicated within the original window. This is the stricter of the two major regimes SocialEngage cites (GDPR's one month vs. CCPA's 45 days), making it the safer default to loosen per-tenant later rather than the reverse.

### 2. CAPTCHA is table-stakes for public rights-request forms, not an enhancement
The research brief (source #3, Osano) confirms that pairing CAPTCHA with IP-based rate limiting is standard, not aspirational, practice among dedicated privacy-request tooling — public forms use both specifically to filter bot/junk submissions while staying account-free. ADR-0092's rate limit alone is a partial control; the brief's own "Implications" section (#2) states this explicitly should not slip past v1 given how central abuse-prevention is to every comparable public-facing DSR tool.

### 3. Regulators expect case-by-case reasoning for refusing a request, not silent auto-rejection
The research brief (source #2, ICO) establishes that a controller may treat a request as manifestly unfounded or excessive, but must assess case-by-case and be able to explain the reasoning to both the requester and the regulator if challenged. ADR-0092's Grant/Deny/Escalate flow already routes every decision through a human `Tenant-Admin`, which is compatible with this — but the feature design's own "risk scoring" AI-enhancement idea (referenced in the research brief but not decided anywhere) needs an explicit ADR-level guardrail before it is ever built: it must inform the reviewer, never replace them.

### 4. Redaction is a propagating operation, not a single-row update
The research brief's "Implications" §5 states this as the sharpest finding: an approved takedown must cascade into derived data, and "what tables are affected" was an open question in the source feature design. ADR-0092 Decision §3 names `RAGConnector.deletePost()` and `post_watchlist_matches` cleanup, but the project has since shipped AI enrichment (`social_posts.enrichment`, sentiment and topic-cluster outputs per ADR-0064/ADR-0071) that is derived directly from the now-redacted body text and is not named anywhere in ADR-0092's propagation list.

---

## Decision

### 1. Default 45-day response SLA, tenant-configurable
- `data_subject_requests` gains a computed `sla_due_at` value: `created_at` (i.e. the timestamp the request enters `status='received'` after magic-link verification, per ADR-0092 §2 — not submission time before verification) plus a default of **45 calendar days**.
- The 45-day default is a platform-wide default, overridable per tenant via the same tenant-settings mechanism used elsewhere in the admin app; a tenant may shorten it but not lengthen it past 45 days without an explicit, logged Platform-Admin override (mirrors the CCPA "extension must be communicated within the original window" norm — extension is possible, silent extension is not).
- `sla_due_at` is surfaced to the `Tenant-Admin` review UI (Story 10.14's `TrustAndComplianceView`) as a due-by date, and to the requester on the public status page.
- This does **not** introduce auto-escalation or auto-grant on SLA breach in v1 — that remains a named, explicitly deferred future item (unchanged from ADR-0092's own Open Questions), now with a concrete clock to measure breach against.

### 2. CAPTCHA is a required v1 control, not a recommendation
- `POST /public/v1/takedowns` must be protected by both the existing 3-submissions-per-IP-per-hour rate limit (ADR-0092 Decision §2, unchanged) **and** a CAPTCHA or equivalent bot-mitigation challenge (e.g. hCaptcha, Turnstile) before a submission is accepted for magic-link verification.
- This closes the gap between BRD-0092's "CAPTCHA recommended" language and ADR-0092's Decision, which never made it a requirement.

### 3. Optional risk-flag, routed to the human reviewer only — never auto-deciding
- `data_subject_requests` gains two nullable columns: `risk_flag boolean` and `risk_reason text`.
- Any future automated or heuristic risk assessment (the feature design's "risk scoring" idea) may populate these fields, but **must never** set `status` directly, trigger auto-deny, or trigger auto-grant. The fields are advisory metadata for the `Tenant-Admin`/`Legal-Advisor` reviewer only.
- When `risk_flag = true`, the review UI must surface `risk_reason` prominently next to the request, but the Grant/Deny/Escalate decision remains a human action exactly as ADR-0092 Decision §3 already requires.
- No risk-scoring model is authorized or built by this ADR — this section only constrains how one would be allowed to plug in later, per the ICO's case-by-case-reasoning requirement.

### 4. Redaction propagation scope, explicitly enumerated
On grant, in addition to ADR-0092 Decision §3's existing steps (soft-redact `social_posts.body_markdown`/`rawPayload`, trigger `RAGConnector.deletePost()`, clean up `post_watchlist_matches`), the redaction worker must also:
- Clear or mark-redacted any AI-derived output stored in `social_posts.enrichment` that was computed from the now-redacted body text (sentiment, topic-cluster assignment, and any other enrichment fields introduced by ADR-0064/ADR-0071 that derive from post content).
- Preserve non-content-derived enrichment metadata (e.g. `detectedLanguage`, `enrichment.override` audit trail per ADR-0071) only where it does not re-expose redacted content in derived form.
- This list is the authoritative "affected tables" answer ADR-0092 left open; any future derived-data feature that reads `social_posts.body_markdown` must add itself to this list as part of its own ADR, not silently assume redaction already covers it.

---

## Consequences

**Positive**
1. Closes ADR-0092's own named open question on response SLA with a defensible, regulator-aligned default.
2. Brings the public form's abuse-resistance in line with confirmed industry practice (CAPTCHA + rate limiting together, not rate limiting alone).
3. Gives any future risk-scoring feature a pre-built, regulator-compatible guardrail (advisory-only) before anyone is tempted to wire it to auto-decisions under time pressure.
4. Closes a real, live gap: AI-derived sentiment/topic outputs computed from redacted content were not being cleaned up.

**Negative**
1. `sla_due_at` and the risk-flag columns add two migrations and UI surface to an already-shipped Story 10.11/10.14 pair — this work only lands when this ADR's own story is built (ADR-0047 §2's implementation-status distinction applies).
2. Widening the redaction propagation list increases the blast radius (and testing surface) of the grant flow.
3. CAPTCHA adds a third-party dependency and a small amount of friction to a form ADR-0092 designed to be as frictionless as possible for a legitimate author.

---

## Alternatives considered

1. **Leave the SLA undecided and let each tenant set their own from a blank default.**
   - *Rejected:* an unset default risks silent non-compliance for tenants who never configure one; a concrete, research-grounded default is safer and remains overridable.

2. **Build the risk-scoring model now, in this ADR.**
   - *Rejected:* out of scope — the research brief only supports designing the *guardrail* (advisory-only, never auto-deciding), not committing to a specific model or scoring approach. Building the model itself is future work.

3. **Hard-delete redacted rows instead of widening the soft-redaction propagation list.**
   - *Rejected:* ADR-0092 Decision §3's rejection of hard deletion (referential integrity, audit continuity) still applies; the correct fix for the enrichment gap is propagation, not a different deletion strategy.

---

## Open Questions

- [ ] **[Q-0125-1]** Should `sla_due_at` breach ever trigger an automated reminder/escalation notification (not an automated decision) to the `Tenant-Admin`? Left open, consistent with ADR-0092's own unresolved auto-escalation question.
- [ ] **[Q-0125-2]** Should the risk-flag be visible to the requester, or only to the internal reviewer? Left open; default assumption is internal-only until decided.
- [ ] **[Q-0125-3]** Does a `restriction`-of-processing analog (see ADR-0126 §1 for the DSR portal's own restriction-type scoping decision) ever apply to a takedown request specifically, or does it always resolve to grant/deny/escalate? Deferred to ADR-0126, which owns the restriction-type question for the DSR surface; not re-decided here.

---

## Footnotes

- Supersedes/refines: `ADR-0092` (Accepted 2026-08-28) — see "Relation to ADR-0092" above for the exact scope of the refinement.
- Related feature design: `docs/product-research/feature-designs/14-author-initiated-takedown.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related deep research: `C:/Users/menno/Documents/Second Brain/raw/14-author-initiated-takedown-deep-research.md`
- Related ADRs: `ADR-0083` (RAG deletion sync), `ADR-0043` (tenant deletion/offboarding), `ADR-0031` (audit log), `ADR-0064`/`ADR-0071` (AI enrichment fields now in the redaction propagation scope), `ADR-0126` (DSR portal restriction-type scoping, same research theme)
