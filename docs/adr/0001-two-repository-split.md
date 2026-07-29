# ADR-0001: Split into `social-listening-core` and `social-listening-admin` repositories

**Status:** Accepted (2026-07-28)
**Source:** Design Spec §2 "Architecture Overview"

## Context

The subsystem needs a backend that ingests, normalizes, enriches, and stores social data, plus an admin surface for tenants to connect platforms, manage watchlists, and check connector/AI-provider health. Downstream subsystems (Brand Reputation & Alerts, Social Care, Social Selling) will also need to consume this subsystem's data, and are explicitly out of scope for this spec but must not be blocked by decisions made here.

## Decision

Split the subsystem into two repositories:

- **`social-listening-core`** — TypeScript/Node.js backend: connector framework, ingestion, normalization, enrichment, storage, event publishing, and the REST API. Designed to be fully usable independent of any UI.
- **`social-listening-admin`** — Next.js admin UI. Talks to `social-listening-core` exclusively through its REST API; it never accesses the database directly.

## Consequences

**Positive**
- Downstream subsystems (Brand Reputation, Social Care, Social Selling) can consume `social-listening-core`'s REST API and Service Bus events without any dependency on the admin UI.
- The core is independently deployable, testable, and versionable; the admin UI can iterate on its own release cadence.
- Forcing the admin UI through the REST API (rather than direct DB access) means the API surface is exercised by the project's own UI from day one, which keeps it honest as a real product surface rather than an afterthought.

**Negative**
- Two repositories to version, deploy, and keep compatible; API changes in core must be coordinated with the admin UI, and eventually with downstream subsystems (Brand Reputation & Alerts, Social Care, Social Selling), which per §7 will consume core's output two ways — the REST API for on-demand/historical reads and Service Bus events for real-time notification (see ADR-0012, ADR-0013).
- Local development requires running both repos (or mocking the core API) to exercise the admin UI end-to-end.
- The spec does not state an API versioning or compatibility policy (e.g., a `/v1/` prefix, deprecation window) for `social-listening-core`'s REST API. With two independently deployable repos — soon three-plus once downstream subsystems integrate — a core change could break the admin UI or a downstream consumer silently unless a versioning strategy is established; this is a gap worth closing with its own ADR before the first breaking change is needed.

## Alternatives Considered

- **Monorepo, single deployable** — simpler local dev and atomic commits across UI/backend, but weakens the "core is usable without any UI" property and makes it easier to accidentally couple the admin UI to internal core modules instead of the REST API.
- **Admin UI reads the database directly** — avoids API round-trips, but breaks tenant-isolation guarantees (RLS is enforced at the DB layer per ADR-0015, but a second direct consumer doubles the surface area that must get this right) and creates a second system that must track every schema change.
