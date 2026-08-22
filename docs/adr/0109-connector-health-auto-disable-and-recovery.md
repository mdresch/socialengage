# ADR-0109: Connector health auto-disable and recovery

**Status:** Proposed (2026-08-23)

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

## Open questions

- Should the consecutive-failure threshold be configurable per connector or per tenant?
- Should `Platform-Admin` be able to re-enable any tenant's connector, or only tenant-wide connectors?
- How is the health-check attempt different from a normal poll? Does it have a smaller result set?
- Should `disabled` connectors still count toward `connector_activations` billing, or are they paused?

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/01-multi-source-ingestion.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0009` (ingestion health), `ADR-0010` (retryable errors), `ADR-0051` (connector activation), `ADR-0101` (connector capabilities)
