# Integration Management Plan
## SocialEngage Project — Supplementary Plan: Integration

**Project:** Social Listening & Engagement Platform (SocialEngage)  
**Phase:** Phase 1 — Social Listening / Insights Subsystem  
**Owner:** Menno Drescher  
**Date:** 2026-08-01  
**Status:** Draft — Integration Management (PMBOK Knowledge Area)  
**Version:** 1.1

---

## 1. Purpose

This plan defines **how the various project components, subsystems, and dependencies are coordinated** for the SocialEngage project. It addresses the integration of architectural decisions, user stories, code components, and external dependencies into a cohesive, functioning system.

While PMBOK 7th Edition treats Integration as a core competency that permeates all Performance Domains rather than as a separate domain, this supplementary plan explicitly addresses the **coordination challenges** specific to a modular, phase-gated, ADR-driven project. It ensures that the sum of the project's parts works together correctly.

---

## 2. Scope

### 2.1 What This Plan Covers
- Integration of ADRs, stories, and implementation artifacts
- Cross-component dependencies and interfaces
- Internal integration (within social-listening-core)
- External integration (with Azure, API providers)
- Integration testing strategies
- Interface management
- Configuration management

### 2.2 What This Plan Does NOT Cover
- Architectural decisions (see ADR series)
- Work execution (see Project-Work-Management-Plan.md)
- Delivery processes (see Delivery-Management-Plan.md)
- Risk management (see Uncertainty-Management-Plan.md)
- Cost management (see Cost-Management-Plan.md)

---

## 3. Approach

### 3.1 Core Philosophy
**"The architecture is only as good as its weakest integration point."**

Given this is a modular, phase-gated project, integration focuses on:
1. **Explicit Interfaces:** Every component boundary is clearly defined
2. **Contract-First Integration:** Interfaces are tested before implementation
3. **Phase-Gated Integration:** Integration happens at phase boundaries, not ad-hoc
4. **Dependency Chains:** All integration points are traceable through the ADR-stories-implementation chain

### 3.2 Integration Challenges for This Project

| Challenge | Root Cause | Mitigation |
|-----------|------------|------------|
| Cross-component dependencies | Modular architecture with shared infrastructure | Explicit dependency tracking in implementation-plan.md |
| Phase sequencing | Features built across multiple phases | Phase-gated delivery with clear exit criteria |
| External dependencies | Cloud services and API providers | Wrapper abstractions (RequestGate, credentialStore) |
| Data model consistency | Multiple tables with relationships | RLS policies, migration scripts |
| Event flow consistency | Async processing across components | Event schema versioning (ADR-0019), Service Bus topics |

### 3.3 Integration Model

```
ADR Decisions (Architectural Contracts)
    ↓
User Stories (Feature Contracts)
    ↓
Jest Contracts (Executable Specifications)
    ↓
Component Implementation (Code)
    ↓
Cross-Component Integration (Interfaces)
    ↓
System Integration (End-to-End)
    ↓
Phase Verification (Milestone)
```

Integration happens at **every level**, with verification at each step.

---

## 4. Roles & Responsibilities

### 4.1 Human Roles

| Role | Responsibilities | Current Assignment |
|------|------------------|-------------------|
| **Integration Architect** | Defines integration patterns and standards | Menno Drescher |
| **Interface Owner** | Owns specific integration points (e.g., RequestGate, credentialStore) | Menno Drescher |
| **Integration Tester** | Verifies cross-component contracts and data flows | Menno + Automated |
| **Dependency Manager** | Tracks and manages external dependencies | Menno Drescher |

### 4.2 AI Agent Roles

| Role | Responsibilities | Engagement |
|------|------------------|------------|
| **AI Security Reviewer** | Reviews integration security (auth, encryption, boundaries) | Episodic |
| **AI Engineering Pragmatism Reviewer** | Reviews integration complexity | Episodic |
| **AI Delivery Agent** | Implements integration contracts and code | Per story |

---

## 5. Processes & Procedures

### 5.1 Integration Planning

#### 5.1.1 Integration Identification

**Triggers:**
- New ADR that affects multiple components
- New story that depends on existing components
- New external dependency
- Phase transition

**Process:**
1. **Identify Integration Points:**
   - Component-to-component interfaces
   - Component-to-external service interfaces
   - Data flow paths
   - Event flow paths

2. **Document Interfaces:**
   - Input/output contracts
   - Error handling contracts
   - Performance expectations
   - Security boundaries

3. **Define Dependencies:**
   - What must exist before integration
   - What order integration must happen in
   - What can be parallelized

4. **Update Integration Map:**
   - Add to this plan's Appendix A
   - Update `implementation-plan.md` dependency sections

#### 5.1.2 Integration Strategy Selection

**Integration Patterns Used:**

| Pattern | Usage | Example |
|---------|-------|---------|
| **Direct Function Call** | Internal module integration | `acquireForProvider()` → `runIngestionAttempt()` |
| **Database Mediation** | Shared data state | `social_posts` table with RLS |
| **Event-Driven** | Async notification | Service Bus events (future) |
| **Wrapper Abstraction** | External service isolation | `RequestGate` wraps rate limiting |
| **Credential Store** | Secure credential management | `credentialStore` wraps Key Vault |
| **Provider Connector** | Platform API abstraction | `ProviderConnector` base class |

**Strategy Selection Criteria:**
1. **Coupling:** Minimize tight coupling between components
2. **Testability:** Integration points must be contract-testable
3. **Flexibility:** Allow for future changes (e.g., swappable AI providers)
4. **Security:** Maintain trust boundaries (tenant isolation, credential encryption)

### 5.2 Interface Management

#### 5.2.1 Internal Interfaces

**Component Integration Matrix:**

| Source Component | Target Component | Integration Point | Type | Contract | Status |
|-----------------|------------------|-------------------|------|----------|--------|
| provider-connector-framework | connector-health-and-error-handling | RequestGate → IngestionRun error classification | Function call | Jest contracts | ✅ Integrated |
| provider-connector-framework | credential-envelope-encryption | Connector → credentialStore | Function call | Jest contracts | ✅ Integrated |
| social-post-lineage | ingestion-events | SocialPost → IngestionRun | DB relationship | SQL + Jest | ✅ Integrated |
| watchlist-matching | social-post-enrichment | Watchlist → Post enrichment | Pipeline | Jest contracts | ⚠️ Not yet wired |
| ingestion-events | service-bus-abstraction | publishEvent() → Service Bus | Function call | Jest contracts | ⏳ Future (Phase 3) |

**Internal Interface Standards:**
1. **Explicit Contracts:** Every interface has Jest contracts
2. **Error Handling:** All error paths are defined and tested
3. **Tenant Context:** All requests use the authenticated identity resolved by middleware (`req.tenantId`, `req.userId`, and `req.role`); client-supplied `X-Tenant-Id` is not trusted (ADR-0033)
4. **Rate Limiting:** All external calls go through RequestGate
5. **Credentials:** All credential access goes through credentialStore

#### 5.2.2 External Interfaces

**External Integration Matrix:**

| Component | External Service | Integration Point | Type | Wrapper | Status |
|-----------|------------------|-------------------|------|---------|--------|
| All connectors | Azure Key Vault | Credential storage | API | credentialStore | ✅ Integrated (Story 5.3) |
| All connectors | PostgreSQL | Data storage | DB | pg client | ✅ Integrated (Story 1.2, 5.4) |
| GNews connector | GNews API | News search | HTTP | pollGNewsSearch | ✅ Integrated (Story 2.7) |
| Newswire connector | GlobeNewswire RSS | Feed polling | HTTP | direct RSS | ✅ Integrated (Story 2.6) |
| Newswire connector | PR Newswire RSS | Feed polling | HTTP | direct RSS | ✅ Integrated (Story 2.6) |
| All connectors | Azure Service Bus | Event publishing | SDK | publishEvent | ⏳ Future (Phase 3) |
| AI enrichment | Azure AI Language | Text analysis | HTTP | AIProviderConnector | ⏳ Future (Phase 2) |

**External Interface Standards:**
1. **Wrapper Pattern:** All external calls go through wrapper abstractions
2. **Credential Management:** No hardcoded credentials; all through Key Vault
3. **Error Classification:** External errors classified and handled consistently
4. **Rate Limiting:** All external calls respect per-tenant rate limits
5. **Monitoring:** External service health is monitored

### 5.3 Integration Testing

#### 5.3.1 Integration Test Types

| Test Type | Scope | Tools | Frequency |
|-----------|-------|-------|-----------|
| **Component Contract** | Single component behavior | Jest | Per commit |
| **Cross-Component Contract** | Two+ components working together | Jest | Per story |
| **End-to-End Flow** | Full pipeline (poll → gate → normalize → match → enrich → publish) | Jest + Manual | Per phase |
| **External Integration** | Component + external service | Jest against real services | Per connector |
| **Regression** | All existing functionality | Full Jest suite | Per commit |

#### 5.3.2 Integration Test Execution

**Process:**
1. **Component-Level:**
   - Run component's Jest contracts
   - Verify all pass

2. **Cross-Component:**
   - Run contracts that span multiple components
   - Verify component interactions work correctly

3. **End-to-End:**
   - Exercise full data flow for a connector
   - Verify: poll → gate → normalize → store → health update

4. **External:**
   - Run against real external services (GNews, Newswire, Azure)
   - Verify credentials, rate limiting, error handling

**Current Integration Test Status (last verified 2026-08-03):**
- Component contracts: 159/159 passing, 32/32 suites ✅
- Cross-component contracts: All passing ✅
- End-to-end flow: GNews (Story 2.7) and Newswire (Story 2.6) verified ✅
- External integration: GNews, Newswire, PostgreSQL, Key Vault verified ✅

#### 5.3.3 Integration Issues

**Known Integration Gaps:**

| Gap | Components | Impact | Status | Resolution |
|-----|------------|--------|--------|------------|
| Watchlist matching not wired | watchlist-matching ↔ connectors | Medium | ⚠️ Open | Phase 1 completion |
| publishEvent() not wired | ingestion-events ↔ connectors | Medium | ⚠️ Open | Phase 3 start |
| Entra sign-in and bearer-token identity resolution not implemented | Admin UI ↔ core API authentication middleware | High | ⏳ Open | Implement ADR-0029–0033 before production UI |
| Connector OAuth token exchange not implemented | credential-envelope-encryption ↔ OAuth platforms | Medium | ⏳ Deferred | First OAuth connector, such as Reddit; separate from Entra sign-in |
| Connector ownership authorization not implemented | connector CRUD ↔ users/roles/credentials | High | ⏳ Open | Implement ADR-0034 |
| Enrichment not wired | social-post-enrichment ↔ ingestion pipeline | High | ⏳ Open | Phase 2 start |
| Service Bus not integrated | ingestion-events ↔ azure-service-bus | Medium | ⏳ Deferred | Phase 3 start |

**Integration Issue Resolution:**
1. Identify the gap in integration testing
2. Trace the expected data/event flow
3. Implement the missing wiring
4. Add integration contracts to verify
5. Run full regression suite
6. Update this plan and `open-items-and-deferred-work.md`

### 5.4 Configuration Management

#### 5.4.1 Configuration Artifacts

| Artifact | Purpose | Location | Format |
|----------|---------|----------|--------|
| `.env.example` | Environment variable template | repo root | .env file |
| `docker-compose.test.yml` | Test environment configuration | social-listening-core | YAML |
| `docker-compose.dev.yml` | Dev environment configuration | social-listening-core | YAML |
| Migration scripts | Database schema | social-listening-core/migrations | SQL |
| Azure infrastructure | Cloud resources | Future: Bicep/Terraform | Bicep/TF |

#### 5.4.2 Configuration Standards

**Environment Variables:**
- All sensitive values (credentials, connection strings) go to Key Vault
- Non-sensitive configuration can use environment variables
- `.env.example` documents all required variables
- No credentials committed to git

**Database Configuration:**
- Connection strings in Key Vault
- RLS policies applied to all tenant tables
- Migrations are idempotent and versioned

**External Service Configuration:**
- API keys in Key Vault with per-tenant mapping
- Rate limit configurations in RequestGate
- Timeout and retry configurations per connector

#### 5.4.3 Configuration Changes

**Process:**
1. **Identify:** What configuration needs to change
2. **Assess Impact:** Which components are affected
3. **Update:** Modify configuration files
4. **Test:** Verify change works with all affected components
5. **Document:** Update any relevant documentation
6. **Deploy:** Apply to all environments (dev, test, prod)

**Configuration Change Log:**
| Date | Change | Components Affected | Status |
|------|--------|----------------------|--------|
| 2026-07-29 | Added pg_cron to test Postgres | derived-data-caching-and-refresh | ✅ Complete |
| 2026-07-30 | Added persistent dev DB | all | ✅ Complete (Story 1.4) |
| 2026-07-31 | Added GNews API key handling | gnews-connector, credential-envelope-encryption | ✅ Complete (Story 2.7) |

### 5.5 Dependency Management

#### 5.5.1 Internal Dependencies

**Component Dependency Graph:**

```
┌─────────────────────────────────────────────────────────────┐
│                    social-listening-core                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                     │
│  │  provider-       │  │  social-post-   │                     │
│  │  connector-      │  │  lineage         │                     │
│  │  framework       │  │                 │                     │
│  │                 │  │  ┌───────────┐  │                     │
│  │  ┌───────────┐  │  │  │ social_   │  │  ┌───────────┐     │
│  │  │ Request   │  │  │  │ posts    │  │  │ watchlist │     │
│  │  │ Gate      │◄─┼──┼──│ table     │  │  │ matching │     │
│  │  │           │  │  │  └───────┬─┘  │  │  │           │     │
│  │  └───────────┘  │  │        └─────┼─────┘  │  │  └───────────┘     │
│  │                  │  │              │         │                     │
│  │  ┌───────────┐  │  │  ┌───────────┐  │  │  ┌───────────┐     │
│  │  │ gnews-    │  │  │  │            │  │  │  │             │     │
│  │  │ connector │  │  │  │ newswire- │  │  │  │ ingestion- │     │
│  │  │          │  │  │  │ connector │  │  │  │ events     │     │
│  │  └───────────┘  │  │  │            │  │  │  │             │     │
│  │                  │  │  └───────────┘  │  │  └───────────┘     │
│  │  ┌───────────┐  │        ↓         │  │                     │
│  │  │ connector- │  │  ┌───────────┐  │  │  ┌───────────┐     │
│  │  │ health-   │  │  │           │  │  │  │ derived-   │     │
│  │  │ and-      │  │  │ credential-│  │  │  │ data-      │     │
│  │  │ error-    │  │  │ store     │  │  │  │ caching    │     │
│  │  │ handling  │  │  │           │  │  │  │ and-      │     │
│  │  └───────────┘  │  └───────────┘  │  │  │ refresh    │     │
│  └─────────────────┘                 │  │  └───────────┘     │
│                                           │                     │
│  ┌─────────────────────────────────┐  │                     │
│  │   Postgres (Azure or local)       │  │                     │
│  └─────────────────────────────────┘  │                     │
│                                                  │                     │
│  ┌─────────────────────────────────┐  │                     │
│  │   Azure Key Vault                   │  │                     │
│  └─────────────────────────────────┘  │                     │
└─────────────────────────────────────────────────────────────┘
```

**Key Dependencies:**
- **provider-connector-framework** ←→ **connector-health-and-error-handling** (RequestGate → error classification)
- **provider-connector-framework** ←→ **credential-envelope-encryption** (connectors → credentialStore)
- **social-post-lineage** ←→ **ingestion-events** (SocialPost → events)
- **watchlist-matching** ←→ **social-post-enrichment** (pipeline integration)

#### 5.5.2 External Dependencies

**External Dependency Matrix:**

| Internal Component | External Service | Dependency Type | Criticality | Status |
|--------------------|------------------|-----------------|-------------|--------|
| All | PostgreSQL | Data storage | High | ✅ Active |
| All | Azure Key Vault | Credential storage | High | ✅ Active |
| gnews-connector | GNews API | Data source | Medium | ✅ Active |
| newswire-connector | GlobeNewswire RSS | Data source | Medium | ✅ Active |
| newswire-connector | PR Newswire RSS | Data source | Medium | ✅ Active |
| Future | Azure Service Bus | Eventing | Medium | ⏳ Planned |
| Future | Azure AI Language | Enrichment | Medium | ⏳ Planned |
| Future | Reddit API | Data source | Medium | ⏳ Planned |

### 5.6 Integration Verification

#### 5.6.1 Verification Checklist

**Before Merging a Story:**
- [ ] Story's own contracts pass
- [ ] All existing contracts still pass (no regressions)
- [ ] Cross-component contracts that depend on this story pass
- [ ] End-to-end flow for any affected connectors works
- [ ] External dependencies are healthy

**Before Closing a Phase:**
- [ ] All phase stories pass verification above
- [ ] Phase-specific integration points work end-to-end
- [ ] All deferred integration work for phase is documented
- [ ] Full regression suite passes

**Before Releasing:**
- [ ] All phase verification complete
- [ ] All external dependencies verified
- [ ] All configuration correct for target environment
- [ ] Smoke tests pass

#### 5.6.2 Verification Tools

| Tool | Purpose | Usage |
|------|---------|-------|
| Jest | Contract verification | All integration tests |
| `npm test` | Full regression | Per commit |
| Manual end-to-end | Real data flow | Per connector |
| Azure Service Health | External dependency health | Weekly |
| Git bisect | Regression identification | As needed |

---

## 6. Tools & Techniques

### 6.1 Integration Tools

| Tool | Purpose | Usage |
|------|---------|-------|
| Jest | Integration contract testing | All cross-component tests |
| TypeScript | Type checking across components | Compile-time verification |
| ESLint | Consistent coding across components | Pre-commit |
| Git | Integration change tracking | All changes |
| Implementation Log | Integration verification record | Per story |
| `implementation-plan.md` | Integration sequencing | Per phase |
| Dependency diagrams | Visualization (future) | As needed |

### 6.2 Integration Techniques

- **Contract-First Integration:** Define interfaces with tests before implementation
- **Wrapper Pattern:** Isolate external dependencies behind abstractions
- **Dependency Injection:** Pass dependencies explicitly, not globally
- **Tenant Context Propagation:** Pass `tenantId` through all cross-tenant operations
- **Error Classification:** Consistent error handling across all components
- **Phase-Gated Integration:** Integrate at phase boundaries, not continuously

---

## 7. Metrics & KPIs

### 7.1 Integration KPIs

| KPI | Definition | Target | Measurement | Frequency |
|-----|------------|--------|-------------|-----------|
| **Integration Test Coverage** | % of integration points with contracts | 100% | Contract audit | Per phase |
| **Integration Test Pass Rate** | % of integration contracts passing | 100% | `npm test` | Per commit |
| **End-to-End Flow Verification** | % of connector flows verified | 100% | Manual + contract | Per connector |
| **Dependency Health** | % of external dependencies with no issues | 100% | Weekly monitoring | Weekly |
| **Configuration Drift** | % of configuration artifacts current | 100% | Manual audit | Quarterly |

### 7.2 Current Integration Status (last verified 2026-08-03)

**Note:** consider generating this table from `docs/templates/measure-project-health.cjs`'s output rather than hand-maintaining it.

| Metric | Current Value | Target | Status | Trend |
|--------|---------------|--------|--------|-------|
| Integration Test Coverage | ~95% | 100% | ⚠️ Needs Review | → |
| Integration Test Pass Rate | 159/159 (100%, 32/32 suites) | 100% | ✅ On Track | → |
| End-to-End Flow Verification | 2/2 connectors (GNews, Newswire) | 100% | ✅ On Track | → |
| Dependency Health | 100% | 100% | ✅ On Track | → |
| Configuration Drift | ~90% | 100% | ⚠️ Needs Review | → |

---

## 8. Review & Update

### 8.1 Review Triggers
This plan is reviewed when:
- A **new integration point** is added
- An **integration issue** is discovered
- A **phase transitions**
- **Quarterly** (calendar-based)

### 8.2 Update Process
1. Identify the change needed
2. Update the relevant integration diagrams and matrices
3. Update any affected interface definitions
4. Add dated note in Version History
5. Commit with descriptive message

### 8.3 Version History

| Version | Date | Author | Changes | Commit |
|---------|------|--------|---------|--------|
| 1.0 | 2026-08-01 | Menno Drescher | Initial version | TBD |
| 1.1 | 2026-08-03 | Menno Drescher | Re-baselined §5.3.2 and §7.2 integration test figures to 159/159 contracts (32/32 suites), last verified 2026-08-03 | TBD |

---

## 9. Appendices

### Appendix A: Integration Map

**Component Integration Diagram (Text Representation):**

```
┌─────────────────────────────────────────────────────────────────────┐
│                            SOCIALENGAGE SYSTEM                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      social-listening-core                        │   │
│  │                                                                  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │   │
│  │  │  Ingestion    │  │   Storage    │  │  Enrichment   │      │   │
│  │  │  Pipeline     │  │  & Query     │  │  Pipeline    │      │   │
│  │  │               │  │              │  │              │      │   │
│  │  │  ┌────────┐  │  │  ┌────────┐  │  │  ┌────────┐  │      │   │
│  │  │  │Request  │  │  │  │  │Social  │  │  │  │AI      │  │      │   │
│  │  │  │Gate     │◄─┼──┼──│Posts   │  │  │  │Provider│  │      │   │
│  │  │  │         │  │  │  │  │Table   │  │  │  │Connector│  │      │   │
│  │  │  └────────┘  │  │  │  └────────┘  │  │  │  │         │  │      │   │
│  │  │               │  │  │              │  │  │  └────────┘  │      │   │
│  │  │  ┌────────┐  │  │  │  ┌────────┐  │  │  │              │      │   │
│  │  │  │Provider │  │  │  │  │Author  │  │  │  │              │      │   │
│  │  │  │Connector│──┼──┼──│Table   │  │  │  │              │      │   │
│  │  │  │Base     │  │  │  │  │        │  │  │  │              │      │   │
│  │  │  └────────┘  │  │  │  └────────┘  │  │  │  ┌────────┐  │      │   │
│  │  │               │  │  │              │  │  │  │Topic   │  │      │   │
│  │  │  ┌────────┐  │  │  │  ┌────────┐  │  │  │  │Signal  │  │      │   │
│  │  │  │GNews    │  │  │  │  │Watchlist│  │  │  │  │        │  │      │   │
│  │  │  │Connector│  │  │  │  │Terms   │  │  │  │  │        │  │      │   │
│  │  │  └────────┘  │  │  │  └────────┘  │  │  │  └────────┘  │      │   │
│  │  │               │  │  │              │  │  │              │      │   │
│  │  │  ┌────────┐  │  │  │  ┌────────┐  │  │  ┌────────┐  │      │   │
│  │  │  │Newswire │  │  │  │  │Ingestion│  │  │  │Connector│  │      │   │
│  │  │  │Connector│  │  │  │  │Run     │  │  │  │Health   │  │      │   │
│  │  │  └────────┘  │  │  │  └────────┘  │  │  │  │         │  │      │   │
│  │  └──────────────┘  │  └──────────────┘  │  └──────────────┘      │   │
│  │                                             ↓                  │   │
│  │  ┌─────────────────────────────────────────────────────┐  │   │
│  │  │                    External Services                      │  │   │
│  │  │                                                          │  │   │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐            │  │   │
│  │  │  │ PostgreSQL│  │ Key Vault│  │ GNews API │            │  │   │
│  │  │  └──────────┘  └──────────┘  └──────────┘            │  │   │
│  │  │                                                          │  │   │
│  │  │  ┌──────────┐  ┌──────────┐                            │  │   │
│  │  │  │Newswire  │  │ (Future) │                            │  │   │
│  │  │  │RSS Feeds │  │ Service  │                            │  │   │
│  │  │  └──────────┘  │ Bus      │                            │  │   │
│  │  │                └──────────┘                            │  │   │
│  │  └─────────────────────────────────────────────────────┘  │   │
│  │                                                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                  │   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      social-listening-admin                       │   │
│  │                                                                  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │   │
│  │  │  Admin UI    │  │  Core API    │  │  (Future)    │      │   │
│  │  │ (Next.js)    │──┼──│  REST API   │  │  Dashboard   │      │   │
│  │  └──────────────┘  │  │              │  │  UI          │      │   │
│  │                    └──────────────┘  └──────────────┘      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                  │   │
└─────────────────────────────────────────────────────────────────────┘
```

### Appendix B: Interface Definition Template

```markdown
## Interface: [Name]

**Purpose:** [What this interface enables]
**Source Component:** [Component A]
**Target Component:** [Component B]
**Type:** Function Call / Database / Event / HTTP

**Contract:**

### Input
| Parameter | Type | Description | Required | Constraints |
|-----------|------|-------------|----------|-------------|
| [param] | [type] | [description] | Yes/No | [constraints] |

### Output
| Field | Type | Description | Always Present |
|-------|------|-------------|----------------|
| [field] | [type] | [description] | Yes/No |

### Errors
| Error | Condition | HTTP Status | Handling |
|-------|-----------|-------------|----------|
| [Error] | [condition] | [status] | [handling] |

### Examples

#### Request Example
```typescript
[example code]
```

#### Response Example
```json
[example response]
```

**Security:**
- [ ] Tenant isolation enforced
- [ ] Credentials encrypted
- [ ] Rate limiting applied
- [ ] Input validation performed

**Performance:**
- [ ] Timeout defined
- [ ] Retry logic implemented
- [ ] Caching considered

**Testing:**
- [ ] Jest contracts exist
- [ ] Contracts pass
- [ ] Edge cases covered

**Traceability:**
- ADR: [Link]
- Story: [Link]
- Files: [List]
```

### Appendix C: Integration Test Template

```markdown
## Integration Test: [Name]

**ID:** [TEST-XX]
**Components:** [List of components involved]
**Type:** Component-Component / Component-External / End-to-End
**ADR:** [Link, if applicable]
**Story:** [Link, if applicable]

**Description:**
[What this test verifies]

**Setup:**
1. [Setup step 1]
2. [Setup step 2]

**Test Cases:**

### Happy Path
```typescript
describe('[Feature]', () => {
  it('should [behavior]', async () => {
    // Given
    const [setup] = await [setupCode];
    
    // When
    const result = await [action];
    
    // Then
    expect(result).to[matcher];
  });
});
```

### Error Path 1
```typescript
it('should handle [error condition]', async () => {
  // Given
  [error setup]
  
  // When
  const result = await [action];
  
  // Then
  expect(result).to[error matcher];
});
```

**Teardown:**
1. [Teardown step 1]
2. [Teardown step 2]

**Dependencies:**
- [ ] [Dependency 1]
- [ ] [Dependency 2]

**Execution:**
- **Frequency:** [Per commit / Per phase / Manual]
- **Environment:** [Local / Test / Production]
- **Owner:** [Name]

**Status:** [Draft / Active / Deprecated]
**Last Run:** [Date]
**Last Result:** [Pass / Fail]
```

---

## 10. References

- [PMBOK 7th Edition](https://www.pmi.org/pmbok-guide-standards/foundational/pmbok)
- [Project Charter](../Project-Charter.md)
- [Business Case](../Business-Case-v6.0.md)
- [Implementation Plan](../../implementation-plan.md)
- [Implementation Log](../../implementation-log.md)
- [Open Items and Deferred Work](../../open-items-and-deferred-work.md)
- [Planning Management Plan](Planning-Management-Plan.md)
- [Project Work Management Plan](Project-Work-Management-Plan.md)
- [Delivery Management Plan](Delivery-Management-Plan.md)
- [Uncertainty Management Plan](Uncertainty-Management-Plan.md)
- [Cost Management Plan](Cost-Management-Plan.md)

---

*This document is maintained as part of the SocialEngage project's Project Management Plans. For questions or updates, contact Menno Drescher.*
