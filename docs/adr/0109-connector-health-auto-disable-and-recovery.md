# ADR-0109: Connector health auto-disable and recovery

**Status:** Accepted (2026-08-28)

**Authorizes:** the auto-disable and recovery rules for `SocialConnector` health, including the `failing`/`degraded` state transitions, the `retryable` flag, and the `Platform-Admin`/`Tenant-Admin` re-enable path.

**Source:** `docs/product-research/feature-designs/01-multi-source-ingestion.md` and `docs/product-research/feature-adr-scoping.md`

---

## Context

### 1. Connectors fail for many reasons
`docs/product-research/feature-designs/01-multi-source-ingestion.md` and the `Sole-Operator`/`Platform-Admin` profiles require robust ingestion. `ADR-0009`/`ADR-0010` established health states. `ADR-0051` added `connector_activations`. This ADR finishes the policy: when a connector is `failing`, it is automatically disabled; when it recovers, it is re-enabled.

### 2. Auto-disable protects quota and cost
A failing connector can burn through retries, exhaust quota, and generate noise. Auto-disable stops polling. Manual re-enable gives the tenant control.

### 3. Recovery must be explicit
A connector should not silently resume after a transient failure. A `Tenant-Admin` or `Platform-Admin` must re-enable it or the platform must detect a sustained healthy state.

---

## Decision

### 1. Health state transitions
```
healthy -> degraded -> failing -> disabled
  ^                                      |
  |______________________________________|
          manual re-enable or auto-recovery
```

- `degraded` — one or more recent `ingestion_runs` failed with `retryable` errors but some succeeded.
- `failing` — N consecutive `ingestion_runs` failed (N = 5 by default) or a non-retryable error occurred.
- `disabled` — the connector is automatically or manually deactivated and stops polling.

### 2. Auto-disable rules
- After 5 consecutive failed `ingestion_runs`, `ConnectorHealth` transitions to `failing` and `shouldAttemptIngestion()` returns `false`.
- If the last failure is `non-retryable` (e.g. HTTP 401, 403), the connector is disabled immediately.
- The `ingestion_runs.retryable` column (ADR-0051/0052) is the source of truth for the failure type.
- A `ConnectorHealthChangedEvent` is emitted with `newState='failing'`.

### 3. Auto-recovery rules
- A `degraded` connector recovers to `healthy` after 3 consecutive successful runs.
- A `failing` or `disabled` connector does **not** auto-recover; it requires manual re-enable.
- After re-enable, the first run begins with a `health_check` attempt (a lightweight poll with `limit=1`).
- If the health check succeeds, the connector returns to `healthy`.
- If the health check fails, the connector returns to `failing` and the counter resets to 1.

### 4. Manual re-enable
- `POST /v1/connectors/:platformId/enable` for `Tenant-Admin` or `Platform-Admin`.
- For user-bound (Tier 3) connectors, the owning user can re-enable their own.
- Re-enable is auditable in `platform_admin_audit_log`.

### 5. Notifications
- On `failing` → `disabled`, a `ConnectorIngestionAlertEvent` is emitted.
- If a webhook subscription exists (ADR-0106), it is delivered.
- The admin UI shows a `disabled` badge with the last error and a re-enable button.

---

## Consequences

1. **Quota protection:** failing connectors stop polling, saving API calls.
2. **Operational clarity:** operators see exactly which connectors are disabled and why.
3. **Human in the loop:** recovery requires explicit re-enable, preventing flapping.
4. **Foundation for `09-real-time-alerts`:** the health `failing` threshold can trigger an alert rule (ADR-0091).

---

## Alternatives considered

1. **Auto-recovery after a cooldown period.**
   - *Rejected:* it can mask persistent problems and waste quota. Manual re-enable is safer for v1.

2. **Disable the connector after a single failure.**
   - *Rejected:* transient failures are common. A threshold of 5 consecutive failures balances safety and noise.

3. **Email the tenant on every failed run.**
   - *Rejected:* it is too noisy. Only the `failing` → `disabled` transition triggers a notification.

---

## Open Questions

- [ ] **[Q-0109-1]** Should the consecutive-failure threshold be configurable per connector or per tenant?
- [ ] **[Q-0109-2]** Should `Platform-Admin` be able to re-enable any tenant's connector, or only tenant-wide connectors?
- [ ] **[Q-0109-3]** How is the health-check attempt different from a normal poll? Does it have a smaller result set?
- [ ] **[Q-0109-4]** Should `disabled` connectors still count toward `connector_activations` billing, or are they paused?

---

## Amendment Log

- 2026-08-28 — **Provenance note, no parameter or Decision change.** The `01-multi-source-ingestion-deep-research.md` competitive research brief (`c:/Users/menno/Documents/Second Brain/raw/01-multi-source-ingestion-deep-research.md`) was reviewed against this ADR. It contains no connector-health-specific or auto-disable-specific findings (its content is about source-type breadth and coverage, not failure/recovery mechanics). One general finding lends indirect support to this ADR's quota-protection rationale: Brandwatch markets that it ingests from "the forums that matter most" rather than crawling indiscriminately (https://www.brandwatch.com/datanetworks/forums/) — a targeted, cost-conscious ingestion posture consistent with this ADR's auto-disable-to-protect-quota design (Decision §2, Consequence 1). This does not change the 5-consecutive-failure threshold, the non-retryable-immediate-disable rule, or any other parameter — it is cited here only as external validation that quota-conscious connector operation is an industry-standard design goal, not a SocialEngage-specific invention. Status remains **Proposed**; the drafting persona does not hold ADR-acceptance authority.

---

## Acceptance / Implementation note

**Accepted 2026-08-28; implemented 2026-08-31 (Story 13.1).** The implementation in `src/connectors/connectorHealth.ts`, `src/http/versions/v1/connectorsRouter.ts`, `src/ingestion/runIngestionAttempt.ts`, `src/ingestion/ingestionRunStore.ts`, and `src/events/connectorIngestionAlertEvent.ts`:
- adds `disabled` to `ConnectorHealthStatus`;
- lowers the absolute consecutive-failure ceiling to 5 failed `ingestion_runs`;
- immediately derives `disabled` on any non-retryable failed run (`reconnect_required` remains the credential-class 401/403 variant, also a blocked state);
- removes the half-open probe for `failing` and requires manual `POST /v1/connectors/:platformId/enable`;
- makes `POST /v1/connectors/:platformId/enable` perform a single health-check `ingestion_runs` attempt that, on success, returns the connector to `healthy`, and on failure resets the failure streak to 1 and leaves it `failing`;
- adds `connector_disabled` to `ConnectorIngestionAlertEvent` and emits it on `failing` → `disabled`/`reconnect_required` transitions.

This supersedes ADR-0023's 20-consecutive-failure ceiling and the 2026-08-17 half-open probe for `failing`; see ADR-0023's own Supersession update (2026-08-31) and the affected contracts' dated notes.

## Footnotes

- Related feature design: `docs/product-research/feature-designs/01-multi-source-ingestion.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0009` (ingestion health), `ADR-0010` (retryable errors), `ADR-0051` (connector activation), `ADR-0101` (connector capabilities)
