# Stakeholder Review — Common Interests, Criteria, Usage, and Product Goals

**Purpose:** synthesize the 14 Stakeholder-Profile documents (13 product/user personas + the aggregate AI-agent profile) into stakeholder groups that share common interests, acceptance criteria, usage patterns, and product goals. This document is intended to support prioritization, story drafting, and feature bundling.

---

## 1. Stakeholder groups

### 1.1 Operational and governance group

**Personas in this group:**
- Sole Operator (Menno)
- Platform-Admin
- AI Documentation Steward
- AI Security & Architecture Reviewer
- AI Engineering Pragmatism Reviewer
- AI Data Privacy & Sovereignty Reviewer
- AI Legal & Compliance Reviewer
- AI Data Sovereignty & Privacy Regulation Reviewer

**Common interests:**
- Keep the platform running, secure, and cost-bounded.
- Avoid scope creep and over-engineering for a solo, self-funded project.
- Maintain auditability, traceability, and defensible compliance posture.
- Ensure AI actions are bounded and do not bypass human accountability.

**Common acceptance criteria:**
- Every change has a contract, a `SKILL.md` update, and an `implementation-log` entry.
- Every tenant-scoped action is RLS-protected and auditable.
- Cost, quota, and rate-limit status are visible and alertable.
- Compliance-relevant actions are logged in `platform_admin_audit_log`.

**Common usage patterns:**
- Monitor platform health, connector status, and cost.
- Review audit logs, ADRs, and implementation-log entries.
- Validate that tenant boundaries and data-handling rules are enforced.

**Common product goals:**
- **Sustainable operations:** the platform can be run by one person without constant firefighting.
- **Trust and legitimacy:** the system does what it says it does, and decisions are defensible.
- **Cost control:** cloud spend, API quota, and AI usage are predictable and bounded.

**Primary features that serve this group:**
- `09-real-time-alerts.md`
- `10-data-export.md`
- `11-api-and-integrations.md`
- `12-multi-user-workspaces-and-rbac.md`
- `16-compliance-audit-pack.md`
- `17-platform-operations-dashboard.md`

---

### 1.2 Tenant administration and setup group

**Personas in this group:**
- Tenant-Admin
- Tenant-Brand-Reputation-Manager
- AI Business & Requirements Analyst

**Common interests:**
- Configure the tenant quickly, safely, and without engineering support.
- Manage users, connectors, watchlists, and governance boundaries.
- Be ready for reputation risks and crises.

**Common acceptance criteria:**
- Connector activation and watchlist creation are wizard-driven and low-friction.
- Actions are clearly scoped to the current tenant.
- New users can be onboarded and existing users can be audited.
- Reputation-crisis playbooks and alert templates are easy to activate.

**Common usage patterns:**
- Set up the first source, watchlist, and user.
- Invite team members and assign connector permissions.
- Activate crisis monitoring templates and review health dashboards.

**Common product goals:**
- **Self-service onboarding:** the tenant is productive within minutes, not days.
- **Reputation protection:** the team is alerted to threats before they escalate.
- **Governance confidence:** the Tenant-Admin knows who can do what inside the tenant.

**Primary features that serve this group:**
- `01-multi-source-ingestion.md`
- `02-boolean-query-builder.md`
- `09-real-time-alerts.md`
- `12-multi-user-workspaces-and-rbac.md`
- `19-self-service-onboarding-checklist.md`
- `20-crisis-threshold-wizard.md`
- `26-watchlist-volume-preview.md`

---

### 1.3 Tenant insight and action group

**Personas in this group:**
- Tenant-User
- Tenant-Reader
- Tenant-Business-Analyst
- Tenant-Social-Care-Agent
- Social-Selling-Strategist
- Topic-Center-Analyst

**Common interests:**
- Find relevant conversations, authors, and trends quickly.
- Understand what the data means without technical expertise.
- Act on insights (reply, publish, export, escalate, engage).
- Avoid missing important signals or wasting time on noise.

**Common acceptance criteria:**
- Dashboards, summaries, and alert cards are legible and explainable.
- Query, filter, and export capabilities are rich enough for real analysis.
- Inbox items are triaged by urgency and source, with clear reply/escalation paths.
- Author/influencer discovery supports prospecting and outreach.
- AI-generated explanations are accurate, confidence-graded, and optional.

**Common usage patterns:**
- Review dashboards and digests to understand the day’s signals.
- Build watchlists and run ad-hoc queries for specific investigations.
- Triage customer issues from the unified inbox.
- Identify and save prospects or influencers to lists.
- Explore topics and trends for research or reporting.

**Common product goals:**
- **Fast, confident decisions:** users can see what matters and act without asking an analyst.
- **Actionable intelligence:** listening turns into response, outreach, or escalation.
- **Low friction for non-technical users:** explanations, wizards, and one-click actions.

**Primary features that serve this group:**
- `03-ai-sentiment-analysis.md`
- `04-ai-topic-clustering.md`
- `05-influencer-discovery.md`
- `06-unified-social-inbox.md`
- `07-publishing-and-scheduling.md`
- `08-dashboards-and-analytics.md`
- `13-composed-post-author-mention-suggestions.md`
- `18-prospecting-list.md`
- `21-ad-hoc-query-endpoint.md`
- `22-metric-explainability.md`
- `23-case-handoff-to-crm.md`
- `24-daily-digest-email.md`
- `25-topic-evolution-timeline.md
|- `28-semantic-search-rag.md``

---

### 1.4 External rights and trust group

**Personas in this group:**
- Author-of-a-Post
- Data-Subject
- Legal-Advisor
- AI Manager

**Common interests:**
- Ensure public content is used fairly, transparently, and proportionally.
- Give individuals a path to access, correct, or request deletion of their data.
- Reduce legal and ethical exposure for the tenant and the platform.
- Make sure the platform's decisions are defensible and auditable.

**Common acceptance criteria:**
- Public data is not repurposed beyond stated listening/insights use.
- A clear, public DSR/takedown path exists and is tracked.
- Exports and erasure requests are bounded, timely, and auditable.
- Platform and tenant actions can be explained and defended.

**Common usage patterns:**
- Submit a takedown or data-subject request and track its status.
- Review a compliance audit pack for a given period.
- Evaluate whether a feature or decision creates legal/ethical risk.

**Common product goals:**
- **Ethical data handling:** public content is treated as borrowed, not owned.
- **Regulatory readiness:** GDPR, CCPA, and other rights are supported by design.
- **Trust and defensibility:** every decision can be explained and audited.

**Primary features that serve this group:**
- `10-data-export.md`
- `12-multi-user-workspaces-and-rbac.md`
- `14-author-initiated-takedown.md`
- `15-dsr-self-service-portal.md`
- `16-compliance-audit-pack.md`

---

## 2. Cross-group feature heatmap

| Feature | Operational / Governance | Tenant Admin / Setup | Tenant Insight / Action | External Rights / Trust |
|---|---|---|---|---|
| 01 Multi-source ingestion | 🟡 | 🟢 | 🟢 | 🟡 |
| 02 Boolean query builder | 🟡 | 🟢 | 🟢 | 🟡 |
| 03 AI sentiment analysis | 🟡 | 🟡 | 🟢 | 🟡 |
| 04 AI topic clustering | 🟡 | 🟡 | 🟢 | 🟡 |
| 05 Influencer discovery | 🟡 | 🟡 | 🟢 | 🟡 |
| 06 Unified social inbox | 🟡 | 🟡 | 🟢 | 🟢 |
| 07 Publishing and scheduling | 🟡 | 🟡 | 🟢 | 🟡 |
| 08 Dashboards and analytics | 🟡 | 🟢 | 🟢 | 🟡 |
| 09 Real-time alerts | 🟢 | 🟢 | 🟢 | 🟡 |
| 10 Data export | 🟢 | 🟡 | 🟢 | 🟢 |
| 11 API and integrations | 🟢 | 🟡 | 🟢 | 🟡 |
| 12 Multi-user workspaces and RBAC | 🟢 | 🟢 | 🟢 | 🟢 |
| 13 Composed post author mention suggestions | 🟡 | 🟡 | 🟢 | 🟡 |
| 14 Author-initiated takedown | 🟡 | 🟡 | 🟡 | 🟢 |
| 15 DSR self-service portal | 🟢 | 🟡 | 🟡 | 🟢 |
| 16 Compliance audit pack | 🟢 | 🟡 | 🟡 | 🟢 |
| 17 Platform operations dashboard | 🟢 | 🟡 | 🟡 | 🟡 |
| 18 Prospecting list | 🟡 | 🟡 | 🟢 | 🟡 |
| 19 Self-service onboarding checklist | 🟡 | 🟢 | 🟢 | 🟡 |
| 20 Crisis threshold wizard | 🟡 | 🟢 | 🟢 | 🟡 |
| 21 Ad-hoc query endpoint | 🟡 | 🟡 | 🟢 | 🟢 |
| 22 Metric explainability | 🟡 | 🟡 | 🟢 | 🟡 |
| 23 Case handoff to CRM | 🟡 | 🟡 | 🟢 | 🟡 |
| 24 Daily digest email | 🟡 | 🟡 | 🟢 | 🟡 |
| 25 Topic evolution timeline | 🟡 | 🟡 | 🟢 | 🟡 |
| 26 Watchlist volume preview | 🟢 | 🟢 | 🟢 | 🟡 |
|| 28 Semantic search with RAG | 🟡 | 🟡 | 🟢 | 🟡 | 🟢 | 🟢 | 🟢 | 🟡 |

**Legend:** 🟢 Primary beneficiary — 🟡 Secondary / affected by the feature

---

## 3. Common acceptance criteria across groups

| Criterion | Why it matters | Persona groups |
|---|---|---|
| **Tenant-scoped by default** | Prevents cross-tenant data leakage. | All |
| **RLS and role-gated** | Enforces least privilege. | Operational, Tenant Admin, External Rights |
| **Explainable and transparent** | Users trust what they see; regulators can audit. | Tenant Insight, External Rights, AI Agents |
| **Bounded cost and quota** | Prevents runaway spend and API bans. | Operational, Tenant Admin, Tenant Insight |
| **Auditable decisions** | Every action is logged and defensible. | Operational, External Rights |
| **Public data only, proportional use** | Respects authors and platform ToS. | External Rights, Operational |
| **Opt-in, not auto-execute** | AI suggestions and alerts do not act without human approval. | Tenant Insight, AI Agents |

---

## 4. Product goals derived from the synthesis

1. **Build trust before scale.** Every feature must be explainable, auditable, and bounded before it becomes broad or automated.
2. **Make setup invisible.** A Tenant-Admin should be able to configure and operate the tenant without engineering support.
3. **Turn listening into action.** The platform must move from post ingestion to clear triage, response, and engagement workflows.
4. **Protect operational sustainability.** As a solo project, the system must be self-policing on cost, quota, and failure modes.
5. **Respect the public conversation.** Authors and data subjects have rights and expectations that the product cannot ignore.

---

## 5. Recommended feature bundles by group

- **Bundle A — Foundation:** `01`, `02`, `03`, `08`, `09`, `12`, `19`, `26` — serve all groups and should be built first.
- **Bundle B — Action and engagement:** `05`, `06`, `07`, `13`, `18`, `23`, `24` — serve the Tenant Insight / Action group.
- **Bundle C — Compliance and trust:** `10`, `14`, `15`, `16`, `21` — serve the External Rights group and enterprise readiness.
- **Bundle D — Operations and scale:** `11`, `17`, `20`, `22`, `25` — serve the Operational and Tenant Admin groups.
