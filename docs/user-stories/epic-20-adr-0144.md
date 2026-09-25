# Epic 20: Frontend Platform Evaluation (ADR-0144)

**Status:** Ready (ADR-0144 Accepted 2026-09-17) — *Documentation Steward correction, 2026-09-25: Story 20.1 below has since shipped (`**Status:** Built`); this epic-level line is a rollup of the epic's overall stage, not a per-story field, and is left as "Ready" since five of six stories (20.2–20.6) remain unbuilt — see each story's own Status line for the authoritative per-story state.*  
**Phase:** Unassigned — defer to Menno's canonical story-to-phase mapping table rather than assigning here  
**Related:** ADR-0144, BRD-0144 (Frontend Platform Selection), FDD-0144 (Frontend Prototype Reference Scope), TDS-0144 (Repository Segregation and API Gateway Implementation)

Evaluate Next.js, Angular, and Blazor as candidate frontends for SocialEngage's admin console by building a common reference screen against a shared, independently-hosted backend API, and select a platform based on that evidence.

---

## Story 20.1 — Separate backend and frontend repositories
**Source:** ADR-0144 (Accepted 2026-09-17) · **Status:** Built  
**Built:** 2026-09-17 — social-listening-core@fc5a6856 (OpenAPI generation), then the standalone repo extraction below

**Notes:** All three acceptance criteria are now satisfied. (1) "Backend publishes its OpenAPI spec as a CI artifact on every build" — a route-owned OpenAPI-operation registry (`src/http/openapi/registry.ts`), a document generator sourced from it (`src/http/openapi/generateOpenApiDocument.ts`), and `npm run openapi:generate`, all contract-tested (`social-listening-core@fc5a6856`). (2) "Repo builds and passes CI with no frontend code present" — was already true (zero frontend deps) and is now demonstrated directly: **`social-listening-core` is a real, standalone repository** at `https://github.com/mdresch/social-listening-core` (private), with its own CI (`.github/workflows/ci.yml`) that builds, typechecks, tests, and publishes `openapi.json` as a build artifact. (3) "Original combined repo history is either preserved via `git filter-repo` or clean-cut" — **clean-cut**, per Menno's own choice (TDS-0144's documented alternative to `git filter-repo` — a single fresh initial commit, `3c1e636`, rather than a history-preserving rewrite). The `socialengage` repo's own git log retains full prior history for this code; the split point is tagged here as `pre-story-20.1-repo-split`. **The combined `socialengage` repo is not being retired** — it remains the place where `social-listening-admin`, all process docs (ADRs/BRDs/FDDs/stories/Implementation Log), and the mandatory `implement-story`/`heal-contract-failure` workflow live, per ADR-0144's own Open Items (repo retirement is a later step, after the frontend candidates in Stories 20.2–20.6 exist). See `.claude/skills/openapi-spec-generation/SKILL.md` and `docs/implementation-log.md`'s Story 20.1 entries (two passes: the OpenAPI-generation healing pass, then this repo-extraction follow-up).

**As the** maintainer,  
**I want** `social-listening-core` split into its own repository, independent of any frontend,  
**so that** the backend can be built, tested, and deployed with no frontend dependency.

**Acceptance criteria:**
- `social-listening-core` repo builds and passes CI with no frontend code present
- Backend publishes its OpenAPI spec as a CI artifact on every build
- Original combined repo history is either preserved via `git filter-repo` or clean-cut, per the TDS

---

## Story 20.2 — Stand up the API gateway
**Source:** ADR-0144 (Accepted 2026-09-17) · **Status:** Ready  
**Built:** not yet

**As the** maintainer,  
**I want** an Azure API Management (Developer tier) instance importing the `social-listening-core` OpenAPI spec,  
**so that** all frontend candidates have a single, stable gateway URL to build against.

**Acceptance criteria:**
- OpenAPI spec imports into APIM without errors
- Entra ID/JWT validation policy is configured (not auto-provided by import)
- Gateway URL is documented and shared across all three frontend stories below

---

## Story 20.3 — Next.js prototype: watchlist reference screen
**Source:** ADR-0144 (Accepted 2026-09-17) · **Status:** Ready  
**Built:** not yet

**As the** maintainer,  
**I want** a Next.js prototype implementing the watchlist reference screen (per the FDD) against the APIM gateway,  
**so that** Next.js can be evaluated against the ranked criteria using real data.

**Acceptance criteria:**
- Implements all functional requirements listed in the FDD's reference scope
- Consumes the backend only through the APIM gateway URL and a generated typed client (`openapi-typescript`)
- Deployed to Azure (Static Web Apps or App Service) for hands-on evaluation

---

## Story 20.4 — Angular prototype: watchlist reference screen
**Source:** ADR-0144 (Accepted 2026-09-17) · **Status:** Ready  
**Built:** not yet

**As the** maintainer,  
**I want** an Angular prototype implementing the same watchlist reference screen,  
**so that** it can be compared against Next.js on equal functional footing.

**Acceptance criteria:**
- Same functional scope and acceptance bar as Story 20.3
- Generated client and deployment approach documented for parity with the other candidates

---

## Story 20.5 — Blazor prototype: watchlist reference screen
**Source:** ADR-0144 (Accepted 2026-09-17) · **Status:** Ready  
**Built:** not yet

**As the** maintainer,  
**I want** a Blazor prototype implementing the same watchlist reference screen,  
**so that** the Azure/Entra-native integration trade-off can be tested against the cost of maintaining a second stack.

**Acceptance criteria:**
- Same functional scope and acceptance bar as Story 20.3
- Client generated via NSwag or Kiota from the published OpenAPI spec
- Entra ID integration specifically evaluated and noted, since this is Blazor's stated differentiator

---

## Story 20.6 — Document the comparison outcome
**Source:** ADR-0144 (Accepted 2026-09-17) · **Status:** Ready  
**Built:** not yet

**As the** maintainer,  
**I want** a written scorecard recording actual build experience for each candidate against the ranked criteria (maintainability, dev velocity, hosting/ops simplicity, Azure/M365 fit, shared types),  
**so that** the final platform decision is evidence-based and the ADR can move from Proposed to Accepted.

**Acceptance criteria:**
- Scorecard references concrete findings from Stories 20.3–20.5, not the original paper comparison alone
- Outcome feeds back into ADR-0144 as the basis for its Accepted/rejected status
