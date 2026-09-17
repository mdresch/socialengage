# FDD-0144: Frontend Prototype Reference Scope

**Status:** Approved (2026-09-17)  
**Related:** BRD-0144 (Frontend Platform Selection), ADR-0144 (Frontend Platform Evaluation, Repository Topology, and API Gateway Selection)  

## Purpose

Define the functional behavior that each frontend candidate (Next.js, Angular, Blazor) must implement identically, so that the platform comparison measures the *frameworks*, not differences in functional scope between prototypes.

## Reference screen: Watchlist view

Chosen because it is read-heavy, exercises the connector/tenant data relationships already documented in the platform's architecture, and is small enough to build in three stacks within a reasonable evaluation window.

### Functional requirements (candidate scope — confirm against the actual backend data model before build)

1. Display a list of watchlists, each showing at minimum: name, associated tenant, and status
2. For each watchlist, display its associated connector(s) and their health/connection status
3. Support viewing a single watchlist's detail (its full configuration and associated posts/authors, if exposed by the API)
4. Reflect authentication state — the screen should not render data for an unauthenticated user
5. Surface API errors (e.g., connector unreachable, tenant not found) in a user-visible way rather than failing silently

> **Open item:** exact watchlist fields, CRUD scope (read-only vs. create/edit), and pagination behavior are not yet confirmed against `social-listening-core`'s actual API — needed before implementation starts, not before this document is reviewed.

## User roles

- **Tenant admin** — the only role in scope for the prototype comparison; broader role-based access (platform admin, connector admin) is out of scope for evaluation but should not be architecturally precluded

## Functional flow

1. User authenticates (Entra ID, via the APIM gateway)
2. User lands on the watchlist list view
3. User selects a watchlist to view its detail and associated connector health
4. User can navigate back to the list

## Non-functional considerations in scope for comparison

- **Accessibility** — each prototype's component choices (including any design-system layer used) should be evaluated for baseline accessibility, since this is a stated strength of both candidate design systems (Adobe React Spectrum, Google Material Web)
- **Load behavior** — how each stack handles the loading/empty/error states for the watchlist list, since this is a recurring pattern across the wider admin console

## Out of scope for the prototype

- Connector management, tenant management, and platform admin screens (full admin console build-out)
- Write operations (create/edit/delete watchlists) unless confirmed as needed for a fair comparison
- Production-grade error handling, retry logic, or offline behavior
