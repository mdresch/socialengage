# Implementation Plan — Story 16.4: Platform Ops Quota Burn-Rate Forecasting & Guided Remediation (Frontend/Backend)

## 1. Traceability Matrix & Governing Specifications

| Artifact | Identifier | Status / Mapping |
|---|---|---|
| **Architecture Decision Record** | `ADR-0128` | Accepted (2026-08-28) — Quota burn-rate forecasting & connector remediation playbooks |
| **Business Requirements Document** | `BRD-0128` | Approved — BR-128.1 (Quota velocity & exhaustion forecasting), BR-128.2 (Operator remediation action drawer) |
| **Functional Design Document** | `FDD-0128` | Approved — Platform operations telemetry & remediation playbooks |
| **Technical Design Specification** | `TDS-0128` | Approved — Linear projection model, DTO schemas, and component architecture |
| **User Story** | `Story 16.4` | Ready (`docs/user-stories/epic-16-adr-0125-to-0128.md`) |
| **Component Skills** | `platform-operations-dashboard` | Core & Admin `.claude/skills/platform-operations-dashboard/SKILL.md` |
| **Executable Contracts** | `Story 16.4 Contracts` | Core: `contracts/epic-16/story-16.4.platform-ops-quota-burn-rate.contract.test.ts`<br>Admin: `contracts/epic-16/story-16.4.platform-ops-quota-burn-rate-ui.contract.test.ts` |

---

## 2. Acceptance Criteria Breakdown & Contract Test Design

- **AC1: Trailing 7-Day Velocity & Linear Burn-Rate Calculation (Backend):**
  - Trailing 7-day token/ingestion velocity formula:
    $$\text{dailyVelocity7d} = \frac{\sum_{i=1}^7 \text{Tokens}_i}{7}, \quad \text{daysRemaining} = \frac{\text{remainingQuota}}{\text{dailyVelocity7d}}$$
  - Categorizes status into:
    - `healthy`: $>30$ days remaining
    - `warning_30d`: $8$ to $30$ days remaining
    - `critical_7d`: $\le 7$ days remaining or exhausted ($0$ days)
  - Computes `projectedExhaustionDate` (ISO string) when velocity $>0$.

- **AC2: Platform Dashboard API Surface (Backend):**
  - `GET /v1/admin/platform-dashboard` returns `tenantQuotaBurnProjections` containing:
    `tenantId`, `tenantName`, `monthlyQuota`, `consumedTokens`, `dailyVelocity7d`, `projectedExhaustionDate`, and `status`.

- **AC3: Role-Gated Remediation API & Audit Logging (Backend):**
  - `POST /v1/admin/connectors/:id/remediate`
  - Gated to `platform_admin` (non-platform-admin requests rejected with `403 FORBIDDEN`).
  - Supports playbooks: `retry_now`, `reprompt_credentials`, `override_backoff` (with `overrideMinutes`), and `clear_error_state`.
  - Permanently records every operator action into `platform_admin_audit_log`.

- **AC4: Quota Burn-Rate Forecasting UI Widget (Frontend):**
  - `QuotaBurnRateForecast.tsx` mounted on `/admin/operations` rendering:
    - Tenant list with quota consumption and 7-day daily velocity.
    - Exhaustion timeline / date forecasts.
    - Risk status badges (`healthy`, `warning_30d`, `critical_7d`).

- **AC5: Interactive Connector Remediation Drawer (Frontend):**
  - `ConnectorRemediationDrawer.tsx` allowing platform operators to:
    - Open drawer from connector status cards/table.
    - Select and execute remediation playbooks (`retry_now`, `reprompt_credentials`, `override_backoff`, `clear_error_state`).
    - Provide immediate feedback and auto-refresh connector status.

---

## 3. Coordinated Repo Boundaries & Order of Implementation

Per project convention (`AGENTS.md`):
1. **Phase A (Backend Core):**
   - Write failing contract test `social-listening-core/contracts/epic-16/story-16.4.platform-ops-quota-burn-rate.contract.test.ts`.
   - Implement burn rate projection logic, `platformDashboardRouter`, and connector remediation endpoint.
   - Verify core contract passes green.
2. **Phase B (Frontend Admin UI):**
   - Write failing contract test `social-listening-admin/contracts/epic-16/story-16.4.platform-ops-quota-burn-rate-ui.contract.test.ts`.
   - Implement BFF proxy, SDK client methods, `QuotaBurnRateForecast`, and `ConnectorRemediationDrawer`.
   - Verify admin contract passes green.
3. **Phase C (Cumulative Suite & Validation):**
   - Verify both core and admin contract test suites.
   - Run typecheck in both repos.
4. **Phase D (Traceability, Telemetry & Merge):**
   - Update component SKILL.md in both repos.
   - Update user story status, implementation log, and run dashboard sync.
   - Merge `feat/story-16.4` to `main`.
