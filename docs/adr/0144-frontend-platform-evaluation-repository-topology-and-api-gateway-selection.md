# ADR-0144: Frontend Platform Evaluation, Repository Topology, and API Gateway Selection

**Status:** Accepted (2026-09-17)  
**Date:** 2026-09-17  
**Number:** 0144  
**Deciders:** Menno  
**Supersedes:** None  
**Related:** ADR-0001 (Two-Repository Split), ADR-0004 (Author/SocialPost modeling — referenced for shared-type discussion)  

> **Acceptance note (2026-09-17):** Approved by Menno: *"With these cleared and BRD to Story allign as intended. The ADR is approved."* Companion BRD-0144, FDD-0144, TDS-0144, and Epic 20 (Stories 20.1–20.6) are fully aligned and transitioned to Approved/Ready.

## Context

`social-listening-core`'s API and frontend currently live in one combined project. Three frontend candidates (Next.js, Angular, Blazor) are being evaluated as separate prototype projects under the same program, all needing to consume the same backend independently. This requires the backend to stop being coupled to any single frontend's language or build process before evaluation can proceed cleanly.

## Decision

**D1 — Frontend platform shortlist and evaluation order.** Build working prototypes in this order: **Next.js** (primary candidate), **Angular** (second), **Blazor/.NET** (third, specifically to test whether its Azure/Entra-native integration offsets the cost of a second stack). SvelteKit and a plain Vite+React SPA are deprioritized — they scored close to or below the shortlisted candidates on the ranked criteria without adding distinct signal. **Adobe React Spectrum** and **Google Material Web** are not competing candidates; they are optional component-library layers evaluated on top of whichever framework is chosen (Spectrum pairs only with React-based candidates; Material Web is framework-agnostic).

**D2 — Repository topology.** The backend (`social-listening-core`) and each frontend candidate are split into separate repositories. The boundary between them is a **versioned OpenAPI contract**, not shared source code — each frontend repo generates its own typed client from the published spec in its own CI, rather than importing backend types directly. This keeps the backend buildable and deployable with no knowledge that any frontend exists, and keeps the boundary meaningful even for Blazor, which cannot share TypeScript types regardless.

**D3 — API gateway.** **Azure API Management** is the gateway of record, hosting and versioning the OpenAPI spec that all frontend repos build against. The **Developer tier** is used during the evaluation phase (free, non-production, no SLA — appropriate while no candidate is serving real traffic). **Logic Apps** is explicitly rejected for this role — it is a workflow-orchestration service, not an API gateway, and using it as one would fight the tool. **Google API Gateway** is explicitly rejected — the rest of the stack (Postgres, Key Vault, Service Bus, Azure AI Language, Entra ID) is Azure-native, and introducing a second cloud purely for the gateway adds cross-cloud egress cost, a second identity model, and a second console to operate, without an offsetting benefit.

## Alternatives considered

| Option | Rejected because |
|---|---|
| Shared TypeScript types between backend and frontend repos | Only works for TS-based candidates; silently re-couples 2 of 3 frontends to the backend and excludes Blazor entirely |
| Logic Apps as the API gateway | Built for workflow orchestration, not for fronting a full multi-route API surface; auto-generated Swagger only describes a single HTTP trigger |
| Google API Gateway | Cross-cloud complexity and cost given an otherwise all-Azure stack; no other component justifies a second cloud |
| Postman as the gateway | Postman is a client/testing/mocking tool with no capability to front production traffic |
| Jumping straight to APIM Standard/Premium | Unnecessary cost (~€500–€2,500/month) during a pre-production evaluation phase; Developer tier offers identical import/gateway behavior for free |

## Consequences

**Positive:**
- Backend remains independently deployable and testable with zero frontend awareness
- Any future frontend candidate can be added without touching the backend
- Evaluation of three frontends proceeds against one stable, real gateway URL rather than three ad hoc mocks

**Negative / trade-offs:**
- Blazor's prototype requires a codegen step (NSwag or Kiota) with no native type-sharing — expected and already weighed into the framework comparison, not a new cost
- APIM Developer tier must be upgraded (Consumption or Standard) before any candidate goes to production — tracked as an open item, not a blocker for evaluation
- Security scheme (Entra ID/JWT validation) is not auto-configured by the OpenAPI import and must be added as an explicit APIM policy

## Open items

- ~~Git history split method for separating the combined repo (preserve history via `git filter-repo`, or clean cut) — Menno's call, not a technical blocker either way~~ — **Resolved 2026-09-17 (Documentation Steward correction, 2026-09-24, backfilling this ADR's own record of a decision already made and executed):** clean cut, per Menno's own choice (TDS-0144's documented alternative to `git filter-repo`) — a single fresh initial commit (`3c1e636`) rather than a history-preserving rewrite. `social-listening-core` is now a real, standalone repository (`https://github.com/mdresch/social-listening-core`, private); this workspace's own git log retains full prior history, with the split point tagged `pre-story-20.1-repo-split`. See Story 20.1's own entry in `docs/user-stories/epic-20-adr-0144.md` and `docs/implementation-log.md` for the full record.
- Which APIM tier to migrate to at production, and when
- Phase/epic assignment for the resulting stories — deferred to Menno's canonical story-to-phase mapping table rather than assigned here
