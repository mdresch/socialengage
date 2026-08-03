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

## 2026-08-03 — reviewed stdin (e.g. git diff)

Here are the security and architecture findings from the review of the provided material:

1.  **Boundary/Asset Affected:** Authentication Boundary, Tenant Boundary
    **Specific Gap:** The `implementation-plan.md` explicitly states that the newly built Entra authentication middleware (from Story 5.6) is "Not yet mounted on any real route," and that wiring it into the `/v1` router (which would retire the unauthenticated `X-Tenant-Id` header) is deferred to Story 5.10. This means that despite the existence of a working authentication solution, the system's `/v1` endpoints continue to rely on `X-Tenant-Id` as an unauthenticated source of tenant identity, perpetuating a known, critical trust boundary vulnerability in the current operational state.
    **Concrete Exploit Scenario:** An attacker can continue to supply an arbitrary `X-Tenant-Id` header to any `/v1` API endpoint not otherwise protected. If the underlying application logic or Row-Level Security policies (which are correctly applied *once* `tenant_id` is trusted) are presented with a forged `tenant_id` value, the attacker could potentially gain unauthorized access to, or manipulate, data belonging to another tenant.
    **Suggested Control:** Immediately prioritize and accelerate the integration of the Entra authentication middleware into all `/v1` API endpoints, ensuring that all tenant and user identity claims are exclusively derived from cryptographically validated and authorized bearer tokens, and that the `X-Tenant-Id` header is explicitly ignored or rejected for identity purposes.

2.  **Boundary/Asset Affected:** Privilege Boundary, Operational Security
    **Specific Gap:** The `platform-admin-access/SKILL.md` explicitly notes that "Real request-time authorization (which caller may actually invoke these Platform Admin actions) is Story 1.7/5.10's job," indicating that the application-level mechanism for authorizing who can trigger platform administration functions (e.g., initiating break-glass requests, creating/modifying tenants) is not yet implemented. While the database-level grants for `platform_admin_role` are appropriately scoped and the break-glass mechanism is robustly designed at a lower level, the critical decision of *who* is entitled to initiate these powerful actions from the client or application layer remains undefined and unenforced.
    **Concrete Exploit Scenario:** If the application exposes any internal or external endpoints or services that directly trigger `platform_admin_role` actions (such as tenant creation, license seat count modifications, or break-glass password resets) without performing explicit authorization checks on the calling entity, an unauthorized actor (internal or external) could potentially invoke these highly privileged operations, leading to unauthorized system configuration changes, tenant data manipulation, or privilege escalation within the platform.
    **Suggested Control:** Implement a comprehensive application-layer authorization service that strictly validates the identity and permissions of any caller attempting to initiate platform administration actions, ensuring that only explicitly authorized platform administrators, and potentially requiring additional factors for sensitive operations, can trigger these privileged workflows.

---

## 2026-08-03 — reviewed stdin (e.g. git diff)

Here are the security and architecture findings from the review of the provided material:

1.  **Boundary/Asset Affected:** Privilege Boundary, Secrets Boundary
    **Specific Gap:** The introduction of `identity_resolver_role` as a new `BYPASSRLS` Postgres role, accompanied by its dedicated test environment variables (`IDENTITY_RESOLVER_PGUSER`, `IDENTITY_RESOLVER_PGPASSWORD`), establishes a new high-privilege entity within the system, but the comprehensive and precise definition of its database grants and constraints is deferred to `.claude/skills/identity-resolution/SKILL.md`, which is not present in the current review material.
    **Concrete Exploit Scenario:** Without immediate and explicit confirmation of the `identity_resolver_role`'s grants, there is a risk that its privileges could inadvertently be broader than strictly necessary for its stated "even-narrower" function, potentially allowing an attacker who compromises this role (even in a test environment that could influence production practices or design assumptions) to bypass Row-Level Security and access or manipulate sensitive data outside its intended scope.
    **Suggested Control:** Mandate that all definitions for new `BYPASSRLS` roles, including their complete and minimum-necessary Postgres DDL grants, are presented for security review concurrently with any material that introduces or references the role.

2.  **Boundary/Asset Affected:** Operational Security, Privilege Boundary, Tenant Boundary
    **Specific Gap:** The `platform-admin-access/SKILL.md` explicitly states that the mechanism for a platform administrator to reliably look up a Tenant-Admin's `external_subject` (required to target a break-glass password reset) given a `tenantId` is *still not implemented*, preventing the secure and efficient initiation of this critical privileged action.
    **Concrete Exploit Scenario:** In the event of an urgent security incident requiring a break-glass password reset for a specific tenant, the absence of an integrated and authorized lookup pathway forces platform administrators to either develop insecure, ad-hoc methods to find the target `external_subject`, or leads to operational delays, both of which increase the risk profile and could compromise the effectiveness of the break-glass recovery process itself.
    **Suggested Control:** Implement a dedicated, securely authorized application-layer service that enables platform administrators to resolve a `tenantId` to its corresponding Tenant-Admin's `external_subject` through a controlled and auditable process, integrating this lookup directly into the workflow for initiating break-glass requests.

---

## 2026-08-03 — reviewed stdin (e.g. git diff)

## 2026-08-03 — reviewed stdin (e.g. git diff)

Here are the security and architecture findings from the review of the provided material:

### Resolution of Previous Findings

1.  **Finding Resolved:** The finding from 2026-08-03 (second entry), finding 1, which stated: "Authentication middleware not mounted on real routes, X-Tenant-Id still in use," is now resolved.
    **Resolution Note:** The provided `git diff` for Story 5.10 (ADR-0033) demonstrates that the `createTenantAuthMiddleware()` (composing `createEntraAuthMiddleware()` and `resolveIdentity()`) is now explicitly mounted on the `/v1` router stack in `social-listening-core/src/http/app.ts`. Furthermore, all `/v1` router files (`connectorsRouter.ts`, `postsRouter.ts`, `topicsRouter.ts`, `watchlistsRouter.ts`) have removed their reliance on the `X-Tenant-Id` header and now invoke `requireTenantUser()`, which extracts identity from the authenticated request context. The `.claude/skills/entra-authentication/SKILL.md` and `.claude/skills/identity-resolution/SKILL.md` files also reflect this change, explicitly stating that mounting has occurred and `X-Tenant-Id` no longer holds any trust role.

### New Findings

1.  **Boundary/Asset Affected:** Privilege Boundary, Operational Security, Deployment Boundary
    **Specific Gap:** The application's core authentication middleware is conditionally swapped with a test-only bypass (`testAuthBypassMiddleware`) based on `process.env.NODE_ENV === 'test'` in `social-listening-core/src/http/app.ts`. This relies on a runtime environment variable to enforce a critical security boundary, which is susceptible to misconfiguration or malicious manipulation.
    **Concrete Exploit Scenario:** An attacker or an operator making a configuration error could set `NODE_ENV='test'` in a non-test environment (e.g., staging, QA, or even a developer machine interacting with shared services). This would cause the application to load the insecure test bypass, allowing unauthenticated or arbitrarily authenticated access to `/v1` endpoints (e.g., by supplying an `X-Test-Identity` header as seen in the updated contract tests), thereby bypassing all real Entra authentication and identity resolution and enabling tenant impersonation or unauthorized data access.
    **Suggested Control:** Replace the reliance on `NODE_ENV` for this critical security switch with an explicit, distinct, and securely managed configuration flag that defaults to secure authentication and requires a strong, auditable override for the test bypass, ideally tied to specific build artifacts or segregated, non-production credentials.

### Open Gaps (Previously Logged, Not Addressed in This Review Material)

The following findings, previously logged, were not addressed by the material provided for this review and therefore remain open:

*   **2026-08-03 (first entry), Finding 1:** The documentation mismatch regarding the status of the `X-Tenant-Id` control (specifically the `Integration-Management-Plan.md` and `Uncertainty-Management-Plan.md` R-04) might still exist in the cited documents, even though the underlying technical gap has been closed. This finding specifically concerns the documentation itself.
*   **2026-08-03 (first entry), Finding 2:** "Connector ownership authorization not implemented" (ADR-0034) remains an open privilege boundary gap for connector CRUD operations.
*   **2026-08-03 (first entry), Finding 3:** The lack of enforced linting in the CI pipeline is still an open code quality and security posture gap.
*   **2026-08-03 (second entry), Finding 2:** "Platform admin authorization not implemented" (Story 1.7/5.10's job) remains an open privilege boundary gap for platform administration functions.
*   **2026-08-03 (third entry), Finding 1:** The comprehensive and precise definition of the `identity_resolver_role`'s `BYPASSRLS` database grants and constraints (the actual DDL) is still deferred and not present in the review material.
*   **2026-08-03 (third entry), Finding 2:** The mechanism for platform administrators to reliably look up a Tenant-Admin's `external_subject` for break-glass password resets is still not implemented.

---

## 2026-08-03 — reviewed stdin (e.g. git diff)

Here are the security and architecture findings from the review of the provided material:

### Resolution of Previous Findings

1.  **Finding Resolved:** The finding from 2026-08-03 (second entry), finding 1, which stated: "Authentication middleware not mounted on real routes, X-Tenant-Id still in use," is now resolved.
    **Resolution Note:** The `security-register.md` update within the reviewed material explicitly documents this resolution, referencing the `git diff` for Story 5.10 (ADR-0033). The provided code changes in `social-listening-core/src/http/auth/requireTenantUser.ts` introduce `requireTenantUserIdentity`, and `social-listening-core/src/http/versions/v1/connectorsRouter.ts` now consistently uses this authenticated identity, explicitly deriving `tenantId`, `userId`, and `role` from the request context, eliminating reliance on the unauthenticated `X-Tenant-Id` header for these critical `/v1` routes.

2.  **Finding Resolved:** The finding from 2026-08-03 (first entry), finding 2, which stated: "Connector ownership authorization not implemented" (ADR-0034) as an open privilege boundary gap for connector CRUD operations, is now resolved for the `connect` and `disconnect` endpoints.
    **Resolution Note:** The changes in `social-listening-core/src/http/versions/v1/connectorsRouter.ts` implement robust, role-based and ownership-tier authorization for `POST /v1/connectors/:platformId/connect` and `DELETE /v1/connectors/:platformId/disconnect`. Specifically, creating or deleting tenant-wide credentials (`ownerType: 'tenant'`) now explicitly requires the caller's role to be `tenant_admin`. Creating a user-bound credential (`ownerType: 'user'`) always associates it with the calling user's authenticated `userId` (ignoring any client-supplied `userId`). Deleting a user-bound credential allows the owning user to disconnect their own credential or a `tenant_admin` to disconnect any user's credential within their tenant. These controls, combined with updates to `social-listening-core/src/credentials/credentialStore.ts` to accept and persist `owner_type` and `user_id`, directly address the requirements of ADR-0034 and the previously identified gap.

### New Findings

No new trust boundary gaps fitting the specified criteria were identified in the material under review. The changes primarily focus on implementing and hardening previously defined authentication and authorization controls.

### Open Gaps (Previously Logged, Not Addressed in This Review Material)

The following findings, previously logged, were not addressed by the material provided for this review and therefore remain open:

*   **2026-08-03 (first entry), Finding 1:** The documentation mismatch regarding the status of the `X-Tenant-Id` control (specifically the `Integration-Management-Plan.md` and `Uncertainty-Management-Plan.md` R-04) might still exist in the cited documents, even though the underlying technical gap has been closed. This finding specifically concerns the documentation itself.
*   **2026-08-03 (first entry), Finding 3:** The lack of enforced linting in the CI pipeline is still an open code quality and security posture gap.
*   **2026-08-03 (second entry), Finding 2:** "Platform admin authorization not implemented" (Story 1.7/5.10's job) remains an open privilege boundary gap for platform administration functions.
*   **2026-08-03 (third entry), Finding 1:** The comprehensive and precise definition of the `identity_resolver_role`'s `BYPASSRLS` database grants and constraints (the actual DDL) is still deferred and not present in the review material.
*   **2026-08-03 (third entry), Finding 2:** The mechanism for platform administrators to reliably look up a Tenant-Admin's `external_subject` for break-glass password resets is still not implemented.
*   **2026-08-03 (fourth entry), Finding 1:** The application's core authentication middleware is conditionally swapped with a test-only bypass (`testAuthBypassMiddleware`) based on `process.env.NODE_ENV === 'test'` in `social-listening-core/src/http/app.ts`, which relies on a runtime environment variable to enforce a critical security boundary.

---

## 2026-08-04 — reviewed docs/adr/0036-admin-ui-authentication-session-and-role-gating-mechanism.md (manual run, not --register — appended by hand for a complete history)

Here are the security and architecture findings from ADR-0036:

1.  **Boundary/Asset Affected:** Privilege Boundary, Secrets Boundary, Network Boundary (`GET /v1/me` endpoint).
    **Specific Gap:** The proposed `GET /v1/me` endpoint in `social-listening-core` is described as "authenticated" but its specific authorization mechanism for ensuring it only returns the identity corresponding to the *caller's own bearer token* is not explicitly stated, leaving open how it will prevent identity spoofing or disclosure of other users' roles/tenant IDs.
    **Concrete Exploit Scenario:** An attacker with a valid bearer token for Tenant A could make a request to the `GET /v1/me` endpoint. If this endpoint's implementation is flawed and does not strictly derive the returned identity solely from the authenticated token (e.g., by allowing a query parameter or custom header to influence the target `tenantId` or `userId`), the attacker could potentially discover the internal identity details (ID, role, tenant ID) of users in other tenants or even Platform Admins.
    **Suggested Control:** The `GET /v1/me` endpoint must be rigorously protected by `createTenantAuthMiddleware()` and must rely exclusively on the `resolveIdentity()` function to extract the caller's identity from their bearer token, ensuring no client-supplied parameters can override or influence the returned identity object.

**Resolution note (same day):** ADR-0036 §5 was still Proposed (not yet accepted) at the time of this finding — revised in place with a Clarification stating exactly this requirement (identity derived exclusively from `req.identity`, never a client-supplied parameter), and Story 6.1's own Acceptance Criteria (`docs/user-stories/epic-6-admin-ui.md`) was updated to make it a testable requirement for whoever builds the actual endpoint. See ADR-0036's own Amendment Log for the full account. Not yet contract-verified — no code exists yet (Story 6.1 is Blocked pending this ADR's acceptance) — this closes the *design* gap, not an implementation one.

---

## 2026-08-04 — reviewed docs/adr/0036-admin-ui-authentication-session-and-role-gating-mechanism.md, second pass (manual run, not --register — appended by hand for a complete history)

The ADR-0036 proposal for the Admin UI's authentication and session mechanism is robust and well-considered, particularly in its adoption of the Backend-for-Frontend (BFF) pattern to mitigate XSS token theft, and its clear stance that UI role-gating is a usability feature, not a security boundary. The clarification added to Decision §5 for the new `GET /v1/me` endpoint, mandating identity derivation *exclusively* from the already-validated `req.identity`, effectively closes a critical spoofing/disclosure risk for that endpoint by preventing client-supplied identity overrides.

However, one area remains an assumption of trust without a concrete, decided enforcement mechanism within the proposed design.

1.  **Boundary/Asset affected:** User Session (representing an authenticated user's access and privilege via a server-side bearer token and client-side session cookie).
    **Specific gap:** The "Refresh-token rotation strategy" is explicitly listed as an Open Question, meaning the design currently defers the decision on how session freshness, maximum lifetime, re-authentication requirements, and timely revocation are enforced. While the session cookie itself is well-protected (`httpOnly`, `Secure`, `SameSite=Lax`, encrypted), leaving the strategy for session *lifetime and rotation* undecided represents an implicit trust that the default or chosen implementation will handle these critical aspects securely without specific architectural guidance. This omits a fundamental control against indefinite session persistence after a compromise.
    **Concrete exploit scenario:** An attacker, through a non-XSS vulnerability (e.g., physical access to a user's browser, a browser-level exploit, or a compromised endpoint that momentarily exposes the cookie) or by exploiting a rare `SameSite` bypass, obtains a legitimate user's active session cookie. Without a defined session rotation strategy, a short maximum session lifetime, or an inactive timeout leading to re-authentication, the attacker can use the stolen session to maintain unauthorized access to the SocialEngage Admin UI and subsequently the core API for an extended, potentially indefinite, period, even if the legitimate user changes their password or logs out, until the session is eventually revoked or expires after a very long duration.
    **Suggested control:** The design should specify a clear policy for session lifecycle management, including a maximum absolute session lifetime, an idle timeout, and a mechanism for session rotation or forced re-authentication to ensure session freshness and limit the window of opportunity for hijacked sessions.

**Resolution note (same day):** ADR-0036 was still Proposed at the time of this finding — revised in place, adding new Decision §6: a decided, hard 8-hour absolute session lifetime (a stated template default, revisable, same convention as ADR-0017/ADR-0018's own starting numbers), enforced server-side regardless of activity, closing the "no bound exists at all" gap this finding correctly identified. The Open Question was narrowed to only the remaining, genuinely-still-open question (idle timeout on top of the ceiling; the exact rotation/refresh UX within it) — not left as a single undifferentiated "not decided." Story 6.1's own Acceptance Criteria updated to make the 8-hour ceiling a testable requirement. Not yet contract-verified — no code exists yet (Story 6.1 is Blocked pending this ADR's acceptance).

---

## 2026-08-04 — reviewed docs/adr/0036-admin-ui-authentication-session-and-role-gating-mechanism.md, third pass (manual run, not --register — appended by hand for a complete history)

1.  **Affected boundary/asset:** Privilege boundary (authentication credentials), `social-listening-admin` application code paths, and the integrity of session management.
    **Specific gap:** Decision §2 mandates `core-client.ts` as the "single choke point" for attaching the bearer token, stating "no other file in `social-listening-admin` constructs this header directly." This relies on developer discipline and adherence to a coding convention rather than a technical enforcement mechanism, creating a potential pathway for accidental or intentional misuse of sensitive authentication material.
    **Concrete exploit scenario:** A future developer, unfamiliar with this architectural constraint or prioritizing expediency, implements a new server-side function that needs to call `social-listening-core`, bypasses `core-client.ts`, and manually constructs the `Authorization: Bearer <token>` header. A bug in that alternative path (e.g. logging the token) could expose it, circumventing `core-client.ts`'s intended guarantees.
    **Suggested control:** Encapsulate token attachment so it is technically difficult or impossible for other modules to construct bearer headers without going through `core-client.ts`.

**Disposition: accepted as-is, no new enforcement added — Menno's call, not decided unilaterally by this session.** Presented as a choice (add real technical enforcement, e.g. a custom lint rule, vs. accept as consistent with existing project convention); no objection was raised to the recommended option, so it stands: this is the identical convention-based "single choke point" pattern every other such module in this project already uses (e.g. `credential-envelope-encryption/SKILL.md`'s own "always go through `storeCredential`/`readCredential`, never call the primitives directly" rule, also not technically enforced), and Story 6.1's own AC already includes the same structural-check backstop (a contract-test scan for a duplicate ad hoc `fetch`-with-bearer-header call) this project uses elsewhere for this class of concern. Building stronger, harder-to-bypass enforcement (e.g. a lint rule) was judged real, new engineering machinery inconsistent with this project's own established solo-project pragmatism (the same reasoning behind ADR-0020's deferred rate-limit gate) — revisit if this project ever grows beyond a single developer/AI-delivery-agent pair, where convention-based discipline scales worse.

---

## 2026-08-04 — question raised directly by Menno (not a Gemini finding) — does the authorization request constrain its own redirect destination?

Menno asked directly whether ADR-0036's OAuth flow registers/enforces a specific callback (`redirect_uri`) to limit where an authorization response can be delivered. Checked: yes, this is standard OAuth2/OIDC behavior — Entra requires an exact-match, pre-registered `redirect_uri` and rejects a mismatched one — but ADR-0036 had not stated this as a decided control; it mischaracterized the question as "deployment-time configuration... not architectural" in its own Open Questions.

**A real gap, corrected same day:** a wildcard or pattern-matched redirect URI is a well-documented real-world source of OAuth authorization-code interception, and would have materially weakened this design regardless of PKCE/BFF-session hygiene elsewhere. Added to ADR-0036 §3: redirect URI must be an exact-match, pre-registered value per environment, never a wildcard/pattern — a distinct, complementary control to PKCE (constrains *where* a code is delivered, not just who can redeem it). Corrected the Open Questions bullet that previously waved this off. Story 6.1's own Acceptance Criteria updated to make this a testable requirement. Not yet contract-verified — no code exists yet.

---

## 2026-08-04 — reviewed docs/adr/0036-admin-ui-authentication-session-and-role-gating-mechanism.md, fourth pass (manual run, not --register — appended by hand for a complete history)

Resolved (per this reviewer's own re-check): finding 1 (`GET /v1/me` identity source) and finding 2 (session lifetime) both confirmed closed by the prior revisions.

3.  **Boundary/Asset Affected:** Secrets boundary (the session cookie's encryption key).
    **Specific Gap:** Decision §1 mandates an "encrypted... session cookie" but does not specify how the *encryption key* itself is secured, provisioned, or rotated. `ADR-0014`'s Key Vault envelope encryption is a project fact, but this ADR does not extend that same explicit control to the admin UI's own session key.
    **Concrete Exploit Scenario:** An attacker with access to the `social-listening-admin` deployment environment (misconfigured CI/CD, an exposed plaintext env var) obtains the session-cookie encryption key, decrypts any user's session, forges a valid one, and bypasses authentication entirely.
    **Suggested Control:** Treat the key as a sensitive secret, provisioned via a real secrets-management system at runtime, never hardcoded or committed.

**Resolution note (same day):** added to ADR-0036 §1: the key is named explicitly as an application-level secret distinct from ADR-0014's tenant-credential scope (that mechanism doesn't apply here); minimum bar decided now (256-bit entropy, environment-variable only, never committed). **Named honestly rather than solved narrowly:** this project has no decided real-production secrets-management strategy for *any* application-level secret yet (this key, the Entra client secret, database credentials) — a real, pre-existing, project-wide gap, now recorded in `docs/open-items-and-deferred-work.md`'s "Security / authentication" section rather than invented a fix for just this one key in isolation. Story 6.1's own Acceptance Criteria updated with the minimum-entropy/never-committed requirement. Not yet contract-verified — no code exists yet.

---
