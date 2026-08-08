Proposed New ADR (if admin UI auth is not covered)
Title: Admin UI Authentication and Authorization Architecture

Rationale:
To complement Story 1.1's boundaries and secure the admin UI, an ADR should formally document admin UI authentication/session management, including token storage, role gating, session lifetime, and integration with backend auth (possibly ADR-0036 covers this, but confirm completeness).

Draft Content:

Describe session cookie usage, no browser-stored access tokens.
Define roles and their route gating policies.
Document integration with OAuth/OIDC providers, token refresh mechanisms.
State how the admin UI securely resolves user identity without X-Tenant-Id.
Address test and dev environment considerations.