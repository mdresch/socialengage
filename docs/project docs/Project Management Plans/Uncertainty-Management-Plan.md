# Uncertainty Management Plan
## SocialEngage Project — PMBOK Domain: Uncertainty

**Project:** Social Listening & Engagement Platform (SocialEngage)  
**Phase:** Phase 1 — Social Listening / Insights Subsystem  
**Owner:** Menno Drescher  
**Date:** 2026-08-01  
**Status:** Active — CI/CD implemented, canonical risk register (R-01–R-06)  
**Version:** 1.3

---

## 1. Purpose

This plan defines **how risks, issues, and uncertainties are identified, assessed, and responded to** for the SocialEngage project. It establishes a systematic approach to managing the unknowns and potential problems that could impact project objectives.

The Uncertainty Performance Domain (PMBOK 7th Edition) emphasizes that uncertainty is inherent in all projects and that effective management of uncertainty is critical to project success. For SocialEngage, this means: **proactively identifying risks, explicitly tracking deferred decisions, and maintaining a bias toward transparency over optimism.**

---

## 2. Scope

### 2.1 What This Plan Covers
- Risk identification and categorization
- Risk assessment (probability, impact, urgency)
- Risk response planning and execution
- Issue management (when risks materialize)
- Deferred work tracking
- Open questions and unresolved decisions
- Uncertainty communication

### 2.2 What This Plan Does NOT Cover
- Scope management (see Planning-Management-Plan.md)
- Change management (see Planning-Management-Plan.md)
- Quality assurance (see Measurement-Management-Plan.md)
- Delivery processes (see Delivery-Management-Plan.md)
- Cost management (see Cost-Management-Plan.md)

---

## 3. Approach

### 3.1 Core Philosophy
**"Name the uncertainty so it can be managed."**

Given this is a solo-developer project, uncertainty management focuses on:
1. **Explicit Tracking:** Every risk, issue, and uncertainty is documented
2. **Proactive Identification:** Look for risks before they become issues
3. **Realistic Assessment:** No sugar-coating; state probabilities and impacts honestly
4. **Acceptance of Limits:** Some uncertainties must be accepted, not resolved

### 3.2 Solo-Developer Adaptations

| Traditional Uncertainty Concept | Solo-Developer Adaptation |
|--------------------------------|---------------------------|
| Risk register | `open-items-and-deferred-work.md` + Risk sections in docs |
| Risk owner assignment | Menno owns all risks (self-assigned) |
| Risk review meetings | Dated addenda to risk registers |
| Escalation paths | External AI review for complex risks |
| Contingency planning | Deferred work with explicit rationales |

### 3.3 Uncertainty Categories

The project tracks several types of uncertainty:

1. **Risks:** Potential future problems with probability and impact
2. **Issues:** Current problems that have materialized
3. **Deferred Work:** Deliberately postponed decisions or implementations
4. **Open Questions:** Unresolved questions requiring future decisions
5. **Assumptions:** Beliefs taken as true without full verification
6. **Dependencies:** External factors outside project control

---

## 4. Roles & Responsibilities

### 4.1 Human Roles

| Role | Responsibilities | Current Assignment |
|------|------------------|-------------------|
| **Risk Owner** | Overall uncertainty management approach | Menno Drescher |
| **Risk Identifier** | Proactively identifies new risks and uncertainties | Menno + AI Reviewers |
| **Risk Assessor** | Evaluates probability, impact, and urgency | Menno |
| **Risk Responder** | Implements risk response strategies | Menno |
| **Issue Manager** | Tracks and resolves materialized issues | Menno |
| **Deferred Work Tracker** | Maintains deferred work register | Menno |

### 4.2 AI Agent Roles

| Role | Responsibilities | Engagement |
|------|------------------|------------|
| **AI Security Reviewer** | Identifies security and architecture risks | Episodic |
| **AI Engineering Pragmatism Reviewer** | Identifies overengineering and complexity risks | Episodic |
| **AI Product & Market-Fit Reviewer** | Identifies market and adoption risks | Episodic |
| **AI Data Privacy Reviewer** | Identifies data handling and compliance risks | Episodic |

---

## 5. Processes & Procedures

### 5.1 Risk Management

#### 5.1.1 Risk Identification

**Triggers:**
- New architecture decision (ADR drafting)
- New story selection
- New external dependency
- Phase transition
- AI reviewer findings
- Any "unknown unknown" discovered during work

**Process:**
1. **Document the Risk:**
   - Add to `open-items-and-deferred-work.md` or relevant artifact
   - Use the Risk Template (Appendix A)
   - Assign unique identifier (R-XX from Business Case, or new)

2. **Categorize the Risk:**
   - Technical / Architectural / Security / Operational / Business / External

3. **Assess Initial Impact:**
   - Probability (High/Medium/Low)
   - Impact (High/Medium/Low)
   - Urgency (Immediate/Short-term/Long-term)

4. **Assign to Risk Register:**
   - This plan's own Appendix D for canonical project-level risk IDs R-01–R-06 (Business Case §5 keeps a dated snapshot only) — see Appendix D's status correction below for the full ownership history
   - `open-items-and-deferred-work.md` for execution-level risks
   - Component `SKILL.md` for component-specific risks

**Risk Identification Sources:**
- ADR Amendment Logs (open questions, known gaps)
- Implementation Log entries (issues encountered)
- AI reviewer findings (security, pragmatism, product)
- External dependency changes (Azure, API providers)
- This plan's own risk register (R-01 to R-06 — Appendix D, canonical; Business-Case-v6.0.md §5 holds a dated snapshot only)

#### 5.1.2 Risk Assessment

**Risk Assessment Matrix:**

| Probability \ Impact | High | Medium | Low |
|----------------------|------|--------|-----|
| **High** | **Critical** — Immediate action | **High** — Urgent action | **Medium** — Monitor closely |
| **Medium** | **High** — Urgent action | **Medium** — Monitor | **Low** — Accept |
| **Low** | **Medium** — Monitor | **Low** — Accept | **Low** — Accept |

**Assessment Factors:**
- **Probability:** Likelihood of risk occurring (0-100%)
- **Impact:** Effect on project if risk occurs (High/Medium/Low)
- **Urgency:** Timeframe within which risk could materialize
- **Detectability:** How early the risk can be detected
- **Mitigability:** How effectively the risk can be reduced

#### 5.1.3 Risk Response Planning

**Response Strategies (Adapted for Solo-Developer):**

| Strategy | Definition | Solo-Developer Application |
|----------|------------|-----------------------------|
| **Avoid** | Change plan to eliminate risk | Redesign architecture to remove dependency |
| **Mitigate** | Reduce probability or impact | Add error handling, validation, retries |
| **Transfer** | Shift risk to another party | Use managed services (Azure), insurance (future) |
| **Accept** | Acknowledge and monitor risk | Document and track; no active response |
| **Defer** | Postpone decision/implementation | Add to deferred work with rationale |

**Response Selection Criteria:**
1. **Severity:** Critical/High risks get Avoid or Mitigate
2. **Cost:** Response cost must be proportional to risk
3. **Feasibility:** Response must be implementable in solo context
4. **Effectiveness:** Response must actually reduce risk

#### 5.1.4 Risk Monitoring and Review

**Monitoring Methods:**
- **Critical/High Risks:** Weekly manual check
- **Medium Risks:** Monthly manual check
- **Low/Accepted Risks:** Quarterly review
- **All Risks:** Automated where possible (e.g., Azure service health monitoring)

**Review Triggers:**
- Risk probability or impact changes
- Risk materializes (becomes an issue)
- Response effectiveness needs assessment
- Quarterly (calendar-based)

**Review Process:**
1. Re-assess probability and impact
2. Evaluate response effectiveness
3. Update risk register
4. Communicate changes to stakeholders (documentation)

### 5.2 Issue Management

**Purpose:** Track and resolve problems that have materialized

**Issue Lifecycle:**
1. **Identify:** Problem is discovered
2. **Log:** Create issue entry with details
3. **Triage:** Determine severity and category
4. **Diagnose:** Identify root cause
5. **Respond:** Implement fix or workaround
6. **Verify:** Confirm issue is resolved
7. **Close:** Document resolution
8. **Retrospective:** Capture lessons learned

**Issue Categories:**
| Category | Definition | Example |
|----------|------------|---------|
| **Contract Failure** | Jest contract fails unexpectedly | Regression from another story's change |
| **Infrastructure Failure** | External service (Azure, API) unavailable | Azure PostgreSQL outage |
| **Architecture Gap** | ADR decision proves insufficient | RLS policy doesn't cover new table |
| **Dependency Issue** | External dependency changes or fails | API provider deprecates endpoint |
| **Process Violation** | Methodology not followed correctly | Implementation without contract |

**Issue Tracking Locations:**
- **Contract Failures:** Implementation Log entries, `heal-contract-failure` workflow
- **Architecture Gaps:** ADR Amendment Logs
- **Dependency Issues:** `open-items-and-deferred-work.md` §5.2
- **Process Violations:** `implementation-methodology.md` deferred findings

### 5.3 Deferred Work Management

**Purpose:** Track work deliberately postponed to maintain focus

**Deferred Work Categories (from `open-items-and-deferred-work.md`):**

#### 5.3.1 Section A: "Also Build, Not Storied"

**Current baseline (2026-08-03):** Watchlist CRUD is complete. Connector connect/disconnect routes exist but require ADR-0033/0034 authentication, ownership, and authorization rework. The remaining admin deliverable is the role-gated Next.js application required by ADR-0035.
Real, substantial work the ADR process didn't cover because it isn't architecturally interesting.

| Phase | Not-Yet-Built Items | Status | Blocking |
|-------|---------------------|--------|----------|
| 1 | Watchlist CRUD endpoints | ⏳ Open | Phase 1 completion |
| 1 | Connector connect/disconnect endpoints | ⏳ Open | Phase 1 completion |
| 1 | Admin UI (connect, watchlist, status screens) | ⏳ Open | Phase 1 completion |
| 2 | Real AIProviderConnector (Azure AI Language) | ⏳ Open | Phase 2 start |
| 2 | AI provider management endpoints | ⏳ Open | Phase 2 start |
| 2 | Enrichment pipeline wiring | ⏳ Open | Phase 2 start |
| 3 | Test subscriber for event validation | ⏳ Open | Phase 3 start |
| 4 | Distributed RequestGate (Redis) | ⏳ Deferred | Multi-instance need |
| 4 | Third connector (Reddit) | ⏳ Open | Phase 4 start |
| 5 | Entire phase (security, load testing, runbooks) | ⏳ Open | Production need |

**Deferred Work Principles:**
1. **Explicit Rationale:** Every deferred item has a stated reason
2. **Tracked, Not Forgotten:** All deferred work is in `open-items-and-deferred-work.md`
3. **Reviewed Regularly:** Deferred work is revisited at phase transitions
4. **Prioritized:** Deferred work is ordered by dependency and value

#### 5.3.2 Section B: Deferred Sub-Scope Within Shipped Stories

**Authentication distinction (2026-08-03):** SocialEngage user authentication and bearer-token identity are now architecturally decided by ADR-0029–0033 and are implementation work. Connector-specific OAuth token exchange remains deferred until the first OAuth connector, such as Reddit.
Gaps within already-shipped components.

**Current interpretation:** The OAuth row below refers to connector-specific OAuth and remains deferred until an OAuth connector is built. Entra-based SocialEngage authentication is separately accepted by ADR-0029–0033 and is an implementation risk, not an open architectural decision.

| Component | Deferred Item | Status | Impact |
|-----------|---------------|--------|--------|
| Real-connector wiring | Watchlist matching not called from connectors | ⏳ Open | Medium |
| Real-connector wiring | publishEvent() not called from connectors | ⏳ Open | Medium |
| Real-connector wiring | OAuth token-exchange flow | ⏳ Open | Medium (waiting for OAuth platform) |
| Distributed correctness | Redis-backed RequestGate | ⏳ Deferred | Low (solo deployment) |
| Derived-data caching | pg_cron production enablement | ⏳ Open | Medium |
| Retention & archival | Periodic archival scheduling | ⏳ Open | Medium |
| Eventing | Real coordinated schema cutover | ⏳ Open | Low (no downstream consumers) |
| Security | Real authentication on endpoints | ⏳ Open | High (Phase 5) |

#### 5.3.3 Section C: Explicitly Out of Scope
Boundaries, not gaps — designed separately or never.

- Brand Reputation & Alerts subsystem
- Social Care subsystem
- Social Selling subsystem
- Tenant offboarding / GDPR right-to-erasure
- Geocoding of profileLocation

#### 5.3.4 Section D: Not Yet Decided
Decisions requiring human go/no-go.

| Decision | Description | Status | Owner |
|----------|-------------|--------|-------|
| ADR-0004 point-in-time author snapshot | Retain followerCount-at-publish on SocialPost | Open | Menno |

#### 5.3.5 Section E: Process/Tooling Debt
Technical debt in development tools and processes.

| Item | Description | Status | Impact |
|------|-------------|--------|--------|
| TypeScript version | Pinned to 6.0.3 (latest is 7.0.2) | ⏳ Open | Low |
| No migration tool | Plain .sql files applied via pg client | ⏳ Accepted | Low |
| Docker required for tests | Ephemeral Postgres container | ⏳ Accepted | Low |

**Status correction (2026-08-03):** The OAuth item below refers only to connector-specific OAuth token exchange. It does not mean SocialEngage authentication is undecided: ADR-0029–0033 define Entra External ID, bearer-token identity, and tenant/user resolution; those decisions are now implementation risks.

### 5.4 Open Questions Management

**Purpose:** Track questions that need answers but aren't blocking immediate work

**Open Questions Sources:**
- ADR "Open questions for decision" sections
- Implementation Log "Known gaps"
- Component SKILL.md "Known gaps / deferred work"
- Business Case open items

**Open Questions Process:**
1. **Capture:** Document the question with context
2. **Categorize:** Technical / Architectural / Business / Operational
3. **Prioritize:** Urgent / Important / Nice-to-know
4. **Assign:** Owner responsible for finding answer
5. **Track:** Regular review until resolved
6. **Resolve:** Document answer, update all affected artifacts

**Current Open Questions:**
- ADR-0020: Should rate threshold vary by deliveryMode (push vs. poll)?
- ADR-0023: Should deliveryMode-based threshold variation be implemented?
- ADR-0004: Should followerCount be retained at publish time on SocialPost?
- `future-subsystems.md`: Is Topic Center a Phase 1 extension or a new subsystem?

### 5.5 Assumption Management

**Purpose:** Track beliefs taken as true without full verification

**Assumptions Register:**

| ID | Assumption | Category | Status | Verification | Risk if Wrong |
|----|------------|----------|--------|--------------|---------------|
| A-01 | Sufficient available time outside ADPA/RPAS commitments — **never numerically quantified** (Charter §6; see `Ideation-Document-v7.2.md`'s R-03 justification for this exact wording), by design: rather than inventing an hours threshold, a proxy trigger is used instead (see Verification column) | Resource | Active | Self-assessment; proxy trigger = a gap exceeding 30 days between consecutive `docs/implementation-log.md` entries | Project stalls |
| A-02 | Azure services will remain available and priced as expected | External | Active | Monthly review | Cost spikes, outages |
| A-03 | Free-tier API access will remain available | External | Active | Quarterly review | Connector failures |
| A-04 | Solo-developer approach is sustainable for MVP | Process | Active | Periodic reassessment | Quality degradation |
| A-05 | Contract-first approach prevents scope creep | Process | Validated | Story 2.5 precedent | Overengineering |

**Assumption Verification:**
- **Quarterly:** Review all active assumptions
- **On Change:** Verify assumption when external conditions change
- **On Doubt:** Explicitly test assumption if uncertainty arises

### 5.6 Dependency Management

**Purpose:** Track external factors outside project control

**Dependency Categories:**
1. **Infrastructure:** Azure services (PostgreSQL, Key Vault, Service Bus)
2. **Data Sources:** Platform APIs (GNews, Newswire, future: Reddit, etc.)
3. **Tools:** Development and CI/CD tools (GitHub, Docker, etc.)
4. **Libraries:** NPM dependencies (TypeScript, Jest, pg, etc.)

**Dependency Tracking:**

| Dependency | Category | Status | Risk | Mitigation | Monitoring |
|------------|----------|--------|------|------------|------------|
| Azure Database for PostgreSQL | Infrastructure | Active | Medium | Local dev alternative | Weekly service health |
| Azure Key Vault | Infrastructure | Active | Medium | Emulator for local dev | Weekly service health |
| Azure Service Bus | Infrastructure | Planned | Low | Deferred until Phase 3 | Not yet |
| GNews API | Data Source | Active | Medium | Free tier, monitor terms | Quarterly terms review |
| Newswire (GlobeNewswire, PR Newswire) | Data Source | Active | Medium | Free RSS, monitor feeds | Quarterly terms review |
| GitHub | Tools | Active | Low | Free public repo | Service status |
| Docker | Tools | Active | Low | Local installation | N/A |
| TypeScript | Libraries | Active | Low | Pinned version, monitor updates | Release notes |
| Jest | Libraries | Active | Low | Pinned version, monitor updates | Release notes |
| pg (node-postgres) | Libraries | Active | Low | Pinned version, monitor updates | Release notes |

---

## 6. Tools & Techniques

### 6.1 Uncertainty Management Tools

| Tool | Purpose | Usage |
|------|---------|-------|
| `open-items-and-deferred-work.md` | Deferred work tracking | Primary register |
| This plan's own Appendix D (canonical, R-01–R-06); Business-Case-v6.0.md §5 (dated snapshot only) | Project-level risk register (canonical IDs) | R-01 to R-06 |
| `implementation-log.md` | Issues encountered and resolved | Per-story issues |
| ADR series | Architecture decisions and open questions | Per-ADR tracking |
| Component SKILL.md files | Component-specific known gaps | Per-component tracking |
| Azure Service Health | Infrastructure dependency monitoring | Weekly check |
| GitHub Status | GitHub dependency monitoring | As needed |

### 6.2 Uncertainty Management Techniques

- **Risk-Based Prioritization:** Focus on highest probability × impact items
- **Explicit Deferral:** Postpone with clear rationale, not silently
- **Transparent Tracking:** Document all uncertainties, not just risks
- **Regular Reviews:** Quarterly risk register reviews
- **Trigger-Based Reviews:** Review when conditions change
- **Acceptance Criteria:** Define what "resolved" means for each uncertainty

---

## 7. Metrics & KPIs

### 7.1 Uncertainty Management KPIs

| KPI | Definition | Target | Measurement | Frequency |
|-----|------------|--------|-------------|-----------|
| **Risk Identification Rate** | # of new risks identified per period | ≥1 | Risk register audit | Quarterly |
| **Risk Resolution Rate** | % of risks resolved vs. total | ≥50% | Risk register review | Quarterly |
| **Issue Resolution Time** | Avg time to resolve issues | ≤1 day | Issue log analysis | Per issue |
| **Deferred Work Visibility** | % of deferred work explicitly tracked | 100% | `open-items-and-deferred-work.md` audit | Quarterly |
| **Assumption Validity** | % of assumptions that remain valid | ≥90% | Assumption verification | Quarterly |

### 7.2 Current Uncertainty Status (last verified 2026-08-03)

| Metric | Current Value | Target | Status | Trend |
|--------|---------------|--------|--------|-------|
| Active Risks | 6 (R-01 to R-06 — this plan's own Appendix D, canonical) | ≤10 | ✅ On Track | → |
| Resolved Risks | 0 | ≥50% | ⚠️ Needs Attention | → |
| Deferred Work Items | 15+ | ≤20 | ✅ On Track | → |
| Open Questions | 4 | ≤5 | ✅ On Track | → |
| Active Assumptions | 5 | ≤10 | ✅ On Track | → |
| Issue Resolution Time | N/A (no recent issues) | ≤1 day | ✅ On Track | → |

---

## 8. Review & Update

### 8.1 Review Triggers
This plan is reviewed when:
- A **new risk** is identified
- A **risk materializes** into an issue
- A **dependency** changes (Azure, API providers)
- **Quarterly** (calendar-based)

### 8.2 Update Process
1. Identify the change needed
2. Update the relevant risk/issue/deferred work entry
3. Re-assess priority and response strategy
4. Update all affected artifacts
5. Add dated note in Version History
6. Commit with descriptive message

### 8.3 Version History

| Version | Date | Author | Changes | Commit |
|---------|------|--------|---------|--------|
| 1.0 | 2026-08-01 | Menno Drescher | Initial version | TBD |
| 1.1 | 2026-08-01 | Menno Drescher | Added R-06 (late-stage integration risk) with mitigation strategy, updated status to Active | TBD |
| 1.2 | 2026-08-03 | Menno Drescher | Reconciled Appendix D's risk IDs against Business-Case-v6.0.md §5/§9 (previously a non-matching independent numbering); annotated A-01 with its "never numerically quantified" status and proxy trigger; re-baselined §7.2 Active Risks to 6 (R-01–R-06) | TBD |
| 1.3 | 2026-08-03 | Menno Drescher | Canonical ownership of the risk register (R-01–R-06) flipped from Business-Case-v6.0.md §5 to this plan's own Appendix D, per Menno's direction that the risk-management process, not the business case, should own it; Business Case §5 now holds a dated snapshot only | TBD |

---

## 9. Appendices

### Appendix A: Risk Template

```markdown
## Risk: [R-XX] — [Short Name]

**Category:** Technical / Architectural / Security / Operational / Business / External

**Description:**
[Clear description of the risk]

**Context:**
[When/where this risk applies]

**Probability:** High / Medium / Low
**Impact:** High / Medium / Low
**Urgency:** Immediate / Short-term (<3 months) / Long-term (>3 months)

**Risk Level:** [Critical / High / Medium / Low]

**Root Cause:**
[What causes this risk to exist]

**Trigger Events:**
- [Event 1 that could cause this risk to materialize]
- [Event 2]

**Early Warning Signs:**
- [Sign 1 that risk may be materializing]
- [Sign 2]

**Response Strategy:**
- [ ] Avoid: [How to eliminate the risk]
- [ ] Mitigate: [How to reduce probability or impact]
- [ ] Transfer: [How to shift risk to another party]
- [X] Accept: [Rationale for accepting the risk]
- [ ] Defer: [When and how this will be revisited]

**Response Actions:**
1. [Action 1]
2. [Action 2]

**Contingency Plan:**
[What to do if risk materializes despite response actions]

**Owner:** [Name]
**Stakeholders:** [List of affected stakeholders]

**Status:** Open / In Progress / Resolved / Closed
**Identified:** [Date]
**Last Review:** [Date]
**Next Review:** [Date]

**Related Artifacts:**
- ADR: [Link]
- Story: [Link]
- Component: [Link]
```

### Appendix B: Issue Template

```markdown
## Issue: [Short Name]

**ID:** [ISS-XX]
**Category:** Contract Failure / Infrastructure / Architecture / Dependency / Process

**Status:** Open / In Progress / Resolved / Closed
**Severity:** Critical / High / Medium / Low
**Identified:** [Date]
**Resolved:** [Date, if applicable]

**Description:**
[Clear description of the issue]

**Root Cause:**
[What caused this issue]

**Impact:**
[How this issue affects the project]

**Steps to Reproduce:**
1. [Step 1]
2. [Step 2]

**Diagnosis:**
[Investigation findings]

**Resolution:**
[What was done to fix the issue]

**Verification:**
[How resolution was verified]

**Lessons Learned:**
- [Lesson 1]
- [Lesson 2]

**Preventive Actions:**
- [Action to prevent recurrence]

**Owner:** [Name]
**Related Artifacts:**
- Story: [Link]
- Contract: [Link]
- ADR: [Link]
```

### Appendix C: Deferred Work Template

```markdown
## Deferred: [Work Item]

**ID:** [DEF-XX]
**Category:** Also Build / Sub-Scope / Out of Scope / Not Yet Decided / Process Debt

**Description:**
[What work is being deferred]

**Rationale:**
[Why this work is not being done now]

**Impact of Deferral:**
[What problems or limitations result from deferring]

**Acceptance Criteria:**
[What would need to be true to accept this work as is]

**Trigger for Revisit:**
[Event or condition that should trigger reconsideration]

**Revisit Date:** [Date or "TBD"]
**Priority:** High / Medium / Low

**Status:** Open / Revisited / Resolved / Obsolete
**Identified:** [Date]
**Last Review:** [Date]

**Related Artifacts:**
- Phase: [Link]
- ADR: [Link]
- Story: [Link]
```

### Appendix D: Risk Register Summary

**Status correction, 2026-08-03 (superseded same day — see the note directly below).** This appendix previously used its own R-01–R-06 numbering that did not match `Business-Case-v6.0.md` §5's table at all (this appendix's old R-01 "scope creep" was actually the Business Case's R-02; this appendix's old R-02 "multi-tenant isolation not proven" had no Business Case counterpart and is folded into R-04's trigger below, since a live two-tenant proof is gated on the same authentication gap; old R-05/R-06 had no Business Case counterpart either). First reconciled by pulling R-01–R-04 directly from the Business Case's table and consolidating R-05/R-06 there too, making the Business Case the single physical location.

**Canonical ownership flip, 2026-08-03 (same day, supersedes the paragraph above).** Per Menno's own direction: a Risk Register belongs to the risk-management process, not the business-case document that justified starting the project. **This appendix (Appendix D) is now this project's sole canonical, actively-maintained risk register (R-01–R-06).** `Business-Case-v6.0.md` §5 keeps a point-in-time snapshot as of 2026-08-03, explicitly marked there as no longer authoritative — update risk status here going forward, not there. Any future new risk is added here first.

**Active Risks (canonical — this is now the single source of truth, IDs R-01–R-06):**

| ID | Risk | Category | Probability | Impact | Status |
|----|------|----------|------------|--------|--------|
| R-01 | Platform API pricing/policy change makes a connector infeasible | External | Medium | High | Open |
| R-02 | Scope creep across the four-subsystem vision outruns solo bandwidth | Scope | Medium | Medium | Open |
| R-03 | Solo-developer bus factor — no redundancy if availability changes | Resource | Low–Medium | High | Open |
| R-04 | No authentication mechanism exists; `X-Tenant-Id` is an unauthenticated placeholder (includes the related fact that a live two-tenant isolation proof cannot happen until this closes) | Security | High (certain, if triggered) | High | Open — ADR-0029–0033 accepted, implementation in progress (Phase 4.5) |
| R-05 | Accepted tenant/admin/user model (ADR-0030–0032) is architecturally decided but not yet implemented | Architecture | Medium | Medium | Open — ADR-0030–0032 accepted |
| **R-06** | **Late-stage integration issues across Azure services, RLS policy interactions, and OAuth as Phase 4.5's identity work lands** | **Technical** | **Medium** | **High** | **Open** |

**Risk Response Summary:**
- **R-01:** Mitigated by favoring free/low-cost platforms first; monthly cost cap still outstanding (Business Case §5)
- **R-02:** Mitigated by phase-gated approach, deferred subsystems; trigger is a second subsystem's charter being drafted before this subsystem's Phase-1 success criteria are re-verified
- **R-03:** Accepted; documentation written for future onboarding; trigger is a >30-day gap between Implementation Log entries
- **R-04:** Architecture is resolved by ADR-0029–0033; implement bearer-token middleware and Entra integration before exposing tenant operations to any external caller, and before claiming a live two-tenant isolation proof
- **R-05:** Architecture is resolved by ADR-0030–0032; implement migrations, identity resolution, role checks, and tenant/user contract tests
- **R-06:** Mitigated by CI/CD and contract testing; keep Entra authentication implementation separate from connector OAuth, which remains deferred until the first OAuth connector

### Appendix E: Dependency Monitoring Checklist

**Weekly Checks:**
- [ ] Azure Service Health dashboard
- [ ] GitHub status page
- [ ] Docker Hub status

**Monthly Checks:**
- [ ] Azure cost reports
- [ ] API provider status pages (GNews, Newswire)
- [ ] NPM package vulnerabilities (if using audit)

**Quarterly Checks:**
- [ ] API provider terms of service review
- [ ] Azure service deprecation notices
- [ ] Technology stack currency (TypeScript, Node.js, etc.)
- [ ] All assumptions verification

---

## 10. References

- [PMBOK 7th Edition](https://www.pmi.org/pmbok-guide-standards/foundational/pmbok)
- [Project Charter](../Project-Charter.md)
- [Business Case](../Business-Case-v6.0.md)
- [Implementation Plan](../../implementation-plan.md)
- [Open Items and Deferred Work](../../open-items-and-deferred-work.md)
- [Planning Management Plan](Planning-Management-Plan.md)
- [Project Work Management Plan](Project-Work-Management-Plan.md)
- [Delivery Management Plan](Delivery-Management-Plan.md)
- [Integration Management Plan](Integration-Management-Plan.md)

---

*This document is maintained as part of the SocialEngage project's Project Management Plans. For questions or updates, contact Menno Drescher.*
