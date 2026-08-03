# Planning Management Plan
## SocialEngage Project — PMBOK Domain: Planning

**Project:** Social Listening & Engagement Platform (SocialEngage)  
**Phase:** Phase 1 — Social Listening / Insights Subsystem  
**Owner:** Menno Drescher  
**Date:** 2026-08-01  
**Status:** Active — CI/CD workflows implemented  
**Version:** 1.2

---

## 1. Purpose

This plan defines **how scope, schedule, budget, and resources are defined and managed** for the SocialEngage project. It establishes the processes for planning, estimating, and controlling the project's work within the constraints of a solo-developer, self-funded context.

The Planning Performance Domain (PMBOK 7th Edition) emphasizes that planning is not a one-time activity but an iterative process that continues throughout the project lifecycle. For SocialEngage, this means: **just-enough planning to enable execution, with heavy reliance on the existing ADR-driven, phase-gated approach** already established in `docs/implementation-plan.md`.

---

## 2. Scope

### 2.1 What This Plan Covers
- Scope definition and management (what's in, what's out)
- Schedule management (phases, dependencies, sequencing)
- Resource management (human, AI agents, infrastructure)
- Budget/cost management coordination (with Cost Management Plan)
- Planning processes and tools
- Change management for planning artifacts

### 2.2 What This Plan Does NOT Cover
- Detailed technical architecture (see ADRs)
- Execution methodology (see `implementation-methodology.md`)
- Day-to-day task management (handled via `implement-story` skill)
- Risk identification and response (see Uncertainty-Management-Plan.md)
- Quality metrics (see Measurement-Management-Plan.md)

---

## 3. Approach

### 3.1 Core Philosophy
**"Plan to the level of detail needed for confident execution, no more."**

Given this is a solo-developer project with no external team to coordinate, planning focuses on:
1. **Defining clear boundaries** (scope in/out, phase gates)
2. **Establishing dependencies** (what must happen before what)
3. **Maintaining traceability** (ADRs → stories → implementation → verification)
4. **Enabling autonomous execution** (plans should be clear enough for a future session to pick up where the last left off)

### 3.2 Solo-Developer Adaptations

| Traditional Planning Concept | Solo-Developer Adaptation |
|-----------------------------|---------------------------|
| Work Breakdown Structure (WBS) | ADR-driven story decomposition + "also build, not storied" work |
| Resource leveling | Self-scheduling based on availability |
| Critical path analysis | Phase-gated dependencies in `implementation-plan.md` |
| Schedule compression | Scope reduction (features out, not schedule in) |
| Baseline management | Git-based version control of all planning artifacts |

### 3.3 Planning Hierarchy

```
Project Charter (Why)
    ↓
Business Case (What value)
    ↓
ADRs (Architectural decisions)
    ↓
Implementation Plan (Phases + Stories)
    ↓
User Stories (Acceptance Criteria)
    ↓
Contracts (Jest tests = executable specs)
    ↓
Implementation (Code)
    ↓
Implementation Log (Verification)
```

Each level is **traceable to the level above it**. This is the planning spine of the project.

---

## 4. Roles & Responsibilities

| Role | Responsibilities | Current Assignment |
|------|------------------|-------------------|
| **Planning Owner** | Overall planning approach, phase definitions, scope boundaries | Menno Drescher |
| **Scope Manager** | Defines what's in/out of scope, manages scope changes | Menno Drescher |
| **Schedule Manager** | Defines phase sequencing, dependency management | Menno Drescher |
| **Resource Manager** | Allocates time, manages AI agent utilization | Menno Drescher |
| **Change Controller** | Approves changes to planning artifacts | Menno Drescher |
| **Dependency Tracker** | Monitors external dependencies (Azure, API providers) | Automated + Menno |

---

## 5. Processes & Procedures

### 5.1 Scope Management

#### 5.1.1 Scope Definition
**Process:**
1. **Project Charter** defines high-level scope (Social Listening / Insights subsystem)
2. **Business Case** defines success criteria and out-of-scope items
3. **ADR Series** defines architectural boundaries (35 accepted ADRs as of 2026-08-03)
4. **Implementation Plan** defines phase-by-phase delivery scope
5. **User Stories** define feature-level scope with acceptance criteria

**Current Scope (2026-08-01):**
- **In Scope:** Social Listening / Insights subsystem (Phases 0-5)
- **Out of Scope:** Brand Reputation & Alerts, Social Care, Social Selling (future subsystems)
- **Deferred:** Charting UI and production deployment. Authentication, tenant/user modeling, connector ownership, and admin UI architecture are decided by ADR-0028–0035 and are now implementation work rather than undecided scope.

#### 5.1.2 Scope Change Control
**Trigger:** New requirement, architecture change, or external dependency change

**Process:**
1. **Identify:** Document the proposed change in a new or amended ADR
2. **Assess:** Evaluate impact on existing ADRs, stories, and phases
3. **Estimate:** Size the change (story count, complexity, dependencies)
4. **Decide:** Menno accepts/rejects based on alignment with Business Case
5. **Update:** Modify `implementation-plan.md`, traceability matrices, and this plan if needed
6. **Communicate:** Update relevant stakeholders (documentation, AI agents)

**Scope Change Log:**
| Date | Change | Impact | Decision | ADR/Story |
|------|--------|--------|----------|-----------|
| 2026-07-29 | Added Newswire connector ahead of schedule | Phase 4 story pulled into earlier consideration | Accepted | ADR-0024, Story 2.6 |
| 2026-07-30 | Added persistent dev DB | Phase 0 scope expansion | Accepted | ADR-0025, Story 1.4 |
| 2026-07-31 | Added GNews connector as RSS/News implementation | Phase 1 gap closure | Accepted | ADR-0026, Story 2.7 |
| 2026-08-01 | GNews connector built | Story 2.7 completion | Complete | Story 2.7 |
| 2026-08-03 | Accepted ADR-0028–0035 | Credential ownership, Entra identity, roles, tenant/user model, bearer-token identity, connector authorization, and one role-gated Next.js admin app | Accepted; implementation backlog updated | ADR-0028–0035 |

#### 5.1.3 Scope Verification
**Method:** Contract-first development ensures scope is verified
- Each story has a Jest contract that encodes acceptance criteria
- Contract must pass before story is considered complete
- Full accumulated suite must pass (159/159 passing, 32/32 suites, last verified 2026-08-03)

**Status correction (2026-08-03):** The Phase 1 row below predates ADR-0028–0035. “CRUD pending” means only the ownership-aware connector rework and the Next.js admin UI remain; Watchlist CRUD and the initial connector routes already exist.

### 5.2 Schedule Management

#### 5.2.1 Phase Structure
The project uses a **phase-gated approach** with 6 phases (0-5):

| Phase | Goal | Stories | Status | Target Completion |
|-------|------|---------|--------|------------------|
| 0 | Foundations (decisions + scaffolding, no ingestion) | 1.1-1.4, 5.3-5.4 | ✅ Complete | 2026-07-29 |
| 1 | MVP: one connector, end to end | 2.1-2.3, 2.7, 3.1-3.4, 4.3 | ⚠️ Storied complete, CRUD pending | 2026-08-XX |
| 2 | Enrichment and AI-provider swappability | 4.1-4.2 | ⏳ Not started | TBD |
| 3 | Eventing and admin UI completion | 5.1-5.2, 5.5 | ⏳ Not started | TBD |
| 4 | Multi-connector scale-out and hardening | 2.4-2.6, 3.5-3.6, 4.4 | ⏳ Not started | TBD |
| 5 | Production readiness | None storied | ⏳ Not started | TBD |

**Phase Gate Criteria:**
- **Current baseline (2026-08-03):** Phase 1's core data path and Watchlist CRUD are complete. Connector routes require ADR-0033/0034 rework, and the role-gated Next.js admin UI required by ADR-0035 remains to be built. The accepted ADR-0028–0035 decisions are implementation constraints, not pending architecture.
- All stories in phase have passing contracts
- All ADRs for phase are Accepted
- "Also build, not storied" work for phase is complete
- Implementation Log is current
- Cross-component regression suite passes

#### 5.2.2 Dependency Management
**Internal Dependencies:**
- Story dependencies are encoded in `implementation-plan.md` sequencing
- ADR dependencies are tracked in `docs/adr/README.md` traceability table
- Contract dependencies: contracts can depend on fixtures from other components

**External Dependencies:**
| Dependency | Type | Impact | Mitigation |
|------------|------|--------|------------|
| Azure Database for PostgreSQL | Infrastructure | High | Monitor service health, maintain local dev alternative |
| Azure Key Vault | Infrastructure | High | Use emulator for local dev, monitor service |
| Azure Service Bus | Infrastructure | Medium | Deferred until Phase 3 |
| GNews API | Data source | Medium | Contract-verified connector, monitor terms |
| Newswire (GlobeNewswire, PR Newswire) | Data source | Medium | Contract-verified connector, monitor feed availability |
| **GitHub Actions** | **CI/CD Platform** | **High** | **Public repo (free), monitor GitHub status page** |

**Dependency Tracking:**
- Monitor Azure service health dashboard weekly
- Check API provider status pages before ingestion runs
- Review terms of service quarterly for all platform providers

#### 5.2.3 Schedule Control
**No Calendar Dates:** Consistent with Charter §5, this project uses **dependency-ordered sequencing, not calendar-based scheduling**. There are no:
- Sprint lengths
- Target dates
- Velocity estimates
- Resource leveling

**Schedule Metrics:**
- Stories completed per phase
- Phases closed
- ADRs accepted
- Contract suite pass rate

### 5.3 Resource Management

#### 5.3.1 Human Resources
| Resource | Role | Allocation | Availability |
|----------|------|------------|--------------|
| Menno Drescher | All roles | Variable | Self-managed |

**Capacity Planning:**
- No formal capacity tracking (solo-developer)
- Time available is constrained by external commitments (ADPA, RPAS-Governance)
- AI agents augment capacity for specific tasks (code generation, review)

#### 5.3.2 AI Agent Resources
| AI Agent | Purpose | Utilization | Cost |
|----------|---------|-------------|------|
| Claude Code (Delivery Agent) | Story implementation | Per story | Included in Anthropic subscription |
| Claude Code (Business Analyst) | Requirements analysis | Episodic | Included |
| Claude Code (Documentation Steward) | Traceability auditing | Not yet exercised | Included |
| Claude Code (QA/Contract Author) | Contract writing/review | Not yet exercised | Included |
| Gemini (Security Reviewer) | Architecture/security review | Episodic | Google API costs |
| Mistral (Engineering Pragmatism) | Anti-overengineering review | Episodic | Mistral API costs |
| Mistral (Product/Market-Fit) | User value assessment | Episodic | Mistral API costs |
| Ollama (Data Privacy) | Local-only review | Episodic | Self-hosted (no cost) |
| Azure AI Foundry | Model hosting (future) | Not yet used | Azure costs |

**AI Resource Constraints:**
- Free-tier API limits may constrain simultaneous agent usage
- Local-only agents (Ollama) used for sensitive data to avoid external costs/exposure
- AI Manager role synthesizes across agents to prevent conflicting advice

#### 5.3.3 Infrastructure Resources
| Resource | Purpose | Provider | Cost Model |
|----------|---------|----------|------------|
| PostgreSQL (dev/test) | Local development | Docker | Free (local) |
| PostgreSQL (production) | Production data | Azure | Pay-as-you-go |
| Key Vault | Credential storage | Azure | Pay-as-you-go |
| Service Bus | Eventing | Azure | Pay-as-you-go (deferred) |
| Blob Storage | Raw payload archival | Azure | Pay-as-you-go (deferred) |
| GitHub | Version control | GitHub | Free (public repo) |

### 5.4 Budget Management Coordination
See `Cost-Management-Plan.md` for detailed cost tracking. This plan coordinates with it by:
- Ensuring planning decisions consider cost implications
- Tracking cost-impacting scope changes
- Aligning resource utilization with budget constraints

**Budget Constraints:**
- Self-funded: all costs borne by Menno personally
- No formal budget ceiling (Charter §5 explicitly declines budget ceiling)
- Cost optimization principle: minimize spend while maintaining architecture integrity

**Cost-Aware Planning:**
- API provider selection favors free tiers where possible (GNews free tier, Newswire free RSS)
- Cloud resources sized minimally (Azure Database for PostgreSQL Flexible Server, not Hyperscale)
- Archival policies (ADR-0018) balance storage cost vs. analytical value
- Local development preferred to cloud where feasible

### 5.5 Planning Artifact Management

#### 5.5.1 Primary Planning Artifacts
| Artifact | Owner | Update Frequency | Location |
|----------|-------|------------------|----------|
| Project Charter | Menno | As needed | `docs/project docs/Project-Charter.md` |
| Business Case | Menno | As needed | `docs/project docs/Business-Case-v6.0.md` |
| Implementation Plan | Menno | Per phase | `docs/implementation-plan.md` |
| ADR Series | Menno + AI Reviewers | Per decision | `docs/adr/` |
| User Stories | Menno | Per epic | `docs/user-stories/` |
| Implementation Log | Menno + AI Delivery Agent | Per story | `docs/implementation-log.md` |
| Open Items & Deferred Work | Menno | Per phase | `docs/open-items-and-deferred-work.md` |
| Future Subsystems | Menno | As needed | `docs/future-subsystems.md` |

#### 5.5.2 Artifact Traceability
All planning artifacts maintain **bidirectional traceability**:
- ADRs ↔ Stories
- Stories ↔ Implementation Plan phases
- Implementation Plan ↔ Implementation Log
- Implementation Log ↔ Git commits

**Traceability Verification:**
- `docs/adr/README.md` contains ADR-to-story traceability table
- `docs/user-stories/README.md` contains story-to-ADR traceability table
- `docs/implementation-plan.md` contains phase-to-story traceability table
- `docs/templates/check-implementation-log.cjs` verifies Implementation Log against git

### 5.6 Change Management

#### 5.6.1 Change Categories
| Category | Definition | Process |
|----------|------------|---------|
| **Architectural Change** | Change to ADR decision | New or amended ADR, full impact assessment |
| **Scope Change** | New story or story modification | ADR if architecturally significant, else direct story update |
| **Planning Change** | Phase sequencing or dependency change | Update `implementation-plan.md` |
| **Process Change** | Methodology or tooling change | Update `implementation-methodology.md` |
| **Infrastructure Change** | Cloud provider or service change | ADR if architecturally significant |

#### 5.6.2 Change Control Process
1. **Propose:** Document the change (ADR, story, or plan amendment)
2. **Assess:** Evaluate impact on scope, schedule, cost, quality, risks
3. **Review:** Consult relevant AI reviewers based on change type
4. **Decide:** Menno accepts/rejects with rationale
5. **Implement:** Execute the change
6. **Verify:** Ensure contracts still pass, traceability maintained
7. **Document:** Update all affected artifacts

**Change Log:** See Section 5.1.2 Scope Change Log above.

---

## 6. Tools & Techniques

### 6.1 Planning Tools
| Tool | Purpose | Usage |
|------|---------|-------|
| `docs/implementation-plan.md` | Primary planning artifact | Phase and story sequencing |
| `docs/adr/README.md` | Architectural traceability | ADR-to-story mapping |
| `docs/user-stories/README.md` | Story traceability | Story-to-ADR mapping |
| `docs/open-items-and-deferred-work.md` | Deferred work tracking | Section A: "Also build, not storied" |
| `docs/future-subsystems.md` | Future scope boundary | Out-of-scope tracking |
| Git history | Change audit trail | All planning artifact versions |
| Azure Cost Management | Cloud cost tracking | Monthly review |
| **`.github/workflows/ci.yml`** | **Full test CI pipeline** | **Automated quality gates on push/PR** |
| **`.github/workflows/ci-simple.yml`** | **Lightweight verification** | **Lint/typecheck/structure validation** |

### 6.2 Planning Techniques
- **ADR-Driven Decomposition:** Break work into architecturally significant decisions
- **Contract-First Sizing:** Story size estimated by contract complexity
- **Phase-Gated Delivery:** Progress measured by phase completion, not calendar
- **Dependency Mapping:** Explicit sequencing in implementation plan
- **Traceability Matrix:** Bidirectional links between all planning levels
- **Change Impact Analysis:** Full blast-radius tracing for any change

---

## 7. Metrics & KPIs

### 7.1 Planning KPIs
| KPI | Definition | Target | Measurement | Frequency |
|-----|------------|--------|-------------|-----------|
| Planning Artifact Completeness | % of required planning artifacts current | 100% | Manual audit | Per phase |
| Traceability Coverage | % of ADRs/stories with bidirectional traceability | 100% | `check-implementation-log.cjs` | Per commit |
| Scope Stability | # of scope changes per phase | ≤3 | Scope change log | Per phase |
| Phase Completion Rate | # of phases closed vs. total | 100% | Implementation plan review | Per phase |
| Dependency Health | % of external dependencies with no blocking issues | 100% | Weekly dependency check | Weekly |

### 7.2 Current Metrics (last verified 2026-08-03)

**Note:** consider generating this table from `docs/templates/measure-project-health.cjs`'s output rather than hand-maintaining it.

| KPI | Current Value | Target | Status |
|-----|---------------|--------|--------|
| Planning Artifact Completeness | 80% (2/5 supplementary plans missing) | 100% | ⚠️ In Progress |
| Traceability Coverage | 100% | 100% | ✅ On Track |
| Scope Stability | 5 changes (all accepted, including ADR-0028–0035 batch) | ≤3/phase | ⚠️ Above target for the phase in which the batch landed |
| Phase Completion Rate | Phase 0 complete; Phase 1 storied work complete (CRUD/admin UI pending); Phase 4.5 underway and unblocked | 100% | ⚠️ In progress |
| Dependency Health | 100% | 100% | ✅ On Track |

---

## 8. Review & Update

### 8.1 Review Triggers
This plan is reviewed when:
- A **new phase** begins
- A **scope change** is accepted
- A **dependency issue** arises
- **Quarterly** (calendar-based)

### 8.2 Update Process
1. Identify the change needed
2. Update the relevant section(s)
3. Update traceability matrices if planning artifacts change
4. Add dated note in Version History
5. Commit with descriptive message

### 8.3 Version History
| Version | Date | Author | Changes | Commit |
|---------|------|--------|---------|--------|
| 1.0 | 2026-08-01 | Menno Drescher | Initial version | TBD |
| 1.1 | 2026-08-01 | Menno Drescher | Added GitHub Actions CI workflows (ci.yml, ci-simple.yml) to dependency management and planning tools | TBD |
| 1.2 | 2026-08-03 | Menno Drescher | Re-baselined §5.1.3 and §7.2 to 159/159 contracts (32/32 suites) and Phase 4.5 status, last verified 2026-08-03; recounted Scope Stability against §5.1.2's actual 5-row change log | TBD |

---

## 9. Appendices

### Appendix A: Planning Artifact Template

```markdown
# [Artifact Name]

**Project:** Social Listening & Engagement Platform (SocialEngage)
**Phase:** [Phase Number] — [Phase Name]
**Owner:** [Owner Name]
**Date:** [YYYY-MM-DD]
**Status:** [Draft/In Review/Approved]
**Version:** [X.Y]

---

## 1. Purpose
[Why this artifact exists]

## 2. Scope
### In Scope
- [ ] 
### Out of Scope
- [ ]

## 3. [Domain-Specific Sections]

## 4. Traceability
- **ADRs:** [List]
- **Stories:** [List]
- **Dependencies:** [List]

## 5. Version History
| Version | Date | Changes | Author |
|---------|------|---------|--------|
```

### Appendix B: Phase Definition Template

```markdown
## Phase [N] — [Phase Name]

**Goal:** [One-sentence goal]

**Stories:** [List of story numbers]
**Also build, not storied:** [List of non-storied work]

**Entry Criteria:**
- [ ] [Criteria]

**Exit Criteria:**
- [ ] All stories have passing contracts
- [ ] All ADRs for phase are Accepted
- [ ] All "also build" work is complete
- [ ] Full regression suite passes
- [ ] Implementation Log is current

**Dependencies:**
- [ ] [Dependency]

**Deliverable:** [What is produced by this phase]
```

### Appendix C: Dependency Tracking Template

```markdown
## [Dependency Name]

**Type:** [Infrastructure/Data/Service/Platform]
**Provider:** [Provider Name]
**Purpose:** [What it enables]
**Criticality:** [High/Medium/Low]
**Status:** [Active/Deprecated/At Risk]
**Cost:** [Cost model]
**Alternatives:** [List of alternatives]
**Mitigation:** [How to handle failures]
**Monitoring:** [How to monitor health]
**Review Frequency:** [How often to check]
```

---

## 10. References

- [PMBOK 7th Edition](https://www.pmi.org/pmbok-guide-standards/foundational/pmbok)
- [Project Charter](../Project-Charter.md)
- [Business Case](../Business-Case-v6.0.md)
- [Implementation Plan](../../implementation-plan.md)
- [Implementation Methodology](../../implementation-methodology.md)
- [Cost Management Plan](Cost-Management-Plan.md)
- [Uncertainty Management Plan](Uncertainty-Management-Plan.md)

---

*This document is maintained as part of the SocialEngage project's Project Management Plans. For questions or updates, contact Menno Drescher.*
