# BRD-0144: Frontend Platform Selection for SocialEngage

**Status:** Approved (2026-09-17)  
**Related:** ADR-0144 (Frontend Platform Evaluation, Repository Topology, and API Gateway Selection)

## Purpose

Define the business justification and requirements for selecting a frontend platform for the SocialEngage admin console (watchlist, connector, tenant, and platform admin screens), and for the repository/gateway structure needed to evaluate multiple candidates without compromising the backend's independence.

## Background

`social-listening-core`'s backend and frontend currently live in a single combined project. As the program has matured, the need has emerged to evaluate more than one frontend technology against the same backend before committing to a long-term platform — and to do so without the backend depending on, or being entangled with, any one frontend choice.

## Business objectives

1. Select a frontend platform that minimizes long-term maintenance risk for a **solo developer**, consistent with the program's existing documentation-first, ADR-gated decision process.
2. Preserve the backend's independence — `social-listening-core` must remain deployable, testable, and consumable by any number of frontends, present or future, without frontend-specific coupling.
3. Make the platform decision on **evidence from working prototypes** built against the real API, not on paper comparison alone.
4. Keep evaluation and eventual production cost proportionate — avoid premature spend on infrastructure tiers not yet needed.

## Scope

- Comparative evaluation of three frontend candidates: Next.js, Angular, Blazor (.NET)
- Repository separation of backend and frontend(s)
- Selection of an API gateway to mediate between backend and frontend candidates during evaluation and beyond

## Out of scope

- Full build-out of the admin console (watchlist, connector, tenant, platform screens) in any candidate — evaluation uses a single reference screen (watchlist) only
- Production hardening of the API gateway (tier upgrade, multi-region, SLA) — deferred until a platform is chosen and real traffic exists
- Design-system/component-library selection (Adobe React Spectrum, Google Material Web) — treated as a downstream decision once the base framework is chosen

## Stakeholders

- Menno — solo developer/architect, sole decision authority and implementer across backend, frontend, and infrastructure

## Success criteria

- A frontend platform is selected based on working prototypes evaluated against the ranked criteria (maintainability, dev velocity, hosting/ops simplicity, Azure/M365 fit, shared types with the backend)
- `social-listening-core` builds, tests, and deploys with no awareness of any frontend repository
- All three frontend candidates can independently consume the same backend through one published, versioned API contract

## Constraints

- Solo maintainer — evaluation and implementation effort must be sustainable by one person
- Existing Azure/M365 ecosystem (Postgres, Key Vault, Service Bus, Azure AI Language, Entra ID) — new infrastructure choices should not introduce unjustified cross-cloud dependencies
- Documentation-first convention — this decision is gated by an ADR before implementation proceeds, and by user stories before sprint work begins

## Assumptions

- The backend's API surface is stable enough during the evaluation window that a single OpenAPI contract can meaningfully serve all three prototypes
- The watchlist screen is representative enough of the broader admin console's needs (data-table-heavy, connector/tenant relationships) to serve as a fair comparison point across candidates

## Risks

- Evaluation effort across three full stacks (React/Next.js, Angular, .NET/Blazor) is significant for a solo developer — mitigated by scoping each prototype to one reference screen rather than the full console
- A platform decision made too early, before real usage patterns emerge, could require rework — mitigated by treating this as Proposed/evaluation-stage, not a final production commitment
