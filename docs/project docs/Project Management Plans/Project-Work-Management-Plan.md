# Project Work Management Plan
## SocialEngage Project — PMBOK Domain: Project Work

**Project:** Social Listening & Engagement Platform (SocialEngage)  
**Phase:** Phase 1 — Social Listening / Insights Subsystem  
**Owner:** Menno Drescher  
**Date:** 2026-08-01  
**Status:** Active — CI/CD implemented; mandatory time tracking via pre-commit hook is **Planned, not yet installed** (see §5.1.3 and §6.1 — Status correction, 2026-08-03)  
**Version:** 1.4

---

## 1. Purpose

This plan defines **how work is executed, monitored, and controlled** for the SocialEngage project. It describes the day-to-day processes that turn planning artifacts (ADRs, stories, phases) into delivered, verified software.

The Project Work Performance Domain (PMBOK 7th Edition) covers the execution of project activities to deliver outputs, outcomes, and benefits. For SocialEngage, this is operationalized through the **`implement-story` skill** and its supporting methodology (`docs/implementation-methodology.md`), which provides the mechanical enforcement of the project's quality and traceability standards.

---

## 2. Scope

### 2.1 What This Plan Covers
- Work execution processes (story implementation workflow)
- Quality control (contract-first testing, regression suite)
- Work monitoring (progress tracking, issue management)
- Work control (change management during execution)
- Component `SKILL.md` maintenance
- Healing process for contract failures

### 2.2 What This Plan Does NOT Cover
- High-level planning (see Planning-Management-Plan.md)
- Architectural decision-making (see ADR series)
- Risk management (see Uncertainty-Management-Plan.md)
- Delivery and release (see Delivery-Management-Plan.md)
- Stakeholder engagement (see Stakeholder-Management-Plan.md)

---

## 3. Approach

### 3.1 Core Philosophy
**"Automate the discipline so it cannot be skipped."**

Given this is a solo-developer project where context resets between sessions, work execution must be:
1. **Mechanically enforced** (hooks, CI, automated checks)
2. **Traceable** (every change linked to a story, ADR, and git commit)
3. **Verifiable** (contracts prove correctness, not manual testing)
4. **Repeatable** (same process for every story, every time)

### 3.2 Solo-Developer Adaptations

| Traditional Project Work Concept | Solo-Developer Adaptation |
|-----------------------------------|---------------------------|
| Team task assignment | Self-assignment via story picking |
| Code review | Automated contracts + AI agent review |
| Progress tracking | Implementation Log + git history |
| Quality gates | Pre-commit hooks + CI checks |
| Handoff documentation | Component `SKILL.md` files |
| Knowledge sharing | Documentation-first, async |

### 3.3 Work Execution Model

```
Story Selection
    ↓
Contract First (Jest test encoding acceptance criteria)
    ↓
SKILL.md Update (component documentation)
    ↓
Minimal Implementation (pass the contract)
    ↓
Full Regression Suite (all contracts pass)
    ↓
Implementation Log Entry (git-hash-verified record)
    ↓
Traceability Update (ADR/README, user-stories/README, implementation-plan.md)
```

This is the **`implement-story` workflow**, operationalized as a Claude Code skill.

---

## 4. Roles & Responsibilities

### 4.1 Human Roles

| Role | Responsibilities | Current Assignment |
|------|------------------|-------------------|
| **Work Executor** | Implements stories, writes contracts, maintains `SKILL.md` files | Menno Drescher |
| **Quality Assurer** | Validates contracts, ensures regression suite passes | Menno + Automated (Jest) |
| **Methodology Guardian** | Ensures `implementation-methodology.md` is followed | AI Delivery Agent + Menno |
| **Healing Agent** | Resolves contract failures, traces blast radius | AI Delivery Agent + Menno |
| **Traceability Auditor** | Verifies all traceability links are current | AI Documentation Steward (future) |

### 4.2 AI Agent Roles

| Role | Responsibilities | Engagement |
|------|------------------|------------|
| **AI Delivery Agent** | Executes `implement-story` skill end-to-end | Per story |
| **AI QA/Contract Author** | Writes/reviews contracts independently | Not yet exercised separately |
| **AI Documentation Steward** | Audits traceability matrices | Not yet exercised |
| **AI Security Reviewer** | Flags security concerns during implementation | Episodic |

---

## 5. Processes & Procedures

### 5.1 Story Implementation (implement-story Workflow)

**Purpose:** Transform an accepted story into delivered, verified code with full traceability.

**Trigger:** Story is Ready (ADR accepted, no blocking dependencies)

**Process:**

#### 5.1.1 Pre-Implementation
1. **Select Story:** Choose from Ready stories in `implementation-plan.md`
2. **Review ADR:** Re-read the source ADR to understand the decision
3. **Review Dependencies:** Check `implementation-plan.md` for sequencing constraints
4. **Check Contract Existence:** Ensure contract file exists (or create if this is the first implementation)

#### 5.1.2 Contract-First Development
1. **Write Contract:** 
   - Create or update Jest test file: `contracts/epic-N/story-X.Y.<slug>.contract.test.ts`
   - Encode acceptance criteria from story as test assertions
   - Use real infrastructure (Azure Key Vault, Service Bus, Postgres) — **no mocks**
   - Include both happy path and edge cases
   - Reference: `docs/implementation-methodology.md` §4.1

2. **Verify Contract Fails:**
   - Run the new contract to confirm it fails (proves it's testing something non-trivial)
   - Document the failure in the `SKILL.md` "Known gaps" section

#### 5.1.3 Implementation
1. **Update SKILL.md:**
   - Document the component being built
   - Add "Known gaps / deferred work" section
   - Add "Files" section listing all files the component touches
   - Reference: `docs/implementation-methodology.md` §4.2

2. **Write Minimal Code:**
   - Implement only what's needed to pass the contract
   - Match existing style (indentation, naming, error handling)
   - Minimal diff principle: remove completely rather than comment out
   - Reference: `docs/implementation-methodology.md` §4.3

3. **Run Full Suite:**
   - Run `npm test` to execute all contracts
   - All existing contracts must continue to pass (no regressions)
   - New contract must pass

4. **Track Time Spent (Planned, not yet installed):**
   - **Status correction, 2026-08-03:** This subsection previously described the hook below as "Enforced" and "Cannot be bypassed without `--no-verify`." Verified against the repo: `.git/hooks/pre-commit` does not exist (only Git's own `pre-commit.sample` template is present), and `docs/time-tracking.md`'s log table has zero rows ("Total Time: 0 minutes") despite 34 stories having shipped since this plan was drafted. The hook was described here but never actually installed — reframed below as planned, not active.
   - **Designed mechanism (not yet built/installed):** `scripts/git-hooks/pre-commit`
   - **Installation (not yet run):** `node scripts/setup-git-hooks.js` would activate it, if/when built
   - Intended to prompt for: date, start/end time, duration, activity, story/ADR, notes
   - Intended to automatically add an entry to `docs/time-tracking.md` as a line item
   - Intended to auto-calculate duration from start/end times
   - Would not be bypassable without `--no-verify`, once actually installed
   - Would enable estimation accuracy metrics (see Measurement-Management-Plan.md) — until then, the only real (partial) time proxy in this project is `docs/implementation-log.md`'s per-session "Session duration (approximate)" field, itself git-timestamp-derived, not measured (see Cost-Management-Plan.md §5.2.5)

#### 5.1.4 Post-Implementation
1. **Append Implementation Log Entry:**
   - Add entry to `docs/implementation-log.md` using exact format
   - Include: date, story, repo, commit hash, contract file, SKILL.md, files touched, suite status
   - Reference: `docs/implementation-log.md` §7-20

2. **Update Traceability:**
   - Update `docs/adr/README.md` traceability table if ADR is first implementation
   - Update `docs/user-stories/README.md` traceability table
   - Update `docs/implementation-plan.md` traceability table

3. **Verify Traceability:**
   - Run `docs/templates/check-implementation-log.cjs` to verify entry against git
   - Manually verify all traceability links

**Exit Criteria:**
- [ ] Contract exists and passes
- [ ] Full accumulated contract suite passes
- [ ] Component `SKILL.md` is current
- [ ] Implementation Log entry exists with git-verifiable commit hash
- [ ] All traceability tables are accurate

**Automation:** This entire workflow is operationalized as the `implement-story` Claude Code skill.

### 5.2 Healing Contract Failures (heal-contract-failure Workflow)

**Purpose:** Restore a failing contract to passing state while maintaining all other contracts.

**Trigger:** Contract fails during:
- New story implementation (expected, part of workflow)
- Regression from another story's changes (unexpected, needs healing)
- Infrastructure changes (e.g., Azure API updates)

**Process:**

#### 5.2.1 Diagnose
1. **Identify Failing Contract:** Run `npm test` to see which contract(s) fail
2. **Determine Root Cause:**
   - Is it the contract being too strict (false positive)?
   - Is it the implementation being incorrect?
   - Is it a fixture/data issue?
   - Is it an infrastructure issue?
3. **Check Blast Radius:**
   - How many other contracts might be affected?
   - Are any already-shipped contracts at risk?

#### 5.2.2 Heal
1. **If Implementation Issue:**
   - Fix the implementation to match the contract
   - Re-run full suite

2. **If Contract Issue (stale relative to ADR):**
   - **STOP:** Cannot edit without explicit sign-off
   - Trace all contracts that would be affected
   - Present blast radius to Menno for decision
   - If approved, edit contract with dated note and Menno's sign-off
   - Reference: `docs/implementation-methodology.md` §5.2

3. **If Fixture/Data Issue:**
   - Fix the fixture or test data
   - Ensure fix doesn't break other contracts

4. **If Infrastructure Issue:**
   - Check if it's a transient issue (retry)
   - If persistent, may need ADR amendment or story to address

#### 5.2.3 Verify
1. **Failing Contract Passes:** The healed contract now passes
2. **No New Failures:** All other contracts still pass
3. **Root Cause Addressed:** The underlying issue is resolved, not worked around
4. **Documentation Updated:** Any changes to contracts, implementations, or fixtures are documented

**Exit Criteria:**
- [ ] Healed contract passes
- [ ] Full accumulated contract suite passes
- [ ] Root cause is understood and addressed
- [ ] Documentation reflects the change

**Automation:** Operationalized as the `heal-contract-failure` Claude Code skill.

### 5.3 Component SKILL.md Maintenance

**Purpose:** Maintain accurate, current documentation for each component to support future sessions and onboarding.

**Process:**

#### 5.3.1 SKILL.md Structure
Every component has a `SKILL.md` file in `.claude/skills/<component-slug>/SKILL.md` with:

```markdown
# <Component Name> — <Purpose>

## Why this exists
[One-sentence rationale]

## In scope
- [ ] [Capability 1]
- [ ] [Capability 2]

## Out of scope
- [ ] [Not handled here]

## Files
| File | Purpose |
|------|---------|
| `src/...` | ... |

## Known gaps / deferred work
| Gap | Rationale | Status |
|-----|-----------|--------|
| [Gap] | [Why deferred] | [Open/Resolved] |

## Entry points
- [ ] `functionName()` — [purpose]

## Usage notes
- [Note 1]
- [Note 2]
```

#### 5.3.2 SKILL.md Update Triggers
Update the component's `SKILL.md` when:
- New file is added to the component
- Existing file is modified
- New gap or deferred work is identified
- Gap is resolved
- Usage pattern changes

#### 5.3.3 SKILL.md Quality Checks
- **Accuracy:** Files list matches actual files in the component
- **Completeness:** All capabilities and gaps are documented
- **Currency:** Known gaps reflect current state
- **Clarity:** Purpose and usage are understandable to a future reader

### 5.4 Work Monitoring

#### 5.4.1 Progress Tracking
**Method:** Implementation Log is the primary progress artifact

**Metrics:**
- Stories completed per phase
- Phases closed
- Contract suite pass rate
- Implementation Log entries per period

**Tracking:**
- `docs/implementation-log.md` — append-only record of all completed work
- `docs/implementation-plan.md` — phase-by-phase progress
- Git history — verifiable record of all changes

#### 5.4.2 Issue Management
**Categories:**
1. **Contract Failures:** Handled via `heal-contract-failure` workflow
2. **Architecture Gaps:** Handled via new or amended ADR
3. **Dependency Issues:** Handled via Planning-Management-Plan.md processes
4. **Process Violations:** Handled via methodology updates

**Issue Lifecycle:**
1. Identify → 2. Categorize → 3. Route to correct workflow → 4. Resolve → 5. Verify → 6. Document

### 5.5 Work Control

#### 5.5.1 Change Control During Execution
**Principle:** Changes to already-shipped artifacts require explicit handling

**Categories:**
| Category | Process |
|----------|---------|
| New story implementation | Standard `implement-story` workflow |
| Healing contract failure | `heal-contract-failure` workflow |
| Editing stale contract | **STOP** — requires Menno sign-off (see §5.2.2) |
| Editing shipped code | Treat as new story if non-trivial |

#### 5.5.2 Scope Creep Prevention
**Mechanisms:**
1. **Contract-First:** Forces explicit definition of acceptance criteria before implementation
2. **Minimal Implementation:** Discourages building beyond what the contract requires
3. **Traceability:** Every change must link to a story and ADR
4. **Implementation Log:** Public record of what was actually built

**Red Flags:**
- Implementation that passes contract but adds unnecessary features
- Code that doesn't trace to any story or ADR
- Changes to shipped artifacts without documentation

---

## 6. Tools & Techniques

### 6.1 Primary Tools

| Tool | Purpose | Usage |
|------|---------|-------|
| `implement-story` skill | End-to-end story implementation | Claude Code skill |
| `heal-contract-failure` skill | Contract failure resolution | Claude Code skill |
| Jest | Contract testing framework | All story contracts |
| Git | Version control, commit verification | All changes |
| `check-implementation-log.cjs` | Traceability verification | CI and manual |
| Component `SKILL.md` files | Component documentation | Per component |
| **`docs/time-tracking.md`** | **Mandatory time tracking log (planned)** | **⚠️ Not yet populated — 0 rows logged as of 2026-08-03 despite 34 stories shipped; hook not installed** |
| **`scripts/git-hooks/pre-commit`** | **Time tracking enforcement (planned)** | **⚠️ Not yet installed — `.git/hooks/pre-commit` does not exist (only `pre-commit.sample`)** |
| **`scripts/setup-git-hooks.js`** | **Hook installation script (planned)** | **Would be run once to activate the pre-commit hook, if/when built** |

### 6.2 Automation Layers

**Three mechanical enforcement layers** (from `docs/implementation-methodology.md`):

1. **PreToolUse Hook:**
   - Blocks writes to `src/` without existing contract
   - Prevents implementation without specification

2. **Pre-commit Hook:**
   - Runs linting, type-checking, and tests
   - Prevents commits that break the suite

3. **CI with Branch Protection:**
   - Runs full test suite on PR
   - Requires passing suite to merge
   - Prevents regression at the repository level

**Additional Enforcement:**
- Hard rule: Cannot weaken a check to reach passing state
- Must escalate to Menno after 3 failed remediation attempts
- Story 2.5 precedent: traced full blast radius before touching shipped contracts

### 6.3 Techniques

- **Contract-First Development:** Tests before implementation
- **Minimal Diff Principle:** Remove completely, don't comment out
- **Traceability Chains:** Every artifact links to its parent and children
- **Append-Only Documentation:** Never edit history, only add corrections
- **Git-Hash Verification:** All entries reference verifiable commits

---

## 7. Metrics & KPIs

### 7.1 Work Execution KPIs

| KPI | Definition | Target | Measurement | Frequency |
|-----|------------|--------|-------------|-----------|
| Contract Pass Rate | % of contracts passing in full suite | 100% | `npm test` | Per commit |
| Story Completion Rate | Stories completed per period | Variable | Implementation Log | Per phase |
| Healing Time | Avg time to resolve contract failure | ≤1 day | Healing log | Per failure |
| SKILL.md Accuracy | % of components with current SKILL.md | 100% | Manual audit | Quarterly |
| Traceability Completeness | % of artifacts with bidirectional links | 100% | `check-implementation-log.cjs` | Per commit |

### 7.2 Current Metrics (last verified 2026-08-03)

**Note:** figures below are hand-maintained point-in-time snapshots; consider generating this table from `docs/templates/measure-project-health.cjs`'s output instead, so it can't go stale between manual updates.

| KPI | Current Value | Target | Status |
|-----|---------------|--------|--------|
| Contract Pass Rate | 159/159 (100%, 32/32 suites) | 100% | ✅ On Track |
| Story Completion Rate | 34/34 stories built (Phase 4.5 underway) | 100% of ADR scope | ✅ Complete |
| Healing Time | N/A (no healing needed recently) | ≤1 day | ✅ On Track |
| SKILL.md Accuracy | ~95% (some components need updates) | 100% | ⚠️ Needs Review |
| Traceability Completeness | 100% | 100% | ✅ On Track |

---

## 8. Review & Update

### 8.1 Review Triggers
This plan is reviewed when:
- A **new workflow** is needed
- A **workflow failure** occurs (e.g., contract failure not caught by healing)
- A **process violation** is detected
- **Quarterly** (calendar-based)

### 8.2 Update Process
1. Identify the change needed
2. Update the relevant section(s)
3. Update any affected workflows or automation
4. Add dated note in Version History
5. Commit with descriptive message

### 8.3 Version History

| Version | Date | Author | Changes | Commit |
|---------|------|--------|---------|--------|
| 1.0 | 2026-08-01 | Menno Drescher | Initial version | TBD |
| 1.1 | 2026-08-01 | Menno Drescher | Added time-tracking.md integration, referenced in workflow and tools | TBD |
| 1.2 | 2026-08-01 | Menno Drescher | Implemented mandatory pre-commit hook for time tracking, moved to docs/time-tracking.md | TBD |
| 1.3 | 2026-08-01 | Menno Drescher | Created tracked git hook script with setup utility (scripts/git-hooks/pre-commit, scripts/setup-git-hooks.js) | TBD |
| 1.4 | 2026-08-03 | Menno Drescher | Status correction: time-tracking pre-commit hook was never actually installed (`.git/hooks/pre-commit` absent, `docs/time-tracking.md` has 0 rows); reframed §5.1.3/§6.1 from "Active/Enforced" to "Planned, not yet installed." Re-baselined §7.2 KPIs to 34 stories / 159/159 contracts (32/32 suites), last verified 2026-08-03 | TBD |

---

## 9. Appendices

### Appendix A: implement-story Skill Workflow

```
INPUT: Story number (e.g., "2.7")

1. READ story and source ADR
   - Read docs/user-stories/epic-N/story-X.Y.md
   - Read docs/adr/00NN-<title>.md
   - Identify acceptance criteria

2. CHECK dependencies
   - Verify all dependent ADRs are Accepted
   - Verify all dependent stories are built
   - Check implementation-plan.md for sequencing

3. WRITE contract
   - Create contracts/epic-N/story-X.Y.<slug>.contract.test.ts
   - Encode acceptance criteria as Jest assertions
   - Use real infrastructure (no mocks)
   - Include edge cases

4. VERIFY contract fails (proves it's non-trivial)

5. UPDATE SKILL.md
   - Create/update .claude/skills/<component>/SKILL.md
   - Document component purpose and scope
   - List all files component touches
   - Document known gaps

6. IMPLEMENT minimally
   - Write only code needed to pass contract
   - Match existing style
   - Follow minimal diff principle

7. RUN full suite
   - npm test
   - All contracts must pass (new + existing)

8. APPEND Implementation Log entry
   - Add to docs/implementation-log.md
   - Include: date, story, repo, commit, contract, SKILL.md, files, suite status

9. UPDATE traceability
   - Update docs/adr/README.md if first implementation
   - Update docs/user-stories/README.md
   - Update docs/implementation-plan.md

OUTPUT: Story complete, verified, documented
```

### Appendix B: heal-contract-failure Skill Workflow

```
INPUT: Failing contract file or error message

1. IDENTIFY failing contract(s)
   - npm test -- --verbose
   - Note which contract(s) fail

2. DETERMINE root cause
   - Is implementation incorrect?
   - Is contract too strict?
   - Is fixture/data wrong?
   - Is infrastructure issue?

3. CHECK blast radius
   - What other contracts might be affected?
   - Are any shipped contracts at risk?

4. ROUTE to correct process:
   
   IF implementation issue:
   a. Fix implementation
   b. Re-run suite
   
   IF contract stale relative to ADR:
   a. STOP
   b. Trace all affected contracts
   c. Present to Menno for sign-off
   d. If approved, edit contract with dated note
   
   IF fixture/data issue:
   a. Fix fixture or test data
   b. Verify no other contracts break
   
   IF infrastructure issue:
   a. Check if transient (retry)
   b. If persistent, may need ADR or story

5. VERIFY
   - Failing contract passes
   - No new failures
   - Root cause addressed

OUTPUT: Contract healed, suite passes, documentation updated
```

### Appendix C: SKILL.md Quality Checklist

Use this checklist when creating or updating a `SKILL.md` file:

- [ ] Header includes component name and purpose
- [ ] "Why this exists" section explains rationale
- [ ] "In scope" and "Out of scope" sections are complete
- [ ] "Files" table lists all files the component touches
- [ ] "Known gaps / deferred work" table is current
- [ ] "Entry points" section lists all public functions
- [ ] "Usage notes" section includes non-obvious behaviors
- [ ] All file paths are accurate and current
- [ ] All gaps have rationales and status
- [ ] Document is understandable to a future reader

### Appendix D: Contract Quality Checklist

Use this checklist when writing or reviewing a contract:

- [ ] Tests encode acceptance criteria from story
- [ ] Uses real infrastructure (no mocks for Azure, Postgres)
- [ ] Includes both happy path and edge cases
- [ ] Has descriptive test names
- [ ] Has clear assertion messages
- [ ] Tests are independent (can run in any order)
- [ ] Tests are deterministic (same result every run)
- [ ] No test relies on external state beyond its fixtures
- [ ] Contract file name matches story naming convention
- [ ] Contract references its source story and ADR

---

## 10. References

- [PMBOK 7th Edition](https://www.pmi.org/pmbok-guide-standards/foundational/pmbok)
- [Implementation Methodology](../../implementation-methodology.md)
- [Implementation Plan](../../implementation-plan.md)
- [Implementation Log](../../implementation-log.md)
- [Stakeholder Management Plan](Stakeholder-Management-Plan.md)
- [Planning Management Plan](Planning-Management-Plan.md)
- [Delivery Management Plan](Delivery-Management-Plan.md)
- [Measurement Management Plan](Measurement-Management-Plan.md)

---

*This document is maintained as part of the SocialEngage project's Project Management Plans. For questions or updates, contact Menno Drescher.*
