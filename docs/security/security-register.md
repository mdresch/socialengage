# Security Register

**Maintained by:** the Security & Architecture Reviewer role (Gemini — `docs/project docs/Stakeholder-Register.md` S-10), invoked via `docs/ai-roles/scripts/invoke-gemini-agent.mjs --register`. External, episodic, human-mediated — Menno runs the invocation and reviews/commits whatever gets appended here, the same as every other AI-role output in this project. This file is never edited by the reviewer's own hand outside that script; Menno may edit it directly at any time (e.g. to mark a finding Resolved).

**Convention:** append-only, same discipline as `docs/implementation-log.md`. A finding here is never silently deleted or rewritten once logged — a correction or resolution gets a new dated note referencing the original entry, not an edit to it. This is what lets the register mean something over time: a stale-but-marked-resolved finding is still evidence the gap was once real and got closed; a silently deleted one is not.

---

## Trust Boundaries & Controls (living inventory)

*Populated by the reviewer's own analysis over time — not pre-filled, since a fabricated inventory would be worse than an honest "not yet reviewed."*

---

## Findings Log (append-only, dated entries)

*Empty — no review has been logged here yet. Each entry follows: `## YYYY-MM-DD — <one-line summary> — reviewed <material: diff / file / ADR>`, then the reviewer's numbered findings in the charter's own Output format, then (added later, separately, by Menno or a follow-up review) a Resolution note when a finding is closed.*

## 2026-08-03 — reviewed stdin (e.g. git diff)

Here are the security and architecture findings from the review of the provided material:

1.  **Boundary/Asset Affected:** Authentication Boundary, Tenant Boundary, Privilege Boundary
    **Specific Gap:** The `Integration-Management-Plan.md` states that client-supplied `X-Tenant-Id` will not be trusted and all requests will use authenticated identity (`req.tenantId`, `req.userId`, `req.role`), implying the control is in place, while the `Uncertainty-Management-Plan.md`'s R-04 and related open items explicitly state that "no authentication mechanism exists" and the implementation of ADR-0029–0033 (Entra sign-in and bearer-token identity resolution) is "Open" and "in progress (Phase 4.5)". This creates a documentation-reality mismatch regarding the current enforcement status of a critical security control.
    **Concrete Exploit Scenario:** A developer or auditor reviewing the `Integration-Management-Plan.md` might mistakenly believe that the system is already rejecting unauthenticated `X-Tenant-Id` claims, leading to a false sense of security and potentially making decisions (e.g., exposing API endpoints) that assume this control is actively enforced before the underlying authentication and identity resolution work is complete.
    **Suggested Control:** Update the `Integration-Management-Plan.md` to explicitly clarify that while ADR-0033 defines the *intended design*, the *enforcement mechanism* is dependent on the completion of ADR-0029–0033, which is currently in an "Open" implementation phase, with a direct cross-reference to R-04 in the `Uncertainty-Management-Plan.md`.

2.  **Boundary/Asset Affected:** Privilege Boundary, Tenant Boundary
    **Specific Gap:** The `Integration-Management-Plan.md` explicitly lists "Connector ownership authorization not implemented" (ADR-0034) as a high-impact, open integration item for "connector CRUD ↔ users/roles/credentials," indicating that the system currently lacks a control to ensure users can only manage connectors they are authorized to. This directly relates to the `Uncertainty-Management-Plan.md`'s R-05, which notes that the accepted tenant/admin/user model (ADR-0030–0032) is architecturally decided but not yet implemented.
    **Concrete Exploit Scenario:** If connector CRUD endpoints are activated or accessible (even behind a rudimentary authentication mechanism that doesn't enforce ownership), a malicious tenant or an attacker who gains any level of authenticated access could potentially manipulate connectors belonging to other tenants, or bypass intended role-based restrictions on their own connectors.
    **Suggested Control:** Ensure that all connector CRUD endpoints are strictly protected by a "fail-safe" authorization layer that prevents any operation until ADR-0030–0032's identity model and ADR-0034's ownership-based access controls are fully implemented and contract-verified.

3.  **Boundary/Asset Affected:** Code Quality Boundary, Security Posture
    **Specific Gap:** The `Measurement-Management-Plan.md` and `Team-Management-Plan.md` explicitly correct the status of "Lint Pass Rate" from "100% ✅" to "⚠️ Not yet configured" and confirm that "no ESLint config exists anywhere in the repo" and the "CI lint step (`npx eslint . --ext .ts || true`) is explicitly non-blocking." This indicates a complete absence of automated code quality enforcement via linting in the CI pipeline.
    **Concrete Exploit Scenario:** Without enforced linting, developers can inadvertently introduce common security vulnerabilities (e.g., improper input validation, insecure default settings, unsafe API usage, direct access to sensitive data without proper sanitization) that would typically be flagged by a robust static analysis tool, leading to a gradual accumulation of latent security flaws in the codebase.
    **Suggested Control:** Implement a comprehensive ESLint configuration with security-focused rules and integrate it as a blocking step in the CI pipeline, preventing the merge of code that does not adhere to established quality and security standards.

---
