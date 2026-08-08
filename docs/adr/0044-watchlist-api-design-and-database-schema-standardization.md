Proposed ADR
Title: Watchlist API Design and Database Schema Standardization

Rationale:
Story 1.5 introduces a complex tenant-scoped REST CRUD interface for watchlists involving multiple filters, RLS, and detailed patch updating semantics. No explicit ADR currently documents the schema or API design choices for watchlists or defines conventions for future similar objects’ designs. This risks inconsistent implementations and complicates downstream extensions.

Draft Content:

Context:
The watchlists feature serves as a critical content-filtering mechanism for tenants. It requires fine-grained DB RLS for tenant isolation, multi-field filtering, and partial update semantics. Current implementation was built without an explicit architectural decision record. Formalizing this as an ADR enables consistent standards across similar REST-driven resource patterns.

Decision:

Use a dedicated watchlists table in Postgres with JSONB columns for flexible data sections, enforced RLS policies per tenant.
Follow RESTful design for CRUD mapped to standard HTTP verbs on /v1/watchlists, with filtering via query parameters.
Partial updates to support PATCH semantics, updating only provided fields, and automatically update timestamps.
Enforce tenant ID via bearer token authentication; avoid legacy headers like X-Tenant-Id.
Define acceptable match types and require validation on boolean query fields.
Trade-offs:

Gains clear, reusable design pattern and improves maintainability.
Could add upfront design overhead but pays off long-term as platform scales.
Consequences:

Downstream teams can build watchlist-consumer features confidently.
Enables automated contract test generation and documentation.
Provides a template for future similar tenant-scoped CRUD endpoints.