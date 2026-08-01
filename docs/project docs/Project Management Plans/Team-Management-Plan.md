# Team Management Plan
## Spark Capture Project — PMBOK Domain: Team

**Project:** Social Listening & Engagement Platform (Spark Capture)  
**Phase:** Phase 1 — Social Listening / Insights Subsystem  
**Owner:** Menno Drescher  
**Date:** 2026-08-01  
**Status:** Draft  
**Version:** 1.0

---

## 1. Purpose

This plan defines **how the project team is structured, developed, and led** to deliver the Spark Capture project. Given this is a **solo-developer** project, this plan addresses:
- The **team structure** (currently one person with multiple roles)
- **Skill development** and continuous learning
- **Workload management** and capacity planning
- **Collaboration patterns** (including AI-assisted development)
- **Knowledge management** to prevent bus-factor risk

Traditional team management focuses on **leading, developing, and supporting** a group of people. For a solo project, this translates to **self-management, skill development, and knowledge capture** to ensure sustainability and scalability.

---

## 2. Scope

### In Scope
- Team structure and role definitions
- Individual skill development and training plans
- Workload management and capacity planning
- Collaboration with AI agents and external reviewers
- Knowledge management and documentation
- Bus-factor mitigation strategies
- Team performance metrics (adapted for solo context)

### Out of Scope
- Traditional team dynamics (conflict resolution, team building)
- Performance management (not applicable in solo context)
- Compensation and benefits (not applicable)
- Multi-person coordination (future concern when team expands)

---

## 3. Approach

### Guiding Principles

1. **Self-Discipline as Team Discipline**: In a solo project, personal discipline **is** team discipline. All processes that would be team-enforced in a multi-person project must be self-enforced here.

2. **Documentation as Team Memory**: Since there is no team memory, **all knowledge must be documented**. This is non-negotiable for sustainability.

3. **Automation as Team Scalability**: Automate repetitive tasks to increase effective capacity. What would be delegated to a team member in a larger project is automated here.

4. **AI as Team Amplifier**: AI agents (Claude Code, Mistral Vibe) are treated as **team extensions**, not just tools. They follow the same methodology and quality standards as human team members.

5. **Capacity is Finite**: Recognize and respect personal capacity limits. Scope must fit available time, not the other way around.

6. **Continuous Learning**: Invest in skill development to expand capacity and quality.

### Team Management Methodology

This project uses a **solo-adapted** approach combining:
- **Agile Team Practices**: Daily standups (self), retrospectives, continuous improvement
- **Personal Kanban**: Visualizing work, limiting work-in-progress
- **Timeboxing**: Structured work periods with clear boundaries
- **Pomodoro Technique**: Focused work intervals with regular breaks

---

## 4. Roles & Responsibilities

### Current Team Structure

| Role | Responsibility | Assignment | Notes |
|------|---------------|------------|-------|
| **Project Sponsor** | Funding, high-level direction, final approvals | Menno Drescher | Self-funded |
| **Project Manager** | Planning, coordination, stakeholder management | Menno Drescher | Same as sponsor |
| **Technical Lead/Architect** | Architecture, technical direction, ADR ownership | Menno Drescher | All technical decisions |
| **Developer** | Implementation, coding, testing | Menno Drescher | All code development |
| **Quality Assurance** | Test design, contract verification, quality gates | Menno Drescher + Automated | Contract-first methodology |
| **DevOps Engineer** | Infrastructure, CI/CD, deployment | Menno Drescher | Azure infrastructure |
| **Business Analyst** | Requirements, business case, market validation | AI Business & Requirements Analyst (OpenAI) | External, advisory |
| **Security Reviewer** | Security assessment, risk identification | AI Security Reviewer (Gemini) | External, advisory |
| **Engineering Pragmatism Reviewer** | Anti-overengineering, simplicity advocacy | AI Engineering Pragmatism Reviewer (Mistral) | External, advisory |
| **AI Delivery Agent** | Code implementation, contract healing | Mistral Vibe / Claude Code | Internal, bounded |

### Role Matrix

| Role | Decision Authority | Implementation Responsibility | Review Authority |
|------|-------------------|-------------------------------|------------------|
| Menno Drescher | All | All | All |
| AI Business Analyst | Advisory only | None | Advisory (requirements) |
| AI Security Reviewer | Advisory only | None | Advisory (security) |
| AI Engineering Pragmatism Reviewer | Advisory only | None | Advisory (simplicity) |
| AI Delivery Agent | None (bounded by contracts) | Code changes (within contract scope) | None (verification only) |

### Capacity Allocation

**Current Capacity (Estimated):**
- **Available Time:** 15-20 hours/week (variable based on other commitments)
- **Effective Capacity:** ~12-15 hours/week (accounting for context switching, meetings, etc.)

**Time Allocation Breakdown:**

| Activity | Weekly Hours | % of Capacity | Priority |
|----------|--------------|---------------|----------|
| Development (Coding) | 8-10 | 53-67% | High |
| Architecture & Design (ADRs) | 2-3 | 13-20% | High |
| Testing & Quality Assurance | 2-3 | 13-20% | High |
| Documentation | 2 | 13% | Medium |
| Review & Validation | 1-2 | 7-13% | Medium |
| Learning & Skill Development | 1 | 7% | Medium |
| Stakeholder Engagement | <1 | <7% | Low |
| **Total** | **15-20** | **100%** | - |

---

## 5. Processes & Procedures

### 5.1 Work Planning & Prioritization

**Process:** Weekly planning session (self)

1. **Review Backlog:**
   - Review `docs/open-items-and-deferred-work.md`
   - Review `docs/implementation-plan.md`
   - Review GitHub Issues (if applicable)
   - Review plan file from current session

2. **Assess Capacity:**
   - Estimate available hours for the week
   - Account for other commitments (ADPA, RPAS-Governance)
   - Buffer 20% for unexpected tasks/issue resolution

3. **Prioritize Work:**
   - **Priority 1 (P0):** Blocking issues, critical bugs, security vulnerabilities
   - **Priority 2 (P1):** Phase completion (currently Track 1: MVP Completion)
   - **Priority 3 (P2):** Platform maturity (Track 4: Multi-Connector)
   - **Priority 4 (P3):** Production readiness (Track 3: Authentication, Hardening)

4. **Create Week Plan:**
   - Define specific tasks for the week
   - Estimate hours for each task
   - Identify dependencies and blockers
   - Document in session plan file

5. **Daily Standup (Self):**
   - What did I accomplish yesterday?
   - What will I work on today?
   - What blockers do I have?
   - Document in plan file

**Tools:**
- Plan file: `C:\Users\MennoDrescher\.vibe\plans\<session-id>.md`
- Todo tracking: Session-level todo list
- Time tracking: Self-monitored (consider Toggl Track for future)

### 5.2 Development Workflow

**Standard Workflow (Contract-First):**

```
┌─────────────────────────────────────────────────────────────┐
│                        DEVELOPMENT WORKFLOW                      │
├─────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. SCOPE                       2. CONTRACT                      │
│  ┌───────────┐    ┌───────────────────────────────────┐    │
│  │ Identify  │───▶│ Write/Update Contract Test       │    │
│  │ Requirement│    │ (Jest .contract.test.ts)        │    │
│  └───────────┘    └───────────────────────────────────┘    │
│          │                                                     │
│          ▼                                                     │
│  3. SKILL.md                   4. IMPLEMENT                      │
│  ┌───────────┐    ┌───────────────────────────────────┐    │
│  │ Document  │───▶│ Write Implementation Code        │    │
│  │ Scope/    │    │ (Following SKILL.md guidance)    │    │
│  │ Constraints│    └───────────────────────────────────┘    │
│  └───────────┘              │                                 │
│                            ▼                                 │
│  5. VERIFY                   6. LOG                           │
│  ┌───────────────────────────────────┐    ┌─────────────┐ │
│  │ Run Full Test Suite            │───▶│ Update      │ │
│  │ (npx jest --runInBand ...)        │    │ Implementation│ │
│  └───────────────────────────────────┘    │ Log         │ │
│                                                └─────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────┘
```

**Workflow Details:**

1. **Scope:** Review existing SKILL.md or create new one if component doesn't exist
2. **Contract:** Write contract test that encodes the acceptance criteria
   - Test must fail initially (red)
   - Test uses real infrastructure (not mocks)
   - Test follows existing patterns from other contracts
3. **SKILL.md:** Create or update component SKILL.md with:
   - What this is
   - Governing ADRs and Stories
   - Contracts that constrain this component
   - How to extend this safely
   - Load-bearing constraints
   - Known gaps / deferred work
   - Relations to other components
4. **Implement:** Write code to satisfy the contract
   - Follow patterns from existing code
   - Use `withTenant()` for all database access (ADR-0015)
   - Never bypass RLS
   - Follow TypeScript best practices
5. **Verify:** Run full test suite
   - All contracts must pass
   - No regressions in existing tests
   - Use `--runInBand --workerIdleMemoryLimit=256MB`
6. **Log:** Update implementation log
   - Append-only (never edit existing entries)
   - Include commit hash, repo, story/ADR, contract, SKILL.md, files touched
   - Include full suite result

### 5.3 AI Agent Collaboration

**AI Agent Roles:**

| Agent | Role | Authority | Constraints |
|-------|------|-----------|--------------|
| Mistral Vibe | AI Delivery Agent | Write code, within contract scope | Cannot edit plan file (Plan mode), cannot bypass contract tests, bounded retry cap (3 attempts) |
| Claude Code | AI Delivery Agent | Write code, implement stories | Same as Mistral Vibe |
| AI Business Analyst (OpenAI) | Requirements Review | Advisory only | Findings logged, not auto-applied |
| AI Security Reviewer (Gemini) | Security Review | Advisory only | Findings logged, not auto-applied |
| AI Engineering Pragmatism Reviewer (Mistral) | Simplicity Review | Advisory only | Findings logged, not auto-applied |

**AI Collaboration Process:**

1. **Session Setup:**
   - Define clear task in prompt
   - Reference existing documentation (ADRs, SKILL.mds, contracts)
   - Set explicit boundaries (what to do, what NOT to do)

2. **Plan Mode (Optional):**
   - For complex tasks, start in Plan mode
   - Create plan file at `C:\Users\MennoDrescher\.vibe\plans\<session-id>.md`
   - Get user approval before switching to Build mode

3. **Build Mode:**
   - Agent reads existing code and documentation
   - Agent writes SKILL.md (if needed)
   - Agent writes contract test
   - Agent implements code
   - Agent verifies with test suite

4. **Constraints Enforcement:**
   - PreToolUse hook prevents writes without pre-existing contract
   - Pre-commit hook verifies contract exists and passes
   - CI with branch protection provides additional guardrails
   - Bounded retry cap (3 attempts) prevents unsupervised iteration

5. **Human Escalation:**
   - If blast radius is uncertain, agent traces impact and pauses for sign-off
   - If contract needs to be edited, agent traces changes and pauses for sign-off
   - After 3 failed remediation attempts, escalate to Menno

**AI Agent Charters:**
- Located in `docs/ai-roles/`
- Define role-specific prompts and boundaries
- Used for external review sessions

### 5.4 Knowledge Management

**Purpose:** Prevent bus-factor risk and ensure project continuity

**Knowledge Artifacts:**

| Artifact Type | Purpose | Location | Update Frequency |
|---------------|---------|----------|------------------|
| ADRs | Architectural decisions and rationale | `docs/adr/` | Per decision |
| SKILL.mds | Component scope and constraints | `.claude/skills/<component>/` | Per component |
| Implementation Log | What was built, when, by whom | `docs/implementation-log.md` | Per story/healing |
| User Stories | Requirements and acceptance criteria | `docs/user-stories/` | Per story |
| Design Spec | Overall system design | `docs/project docs/2026-07-28-social-listening-ingestion-design.md` | Per major design change |
| Project Charter | Project purpose and scope | `docs/project docs/Project-Charter.md` | Per charter amendment |

**Knowledge Capture Process:**
1. **Before Starting:** Review existing documentation
2. **During Work:** Document decisions, rationale, and constraints
3. **After Completion:** Update all relevant artifacts
4. **Continuous:** Refactor documentation as understanding evolves

**Bus-Factor Mitigation Strategies:**

| Strategy | Implementation | Status |
|----------|----------------|--------|
| Comprehensive Documentation | ADRs, SKILL.mds, Implementation Log | ✅ Active |
| Automated Tests | Contract tests as executable specification | ✅ Active |
| External Reviews | AI reviewers provide independent validation | ✅ Active |
| Open Source (Future) | Consider open-sourcing to attract contributors | 📅 Deferred |
| Knowledge Sharing | Document everything, no tribal knowledge | ✅ Active |
| Cross-Training | Not applicable (solo) | N/A |

### 5.5 Quality Assurance

**Quality Gates:**

| Gate | Definition | Check Method | Status |
|------|------------|--------------|--------|
| **Contract Test Pass** | All contract tests pass | `npx jest --runInBand` | ✅ Enforced |
| **Type Check Pass** | TypeScript compilation succeeds | `npm run typecheck` | ✅ Enforced |
| **Lint Pass** | ESLint checks pass | `npm run lint` (if configured) | ⚠️ Not yet configured |
| **Build Pass** | Build succeeds | `npm run build` | ✅ Enforced |
| **CI Pass** | GitHub Actions pass | CI workflow | ⚠️ Not yet configured |
| **RLS Verification** | Row-Level Security enforced | Contract tests against real Postgres | ✅ Enforced |
| **Methodology Compliance** | Follows implementation methodology | Manual review against `implementation-methodology.md` | ✅ Enforced |

**Quality Standards:**
- **Code:** Follows existing patterns, TypeScript best practices, proper error handling
- **Tests:** Contract-first, real infrastructure (not mocks), comprehensive coverage
- **Documentation:** Clear, concise, up-to-date, cross-referenced
- **Architecture:** ADR-driven, decisions documented, rationale captured

### 5.6 Continuous Improvement

**Retrospective Process:**

**Trigger:** End of each phase, or after significant events

**Procedure:**
1. **Review Metrics:**
   - Velocity (stories completed)
   - Quality (test pass rate, regressions)
   - Time estimation accuracy
   - Blockers encountered and resolved

2. **Identify Improvements:**
   - What worked well?
   - What didn't work well?
   - What should be changed?

3. **Action Items:**
   - Update processes or tools
   - Adjust capacity estimates
   - Revise priorities

4. **Document:**
   - Update this plan
   - Update methodology if changes are broad

**Retrospective Frequency:**
- **Phase Retrospective:** After each phase completion (M1, M4, M7)
- **Event Retrospective:** After major incidents or unexpected outcomes
- **Quarterly Retrospective:** General process review

---

## 6. Tools & Techniques

### Primary Tools

| Tool | Purpose | Usage |
|------|---------|-------|
| **Git / GitHub** | Version control, collaboration | All code and documentation |
| **TypeScript** | Type-safe development | All source code |
| **Jest** | Testing framework | Contract tests |
| **PostgreSQL** | Database | All persistent data |
| **Azure** | Cloud services | Hosting, storage, messaging |
| **Node.js** | Runtime | Backend services |
| **Docker** | Containerization | Test databases, local dev |
| **Mistral Vibe** | AI Delivery Agent | Code implementation, contract healing |
| **Claude Code** | AI Delivery Agent | Code implementation (legacy) |

### Techniques

1. **Timeboxing:** Set fixed time limits for tasks to prevent scope creep
2. **Pomodoro:** 25-50 minute focused work sessions with 5-10 minute breaks
3. **Personal Kanban:** Visual task board (can use GitHub Projects or simple markdown)
4. **Weekly Planning:** Sunday evening planning session for the week ahead
5. **Daily Standup:** Morning self-check-in on progress and blockers
6. **Context Switching Buffer:** 15-30 minutes between different types of work

---

## 7. Metrics & KPIs

### Team Performance KPIs

| KPI | Definition | Target | Measurement | Frequency |
|-----|------------|--------|-------------|-----------|
| **Velocity** | Stories completed per week | 1-2 stories | Implementation Log | Weekly |
| **Test Coverage** | Percentage of contract tests passing | 100% | Test suite results | Per commit |
| **Regression Rate** | Number of regressions introduced | 0 | Test suite diff | Per commit |
| **Estimation Accuracy** | Actual vs. estimated hours | ±25% | Time tracking | Per story |
| **Cycle Time** | Time from story start to completion | ≤2 weeks | Implementation Log | Per story |
| **Documentation Completeness** | Percentage of work with SKILL.md/ADR | 100% | Documentation review | Per phase |
| **Bus-Factor Risk** | Number of single points of failure | 0 | Knowledge audit | Quarterly |

### Current Metrics (2026-08-01)

| KPI | Current Value | Target | Status |
|-----|---------------|--------|--------|
| Velocity | ~1 story/day (recent) | 1-2 stories/week | ✅ On Track |
| Test Coverage | 100% (132/132 tests passing) | 100% | ✅ On Track |
| Regression Rate | 0 | 0 | ✅ On Track |
| Estimation Accuracy | N/A (not yet tracked) | ±25% | ⚠️ Not Measured |
| Cycle Time | Varies | ≤2 weeks | ⚠️ Not Consistently Measured |
| Documentation Completeness | ~100% | 100% | ✅ On Track |
| Bus-Factor Risk | 1 (Menno) | 0 | ⚠️ Risk Accepted (solo project) |

---

## 8. Review & Update

### Review Schedule

| Review Type | Frequency | Trigger | Owner |
|-------------|-----------|---------|-------|
| **Weekly Plan Review** | Weekly | Sunday evening | Menno |
| **Phase Retrospective** | Per phase | Phase completion (M1, M4, M7) | Menno |
| **Tooling Review** | Quarterly | Calendar-based | Menno |
| **Process Review** | Quarterly | Calendar-based | Menno |
| **Capacity Review** | Quarterly | Calendar-based | Menno |

### Update Process

1. **Identify Change:** Process improvement needed, tool change, capacity change
2. **Assess Impact:** How does this affect other plans or project execution?
3. **Test Change:** Try the new approach for a limited period
4. **Evaluate Results:** Did the change improve outcomes?
5. **Document Change:** Update this plan with the new approach
6. **Communicate Change:** Notify any affected stakeholders (if applicable)
7. **Version Control:** Commit changes to repository

### Version History

| Version | Date | Author | Changes | Commit |
|---------|------|--------|---------|--------|
| 1.0 | 2026-08-01 | Menno Drescher | Initial version | TBD |

---

## 9. Appendices

### Appendix A: Personal Development Plan

**Skill Development Goals (Next 12 Months):**

| Skill Area | Current Level | Target Level | Development Activities | Timeline |
|-----------|---------------|--------------|------------------------|----------|
| TypeScript | Advanced | Expert | Continue using in project, read advanced patterns | Ongoing |
| PostgreSQL | Intermediate | Advanced | Deep dive on RLS, partitioning, JSONB | Q3 2026 |
| Azure Services | Intermediate | Advanced | Explore more services (Container Apps, etc.) | Q4 2026 |
| Node.js | Advanced | Expert | Performance optimization, debugging | Ongoing |
| Architecture | Advanced | Expert | Study system design patterns, review other projects | Ongoing |
| Testing | Intermediate | Advanced | Contract testing patterns, property-based testing | Q3 2026 |
| DevOps | Beginner | Intermediate | CI/CD setup, deployment automation | Q4 2026 |
| AI Assistance | Intermediate | Advanced | Better prompting, multi-agent orchestration | Ongoing |

**Learning Resources:**
- Books: TypeScript Design Patterns, PostgreSQL 17 Internals
- Courses: Azure Architect Technologies (if budget allows)
- Communities: TypeScript Discord, PostgreSQL mailing lists
- Practice: Continue building Spark Capture, contribute to OSS

### Appendix B: Workload Management Template

```markdown
# Weekly Plan - Week of YYYY-MM-DD

## Capacity
- Available: XX hours
- Buffer (20%): XX hours
- Effective: XX hours

## Priorities
1. [P0] Task A - X hours
2. [P1] Task B - X hours
3. [P2] Task C - X hours

## Tasks
- [ ] Task A
  - Estimated: X hours
  - Actual: X hours
  - Status: Not Started / In Progress / Blocked / Complete
  - Notes: 

## Blockers
- Blocker 1: Description, Impact, Next Steps

## Reflection
- What went well:
- What didn't go well:
- Improvements for next week:
```

### Appendix C: Bus-Factor Risk Assessment

**Current State:**
- **Single Point of Failure:** Menno Drescher (all roles)
- **Mitigation:** Comprehensive documentation, automated tests, AI assistance
- **Risk Level:** Medium (accepted for solo project phase)
- **Mitigation Timeline:** 
  - Short-term: Continue improving documentation and automation
  - Medium-term: Open-source to attract contributors (6-12 months)
  - Long-term: Build community, attract co-maintainers (12+ months)

**Critical Knowledge Areas:**
1. **Architecture:** ADR series, design spec, SKILL.mds
2. **Implementation:** Codebase structure, patterns, conventions
3. **Infrastructure:** Azure setup, Postgres configuration, Service Bus
4. **Methodology:** Contract-first, implement-story workflow
5. **Business Context:** Project charter, business case, stakeholder needs

**Knowledge Transfer Plan (Future):**
- When first contributor joins: Pair on first few stories
- Create contributor guide
- Document onboarding process
- Gradually transfer ownership of components

---

## 10. References

- [PMBOK 7th Edition — Team Performance Domain](https://www.pmi.org/pmbok-guide-standards/foundational/pmbok)
- [Project Charter](../Project-Charter.md)
- [Implementation Plan](../../implementation-plan.md)
- [Implementation Methodology](../../implementation-methodology.md)
- [Stakeholder Management Plan](Stakeholder-Management-Plan.md)
- [AI Roles Charters](../../ai-roles/)

---

*This document is maintained as part of the Spark Capture project's Project Management Plans. For questions or updates, contact Menno Drescher.*
