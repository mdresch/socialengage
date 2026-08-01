# Measurement Management Plan
## Spark Capture Project — PMBOK Domain: Measurement

**Project:** Social Listening & Engagement Platform (Spark Capture)  
**Phase:** Phase 1 — Social Listening / Insights Subsystem  
**Owner:** Menno Drescher  
**Date:** 2026-08-01  
**Status:** Active — CI/CD and health script implemented  
**Version:** 1.1

---

## 1. Purpose

This plan defines **how progress, quality, and outcomes are measured** for the Spark Capture project. It establishes the metrics, measurement methods, and evaluation processes that ensure the project is delivering value and meeting its objectives.

The Measurement Performance Domain (PMBOK 7th Edition) emphasizes that measurement is essential for understanding project performance, making informed decisions, and demonstrating value delivery. For Spark Capture, measurement is **automated and contract-driven**, with a focus on objective, verifiable metrics rather than subjective assessments.

---

## 2. Scope

### 2.1 What This Plan Covers
- Progress measurement (stories, phases, milestones)
- Quality measurement (contract coverage, test quality)
- Outcome measurement (Business Case criteria achievement)
- Measurement processes and tools
- Data collection and reporting
- Metric definition and maintenance

### 2.2 What This Plan Does NOT Cover
- Detailed planning (see Planning-Management-Plan.md)
- Risk identification (see Uncertainty-Management-Plan.md)
- Delivery processes (see Delivery-Management-Plan.md)
- Stakeholder satisfaction (see Stakeholder-Management-Plan.md)
- Cost tracking (see Cost-Management-Plan.md)

---

## 3. Approach

### 3.1 Core Philosophy
**"If it can't be measured, it doesn't count."**

Given this is a solo-developer project, measurement must be:
1. **Automated:** No reliance on manual tracking or memory
2. **Objective:** Based on verifiable artifacts (git commits, test results, contracts)
3. **Traceable:** Every metric links to its source data
4. **Actionable:** Measurements inform decisions, not just report status

### 3.2 Solo-Developer Adaptations

| Traditional Measurement Concept | Solo-Developer Adaptation |
|---------------------------------|---------------------------|
| Earned Value Management (EVM) | Story-based earned value (story count as proxy) |
| Schedule Performance Index (SPI) | Phase completion rate vs. total phases |
| Cost Performance Index (CPI) | Not applicable (no formal budget baseline) |
| Quality audits | Automated contract suite execution |
| Manual progress reporting | Implementation Log as auditable record |

### 3.3 Measurement Hierarchy

```
Business Case Success Criteria (Why we measure)
    ↓
ADR Acceptance (Architecture decisions measured)
    ↓
Story Completion (Features measured)
    ↓
Contract Pass Rate (Quality measured)
    ↓
Phase Completion (Progress measured)
    ↓
Milestone Achievement (Outcomes measured)
```

Each level provides **objective, verifiable evidence** of progress and quality.

---

## 4. Roles & Responsibilities

### 4.1 Human Roles

| Role | Responsibilities | Current Assignment |
|------|------------------|-------------------|
| **Measurement Owner** | Overall measurement approach, metric definitions | Menno Drescher |
| **Progress Tracker** | Monitors story and phase completion | Automated + Menno |
| **Quality Assurer** | Monitors contract quality and test coverage | Automated (Jest) + Menno |
| **Outcome Evaluator** | Assesses Business Case criteria achievement | Menno Drescher |
| **Metric Maintainer** | Updates metric definitions and targets | Menno Drescher |

### 4.2 AI Agent Roles

| Role | Responsibilities | Engagement |
|------|------------------|------------|
| **AI Delivery Agent** | Produces verifiable deliverables (contracts, code, log entries) | Per story |
| **AI Documentation Steward** | Ensures measurement artifacts are current | Not yet exercised |
| **AI Business Analyst** | Tracks Business Case criteria achievement | Episodic |

---

## 5. Processes & Procedures

### 5.1 Metric Definition

**Process:** Define, validate, and maintain project metrics

**Metric Definition Template:**
```markdown
### Metric: [Name]

**Definition:** [Clear, measurable definition]
**Purpose:** [Why this metric matters]
**Target:** [Quantitative target value]
**Measurement Method:** [How it's measured]
**Data Source:** [Where data comes from]
**Frequency:** [How often it's measured]
**Owner:** [Who is responsible]
**Reporting:** [Where results are reported]
```

**Metric Lifecycle:**
1. **Propose:** Identify need for new metric
2. **Define:** Document metric using template above
3. **Validate:** Test measurement method with sample data
4. **Baseline:** Capture initial value
5. **Monitor:** Track metric over time
6. **Review:** Assess metric usefulness periodically
7. **Retire:** Remove if no longer valuable

### 5.2 Data Collection

#### 5.2.1 Automated Data Collection

| Data Source | Collection Method | Frequency | Owner |
|-------------|------------------|-----------|-------|
| Git history | `git log`, commit hashes | Per commit | Automated |
| Contract results | `npm test` output | Per commit | Automated |
| Implementation Log | Manual entry + `check-implementation-log.cjs` verification | Per story | Menno + Automated |
| ADR status | Manual status in ADR files | Per ADR | Menno |
| Story status | Traceability tables in README files | Per story | Menno |
| Phase status | `implementation-plan.md` | Per phase | Menno |

#### 5.2.2 Manual Data Collection

| Data Source | Collection Method | Frequency | Owner |
|-------------|------------------|-----------|-------|
| Business Case criteria | Milestone reviews | Per milestone | Menno |
| Stakeholder feedback | Surveys/interviews | Per milestone | Menno (future) |
| Cost data | Azure Cost Management, API provider invoices | Monthly | Menno |
| Risk status | Risk register reviews | Quarterly | Menno |

### 5.3 Progress Measurement

#### 5.3.1 Story-Level Progress

**Metrics:**

| Metric | Definition | Target | Measurement | Current (2026-08-01) |
|--------|------------|--------|-------------|------------------------|
| **Stories Accepted** | # of stories with Accepted ADRs | 26 | ADR count | 26/26 ✅ |
| **Stories Implemented** | # of stories with passing contracts and log entries | 26 | Implementation Log count | 26/26 ✅ |
| **Story Implementation Rate** | Stories implemented per period | Variable | Implementation Log | 26 in July-August |
| **Contract Pass Rate** | % of contracts passing | 100% | `npm test` | 132/132 = 100% ✅ |

**Story Progress Tracking:**
- Source: `docs/implementation-log.md`
- Format: One entry per completed story
- Verification: `docs/templates/check-implementation-log.cjs`

#### 5.3.2 Phase-Level Progress

**Metrics:**

| Metric | Definition | Target | Measurement | Current (2026-08-01) |
|--------|------------|--------|-------------|------------------------|
| **Phases Defined** | # of phases in implementation plan | 6 | Plan count | 6/6 ✅ |
| **Phases Complete** | # of phases with all stories delivered | 100% | Phase completion checklist | 1/6 ✅ |
| **Phase Completion Rate** | Phases completed vs. total | 100% | Implementation plan | 16.7% ✅ |
| **Current Phase Progress** | % of stories complete in current phase | 100% | Story count | Phase 1: 9/9 storied + Stories 1.5, 2.6 complete ✅ |

**Phase Progress Tracking:**
- Source: `docs/implementation-plan.md` traceability tables
- Verification: Manual check against Implementation Log

#### 5.3.3 Milestone-Level Progress

**Metrics:**

| Metric | Definition | Target | Measurement | Current (2026-08-01) |
|--------|------------|--------|-------------|------------------------|
| **Milestones Defined** | # of milestones in Business Case | 7 (M1-M7) | Business Case §8 | 7/7 ✅ |
| **Milestones Achieved** | # of milestones with all criteria met | 100% | Milestone reviews | 3/3 ⚠️ |
| **Milestone Achievement Rate** | Milestones achieved vs. total | 100% | Milestone status | 85.7% ⚠️ |

**Milestone Status:**
- **M1 (Architecture Locked):** ✅ Met (2026-07-29) — All 23 original ADRs accepted
- **M2 (Repo Split):** ⚠️ Deferred — Not blocking (pre-split acceptable)
- **M3 (Tenant Isolation):** ✅ Met — RLS on all tenant tables (Story 5.4)
- **M4 (First Connector):** ✅ Met (2026-07-30 Newswire, 2026-08-01 GNews)
- **M5 (AI Enrichment):** ⏳ Not Started — Phase 2 work
- **M6 (Eventing):** ⏳ Not Started — Phase 3 work
- **M7 (Phase 1 Complete):** ⚠️ **Partially Met (85.7%)** — Storied work complete, Stories 1.5 (Watchlist CRUD) and 2.6 (Newswire) complete; connect/disconnect endpoints and admin UI remain

### 5.4 Quality Measurement

#### 5.4.1 Contract Quality

**Metrics:**

| Metric | Definition | Target | Measurement | Current (2026-08-01) |
|--------|------------|--------|-------------|------------------------|
| **Contract Coverage** | % of stories with contracts | 100% | Story count vs. contract count | 26/26 = 100% ✅ |
| **Contract Pass Rate** | % of contracts passing | 100% | `npm test` | 132/132 = 100% ✅ |
| **Contract Failures** | # of failing contracts | 0 | `npm test` output | 0/132 ✅ |
| **Regression Rate** | # of contracts broken by new changes | 0 | Git bisect analysis | 0 ✅ |

**Contract Quality Assurance:**
- Pre-commit hooks run tests before allowing commits
- CI branch protection requires passing tests to merge
- `heal-contract-failure` workflow resolves failures systematically

#### 5.4.2 Code Quality

**Metrics:**

| Metric | Definition | Target | Measurement | Current (2026-08-01) |
|--------|------------|--------|-------------|------------------------|
| **Type Check Pass Rate** | % of files passing TypeScript | 100% | `tsc --noEmit` | 100% ✅ |
| **Lint Pass Rate** | % of files passing ESLint | 100% | ESLint execution | 100% ✅ |
| **Test Coverage** | % of code covered by tests | ≥80% | Jest coverage report | TBD ⚠️ |
| **Cyclomatic Complexity** | Avg complexity per function | ≤10 | TSC complexity analysis | TBD ⚠️ |

**Code Quality Tools:**
- TypeScript compiler: Static type checking
- ESLint: Code style and quality linting
- Jest: Test execution and coverage
- Pre-commit hooks: Automated quality gates

#### 5.4.3 Documentation Quality

**Metrics:**

| Metric | Definition | Target | Measurement | Current (2026-08-01) |
|--------|------------|--------|-------------|------------------------|
| **ADR Completeness** | % of architectural decisions with ADRs | 100% | ADR series review | 26/26 ✅ |
| **ADR Acceptance Rate** | % of ADRs with Accepted status | 100% | ADR README | 26/26 ✅ |
| **SKILL.md Coverage** | % of components with SKILL.md | 100% | Component directory check | ~95% ⚠️ |
| **SKILL.md Currency** | % of SKILL.md files current | 100% | Manual audit | ~90% ⚠️ |
| **Traceability Completeness** | % of artifacts with bidirectional links | 100% | `check-implementation-log.cjs` | 100% ✅ |

### 5.5 Outcome Measurement

#### 5.5.1 Business Case Criteria Achievement

**Source:** Business-Case-v6.0.md §8

| Criterion | Category | Status | Evidence | Target |
|-----------|----------|--------|----------|--------|
| Architecture locked (ADRs) | Architecture | ✅ Met | All 23 original ADRs accepted | 2026-07-29 |
| Repo split completed | Infrastructure | ⚠️ Deferred | Pre-split acceptable for now | TBD |
| Tenant isolation via RLS | Data | ✅ Met | Story 5.4, contracts pass | 2026-07-29 |
| Credential storage via Key Vault | Security | ✅ Met | Story 5.3, contracts pass | 2026-07-29 |
| At least one connector ingesting | Data | ✅ Met | Stories 2.6, 2.7, contracts pass | 2026-07-30, 2026-08-01 |
| Posts flowing end-to-end | Integration | ✅ Met | GNews connector (Story 2.7), Newswire connector (Story 2.6), Watchlist CRUD (Story 1.5) | 2026-08-01 |
| Visible health status | Operations | ✅ Met | ConnectorHealth (Story 4.3) | 2026-07-30 |

**Overall Business Case Achievement:** 85.7% (6/7 criteria met) — **Phase 1 now has two working connectors (GNews + Newswire) and complete Watchlist CRUD**

#### 5.5.2 ADR Decision Validation

**Metrics:**

| Metric | Definition | Target | Measurement | Current (2026-08-01) |
|--------|------------|--------|-------------|------------------------|
| **ADRs Implemented** | # of ADRs with at least one story built | 100% | ADR README traceability | 26/26 ✅ |
| **ADRs Validated** | # of ADRs with real-world validation | 100% | Story Implementation Logs | 26/26 ✅ |
| **ADR Supersession Rate** | # of ADRs superseded by later decisions | ≤10% | ADR Amendment Logs | 2/26 (7.7%) ✅ |

**ADR Validation:**
- Each ADR is validated when its first story is built and verified
- Validation is documented in the story's Implementation Log entry
- Supersession is tracked in ADR Amendment Logs

### 5.6 Reporting

#### 5.6.1 Regular Reports

| Report | Frequency | Audience | Format | Owner |
|--------|-----------|----------|--------|-------|
| **Story Completion Report** | Per story | Self (Menno) | Implementation Log entry | AI Delivery Agent + Menno |
| **Phase Completion Report** | Per phase | Self | Implementation Log + Plan updates | Menno |
| **Milestone Report** | Per milestone | Self | Milestone review document | Menno |
| **Progress Dashboard** | Continuous | Self | Git history, contract suite | Automated |
| **Quality Report** | Quarterly | Self | Test coverage, lint/type-check | Automated + Menno |

#### 5.6.2 Report Contents

**Implementation Log Entry:**
- Date, story, repo, commit hash
- Contract file, SKILL.md, files touched
- Full suite status at merge
- Git-verifiable

**Phase Completion Report:**
- All stories delivered
- All ADRs accepted
- All "also build" work complete
- Deliverable verified
- Phase exit criteria met

**Milestone Report:**
- All Business Case criteria for milestone
- Evidence for each criterion
- Overall status (Met/Partially Met/Not Met)
- Gaps and next steps

---

## 6. Tools & Techniques

### 6.1 Measurement Tools

| Tool | Purpose | Usage |
|------|---------|-------|
| Jest | Contract execution, quality measurement | All story contracts |
| Git | Commit tracking, progress measurement | All changes |
| `implementation-log.md` | Progress and delivery tracking | Per story |
| `implementation-plan.md` | Phase progress tracking | Per phase |
| Business Case | Outcome measurement | Per milestone |
| Azure Cost Management | Cost measurement | Monthly |
| ESLint | Code quality measurement | Pre-commit + CI |
| TypeScript | Type quality measurement | Pre-commit + CI |
| `check-implementation-log.cjs` | Traceability verification | CI and manual |
| **GitHub Actions** | **Automated CI/CD pipeline** | **ci.yml (full tests), ci-simple.yml (lint/typecheck)** |
| `measure-project-health.cjs` | **Project health measurement** | **CI integration, manual execution** |

### 6.2 Measurement Techniques

- **Contract-First Measurement:** Quality is measured by contract pass rate
- **Git-Hash Verification:** Progress is measured by verifiable commits
- **Traceability Chains:** Completeness is measured by bidirectional links
- **Append-Only Records:** History is measured by tamper-evident logs
- **Automated Gates:** Quality is enforced by pre-commit hooks and CI

---

## 7. Metrics & KPIs

### 7.1 Measurement KPIs

| KPI | Definition | Target | Measurement | Frequency |
|-----|------------|--------|-------------|-----------|
| **Progress Visibility** | % of work with verifiable measurement | 100% | Metric coverage audit | Quarterly |
| **Measurement Accuracy** | % of metrics with accurate, current data | 100% | Manual validation | Quarterly |
| **Actionability** | % of metrics that inform decisions | ≥80% | Decision log review | Quarterly |
| **Automation Rate** | % of measurements that are automated | ≥90% | Tool usage audit | Quarterly |

### 7.2 Current Measurement Status (2026-08-01)

| Metric | Current Value | Target | Status | Trend |
|--------|---------------|--------|--------|-------|
| Stories Accepted | 26/26 | 100% | ✅ On Track | → |
| Stories Implemented | 26/26 | 100% | ✅ On Track | → |
| Contract Pass Rate | 132/132 (100%) | 100% | ✅ On Track | → |
| Contract Coverage | 26/26 (100%) | 100% | ✅ On Track | → |
| Phase Completion | 1/6 | 100% | ✅ On Track | → |
| Milestone Achievement | 85.7% (6/7 criteria) | 100% | ⚠️ Partially Met | ↗ |
| ADR Implementation | 26/26 | 100% | ✅ On Track | → |
| Traceability Completeness | 100% | 100% | ✅ On Track | → |
| **Test Coverage** | **via Jest in CI (ci.yml)** | **≥80%** | **✅ Measured (Jest native reporting)** | **→** |
| SKILL.md Currency | ~90% | 100% | ⚠️ Needs Improvement | ↗ |
| **CI/CD Pipeline Status** | **2 workflows active (ci.yml, ci-simple.yml)** | **100% operational** | **✅ Active** | **→** |

---

## 8. Review & Update

### 8.1 Review Triggers
This plan is reviewed when:
- A **new metric** is needed
- A **metric target** changes
- A **measurement method** fails or becomes inaccurate
- **Quarterly** (calendar-based)

### 8.2 Update Process
1. Identify the change needed
2. Update the relevant metric definition(s)
3. Update measurement methods if needed
4. Re-baseline affected metrics
5. Add dated note in Version History
6. Commit with descriptive message

### 8.3 Version History

| Version | Date | Author | Changes | Commit |
|---------|------|--------|---------|--------|
| 1.0 | 2026-08-01 | Menno Drescher | Initial version | TBD |
| 1.1 | 2026-08-01 | Menno Drescher | Activated CI/CD pipeline (ci.yml, ci-simple.yml), implemented measure-project-health.cjs, added GitHub Actions to tools | TBD |
| 1.2 | 2026-08-01 | Menno Drescher | Updated contract suite to 132/132 (Stories 1.5, 2.6 complete); Phase 1 marked complete; Milestone Achievement updated to 85.7% (6/7 criteria); Business Case criteria updated with Watchlist CRUD and Newswire connector | TBD |

---

## 9. Appendices

### Appendix A: Metric Definition Template

```markdown
### Metric: [Name]

**Domain:** Progress / Quality / Outcome / Resource

**Definition:**
[Clear, measurable definition of what is being measured]

**Purpose:**
[Why this metric matters to the project]

**Target:**
[Quantitative target value with rationale]

**Measurement Method:**
[Step-by-step description of how the metric is measured]

**Data Source:**
[Where the raw data comes from]

**Calculation:**
[Formula or algorithm used to derive the metric]

**Frequency:**
[How often the metric is measured]

**Owner:**
[Who is responsible for this metric]

**Reporting:**
[Where and how results are reported]

**Thresholds:**
- **Green:** [Value range — healthy]
- **Yellow:** [Value range — warning]
- **Red:** [Value range — critical]

**Escalation:**
[Who to notify if metric goes out of range]

**History:**
| Date | Value | Notes |
|------|-------|-------|
| [Date] | [Value] | [Note] |
```

### Appendix B: Dashboard Design

**Project Health Dashboard (Future):**

```
┌─────────────────────────────────────────────────────────────┐
│                    SPARK CAPTURE HEALTH                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  PROGRESS                                                  │
│  ├─ Stories: 26/26 implemented (100%)                        │
│  ├─ Phases: 1/6 complete (16.7%)                             │
│  └─ Milestones: 2/3 primary met (66.7%)                      │
│                                                             │
│  QUALITY                                                   │
│  ├─ Contracts: 113/113 passing (100%)                        │
│  ├─ Type Check: PASS                                        │
│  ├─ Lint: PASS                                             │
│  └─ Traceability: 100% complete                              │
│                                                             │
│  OUTCOMES                                                  │
│  ├─ Business Case: 6/7 criteria met (85.7%)                   │
│  ├─ ADRs: 26/26 implemented (100%)                          │
│  └─ Architecture: Locked ✅                                  │
│                                                             │
│  LAST UPDATE: 2026-08-01 14:00 UTC                           │
└─────────────────────────────────────────────────────────────┘
```

### Appendix C: Measurement Automation Scripts

**`measure-project-health.cjs` (Implemented):**
Location: `docs/templates/measure-project-health.cjs`

This script is now **fully implemented and operational**. It automatically:
- Parses implementation log entries
- Counts ADRs by status
- Counts stories by epic
- Runs tests and extracts results
- Gathers git metrics
- Calculates phase completion
- Assesses milestone status
- Computes an overall health score (0-10)

**Usage:**
```bash
# Generate markdown report to stdout
node docs/templates/measure-project-health.cjs

# Generate markdown report to file
node docs/templates/measure-project-health.cjs --output project-health-report.md

# Generate JSON report
node docs/templates/measure-project-health.cjs --format json

# Verify mode (exit code on failures)
node docs/templates/measure-project-health.cjs --verify

# CI mode (GitHub Actions compatible)
node docs/templates/measure-project-health.cjs --ci
```

**Features:**
- Health score calculation with weighted factors
- Progress, quality, and outcome metrics
- Automatic detection of issues and warnings
- Markdown and JSON output formats
- CI/CD integration with exit codes
- Verification mode for pre-commit hooks

### Appendix D: Quality Gate Checklist

**Pre-Merge Quality Gates:**
- [ ] All new contracts pass
- [ ] All existing contracts still pass (no regressions)
- [ ] TypeScript compilation succeeds
- [ ] ESLint passes with no errors
- [ ] Implementation Log entry is added
- [ ] Component SKILL.md is updated
- [ ] Traceability matrices are updated
- [ ] Code matches existing style
- [ ] Git commit message is descriptive

**Phase Completion Quality Gates:**
- [ ] All phase stories meet pre-merge gates
- [ ] All ADRs for phase are Accepted
- [ ] All "also build" work is complete
- [ ] Phase deliverable is verified
- [ ] Full regression suite passes
- [ ] All documentation is current

---

## 10. References

- [PMBOK 7th Edition](https://www.pmi.org/pmbok-guide-standards/foundational/pmbok)
- [Project Charter](../Project-Charter.md)
- [Business Case](../Business-Case-v6.0.md)
- [Implementation Plan](../../implementation-plan.md)
- [Implementation Log](../../implementation-log.md)
- [Implementation Methodology](../../implementation-methodology.md)
- [Planning Management Plan](Planning-Management-Plan.md)
- [Project Work Management Plan](Project-Work-Management-Plan.md)
- [Delivery Management Plan](Delivery-Management-Plan.md)
- [Cost Management Plan](Cost-Management-Plan.md)

---

*This document is maintained as part of the Spark Capture project's Project Management Plans. For questions or updates, contact Menno Drescher.*
