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

## 2026-08-04 — reviewed docs/adr/0036-admin-ui-authentication-session-and-role-gating-mechanism.md, fifth pass (manual run, not --register — appended by hand for a complete history)

**Disposition: no new findings — all three items re-flag material already addressed or deliberately deferred, not acted on further.**

1. **Application-level secrets management (project-wide)** — this is the same gap §1 already discloses honestly ("this project has no decided real-production secrets-management strategy for any application-level secret yet") and cross-references into `docs/open-items-and-deferred-work.md` as a real, pre-existing, project-wide gap out of this ADR's own scope to solve. The reviewer flagged the disclosure itself, not an undiscovered gap.
2. **`core-client.ts` single-choke-point enforcement** — identical to the finding from two passes ago (2026-08-04, third pass, above). Already dispositioned: accepted as-is, consistent with every other convention-enforced module boundary in this project, no new enforcement added.
3. **Hand-rolled PKCE vs. Auth.js** — already an explicit, named trade-off in Decision §3 and Open Questions, with the ADR's own words that adopting Auth.js later is "a legitimate, lower-maintenance alternative" pending Story 6.1's own verification of its Entra External ID support — not a fresh gap, a re-surfacing of an already-disclosed, deliberately-deferred decision.

No further ADR revision made this pass — continuing to revise for restated findings would itself be inconsistent with this project's own engineering-pragmatism discipline (don't solve a gap twice, don't chase a reviewer's repeated flag past the point where the project owner has already made the call). ADR-0036 has now had four substantive, distinct rounds of hardening (identity-source spoofing, session lifetime, redirect-URI exactness, session-key entropy) plus this one confirming pass with nothing new — judged ready for Menno's own accept/reject review.

---

## 2026-08-04 — reviewed docs/adr/0037-self-service-tenant-signup-and-first-tenant-admin-provisioning.md (manual run, not --register — appended by hand for a complete history)

1.  **Boundary/asset affected:** Information disclosure, Tenant boundary.
    **Specific gap:** The ADR explicitly raises the question of whether to disclose the name of the existing organization when a sign-up attempt's email domain matches an already-onboarded tenant.
    **Concrete exploit scenario:** An attacker could systematically probe for the existence of organizations on the SocialEngage platform by attempting sign-ups with corporate email domains. If the platform confirms the organization's name upon domain-match rejection, it reveals sensitive information about platform adoption and specific tenant identities.
    **Suggested control:** Ensure the domain-match rejection message provides only generic information, stating that an organization with that email domain already exists and directing the user to seek an invite from their admin, without disclosing the specific organization's name.

2.  **Boundary/asset affected:** System availability, Resource consumption, Tenant creation.
    **Specific gap:** The proposed design explicitly defers the implementation of a rate-limiting mechanism to prevent bulk tenant creation by numerous distinct, newly provisioned Entra identities, stating that this remains a "genuine, currently-unresolved risk."
    **Concrete exploit scenario:** An attacker could rapidly provision a large number of disposable Entra accounts and use each to create a new tenant via the `self-service-signup` endpoint, leading to potential resource exhaustion, inflated operational costs from numerous empty tenants, or a denial-of-service condition.
    **Suggested control:** Prioritize an application-level rate-limiting solution for the self-service sign-up endpoint before it is exposed to untrusted traffic.

3.  **Boundary/asset affected:** Tenant boundary, Data integrity, Trust.
    **Specific gap:** The reliance on a static, manually maintained public-email-provider denylist means new or unlisted free email domains could be erroneously captured as unique organizational domains, leading to unintended tenant associations.
    **Concrete exploit scenario:** Users from unrelated organizations signing up via the same not-yet-denylisted free email provider could be incorrectly domain-matched to each other.
    **Suggested control:** Establish a process for regularly updating the denylist.

4.  **Boundary/asset affected:** Feature availability, Security policy enforcement, Identity provider integration.
    **Specific gap:** The feature's viability depends on ADR-0029's still-open "restrict Entra self-service sign-up at the IdP level" question being resolved against restriction — a critical inter-ADR dependency.
    **Concrete exploit scenario:** A future, isolated security-hardening decision restricting self-service sign-up at the Entra IdP level could silently disable this feature without any application-code change.
    **Suggested control:** Formally track this inter-ADR dependency and require it be reconciled before either ADR's dependent policy is changed unilaterally.

**Resolution note (same day):** ADR-0037 was still Proposed at the time of this finding. Finding 1 was a real, previously undecided gap — this ADR's own Open Questions had explicitly left it open — and was resolved: the domain-match rejection message is now decided as deliberately vague, never naming the matched organization (added to §3; the corresponding Open Questions bullet marked resolved). Findings 2–4 were confirmed to already be explicitly named, not newly discovered — ADR-0037's own §7 (rate-limiting), §4 (denylist maintenance burden), and §5/Open Questions (the ADR-0029 dependency tension) already disclose exactly these gaps honestly rather than hiding them; no further revision made for those, consistent with this project's "don't re-solve an already-disclosed gap" discipline. See ADR-0037's own Amendment Log for the full account. Not yet contract-verified — no code exists yet (Story 6.7 is Blocked pending this ADR's acceptance).

---

## 2026-08-04 — reviewed docs/adr/0037-self-service-tenant-signup-and-first-tenant-admin-provisioning.md, second pass, post-acceptance (manual run, not --register — appended by hand for a complete history)

1. **Boundary/asset affected:** Tenant boundary, Data integrity, Information disclosure. **Specific gap:** §4's denylist is permanently incomplete by construction; an unlisted public-email domain gets captured as if it were a real organization's, then blocks a second, unrelated legitimate signer-upper from the same public provider. **Suggested control:** regular denylist review/update; consider an external, version-controlled list if the false-negative rate proves problematic.
2. **Boundary/asset affected:** Abuse and rate-limiting boundary, resource exhaustion. **Specific gap:** restated — nothing bounds how many distinct, verified identities can each provision one new tenant in rapid succession. **Suggested control:** application/edge-layer rate limiting keyed on IP/user-agent/behavioral heuristics.
3. **Boundary/asset affected:** Security alerting boundary, operational visibility. **Specific gap:** restated — §8c's escalation signal is durably logged but not real-time-alerted; detection depends on manual log review. **Suggested control:** real-time alerting (Slack/email/on-call) on threshold crossing.

**Disposition (same day):** all three findings were confirmed to already be explicitly named in ADR-0037's own text (§4, §7, §8c/Open Questions respectively) — no new gap discovered, no further ADR revision made for these three, per this project's own "don't re-solve an already-disclosed gap" discipline. **Finding 1 prompted a real, substantive discussion with Menno, resolved the same day:** DNS TXT-record domain-ownership verification (the standard mechanism for this class of problem — the same pattern Microsoft 365/Google Workspace/Slack use; a WHOIS lookup was also considered and rejected, since it proves registration, not authorization) was proposed and then explicitly declined by Menno himself, verbatim: "Do Not Change anything at the moment activating a TXT on a domain whilst not being able to continue would take to long for a signup." DNS propagation/IT-process delay was judged incompatible with this endpoint's own core promise (instant, zero-touch self-service) to guard against a comparatively low-severity availability bug, not a breach. Recorded in ADR-0037 §4 and its own Amendment Log, not reopened without a demonstrated, forcing need. A related but distinct future idea (a fuller onboarding-intent-and-maturity journey, not a verification mechanism) was named as a real possible future direction, genuinely undesigned, not committed to.

---

## 2026-08-04 — reviewed docs/adr/0037-self-service-tenant-signup-and-first-tenant-admin-provisioning.md, third pass, post-acceptance (manual run, not --register — appended by hand for a complete history)

1. **Boundary/asset affected:** Denylist (§4), false-positive rejection, information disclosure of domain "taken" status. **Specific gap:** restated, with a sharper concrete scenario — an unlisted public domain gets captured, and a second signer-upper's rejection also confirms that domain is already taken. **Suggested control:** recurring denylist review, possibly incorporating external/community-maintained lists.
2. **Boundary/asset affected:** Resource exhaustion, operational overhead. **Specific gap:** restated — volumetric tenant creation by many distinct verified identities. **Suggested control:** application-layer rate limiting.
3. **Boundary/asset affected:** Identity boundary — trust in Entra's `email` claim; tenant/audit-integrity. **Specific gap, genuinely new:** §8a states email-OTP verification is a precondition, but nothing ensures the deployed Entra user flow actually keeps that setting enabled — a silent misconfiguration would let an unverified `email` claim flow straight into domain-matching, the denylist, and the audit trail. **Suggested control:** automated deployment-pipeline/startup validation that the configured user flow still requires email verification.
4. **Boundary/asset affected:** Tenant-Admin experience, operational efficiency, `domain_signup_attempts` integrity. **Specific gap, genuinely new:** an actor controlling several distinct, individually-verified mailboxes at one already-onboarded domain (e.g. `sales@target.com`, `marketing@target.com`) could generate many separate rejection/escalation entries, each surfacing as its own Same-Domain Invite Assist proposal — flooding the Tenant-Admin's dashboard. **Suggested control:** aggregate/rate-limit `domain_signup_attempts` inserts from the same domain within a time window.

**Disposition (same day):** findings 1 and 2 reconfirmed already-disclosed gaps (§4, §7) — no further action, same restraint as the prior two passes. Findings 3 and 4 were both genuine and both resolved in ADR-0037 §8a/§8b: (3) a deployment-time configuration check is now the decided minimum; whether Entra also emits a per-token `email_verified` claim for local accounts (cheaper runtime defense-in-depth) was checked against Microsoft's general ID-token claims reference — not listed there, but that reference wasn't confirmed to cover External ID/CIAM specifically, so left as a genuine, unresolved Open Question rather than asserted either way; (4) the Tenant-Admin-facing surface now aggregates to one item per domain, not one per attempt — the underlying table still records every individual attempt. **Verifying finding 1 directly surfaced a materially more serious gap neither this nor the prior Gemini pass named:** `platform_admin_role`'s own grant on `tenants` (ADR-0031 §3) covers only `status` and `license_seat_count` — never `domain` — so there was no designed way to fix a wrong or squatted `domain` value at all, not even manually. **Menno decided the same day:** extend `platform_admin_role`'s grant with `UPDATE(domain)`, fully audited via the existing `platform_admin_audit_log` mechanism, deliberately manual rather than a self-service DNS-reclaim workflow (ADR-0037 §9; ADR-0031 §3 carries a matching "Supersession update" note). **Menno also made a further, independent point about the same abuse pattern:** triggering §8c's escalation requires "the force of multiple email accounts and legitimate access" — inherently attributable, not anonymous, since §8a's OTP precondition means every escalating attempt is individually mailbox-verified. Decided: §8c's audit-log escalation entry now includes the verified email addresses behind the pattern, arming §9's manual recovery process with real contact information — deliberately not automated outreach, which would require this project's first outbound-email capability (not built anywhere today) and was scoped out as a separate, larger decision. See ADR-0037's own Amendment Log for the full, dated account of all of the above.

---

## 2026-08-04 — reviewed docs/adr/0037-self-service-tenant-signup-and-first-tenant-admin-provisioning.md, fourth pass, post-acceptance (manual run, not --register — appended by hand for a complete history)

1. **Boundary/asset affected:** Privilege/network boundary (`tenant_signup_role` credential). **Specific gap:** no explicit detail on how this role's own database credential is protected (rotation, least-privilege access to the credential itself). **Suggested control:** credential rotation and restricted access, consistent with or exceeding `platform_admin_role`'s own posture.
2. **Boundary/asset affected:** Network/abuse boundary. **Specific gap:** restated — §7's volumetric-abuse gap. **Suggested control:** multi-layer rate limiting (IP, per-subject, device fingerprinting).
3. **Boundary/asset affected:** Privilege/operational visibility. **Specific gap:** restated — §8c's escalation is durably logged, not real-time-alerted. **Suggested control:** SIEM/on-call integration.
4. **Boundary/asset affected:** Identity/configuration boundary. **Specific gap:** restated — §8a's own already-flagged Open Question on a runtime `email_verified` check. **Suggested control:** implement the runtime check if available.
5. **Boundary/asset affected:** Configuration/data integrity (denylist). **Specific gap:** restated — §4's denylist false-negative, framed as "squatting" of a public email domain. **Suggested control:** periodic denylist review.
6. **Boundary/asset affected:** Tenant boundary/information disclosure (Same-Domain Invite Assist). **Specific gap, genuinely new:** the per-domain aggregation (added the prior pass) shows a count but risked not surfacing the individual verified email addresses a Tenant-Admin needs to actually act on a request. **Suggested control:** an expandable/drill-down view listing the individual addresses behind an aggregated count.

**Disposition (same day):** findings 2, 3, and 4 reconfirmed already-disclosed gaps — no action. Finding 5 is also already disclosed, and is now more resolved than the finding assumed: ADR-0037 §9 (added the same day, before this pass ran) already provides the manual recovery path the "squatting" framing implicitly needed. Findings 1 and 6 were genuine and resolved: (1) confirmed as the same already-disclosed, project-wide "no secrets-management strategy for any application/database credential" gap (ADR-0036 §1, `docs/open-items-and-deferred-work.md`) — applies equally to every bypass role this project has (`platform_admin_role`, `identity_resolver_role`, now `tenant_signup_role`), not a new or role-specific exposure; noted in ADR-0037 §1, not re-solved narrowly for this one role. (6) Decided: the aggregated summary item expands on demand to the full list of distinct verified emails — the same underlying `domain_signup_attempts` data surfaced two ways (a count for at-a-glance scanning, the full list on request), not a second mechanism. See ADR-0037's own Amendment Log for the full account.

---

## 2026-08-04 — reviewed stdin (e.g. git diff)

### Resolution of Previous Findings

1.  **Finding Resolved:** The previously identified inability for the `platform_admin_role` to correct a wrong or squatted `domain` value on the `tenants` table.
    **Resolution Note:** The `Supersession update, 2026-08-04` in `docs/adr/0031-tenants-table-shape.md` explicitly documents that ADR-0037 §9 extends `platform_admin_role`'s database grant to include `UPDATE(domain)`. This was a direct result of a finding during the third pass review of ADR-0037, and the change establishes an audited, manual recovery path for this specific data integrity concern.

2.  **Finding Resolved:** All security findings related to **ADR-0036** (Admin UI's authentication and session mechanism).
    **Resolution Note:** `docs/adr/0036-admin-ui-authentication-session-and-role-gating-mechanism.md` now shows a `Status: Accepted (2026-08-04)`. The accompanying `Acceptance note` explicitly confirms that all four review-round amendments have been incorporated into the accepted ADR. These amendments addressed concerns regarding the identity source for `GET /v1/me` (spoofing/disclosure risk), the absence of a maximum session lifetime, the lack of an exact-match redirect URI control for the OAuth flow, and the absence of key-management minimums for the session cookie's encryption key.

3.  **Finding Resolved:** Specific trust boundary gaps identified during the review of **ADR-0037** (Self-service tenant sign-up and first tenant-admin provisioning).
    **Resolution Note:** The `Resolution note` from the 2026-08-04 first pass of ADR-0037 in `docs/security/security-register.md` states that finding 1 (information disclosure of organization name on domain match) was resolved by ensuring the rejection message is deliberately vague. The third pass review of ADR-0037 (also 2026-08-04) identified and resolved finding 3 (ensuring Entra's email-OTP verification setting is enforced via a deployment-time configuration check) and finding 4 (preventing flooding of the Tenant-Admin dashboard with `domain_signup_attempts` by aggregating entries). The fourth pass review (also 2026-08-04) identified and resolved finding 6 (providing an expandable view to surface individual email addresses behind an aggregated `Same-Domain Invite Assist` count to the Tenant-Admin).

### New Findings

No new trust boundary gaps fitting the specified criteria were identified in the material under review beyond those already explicitly acknowledged, tracked, or resolved in the project's documentation and security register. The changes primarily focus on documenting the acceptance of ADRs that have undergone extensive security review and consolidating existing known open items.

---
