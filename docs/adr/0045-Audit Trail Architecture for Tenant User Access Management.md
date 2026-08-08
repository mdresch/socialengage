Proposed ADR
Title: Audit Trail Architecture for Tenant User Access Management

Rationale:
Story 1.9 requires auditing of user access changes (access_ends_at) for offboarding flows. While Story 5.17 is mentioned for audit mechanism design, there is no explicit ADR that documents audit trail architecture, schema design, data retention, or access control to audit logs.

Draft Content:

Define audit log storage tables and columns recording user identity, timestamp, before/after state, operation type.
Ensure RLS controls limit log visibility by tenant and restrict admin role access.
Specify integration points with PATCH /v1/tenants/users/:id endpoint.
Define retention policies balancing compliance and storage cost.
Outline event sourcing or soft-delete patterns if applicable.