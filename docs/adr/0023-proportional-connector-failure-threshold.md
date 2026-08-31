# ADR-0023: Proportional (rate-relative) connector failure threshold for auto-disable

**Status:** Accepted (2026-07-29) — see Acceptance note below
**Source:** Not specified in the design spec, which explicitly names its own threshold a placeholder (§5: "10 consecutive failures used as a placeholder above"; §10 lists it as an open question). Expanded on in a third-party architectural review. This ADR originates the policy; it does not document a prior decision.
**Relationship to existing ADRs:** **partially supersedes** the `failing` derivation rule in ADR-0009's Decision and the auto-disable threshold in ADR-0010's Decision — specifically and only the flat "≥10 failures/hour" rule each currently states. Nothing else in either ADR is affected (see the "Supersession update" note each of those ADRs now carries). This is a partial, single-rule supersession, not a replacement of either ADR as a whole. It also does not retroactively change already-shipped code: Stories 2.3 and 4.3 were built and passed their contracts against the flat rule before this ADR was accepted — their code and contracts stay as shipped until Story 2.5 (this ADR's own story) is actually picked up and built, which is when the flat-rule implementation actually gets healed to match. See `docs/user-stories/README.md`'s "Known cross-story conflict" note.
**Acceptance note:** accepted with 50% / 5-attempt floor / 20-consecutive kept as the launch defaults — not derived from real data, but neither was the flat "10/hour" placeholder they replace, and this rule is structurally better-reasoned (it explicitly handles the low-volume-noise case the flat rule doesn't). Tune later once real connector traffic exists, logged in the Amendment Log, same treatment as ADR-0017's deprecation window and ADR-0018's retention numbers. Varying the threshold by `deliveryMode` (push vs. poll) is deferred, not resolved: both connectors currently on the roadmap (RSS/News, Reddit) are poll-mode, and push-mode isn't scheduled until later platforms — solving it now would mean designing against a connector type that doesn't exist yet. Logged as a known gap, not a blocker.

## Context

ADR-0009 derives `failing` status as "≥10 failed `IngestionRun`s within the last hour" — a flat absolute count, explicitly carried over from the spec's own placeholder. This number doesn't account for how differently connectors are actually invoked: a platform polled every couple of minutes and a platform polled hourly both accumulate runs at very different rates, so a flat count-per-hour conflates two very different situations — 10 failures out of 10 attempts (100% failure, clearly broken) and 10 failures out of 200 attempts (5% failure, probably a transient blip) would trigger identically.

## Decision

**The durable decision — this is what would need superseding, not just amending:**

Auto-disable is triggered by failure *rate* relative to actual attempt volume for that `(tenantId, platformId)` pair within the evaluation window, not a flat absolute count — so connectors invoked at very different frequencies aren't held to the same absolute threshold. A minimum attempt-count floor applies alongside the rate threshold, so a connector with very few attempts in the window doesn't trigger off statistical noise (e.g., 1 failure out of 2 attempts looking identical to 100% failure on a high-volume connector). A separate absolute ceiling still applies regardless of rate, so a persistently broken low-frequency connector (one that fails every single time it runs, but only runs a handful of times an hour) still gets caught within a bounded time, rather than needing an implausibly long window to accumulate enough attempts to trip a purely rate-based rule.

**Implementation defaults (adjustable — see Amendment Log; does not require superseding this ADR on its own):**

- Evaluation window: **1 hour**, unchanged from ADR-0009's existing base unit.
- Rate threshold: `failing` when **≥50%** of attempts in the window failed, **and** at least **5 attempts** occurred in the window (the floor, to avoid a single failed attempt on a low-frequency connector reading as "100% failure").
- Absolute ceiling: `failing` when **≥20 consecutive failures** have occurred, regardless of rate or the 1-hour window — catches a connector that's broken on every run but polls infrequently enough that it wouldn't otherwise hit the attempt floor within an hour.
- `degraded` (ADR-0009's existing intermediate state) continues to mean "some recent failures, but a successful run within the last hour" — unchanged by this ADR.

## Consequences

**Positive**
- A connector polled every few minutes and one polled hourly are now judged by comparable standards (failure *rate*, not absolute count), removing an unfairness the flat threshold had by construction.
- The attempt-count floor prevents a low-frequency, low-sample-size connector from being disabled off noise (e.g., one bad poll out of two).
- The absolute ceiling preserves the original intent of the placeholder threshold — genuinely broken connectors still get caught — for the specific case a pure percentage rule would handle poorly (very low attempt volume).

**Negative**
- Materially more complex than a flat count: `ConnectorHealth`'s derivation (ADR-0009) now needs both attempt count and failure count per window, not just a failure count, and two threshold rules instead of one.
- Three numbers (50%, 5-attempt floor, 20 consecutive) are this ADR's own estimates, not derived from real failure-pattern data across actual connectors — likely need tuning once real tenant/platform traffic exists.
- Changes what `ConnectorHealth`'s `failing` derivation actually computes (ADR-0009's Decision text describes the old flat rule) — this ADR should be read alongside ADR-0009, not in isolation; ADR-0009 itself isn't edited, per this series' convention of not rewriting an Accepted ADR's original text (see README governance conventions).

## Alternatives Considered

- **Keep the flat 10-failures/hour count** — status quo (the spec's own placeholder); rejected for the reason above: it doesn't distinguish a fast-polling connector's blip from a slow-polling connector's persistent failure.
- **Pure percentage, no attempt-count floor** — closer to "true" rate-based judgment, but rejected because a connector with very few attempts (e.g., 1 attempt, 1 failure = 100%) would look indistinguishable from a genuinely broken high-volume connector and trigger too eagerly.
- **Percentage only, no absolute ceiling** — rejected because a connector that fails every single time but only attempts a handful of times per hour could take a long time to accumulate the attempt-count floor, delaying detection of an outright-broken connector well beyond what the original flat-count rule would have caught.

## Open questions for decision

- ~~Are 50% / 5-attempt floor / 20-consecutive the right numbers? These need real traffic data to validate, more than any other threshold in this series.~~ **Resolved at acceptance:** accepted as the launch defaults — structurally better-reasoned than the flat placeholder they replace even without real data yet; tune later once real connector traffic exists.
- ~~Should the rate threshold vary further by connector `deliveryMode` (ADR-0002) — e.g., should push-mode connectors, which don't "attempt" in the same sense as poll-mode ones, use a different rule entirely?~~ **Deferred at acceptance (not resolved):** both connectors currently on the roadmap (RSS/News, Reddit) are poll-mode; push-mode isn't scheduled until later platforms. Noted as a known gap, revisit when a push-mode connector is actually being built.

## Amendment Log

- 2026-07-28 — Initial proposal: 50% failure rate with a 5-attempt floor over a 1-hour window, plus a 20-consecutive-failure absolute ceiling.
- 2026-07-29 — Accepted: 50% / 5-attempt floor / 20-consecutive confirmed as launch defaults; `deliveryMode`-based variation deferred as a known gap, not resolved.

## Clarification (2026-08-12)

This ADR's own rate-relative formula (`recentFailures / recentAttempts`, the 5-attempt floor, the 20-consecutive ceiling) is defined purely in terms of failed vs. succeeded `IngestionRun`s — it does not, and at drafting time had no reason to, distinguish *why* a run failed. Direct code inspection this session (drafting ADR-0051, connector activation) found that `connectorHealth.ts`'s implementation of this formula counts every `status = 'failed'` row identically toward `recentFailures` and `consecutiveFailures`, regardless of the `retryable` boolean `ingestion_runs` already carries per row (written by `runIngestionAttempt.ts`, never read by `deriveConnectorHealth()`). ADR-0010's own Decision text already distinguishes retryable from non-retryable errors as needing different responses — this ADR's math doesn't yet carry that distinction through, so a run of purely retryable failures (e.g. sustained rate-limiting) can trip this ADR's own rate threshold or consecutive-failure ceiling exactly as if they were non-retryable, which is not this ADR's intent (see its own Context: the threshold exists to distinguish "clearly broken" from "probably a transient blip," and a rate-limit hit is the paradigm transient case).

Named as a required correction, not performed here: the rate-relative math above should exclude, or separately weight, retryable failures from `recentFailures`/`consecutiveFailures` when deciding `failing`, so that a genuinely non-retryable failure pattern still trips this rule while a merely-rate-limited connector does not, on its own. See ADR-0010's own matching Clarification note (same date) for the full context and the paired fix this shares with `deriveConnectorHealth()`. This does not change the 50%/5-attempt-floor/20-consecutive numbers this ADR already accepted — it changes what counts as an eligible failure going into that math, which remains this ADR's own Decision to own, not a new decision by ADR-0051.

## Clarification (2026-08-17) — the absolute ceiling was never given a recovery path once tripped

This ADR's own Context and Consequences frame both rules purely as **detection**: "genuinely broken connectors still get caught," "catches a connector that's broken on every run." Neither this ADR nor any other names what happens *after* detection — specifically, how a connector is meant to leave `failing` once the real cause is actually fixed.

**Found live, not assumed:** `shouldAttemptIngestion()` (`connectorHealth.ts`) checks `health.status === 'failing'` and returns `false` unconditionally when true — before ever reaching the activation/credential check that follows it. Because the very next poll attempt is what would write a fresh `succeeded` `IngestionRun` (which `deriveConnectorHealth()`'s own scan-from-newest-until-a-success logic would then read as clearing `consecutiveFailures`), and that attempt is exactly what's blocked, a connector that trips the **20-consecutive absolute ceiling** specifically (not the rate rule, which naturally decays once the 1-hour window ages out) can never leave `failing` on its own — not after an hour, not after the underlying credential/config problem is fixed and the connector reactivated, not ever, without an operator manually altering `ingestion_runs` history out of band. Confirmed live: a tenant's GNews connector legitimately failed 20 times in a row (a real, correctly-classified non-retryable "No credential registered" error, itself caused by a separate, since-fixed `KEY_VAULT_KEY_ID` configuration bug) and remained permanently stuck in `failing` — with a real credential now stored and the connector reactivated — because nothing in this ADR's own rule ever re-tests the condition that tripped it.

**This was never a deliberate design choice.** The rate-relative rule already self-heals by construction (the 1-hour window ages failures out); the absolute ceiling was added specifically to catch what the rate rule structurally can't (a low-frequency, always-broken connector) — but doing so by scanning *unboundedly* backward through history for an unbroken failure streak means, once tripped, it has no time dimension left to eventually decay through, unlike the rule it sits beside.

**Named as a required correction, following this ADR's own precedent immediately above:** `shouldAttemptIngestion()` should adopt a standard circuit-breaker "half-open" allowance — once `failing` via the ceiling specifically, still permit exactly one probe attempt through once `lastAttemptAt` is older than a bounded cooldown (falling through to the normal activation/credential check, never bypassing it), rather than blocking unconditionally forever. A probe that succeeds clears the streak via the existing derivation logic, unmodified; a probe that fails simply restarts the cooldown, so a genuinely still-broken connector isn't hammered. This is a real, deliberate widening of this ADR's own already-Accepted rule (not a new rule replacing it, and not a change to the 50%/5-attempt-floor/20-consecutive numbers) — Menno's own explicit direction, given a structured choice among "fix it properly" / "manually unstick the one affected connector" / "both": fix it properly. See `docs/implementation-log.md`'s matching healing-pass entry for the actual implementation and the dated updates this required to Story 2.3's and Story 2.5's own contracts (both of which, before this fix, asserted the permanent-lockout behavior this Clarification corrects).

## Supersession update (2026-08-31)

ADR-0109 (accepted 2026-08-28, implemented Story 13.1) supersedes the parts of this ADR's implementation defaults that govern the absolute ceiling and recovery behavior. Story 13.1's `connectorHealth.ts` now:
- lowers the absolute consecutive-failure ceiling to 5 failed `ingestion_runs`;
- derives `disabled` immediately on any non-retryable failed run, rather than waiting for the ceiling;
- removes the half-open probe for `failing` and instead requires a manual `POST /v1/connectors/:platformId/enable` to trigger a health-check attempt;
- counts any `status = 'failed'` run toward the consecutive-failure streak, not only non-retryable ones.

The rate-relative formula (≥50% of ≥5 attempts in the trailing hour) and the 1-hour evaluation window remain in use, but the absolute ceiling, the probe cooldown, and the retryable-exclusion for the consecutive counter are no longer current. The associated contracts (Story 2.3, 2.5, 2.12, 4.3, 1.15) carry dated supersession notes from 2026-08-31.
