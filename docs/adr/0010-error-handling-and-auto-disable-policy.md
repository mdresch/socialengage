# ADR-0010: Retryable-vs-non-retryable error policy with per-tenant auto-disable

**Status:** Accepted (2026-07-28)
**Source:** Design Spec §5 "Error handling"

## Context

Ingestion failures have different causes with different correct responses: a rate limit or transient network blip should resolve itself, but an expired credential or malformed watchlist will not resolve by retrying, and retrying it anyway just burns quota and hides a problem the tenant needs to fix. Failures also must stay isolated per tenant per §8, so one tenant's broken connector can't degrade another's.

## Decision

- **Retryable errors** (rate limit, transient network, 5xx) → exponential backoff, automatic retry.
- **Non-retryable errors** (401/403, malformed watchlist) → immediate `failing` status, surfaced to the tenant, no blind retry.
- OAuth token refresh is attempted automatically before failing; it only surfaces to the user if the refresh itself fails.
- After the failure threshold (§5, §10: 10 consecutive failures as a placeholder) is crossed, the connector auto-disables for that tenant with a clear reason, rather than failing silently and indefinitely.
- All of this isolation is per-tenant: one tenant's failing/expired connector never affects another tenant's ingestion.

## Consequences

**Positive**
- Distinguishing retryable from non-retryable errors avoids two failure modes at once: wasting retries (and rate-limit budget, per ADR-0003) on errors that can't self-resolve, and giving up too early on errors that would have cleared on their own.
- Automatic OAuth refresh-before-fail means the common case (an expired-but-refreshable token) never bothers the tenant; only a genuinely broken credential does.
- Auto-disable after a threshold, with the run history it's derived from being visible via `ConnectorHealth` (ADR-0009), means a tenant is never left ingesting nothing with no explanation — the state is `failing`/`disconnected` with a reason, not silence.

**Negative**
- The failure classification (which specific errors are retryable vs. not) has to be implemented per-connector, since what counts as a transient vs. permanent error is platform-specific; a connector author must get this right or risk masking real problems as "just retry" or over-alerting on transient issues.
- The 10-consecutive-failures threshold is a single global placeholder (§10) rather than tuned per platform; a platform with naturally flakier infrastructure could trip auto-disable more often than one that's simply more stable, even when neither indicates a real tenant-facing problem.

## Alternatives Considered

- **Retry everything with backoff, never auto-disable** — simpler policy, but a genuinely broken credential would retry forever, burning resources and delaying tenant awareness of a problem they need to fix themselves.
- **Fail immediately on any error, no retry** — surfaces problems fast, but would turn routine transient network issues or rate-limit hits into tenant-visible failures, creating noise for conditions that are expected to self-resolve.

## Pending supersession note (2026-07-28)

**ADR-0023** (Proposed, not yet accepted) would replace the auto-disable threshold in this ADR's Decision (the flat "10 consecutive failures" placeholder) with a rate-relative rule. If ADR-0023 is accepted, only that one line changes — retryable/non-retryable classification, automatic OAuth refresh-before-failing, and per-tenant isolation are unaffected and don't need re-deciding. This note is a forward-pointer only; per this series' convention, the original Decision text above is not edited. See `docs/adr/README.md`'s governance table.

## Supersession update (2026-07-29)

**ADR-0023 has been accepted.** The flat "10 consecutive failures" auto-disable threshold above is now superseded by ADR-0023's rate-relative rule, exactly as the note above anticipated — retryable/non-retryable classification, automatic OAuth refresh-before-failing, and per-tenant isolation are unaffected. This does not retroactively change already-shipped code: Story 2.3 was built and passed its contract against the flat rule before ADR-0023 was accepted, and stays as shipped until Story 2.5 (now Ready) is actually picked up and built — that's when the implementation gets healed to match. See `docs/user-stories/README.md`'s "Known cross-story conflict" note. This ADR's own Decision text is still not edited, per this series' convention.
