# Stakeholder Management Plan
## SocialEngage Project — PMBOK Domain: Stakeholders

**Project:** Social Listening & Engagement Platform (SocialEngage)  
**Phase:** Phase 1 — Social Listening / Insights Subsystem  
**Owner:** Menno Drescher  
**Date:** 2026-08-01  
**Status:** Draft  
**Version:** 1.1

---

## 1. Purpose

This plan defines **how stakeholders are identified, analyzed, engaged, and managed** throughout the SocialEngage project lifecycle. Stakeholders are individuals, groups, or organizations that can **affect, be affected by, or perceive themselves to be affected by** a decision, activity, or outcome of the project.

Given this is a **solo-developer, self-funded** project, stakeholder management focuses on:
- **Identification** of current and future stakeholders
- **Analysis** of their interests, influence, and impact
- **Engagement** strategies appropriate for each stakeholder type
- **Communication** methods that respect the solo-developer context

---

## 2. Scope

### In Scope
- Identification of all project stakeholders (internal and external)
- Stakeholder analysis (power/interest matrix, influence/impact)
- Engagement strategies and communication plans for each stakeholder
- Escalation paths and decision rights
- Feedback mechanisms and stakeholder satisfaction monitoring
- Maintenance of the Stakeholder Register

### Out of Scope
- Detailed user personas (product management artifact, not stakeholder management)
- Marketing and go-to-market stakeholder engagement (future Phase 2+ concern)
- Contractual negotiations with vendors (handled per Procurement Management Plan)
- Legal/compliance stakeholder engagement (handled per project governance)

---

## 3. Approach

### Guiding Principles

1. **Documentation-First Engagement**: All stakeholder interactions are documented in the [Stakeholder Register](../Stakeholder-Register.md) or these plans. This ensures continuity given the solo-developer context.

2. **Proactive over Reactive**: Stakeholders are identified and engaged **before** their input is needed, not as an afterthought.

3. **Right-Sized Engagement**: Engagement frequency and depth are proportional to the stakeholder's actual influence and interest, not a one-size-fits-all approach.

4. **Asynchronous by Default**: Given the solo-developer nature, engagement is primarily asynchronous (documentation, emails, GitHub discussions) with synchronous sessions reserved for high-impact decisions.

5. **Transparency**: All architectural decisions (ADRs), user stories, and implementation logs are publicly visible within the repository, ensuring stakeholders can self-serve information.

### Stakeholder Management Methodology

This project uses a **hybrid** approach combining:
- **PMBOK 7th Edition**: Stakeholder engagement as a performance domain
- **Power/Interest Grid**: For categorizing stakeholders and determining engagement strategies
- **RACI Matrix**: For clarifying roles in decision-making
- **Agile Stakeholder Mapping**: For visualizing stakeholder relationships

---

## 4. Roles & Responsibilities

| Role | Responsibility | Current Assignment | Notes |
|------|---------------|-------------------|-------|
| **Project Sponsor** | Provides funding, sets high-level direction, approves major scope changes | Menno Drescher | Solo-developer self-funded; approval is self-approval with explicit sign-off |
| **Project Manager** | Day-to-day management, stakeholder engagement, risk management | Menno Drescher | Same person as sponsor in this context |
| **Technical Lead** | Architectural decisions, technical direction, code quality | Menno Drescher | Solo developer |
| **Business Analyst** | Requirements analysis, market validation, business case refinement | AI Business & Requirements Analyst (Claude Code, distinct invocation — Stakeholder-Register.md S-11) | Internal / Tool-Agent, advisory only — no unilateral acceptance authority (Status correction, 2026-08-03: previously misattributed to "OpenAI"; OpenAI was only ever considered for the unrelated Product & Market-Fit Reviewer role and reassigned to Mistral before ever being exercised) |
| **Security Architect** | Security review, risk assessment, hardening recommendations | AI Security & Architecture Reviewer (Gemini — S-10) | External, episodic, advisory only |
| **Engineering Pragmatism Reviewer** | Anti-overengineering review, simplicity advocacy | AI Engineering Pragmatism Reviewer (Mistral — S-15) | External, episodic, advisory only |
| **Future End Users/Tenants** | Provide feedback, validate requirements, adoption | Not yet identified | Engagement deferred until Phase 1 validation (Milestone M7) |
| **Future Contributors** | Code contributions, reviews, testing | Not yet identified | Engagement deferred until project is open-sourced |
| **Azure Platform** | Cloud services provider | Microsoft Azure | Vendor relationship, managed via subscriptions |
| **Platform APIs** (GNews, Newswire, Reddit, etc.) | Data source providers | Various | Vendor relationships, managed via API terms and credentials |

---

## 5. Processes & Procedures

### 5.1 Stakeholder Identification

**Trigger:** Project initiation, phase transition, new feature consideration, or when a new dependency is introduced

**Procedure:**
1. Review existing [Stakeholder Register](../Stakeholder-Register.md)
2. Identify new stakeholders using the **Stakeholder Identification Checklist** (Appendix A)
3. For each new stakeholder, document:
   - Name/Organization
   - Role/Title
   - Contact Information (if applicable)
   - Category (Internal/External)
   - Interest in Project (High/Medium/Low)
   - Influence on Project (High/Medium/Low)
   - Engagement Level (Governed/Managed/Monitored/Keep Informed)
   - Communication Preferences
   - Key Concerns/Expectations
4. Update the Stakeholder Register
5. Assign initial engagement strategy based on Power/Interest matrix

**Frequency:** 
- **Full review:** At each phase transition (M1, M4, M7)
- **Incremental review:** When new dependencies or capabilities are added

### 5.2 Stakeholder Analysis

**Method:** Power/Interest Grid + Influence/Impact Assessment

For each stakeholder, assess:

| Dimension | Definition | Assessment Method |
|-----------|------------|-------------------|
| **Power** | Ability to impose will or block decisions | Can they approve/reject scope? Can they fund/defund? |
| **Interest** | Level of concern or benefit from project | Direct user? Financial interest? Reputation impact? |
| **Influence** | Ability to shape opinions or decisions | Do others follow their lead? Are they subject matter experts? |
| **Impact** | Degree to which project affects them | Will project outcomes materially change their work? |

**Engagement Strategy Matrix:**

| Power/Interest | High Power, High Interest | High Power, Low Interest | Low Power, High Interest | Low Power, Low Interest |
|----------------|---------------------------|--------------------------|---------------------------|--------------------------|
| **Strategy** | **Governed** | **Keep Satisfied** | **Keep Informed** | **Monitor** |
| **Actions** | Close engagement, regular updates, involvement in decisions | Keep happy, minimal effort, consult on their concerns | Regular updates, listen to concerns, ensure they feel heard | Minimal effort, no proactive engagement |
| **Example** | Menno (Sponsor/Manager) | Azure Platform | Future End Users | General public |

**Current Stakeholder Mapping:**

| Stakeholder | Power | Interest | Engagement Strategy | Rationale |
|-------------|-------|----------|---------------------|-----------|
| Menno Drescher | High | High | **Governed** | Project sponsor, manager, and sole developer |
| AI Business & Requirements Analyst (Claude Code, distinct invocation — S-11) | High within its scope, no unilateral acceptance authority | N/A — no independent stake | **Governed** | Internal tool-agent, not external — corrected 2026-08-03 from "OpenAI"/Keep Informed to match Stakeholder-Register.md's S-11 entry (Internal / Tool-Agent, Governed) |
| AI Security & Architecture Reviewer (Gemini — S-10) | Low | N/A | **Keep Informed** | External reviewer, episodic, advisory only |
| AI Engineering Pragmatism Reviewer (Mistral — S-15) | Low | N/A | **Keep Informed** | External reviewer, episodic, advisory only, never an implementer |
| Future End Users/Tenants | Low | High | **Keep Informed** | Engagement deferred until M7 |
| Azure Platform | High | Medium | **Keep Satisfied** | Cloud services dependency |
| GNews API | Medium | Medium | **Keep Satisfied** | Data source, API dependency |
| Newswire Providers | Medium | Medium | **Keep Satisfied** | Data source, API dependency |

### 5.3 Stakeholder Engagement

**Engagement Levels and Actions:**

#### Level 1: Governed (High Power, High Interest)
- **Stakeholders:** Menno Drescher
- **Engagement Actions:**
  - Weekly progress review (self-assessment)
  - Decision-making authority for all architectural and implementation decisions
  - Sign-off required for all ADR acceptances
  - Sign-off required for all story completions
  - Responsible for all documentation updates
- **Communication Frequency:** Continuous (daily work)
- **Communication Method:** Direct (self)

#### Level 2: Keep Satisfied (High Power, Low Interest)
- **Stakeholders:** Azure Platform, Platform API Providers (GNews, Newswire)
- **Engagement Actions:**
  - Monitor service status and API changes
  - Ensure compliance with terms of service
  - Proactive notification of upcoming changes (if announced)
  - Cost monitoring and optimization
- **Communication Frequency:** Monthly
- **Communication Method:** Asynchronous (email, service dashboards, API changelog monitoring)

#### Level 3: Keep Informed (Low Power, High Interest)
- **Stakeholders:** External AI Reviewers (Gemini — Security; Mistral — Engineering Pragmatism and Product/Market-Fit; ~~Ollama — Data Privacy~~ Data Privacy & Sovereignty, migrating from Ollama to a Microsoft Foundry Prompt Agent as of 2026-08-06 — see `Stakeholder-Register.md` S-16), Future End Users/Tenants. (Status correction, 2026-08-03: "OpenAI" removed — it was only ever considered for the Product & Market-Fit Reviewer role and reassigned to Mistral before ever being exercised, per Stakeholder-Register.md S-14. The internal AI Business & Requirements Analyst, S-11, is **Governed**, not Keep Informed — see §5.2's Current Stakeholder Mapping above.) **Documentation Steward note, 2026-08-06: this list is also missing the Legal & Compliance, Data Sovereignty & Privacy Regulation, and Knowledge-Graph & Semantic Data Modeling reviewers (S-22–S-24, added 2026-08-05) and the Learning & Development Writer (S-25, added 2026-08-06) — flagged here rather than added unilaterally, since which engagement tier each belongs in is a classification call, the same boundary this role holds for every other PM-plan content decision; `Stakeholder-Register.md` Section 2 is the current, accurate source for all of them.**
- **Engagement Actions:**
  - Provide access to all project documentation
  - Share major milestones and decisions (Phase completions, architecture changes)
  - Solicit feedback on specific areas of expertise
  - Document all findings and responses
- **Communication Frequency:** Per review round (episodic) or per milestone
- **Communication Method:** Asynchronous (documentation, GitHub, email)

#### Level 4: Monitor (Low Power, Low Interest)
- **Stakeholders:** General public, potential future contributors
- **Engagement Actions:**
  - Maintain public-facing documentation (if/when open-sourced)
  - Monitor for inquiries or contributions
  - Respond to direct questions
- **Communication Frequency:** Reactive only
- **Communication Method:** Asynchronous (GitHub issues, email)

### 5.4 Communication Planning

**Communication Matrix:**

| Audience | Purpose | Method | Frequency | Owner |
|----------|---------|--------|-----------|-------|
| Menno (Self) | Progress tracking, decision documentation | Implementation Log, ADR Amendment Logs | Continuous | Menno |
| AI Reviewers | Architectural review, findings | Reusable charters in `docs/ai-roles/` | Per review round | Menno |
| Future End Users | Feature validation, feedback | To be determined | Deferred until M7 | Menno |
| Azure Platform | Service status, cost alerts | Azure Portal, Cost Management | Monthly | Menno |
| API Providers | Terms compliance, API changes | Vendor documentation, email | Per API change | Menno |

**Communication Methods:**

| Method | Purpose | Tools/Platforms |
|--------|---------|----------------|
| **Documentation** | Primary knowledge sharing | Markdown files in repo, ADRs, SKILL.mds |
| **GitHub** | Code collaboration, issue tracking | GitHub repository, Issues, Discussions |
| **Email** | Formal communications, external stakeholders | menno.drescher@gmail.com |
| **Azure Portal** | Cloud service monitoring | Azure Cost Management, Service Health |
| **AI Agent Sessions** | Real-time collaboration | Claude Code — the only chartered AI Delivery Agent (Stakeholder-Register.md S-09); "Mistral Vibe" removed 2026-08-03, no such entity exists in the Stakeholder Register — Mistral (S-14/S-15) is external, episodic, advisory-only, never a delivery agent |

### 5.5 Stakeholder Feedback Management

**Feedback Collection:**
- **AI Reviewers:** Formal review rounds with documented charters; findings logged in relevant ADRs or methodology documents
- **Future End Users:** Feedback collected via structured interviews or surveys (deferred until M7)
- **API Providers:** Feedback via vendor support channels or community forums

**Feedback Processing:**
1. **Capture:** Document feedback in the appropriate artifact (ADR Amendment Log, Implementation Log, or dedicated feedback document)
2. **Assess:** Evaluate impact, feasibility, and alignment with project objectives
3. **Prioritize:** Determine if immediate action, deferred work, or rejection
4. **Act:** Implement changes or document decision to defer/reject
5. **Close:** Notify stakeholder of resolution

**Feedback Response Timeframes:**
- **Critical Issues:** Within 24 hours (e.g., security vulnerabilities, API deprecations)
- **Architectural Feedback:** Within 1 week (AI reviewer findings)
- **General Feedback:** Within 2 weeks (feature requests, suggestions)
- **Low Priority:** Deferred or documented for future consideration

### 5.6 Escalation Paths

Given the solo-developer context, escalation is primarily about **decision documentation** and **external validation**:

| Issue Type | Escalation Path | Trigger |
|------------|----------------|---------|
| **Architectural Decision** | ADR process + AI reviewer consultation | New architecturally significant decision needed |
| **Security Concern** | AI Security Reviewer (Gemini) + direct assessment | Security vulnerability or risk identified |
| **Overengineering Risk** | AI Engineering Pragmatism Reviewer (Mistral) | Complexity that may not be load-bearing |
| **Scope Creep** | Self-assessment against Project Charter | New feature request outside Phase 1 scope |
| **Cost Overrun Risk** | Azure Cost Management review | Monthly cloud spend approaching ceiling |
| **Platform API Issue** | Vendor support + community research | API changes, outages, or pricing concerns |

---

## 6. Tools & Techniques

### Primary Tools

| Tool | Purpose | Location/Access |
|------|---------|-----------------|
| **GitHub** | Version control, issue tracking, documentation | [github.com/mdresch/socialengage](https://github.com/mdresch/socialengage) |
| **Stakeholder Register Template** | Stakeholder tracking | `docs/project docs/Stakeholder-Register.md` |
| **Power/Interest Grid** | Stakeholder categorization | Appendix A of this document |
| **RACI Matrix** | Role clarification | Appendix B of this document |
| **Azure Cost Management** | Cloud cost monitoring | Azure Portal |
| **Azure Service Health** | Service status monitoring | Azure Portal |

### Techniques

1. **Stakeholder Mapping Workshops**: Conducted internally (self-workshop) at phase transitions
2. **Engagement Level Reviews**: Quarterly assessment of stakeholder engagement effectiveness
3. **Communication Audits**: Review of communication effectiveness at each milestone
4. **Feedback Retrospectives**: Analysis of stakeholder feedback patterns to improve engagement

---

## 7. Metrics & KPIs

### Stakeholder Management KPIs

| KPI | Definition | Target | Measurement Method | Frequency |
|-----|------------|--------|---------------------|-----------|
| **Stakeholder Satisfaction** | Percentage of stakeholders reporting satisfaction with engagement | ≥80% | Survey/feedback | Per milestone |
| **Stakeholder Identification Completeness** | Percentage of relevant stakeholders identified and documented | 100% | Stakeholder Register review | Quarterly |
| **Feedback Response Time** | Average time to respond to stakeholder feedback | ≤7 days | Feedback log analysis | Monthly |
| **Engagement Effectiveness** | Percentage of stakeholder engagements that result in actionable outcomes | ≥70% | Engagement log review | Quarterly |
| **Stakeholder Influence Coverage** | Percentage of high-influence stakeholders engaged according to strategy | 100% | Stakeholder Register review | Quarterly |

### Current Metrics (2026-08-01)

| KPI | Current Value | Target | Status |
|-----|---------------|--------|--------|
| Stakeholder Identification Completeness | 100% | 100% | ✅ On Track |
| Stakeholder Satisfaction | N/A (not yet measured) | ≥80% | ⚠️ Not Measured |
| Feedback Response Time | N/A (no external feedback yet) | ≤7 days | ⚠️ Not Applicable |
| Engagement Effectiveness | N/A (no engagements yet) | ≥70% | ⚠️ Not Measured |
| Stakeholder Influence Coverage | 100% | 100% | ✅ On Track |

---

## 8. Review & Update

### Review Schedule

| Review Type | Frequency | Trigger | Owner |
|-------------|-----------|---------|-------|
| **Full Stakeholder Review** | Quarterly | Calendar-based | Menno |
| **Incremental Review** | As needed | New stakeholder identified, major scope change | Menno |
| **Engagement Effectiveness Review** | Per milestone | M1, M4, M7 | Menno |
| **Stakeholder Register Update** | Continuous | New stakeholder or changed information | Menno |

### Update Process

1. **Identify Change:** New stakeholder, changed engagement strategy, or updated information
2. **Assess Impact:** Determine if change affects other plans or project execution
3. **Document Change:** Update relevant sections of this plan and/or the Stakeholder Register
4. **Communicate Change:** Notify affected stakeholders (if applicable)
5. **Version Control:** Commit changes to repository with descriptive commit message

### Version History

| Version | Date | Author | Changes | Commit |
|---------|------|--------|---------|--------|
| 1.0 | 2026-08-01 | Menno Drescher | Initial version | TBD |
| 1.1 | 2026-08-03 | Menno Drescher | Status correction: AI Business & Requirements Analyst corrected from "OpenAI"/External/Keep Informed to Claude Code (S-11)/Internal/Governed; removed "Mistral Vibe" from §5.4's AI Agent Sessions row; corrected §5.3 Level 3's stakeholder list — all to match `Stakeholder-Register.md` | TBD |

## 9. Appendices

### Appendix A: Stakeholder Identification Checklist

Use this checklist when identifying new stakeholders:

- [ ] **Project Team Members** (even if solo, document the role)
- [ ] **Sponsors/Funders** (internal or external)
- [ ] **End Users** (current and future)
- [ ] **Technical Stakeholders** (architects, developers, operations)
- [ ] **Business Stakeholders** (product managers, business analysts, executives)
- [ ] **External Dependencies** (vendors, API providers, cloud services)
- [ ] **Regulatory/Compliance** (security, legal, privacy officers)
- [ ] **Support/Operations** (who will maintain this in production?)
- [ ] **Reviewers/Auditors** (internal and external)
- [ ] **Potential Contributors** (open source community, future team members)

### Appendix B: RACI Matrix

| Role/Stakeholder | Project Direction | Architecture | Implementation | Testing | Documentation | Deployment |
|-------------------|-----------------|-------------|----------------|---------|---------------|------------|
| Menno Drescher | A/R | A/R | R | R | R | R |
| AI Business Analyst | C | C | - | - | C | - |
| AI Security Reviewer | C | C | - | - | C | - |
| AI Engineering Pragmatism Reviewer | C | C | - | - | C | - |
| Future End Users | C | - | - | I | I | I |
| Azure Platform | - | - | - | - | - | C |

**Legend:**
- **A** = Accountable (ultimately answerable)
- **R** = Responsible (does the work)
- **C** = Consulted (two-way communication)
- **I** = Informed (one-way communication)
- **-** = Not involved

### Appendix C: Stakeholder Engagement Calendar

| Date | Event | Stakeholders | Status |
|------|-------|--------------|--------|
| 2026-07-28 | Project Charter Drafted | Menno | ✅ Complete |
| 2026-07-29 | ADR Series Accepted (0001-0023) | Menno + AI Reviewers | ✅ Complete |
| 2026-07-30 | ADR-0024, ADR-0025 Accepted | Menno + AI Reviewers | ✅ Complete |
| 2026-07-31 | ADR-0026 Accepted | Menno + AI Reviewers | ✅ Complete |
| 2026-08-01 | Story 1.5 Implemented | Menno | ✅ Complete |
| 2026-08-03 | ADR-0028–0035 Accepted: credential ownership, Entra identity, roles, tenant/user model, connector authorization, and one role-gated Next.js admin app | Menno + AI Reviewers | ✅ Complete |
| 2026-08-XX | Milestone M7 (Phase 1 Review) | Menno + Future End Users (TBD) | 📅 Planned |

---

## 10. References

- [PMBOK 7th Edition](https://www.pmi.org/pmbok-guide-standards/foundational/pmbok)
- [Stakeholder Register](../Stakeholder-Register.md)
- [Project Charter](../Project-Charter.md)
- [Implementation Plan](../../implementation-plan.md)
- [Implementation Methodology](../../implementation-methodology.md)

---

*This document is maintained as part of the SocialEngage project's Project Management Plans. For questions or updates, contact Menno Drescher.*
