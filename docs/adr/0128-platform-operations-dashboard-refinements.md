# ADR-0128: Platform operations dashboard refinements — quota burn-rate forecasting and connector health playbooks

**Status:** Proposed (2026-08-28)

**Authorizes:** refinements to ADR-0089's Platform Operations Dashboard: tenant token/quota burn-rate projections and guided connector health remediation playbooks for Platform-Admins.

**Source:** docs/product-research/feature-designs/17-platform-operations-dashboard.md, 17-platform-operations-dashboard-deep-research.md

---

## Decision
1. **Quota Burn-Rate Forecasting:** Real-time projection estimating when a tenant will exhaust monthly ingestion/AI token quotas based on trailing 7-day velocity.
2. **Connector Remediation Action Drawer:** Provides one-click retry, credential re-prompt, and rate-limit backoff overrides from the platform ops UI.