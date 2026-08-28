# ADR-0123: Real-time alert rules and delivery — refinements

**Status:** Proposed (2026-08-28)

**Authorizes:** four additive refinements to ADR-0091's `alert_rules` engine and delivery model — rule-level noise exclusion, a hard per-rule daily alert cap alongside the existing cooldown, sensitivity-preset UX for threshold configuration, and a pre-save alert-volume preview — driven by competitive research across Brandwatch, Meltwater, Mention, and Sprout Social.

**Source:** `docs/product-research/feature-designs/09-real-time-alerts.md`, `docs/product-research/feature-adr-scoping.md`, and `docs/product-research/reports/09-real-time-alerts-deep-research.md` (generated 2026-08-28)

---

## Context

### 1. ADR-0091 is Accepted and its story is built
ADR-0091 (Accepted 2026-08-28) authorized the `alert_rules` data model, the `AlertEvaluationWorker`, and in-app/email/webhook delivery. Story 10.9 (backend) and Story 10.10 (frontend) are built and verified (`social-listening-core@fdb9bb8`, 2026-08-28). This ADR does not reopen that architecture — it is a refinement layer, informed by a deep research brief that was generated after ADR-0091's acceptance.

### 2. The research brief mostly confirms ADR-0091, with four concrete gaps
`docs/product-research/reports/09-real-time-alerts-deep-research.md` finds `real_time_alerts` has 11/12 "yes" support across competitors (second-most universally adopted feature after dashboards) and validates the core shape ADR-0091 already chose: a rule bound to a query/watchlist (confirmed against Brandwatch Signals), asynchronous event-driven evaluation, and a signed webhook payload already ahead of at least one real competitor (KWatch, TLS-only, no HMAC). It also surfaces four specific, low-cost gaps against Brandwatch, Meltwater, Mention, and Sprout Social that ADR-0091 left unaddressed.

### 3. ADR-0091's own Open Questions named some of this territory but did not decide it
ADR-0091's Open Questions asked "how are duplicate alert emails suppressed across a tenant?" and left alert-fatigue mitigation implicit in the cooldown mechanism alone. The research brief's Implications §1–§4 give concrete, evidence-backed answers to exactly that gap.

---

## Decision

This ADR **extends** ADR-0091's Decision. Everything in ADR-0091 §1 (`alert_rules` table shape), §2 (rule types and thresholds), §3 (evaluation trigger), §4 (delivery channels), and §6 (alert payload) carries forward unchanged except where explicitly modified below. See "Relation to ADR-0091" for the precise diff.

### 1. Rule-level noise exclusion — new `alert_rules` columns
```sql
ALTER TABLE alert_rules ADD COLUMN excluded_watchlist_ids uuid[] DEFAULT '{}';
ALTER TABLE alert_rules ADD COLUMN excluded_topic_ids text[] DEFAULT '{}';
```
- A rule's evaluation excludes any post that matches an entry in `excluded_watchlist_ids` or is tagged with a topic in `excluded_topic_ids`, even if it would otherwise satisfy the rule's own `threshold`.
- This lets a `Tenant-Admin` exclude a known, expected campaign or topic from a Signal-style rule without disabling the rule entirely — directly modeled on Brandwatch's "Rules" exclusion mechanism (research finding #2).
- Exclusions are evaluated before threshold evaluation, not as a post-hoc filter on already-stored `tenant_alerts` rows.

### 2. Hard per-rule daily cap — new `alert_rules` column
```sql
ALTER TABLE alert_rules ADD COLUMN max_alerts_per_day int DEFAULT 20;
```
- In addition to `cooldown_minutes` (ADR-0091 §5, unchanged), a rule may not produce more than `max_alerts_per_day` `tenant_alerts` rows in a rolling 24-hour window.
- Once the daily cap is reached, the rule stops firing until the window rolls forward; this is independent of and stricter than the cooldown, which only bounds the *gap* between individual fires, not the total count (research finding #4 — Mention's 20/day hard cap on Instant Mentions).
- The cap is per-rule, defaulting to 20 (matching the cited Mention default), and configurable per rule up to a platform-level ceiling to be set at implementation time.
- A rule that hits its daily cap surfaces a distinct `tenant_alerts` marker (e.g. a `capped` boolean on the day's summary) so `AlertsInboxView` can tell a user "this rule stopped firing today because it hit its cap" rather than silently going quiet.

### 3. Sensitivity presets — a UX layer over existing `threshold` fields
- `AlertRuleForm` (Story 10.10) gains a `sensitivity` selector with three presets — `fewer` | `balanced` | `more` — modeled on Meltwater's Fewer/Balanced/More pattern (research finding #5).
- Each preset maps to a pre-filled multiplier applied to the rule type's own `threshold` fields (e.g. for `volume`, `fewer` sets a higher `minPosts`; `more` sets a lower one) at rule-creation time. The mapping is a UI/API convenience only — it writes concrete numbers into the existing `threshold` JSONB shape from ADR-0091 §1/§2, it does not add a new evaluation code path.
- Advanced users can still edit the resulting numeric thresholds directly after a preset is applied; the preset is a starting point, not a locked mode.
- This is additive UX scope for Story 10.10's successor story (§ Epic 15 below), not a schema change.

### 4. Pre-save alert-volume preview — new endpoint
```
POST /v1/alert-rules/preview
```
- Accepts the same `type`/`threshold`/`watchlist_id` shape a rule would be created with, plus a `lookbackDays` parameter (default 7).
- Returns `{ estimatedAlertCount: number, lookbackDays: number }` — a backward-looking simulation of how many times this rule *would have* fired over the trailing window, computed by replaying the rule's evaluation logic against existing `SocialPostIngestedEvent`/`ConnectorHealthChangedEvent` history (or the equivalent stored post/health data) rather than live events.
- `AlertRuleForm` calls this endpoint on every threshold/sensitivity change (debounced) and shows "You would have received approximately N alerts in the last 7 days" before the user saves — directly modeled on Sprout Social's live-preview UX (research finding #6), and named by the research brief as "the single highest-leverage, lowest-cost UX change for the stated alert-fatigue problem."
- This is a read-only simulation endpoint; it creates no `alert_rules` or `tenant_alerts` rows.

### 5. Webhook payload and signing — reaffirmed, not changed
- ADR-0091 §4/§6's webhook payload shape (platform, watchlist, triggering post, author, sentiment, threshold crossed) and its HMAC-signing plan (per ADR-0092) are reaffirmed as already ahead of at least one real competitor (KWatch ships TLS-only, no payload signing — research finding #7). No change is made here; this is named explicitly so a future reviewer does not mistake silence for an oversight.

---

## Relation to ADR-0091

This ADR is a refinement of ADR-0091 (Accepted 2026-08-28), not a reversal of it. Specifically:

- **ADR-0091 §1** (`alert_rules` table) is extended, not replaced: two new nullable/defaulted columns (`excluded_watchlist_ids`, `excluded_topic_ids`, `max_alerts_per_day`) are added. Every existing column and constraint stands.
- **ADR-0091 §5** (cooldown and suppression) is extended: the daily cap in this ADR's §2 operates *alongside* `cooldown_minutes`, not instead of it. A rule must satisfy both the cooldown gap and the daily cap to fire.
- **ADR-0091 §2/§3/§4/§6** (rule types/thresholds, evaluation trigger, delivery channels, payload shape) are unaffected and carry forward exactly as decided.
- **New scope, no ADR-0091 precedent:** the `sensitivity` preset UX (§3) and the `POST /v1/alert-rules/preview` endpoint (§4) are net-new capabilities that ADR-0091 did not address at all — they answer ADR-0091's own Open Questions about alert-fatigue mitigation, rather than contradicting a prior decision.
- If this ADR is accepted, Story 10.9/10.10 (already Built) are **not** retroactively changed — per this series' convention (`docs/adr/README.md`'s row 6 / ADR-0047 §2), already-shipped code changes only when this ADR's own story (Epic 15, below) is actually built.

---

## Consequences

**Positive**
1. **Directly answers ADR-0091's own open alert-fatigue question** with three concrete, evidence-backed mechanisms (exclusion, daily cap, live preview) rather than leaving it to future guesswork.
2. **Lower operational noise** for tenants running rules against known, expected campaigns (exclusion) or naturally bursty topics (daily cap).
3. **Cheaper rule-creation UX** — sensitivity presets and live preview reduce the cognitive load of picking raw numeric thresholds, matching the market-standard pattern (Meltwater, Sprout Social).
4. **No architectural risk** — every change is additive (new columns, new endpoint, new UI affordance); nothing in ADR-0091's core derived/event-driven design is touched.

**Negative**
1. Two new `alert_rules` columns and one new read endpoint add a small amount of implementation and testing surface beyond what Story 10.9 already shipped.
2. The preview endpoint's "replay history" computation needs its own performance bound (a `lookbackDays` cap) so it cannot become an unbounded query — left for the implementing story to size against `*DailyCount` (ADR-0087) where available, falling back to raw event/post history otherwise.
3. Sensitivity-preset multipliers are a product/UX judgment call (what counts as "fewer" for a `sentiment` rule vs. a `volume` rule) that needs concrete default values chosen at implementation time — not fully specified by this ADR, which fixes the *mechanism* (a `sensitivity` field mapping to `threshold` numbers) but leaves the exact multiplier table to the implementing story.

---

## Alternatives considered

1. **Fold these changes directly into ADR-0091 as a dated Revision section instead of a new ADR.**
   - *Rejected:* ADR-0091 is Accepted and its story is Built; per `docs/adr/README.md`'s governance table, an Accepted ADR's Decision/Consequences text is a historical record that stays put. A genuinely new architectural surface (new columns, new endpoint) belongs in a new, still-Proposed ADR, with a Pending supersession note left on ADR-0091 itself.

2. **Make the daily cap the only new safeguard, skip exclusion and preview.**
   - *Rejected:* the research brief's Implications §1 and §4 both flag their respective mechanisms as low-cost and directly answering the stated alert-fatigue problem; shipping only one of the three would leave the other two named-but-unaddressed gaps in ADR-0091's own Open Questions.

3. **Make sensitivity presets a hard-coded three-value enum with no underlying numeric thresholds exposed.**
   - *Rejected:* ADR-0091 already lets advanced users set exact numbers; hiding that entirely behind a preset would be a regression for power users. The preset is a convenience default, not a replacement for direct threshold editing.

---

## Open questions

- What are the concrete per-rule-type sensitivity multipliers (`fewer`/`balanced`/`more`) for each of the five rule types? Deferred to the implementing story.
- What platform-level ceiling should bound a tenant-configurable `max_alerts_per_day`? Deferred to the implementing story.
- Should the preview endpoint's `lookbackDays` be user-adjustable, or fixed at 7 as a v1 default? Deferred to the implementing story.
- Should `Platform-Admin` have its own exclusion/cap defaults for platform-wide connector-health rules? Carried forward unresolved from ADR-0091's own Open Questions — still not decided here.

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/09-real-time-alerts.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Deep research brief: `docs/product-research/reports/09-real-time-alerts-deep-research.md` (generated 2026-08-28)
- Related ADRs: `ADR-0091` (Accepted 2026-08-28, the ADR this refines), `ADR-0012`/`ADR-0013` (events), `ADR-0044` (watchlists), `ADR-0087` (precomputed views, for preview-endpoint performance), `ADR-0092` (webhook signing convention)
