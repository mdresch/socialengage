# TDS-0144: Repository Segregation and API Gateway Implementation

**Status:** Approved (2026-09-17)  
**Related:** ADR-0144 (Frontend Platform Evaluation, Repository Topology, and API Gateway Selection), FDD-0144 (Frontend Prototype Reference Scope), BRD-0144 (Frontend Platform Selection)
  

## Current state

`social-listening-core`'s backend and frontend code live in one combined repository, coupling backend deployment to frontend presence and making independent frontend evaluation impractical.

## Target repository topology

- `social-listening-core` — backend only; publishes its OpenAPI spec as a build artifact on every CI run
- `social-listening-frontend-nextjs`
- `social-listening-frontend-angular`
- `social-listening-frontend-blazor`
- (Optional, documentation-only) a program-level repo or ADR folder tracking which frontend/backend versions are known-compatible — no code, to avoid becoming a second coupling point

## Contract boundary

The backend publishes a versioned OpenAPI (Swagger) spec. Each frontend generates its own typed client from that spec in its own CI pipeline — no shared source, no direct import of backend types.

| Frontend | Client generation tooling |
|---|---|
| Next.js | `openapi-typescript` (or equivalent) |
| Angular | `openapi-typescript` / Angular-specific OpenAPI codegen |
| Blazor | NSwag or Kiota |

## Repository split procedure

1. Tag the current combined repo's `HEAD` before making any changes, as a rollback point
2. Extract backend history first, using `git filter-repo` (preferred over `filter-branch` or `subtree split` for speed and reliability):

```bash
git clone <combined-repo> social-listening-core
cd social-listening-core
git filter-repo --path backend/ --path-rename backend/:''
```

3. Push to the new `social-listening-core` remote; confirm it builds, tests, and publishes its OpenAPI spec standalone, with no reference to frontend code
4. Extract the frontend, from a separate clone:

```bash
git clone <combined-repo> social-listening-frontend-nextjs
cd social-listening-frontend-nextjs
git filter-repo --path frontend/ --path-rename frontend/:''
```

5. Point the new frontend repo's CI at the published OpenAPI spec; confirm the generated client matches the live backend
6. Repeat step 4–5 for the Angular and Blazor prototypes
7. Retire the combined repo — archive it, or repurpose it as the documentation-only program-level tracking repo

> If commit history in the combined repo isn't valuable yet, a simpler clean-cut split (copy current state into a fresh repo with a new initial commit) is an acceptable alternative to steps 2–6.

## API gateway implementation

- **Service:** Azure API Management, **Developer tier** during evaluation (free; non-production; no SLA; single scale-out unit)
- **Import:** OpenAPI spec imported via URL or file upload in the Azure portal (Design > Front End > OpenAPI Specification Editor), or via the REST API for automation
- **What import provides automatically:** API definition, operations, request/response schemas, parameter details, developer portal display
- **What import does NOT provide — must be configured manually:** security scheme / JWT validation policy for Entra ID auth; server URLs from the spec are used only to set the initial backend URL, since APIM fronts the backend with its own gateway URL
- **Gateway URL:** becomes the single endpoint all three frontend repos target — none of them call `social-listening-core` directly
- **Validation:** validate the OpenAPI document (Swagger Editor or the portal's designer) before import to avoid the generic "one or more fields contain incorrect values" import error

## Production migration path (not yet actioned)

Before any frontend candidate serves real traffic, move off the Developer tier to Consumption (pay-per-call, no fixed fee) or Standard (fixed monthly cost, higher limits, multi-region support at Premium). This TDS does not select a target tier — that decision depends on actual traffic patterns once a platform is chosen.

## CI/CD summary

1. Backend CI: build → test → publish OpenAPI spec as artifact → deploy
2. APIM: import/update from published spec (manual during evaluation; automatable later via Azure DevOps/GitHub Actions APIM extension)
3. Each frontend CI: fetch current spec from APIM or backend artifact → generate typed client → build → test → deploy
