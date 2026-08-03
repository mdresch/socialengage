# Cost Management Plan
## Spark Capture Project — Supplementary Plan: Cost

**Project:** Social Listening & Engagement Platform (Spark Capture)  
**Phase:** Phase 1 — Social Listening / Insights Subsystem  
**Owner:** Menno Drescher  
**Date:** 2026-08-01  
**Status:** Active — CI/CD costs tracked  
**Version:** 1.1

---

## 1. Purpose

This plan defines **how cloud costs, API expenses, and budget constraints are tracked and controlled** for the Spark Capture project. It establishes processes for monitoring, forecasting, and optimizing costs across all project dependencies.

As a solo-developer, self-funded project (per Charter §5 and Business-Case-v6.0.md), cost management focuses on **transparency, minimization, and sustainability** rather than formal budgeting and approval workflows. The goal is to ensure Menno can continue funding the project without unexpected cost spikes.

---

## 2. Scope

### 2.1 What This Plan Covers
- Cost identification and categorization
- Cost monitoring and tracking
- Cost forecasting and projection
- Cost optimization strategies
- Budget constraint management
- Cost reporting and analysis

### 2.2 What This Plan Does NOT Cover
- Detailed financial planning (out of scope for self-funded project)
- Procurement processes (handled ad-hoc per Business Case §5)
- Resource planning (see Planning-Management-Plan.md)
- Risk management for cost overruns (see Uncertainty-Management-Plan.md)
- Vendor contract negotiation

---

## 3. Approach

### 3.1 Core Philosophy
**"Spend as little as possible while maintaining architectural integrity."**

Given this is a self-funded project, cost management principles:
1. **Favor Free Tiers:** Use free tiers of services where possible
2. **Minimal Sizing:** Size resources to actual needs, not anticipated future needs
3. **Pay-as-you-go:** Prefer consumption-based pricing over reserved capacity
4. **Monitor Proactively:** Track costs to avoid surprises
5. **Optimize Continuously:** Regularly review for cost-saving opportunities

### 3.2 Solo-Developer Adaptations

| Traditional Cost Management Concept | Solo-Developer Adaptation |
|-------------------------------------|---------------------------|
| Formal budget approvals | Self-approval with explicit documentation |
| Cost center accounting | Personal funding tracking |
| Vendor negotiations | Accept standard terms (no volume discounts) |
| Cost allocation | No allocation needed (single cost center) |
| ROI analysis | Value assessment against Business Case |

### 3.3 Cost Management Model

```
Cost Identification
    ↓
Cost Tracking (per service, per period)
    ↓
Cost Analysis (trends, spikes, anomalies)
    ↓
Cost Optimization (right-sizing, alternatives)
    ↓
Cost Forecasting (future spend projection)
    ↓
Spend Decision (continue, adjust, or stop)
```

---

## 4. Roles & Responsibilities

### 4.1 Human Roles

| Role | Responsibilities | Current Assignment |
|------|------------------|-------------------|
| **Cost Owner** | Overall cost management approach, budget decisions | Menno Drescher |
| **Cost Tracker** | Monitors and records costs | Menno Drescher |
| **Cost Analyst** | Analyzes cost trends and optimization opportunities | Menno + AI Manager |
| **Cost Optimizer** | Implements cost-saving measures | Menno Drescher |

### 4.2 AI Agent Roles

| Role | Responsibilities | Engagement |
|------|------------------|------------|
| **AI Manager** | Advises on cost implications of architectural decisions | Episodic |
| **AI Engineering Pragmatism Reviewer** | Identifies cost-ineffective overengineering | Episodic |

---

## 5. Processes & Procedures

### 5.1 Cost Identification

#### 5.1.1 Cost Categories

| Category | Definition | Examples |
|----------|------------|----------|
| **Cloud Infrastructure** | Azure services for hosting and data | PostgreSQL, Key Vault, Service Bus, App Service |
| **API Services** | External data source APIs | GNews API, Newswire feeds |
| **AI Services** | AI/ML services for enrichment | Azure AI Language (future) |
| **Development Tools** | Tools used for development | GitHub, Docker, npm packages |
| **AI Agent Services** | AI assistant API costs | Claude, Gemini, Mistral, Ollama |
| **Local Infrastructure** | Local development resources | Docker containers, local compute |

#### 5.1.2 Cost Item Register

**Current Cost Items (2026-08-01):**

| ID | Item | Category | Cost Model | Current Cost | Status |
|----|------|----------|------------|--------------|--------|
| C-01 | Azure Database for PostgreSQL Flexible Server | Cloud Infrastructure | Pay-as-you-go | ~$15/month | Active |
| C-02 | Azure Key Vault Standard | Cloud Infrastructure | Pay-as-you-go | ~$0.03/10k requests | Active |
| C-03 | Azure Blob Storage | Cloud Infrastructure | Pay-as-you-go | ~$0.01/GB/month | Active (minimal usage) |
| C-04 | GNews API | API Services | Free tier (100 requests/day, 10 articles/request) | $0 | Active |
| C-05 | GlobeNewswire RSS | API Services | Free (public RSS feeds) | $0 | Active |
| C-06 | PR Newswire RSS | API Services | Free (public RSS feeds) | $0 | Active |
| C-07 | GitHub (public repo) | Development Tools | Free | $0 | Active |
| **C-16** | **GitHub Actions (CI/CD)** | **Development Tools** | **Free for public repos** | **$0** | **Active** |
| C-08 | Docker Desktop | Development Tools | Free | $0 | Active |
| C-09 | npm packages | Development Tools | Free | $0 | Active |
| C-10 | Claude Code | AI Agent Services | Anthropic subscription | Included | Active |
| C-11 | Gemini | AI Agent Services | Google API | Pay-per-request | Episodic |
| C-12 | Mistral | AI Agent Services | Mistral API | Pay-per-request | Episodic |
| C-13 | Ollama (self-hosted) | AI Agent Services | Local | $0 | Active |
| C-14 | Azure AI Language (future) | AI Services | Pay-as-you-go | TBD | Planned — **2026-08-03 note: this row's assumption (a single project-operated subscription, billed to and tracked as a SocialEngage cost item) is superseded by ADR-0028 (Accepted 2026-08-03), which resolves `AIProviderConnector` credentials as tenant-owned, with cost incurred and settled directly between each tenant and Microsoft/Azure — not a SocialEngage-tracked cost item at all once that model is built. This row is not removed or re-derived here (a separate exercise for whoever next revises this document); flagged so it isn't mistaken for still-current guidance. See ADR-0028's Amendment Log (2026-08-03 resolution entry) and `Business-Case-v6.0.md` §4's own matching flag.** |
| C-15 | Azure Service Bus (future) | Cloud Infrastructure | Pay-as-you-go | TBD | Planned |

### 5.2 Cost Tracking

#### 5.2.1 Tracking Methods

| Cost Category | Tracking Method | Frequency | Tool |
|---------------|-----------------|-----------|------|
| Azure Cloud | Azure Cost Management + Billing | Monthly | Azure Portal |
| API Services | Provider billing pages + usage monitoring | Monthly | Vendor portals |
| AI Agent Services | API usage tracking | Per session | Provider portals |
| Development Tools | Subscription management | Quarterly | Vendor portals |

#### 5.2.2 Azure Cost Tracking

**Process:**
1. **Daily:** Check Azure Cost Management dashboard for anomalies
2. **Weekly:** Review cost by service and resource group
3. **Monthly:** Export detailed cost breakdown
4. **Quarterly:** Analyze trends and forecast

**Azure Cost Breakdown (Estimated 2026-08):**
| Service | Resource | Usage | Estimated Cost |
|---------|---------|-------|---------------|
| PostgreSQL | socialengage-db | 4 vCore, 32GB RAM | ~$15/month |
| Key Vault | socialengage-kv | <10k requests/month | ~$0.03/month |
| Blob Storage | socialengage-storage | <1GB | ~$0.01/month |
| **Total** | | | **~$15.04/month** |

**Azure Cost Alerts:**
| Alert | Threshold | Action |
|-------|-----------|--------|
| Daily Spend | >$10/day | Immediate investigation |
| Monthly Spend | >$50/month | Cost review and optimization |
| Budget | >$100/month | Architecture review for cost savings |

#### 5.2.3 API Provider Cost Tracking

**GNews API:**
- **Plan:** Free tier (Essential)
- **Limits:** 100 requests/day, 10 articles/request
- **Cost:** $0
- **Constraints:** Non-commercial use only (see ADR-0026)
- **Monitoring:** Track request count in connector logs

**Newswire (GlobeNewswire, PR Newswire):**
- **Plan:** Free public RSS feeds
- **Limits:** No stated limits (fair use)
- **Cost:** $0
- **Monitoring:** Track feed polling frequency

**Future API Providers:**
- **Reddit:** Free tier available, OAuth required
- **X (Twitter):** Paid API (v2) - cost TBD
- **YouTube:** Free API with quotas
- **LinkedIn:** Paid API - cost TBD
- **Meta:** Paid API - cost TBD

#### 5.2.4 AI Agent Cost Tracking

**Cost Model:** Mostly subscription-based (Claude) with some pay-per-request (Gemini, Mistral)

| Agent | Model | Cost Model | Estimated Monthly Cost |
|-------|-------|------------|------------------------|
| Claude Code | claude-3-5-sonnet-20250620 | Anthropic Pro subscription | Included |
| Gemini | gemini-1.5-pro | Google AI pay-per-request | <$10 (episodic) |
| Mistral | mistral-large | Mistral AI pay-per-request | <$10 (episodic) |
| Ollama | qwen2.5:0.5b | Self-hosted | $0 |

**AI Cost Tracking:**
- Track number of API calls per session
- Monitor subscription usage
- Log AI agent invocations in Implementation Log (future enhancement)

#### 5.2.5 Session Time Tracking — added 2026-08-03, rolled into `docs/implementation-log.md` the same day

**Why this exists:** every cost line above (Azure, API providers, AI subscriptions) is a direct dollar cost, but this plan has never tracked Menno's own working time — for a self-funded solo project, time is a real cost too (opportunity cost, at minimum), even with no invoice attached to it. Added per Menno's own direct recommendation: *"time can be expressed as monies for cost management review."*

**Session duration lives in `docs/implementation-log.md`, not duplicated here.** Per Menno's own follow-up direction ("roll this up with the implementation-log"), each session's approximate duration is recorded once, in that log's own per-session entry (its "Session duration (approximate)" field, alongside the commit hash and files touched it already verifies against git) — this section only explains the *policy*, not the numbers themselves, per the same single-source-of-truth-per-field discipline ADR-0029 §3 established this session. See `docs/implementation-log.md`'s 2026-08-03 "Governance" entry for this session's own row.

**Two open items, named rather than silently assumed:**
- **No hourly rate is decided anywhere in this document.** Converting a session's duration into a dollar "notional cost" is left uncomputed on purpose — inventing a rate (a market contractor rate? a personal opportunity-cost figure?) without Menno deciding one first would be a fabricated number, not a real cost figure. **Open item:** Menno to decide what rate, if any, future session-duration entries should be converted at.
- **Duration is currently only a proxy (the gap between git commits), not a measured value** — reasonable for a session that produces one commit at its end, but would misstate duration for a session spanning multiple days or mixed with unrelated work between commits. **Open item:** decide whether a lighter manual log (a start/end note per session) is worth adding, or whether the commit-timestamp-gap proxy is good enough at this project's current scale.

### 5.3 Cost Analysis

#### 5.3.1 Cost Trend Analysis

**Monthly Cost Trend (2026):**
| Month | Azure | API Services | AI Agents | Total | Notes |
|-------|-------|--------------|-----------|-------|-------|
| July | ~$45 | $0 | <$20 | ~$65 | Initial setup, Story 2.6 |
| August | ~$15 | $0 | <$20 | ~$35 | Optimized PostgreSQL |
| September | ~$15 | $0 | <$20 | ~$35 | Forecast |

**Observations:**
- Azure costs dropped significantly after right-sizing PostgreSQL
- API services remain at $0 due to free tier usage
- AI agent costs are minimal due to episodic usage

#### 5.3.2 Cost Spike Investigation

**Process:**
1. **Detect:** Identify cost spike (via alerts or manual review)
2. **Isolate:** Determine which service/resource caused the spike
3. **Analyze:** Review usage patterns during spike period
4. **Diagnose:** Identify root cause (bug, misconfiguration, usage change)
5. **Resolve:** Fix root cause or adjust usage
6. **Prevent:** Implement safeguards to prevent recurrence

**Example: July Azure Cost Spike**
- **Detection:** Azure spend exceeded $10/day on 2026-07-25
- **Isolation:** PostgreSQL Flexible Server was the primary cost driver
- **Analysis:** Initial provisioning was oversized (8 vCore instead of 4)
- **Diagnosis:** Over-provisioned for development needs
- **Resolution:** Downsized to 4 vCore on 2026-07-28
- **Prevention:** Added cost alerts at $10/day threshold

### 5.4 Cost Optimization

#### 5.4.1 Optimization Strategies

| Strategy | Description | Application |
|----------|-------------|-------------|
| **Right-Sizing** | Size resources to actual usage | PostgreSQL downsized from 8 to 4 vCore |
| **Free Tier Utilization** | Use free tiers where available | GNews free tier, Newswire free RSS |
| **Pay-as-you-go** | Avoid reserved capacity | All Azure services |
| **Local Development** | Use local alternatives for development | PostgreSQL in Docker for local dev |
| **Caching** | Reduce repeated external calls | RequestGate queue, future derived data cache |
| **Batching** | Combine multiple operations | Bulk inserts, batch API calls |
| **Archival** | Remove old data | ADR-0018 retention policies |
| **Efficient Algorithms** | Optimize code for resource usage | Minimal processing, early filtering |

#### 5.4.2 Optimization Opportunities

| Opportunity | Current State | Potential Savings | Effort | Priority |
|-------------|---------------|------------------|--------|----------|
| Archive old rawPayloads | ADR-0018: 90-day retention | Storage costs | Low | Medium |
| Implement derived data caching | ADR-0022: pg_cron enabled | Compute costs | Medium | Medium |
| Optimize GNews polling frequency | Currently per-tenant configurable | API call costs | Low | Low |
| Use Azure Spot Instances | Not currently used | Compute costs | Medium | Low (Phase 5) |
| Implement connection pooling | Not currently implemented | Database connection costs | Medium | Low |

#### 5.4.3 Optimization Review Process

**Trigger:** Quarterly or when cost trends are concerning

**Process:**
1. **Review Usage:** Analyze usage patterns for all paid services
2. **Identify Opportunities:** Look for optimization candidates
3. **Estimate Savings:** Calculate potential cost reductions
4. **Prioritize:** Order by savings potential vs. implementation effort
5. **Implement:** Execute high-priority optimizations
6. **Verify:** Confirm savings are realized
7. **Document:** Record optimization in this plan

### 5.5 Cost Forecasting

#### 5.5.1 Forecasting Methodology

**Approach:** Bottom-up forecasting based on:
1. Current usage patterns
2. Planned feature additions
3. Expected growth in data volume
4. New service adoptions

**Forecast Horizon:**
- **Short-term (1 month):** Based on current usage
- **Medium-term (3 months):** Includes planned Phase 1-2 work
- **Long-term (6-12 months):** Includes all Phase 1-5 work

#### 5.5.2 Current Forecast (2026-08-01)

**Short-Term (August 2026):**
| Category | Estimated Cost | Notes |
|----------|---------------|-------|
| Azure Cloud | ~$15 | PostgreSQL, Key Vault, Blob Storage |
| API Services | $0 | GNews, Newswire free tiers |
| AI Agents | <$20 | Episodic usage |
| **Total** | **~$35** | |

**Medium-Term (August-October 2026):**
| Category | Estimated Cost | Notes |
|----------|---------------|-------|
| Azure Cloud | ~$45 | Add Service Bus for Phase 3 |
| API Services | $0 | Continue free tiers |
| AI Agents | <$60 | More frequent usage |
| **Total** | **~$105** | For 3 months |

**Long-Term (August 2026-July 2027):**
| Category | Estimated Cost | Notes |
|----------|---------------|-------|
| Azure Cloud | ~$200 | Full Phase 1-5 infrastructure |
| API Services | <$100 | Reddit, YouTube free tiers |
| AI Agents | <$240 | Regular usage |
| Azure AI Language | ~$100 | Enrichment pipeline — **2026-08-03: superseded by ADR-0028 (Accepted 2026-08-03); this line assumed a project-operated subscription, but the resolved model is tenant-owned/tenant-billed (see C-14's note above), so this figure should not be carried into the project's own 12-month total once re-derived** |
| **Total** | **~$640** | For 12 months — **this total includes the now-superseded ~$100 Azure AI Language line above; not yet recalculated, flagged 2026-08-03** |

**Forecast Assumptions:**
1. No paid-tier API providers (continue free tier usage)
2. Azure costs remain at current rates
3. AI agent usage remains episodic
4. No production deployment (Phase 5 deferred)

#### 5.5.3 Forecast Accuracy

**Tracking:**
- Compare forecasted vs. actual costs monthly
- Calculate forecast accuracy: (1 - |Actual - Forecast| / Actual) × 100%
- Investigate significant variances (>20%)

**Current Forecast Accuracy (July 2026):**
- **Azure:** Forecast $45, Actual ~$45 → 100%
- **API Services:** Forecast $0, Actual $0 → 100%
- **AI Agents:** Forecast <$20, Actual <$20 → 100%
- **Overall:** 100%

### 5.6 Budget Management

#### 5.6.1 Budget Constraints

**Explicit Constraints:**
- Self-funded: All costs borne by Menno personally
- No formal budget ceiling (Charter §5 explicitly declines budget ceiling)
- Cost optimization principle: Minimize spend while maintaining architecture integrity

**Implicit Constraints:**
- **Sustainability:** Monthly costs should remain affordable for long-term development
- **Predictability:** Avoid cost spikes that could disrupt development
- **Value:** Every cost should provide proportional value to the project

#### 5.6.2 Spend Decision Framework

**Decision Matrix:**

| Cost | Value to Project | Affordability | Decision |
|------|------------------|---------------|----------|
| High | High | High | **Approve** |
| High | High | Low | **Defer or Find Alternative** |
| High | Low | High | **Reject or Find Alternative** |
| High | Low | Low | **Reject** |
| Low | High | High | **Approve** |
| Low | High | Low | **Approve (monitor)** |
| Low | Low | High | **Defer** |
| Low | Low | Low | **Reject** |

**Decision Process:**
1. **Assess Value:** How does this cost enable Business Case objectives?
2. **Assess Affordability:** Can this be sustained over time?
3. **Identify Alternatives:** Are there lower-cost options?
4. **Consult AI Manager:** Get advisory synthesis on cost vs. benefit
5. **Decide:** Menno makes final decision
6. **Document:** Record decision rationale in this plan

**Recent Spend Decisions:**
| Date | Cost Item | Decision | Rationale |
|------|-----------|----------|-----------|
| 2026-07-25 | Azure PostgreSQL (8 vCore) | Reject | Over-provisioned for dev needs |
| 2026-07-28 | Azure PostgreSQL (4 vCore) | Approve | Right-sized for current usage |
| 2026-07-30 | GNews API (free tier) | Approve | Non-commercial use permitted |
| 2026-07-31 | Mistral API (pay-per-request) | Approve | Episodic usage, low cost |

---

## 6. Tools & Techniques

### 6.1 Cost Management Tools

| Tool | Purpose | Usage |
|------|---------|-------|
| Azure Cost Management + Billing | Azure cost tracking and alerts | Primary cost monitoring |
| Azure Pricing Calculator | Cost estimation for new services | Planning |
| Azure Advisor | Cost optimization recommendations | Monthly review |
| GNews API Dashboard | GNews usage monitoring | Quarterly |
| GitHub Billing | GitHub cost tracking | Quarterly |
| Personal Spreadsheet | Cost aggregation and forecasting | Monthly |

### 6.2 Cost Management Techniques

- **Cost Allocation Tagging:** Use Azure tags to categorize costs
- **Budget Alerts:** Set up alerts at multiple thresholds
- **Usage Metrics:** Track request counts, storage usage, compute hours
- **Cost-Benefit Analysis:** Evaluate value vs. cost for each expense
- **Right-Sizing:** Continuously match resource size to actual usage
- **Reserved Capacity Analysis:** Evaluate when reserved instances make sense (future, if usage stabilizes)

---

## 7. Metrics & KPIs

### 7.1 Cost Management KPIs

| KPI | Definition | Target | Measurement | Frequency |
|-----|------------|--------|-------------|-----------|
| **Cost Visibility** | % of costs tracked and categorized | 100% | Cost register audit | Monthly |
| **Cost Prediction Accuracy** | Accuracy of cost forecasts | ≥90% | Forecast vs. actual comparison | Monthly |
| **Cost Optimization Rate** | % of optimization opportunities implemented | ≥80% | Optimization backlog review | Quarterly |
| **Cost per Story** | Average cost to deliver one story | ≤$10 | Cost / story count | Per phase |
| **Cost per Phase** | Total cost to deliver one phase | ≤$100 | Cost / phase count | Per phase |

### 7.2 Current Cost Status (2026-08-01)

| Metric | Current Value | Target | Status | Trend |
|--------|---------------|--------|--------|-------|
| Cost Visibility | 100% | 100% | ✅ On Track | → |
| Cost Prediction Accuracy | 100% (July) | ≥90% | ✅ On Track | → |
| Cost Optimization Rate | 100% (all identified optimizations implemented) | ≥80% | ✅ On Track | → |
| Cost per Story | ~$2.50 (26 stories / ~$65) | ≤$10 | ✅ On Track | → |
| Cost per Phase | ~$65 (Phase 0-1) | ≤$100 | ✅ On Track | → |
| Monthly Spend | ~$35 | ≤$50 | ✅ On Track | → |

---

## 8. Review & Update

### 8.1 Review Triggers
This plan is reviewed when:
- A **new cost item** is added
- A **cost spike** is detected
- A **forecast** is significantly off
- **Monthly** (cost tracking)
- **Quarterly** (cost analysis and optimization)

### 8.2 Update Process
1. Identify the change needed
2. Update cost register and forecasts
3. Update cost trend analysis
4. Document any spend decisions
5. Add dated note in Version History
6. Commit with descriptive message

### 8.3 Version History

| Version | Date | Author | Changes | Commit |
|---------|------|--------|---------|--------|
| 1.0 | 2026-08-01 | Menno Drescher | Initial version | TBD |
| 1.1 | 2026-08-01 | Menno Drescher | Added C-16 (GitHub Actions CI/CD) to cost register as $0 for public repo | TBD |

---

## 9. Appendices

### Appendix A: Cost Item Template

```markdown
## Cost Item: [ID] — [Name]

**Category:** Cloud Infrastructure / API Services / AI Services / Development Tools / AI Agent Services / Local Infrastructure

**Description:**
[What this cost is for]

**Provider:** [Vendor name]
**Service/Product:** [Service name]
**Plan/Tier:** [Plan name]

**Cost Model:**
- [ ] Free
- [ ] Pay-as-you-go
- [ ] Subscription (Monthly/Annual)
- [ ] Reserved Capacity
- [ ] Other: [Describe]

**Pricing Details:**
| Metric | Unit | Unit Price | Notes |
|--------|------|------------|-------|
| [Metric] | [Unit] | [Price] | [Notes] |

**Current Usage:**
| Period | Usage | Cost |
|--------|-------|------|
| [Month] | [Usage] | [Cost] |

**Forecast:**
| Period | Expected Usage | Expected Cost |
|--------|----------------|--------------|
| [Month] | [Usage] | [Cost] |

**Status:** Active / Planned / Deprecated / Retired
**Start Date:** [Date]
**End Date:** [Date, if applicable]

**Payment Method:** [Credit card / Subscription / etc.]
**Billing Cycle:** [Monthly / Annual / etc.]

**Optimization Opportunities:**
- [ ] [Opportunity 1] — [Potential Savings] — [Effort] — [Priority]

**Related Artifacts:**
- ADR: [Link]
- Story: [Link]
- Component: [Link]
```

### Appendix B: Cost Optimization Opportunity Template

```markdown
## Optimization: [ID] — [Name]

**Description:**
[What optimization opportunity this represents]

**Affected Cost Items:**
- [ ] [Cost Item 1]
- [ ] [Cost Item 2]

**Current State:**
[How things are currently configured/used]

**Proposed Change:**
[What change would implement the optimization]

**Potential Savings:**
| Category | Current Cost | Projected Cost | Savings | Timeframe |
|----------|--------------|---------------|---------|-----------|
| [Category] | [Cost] | [Cost] | [Savings] | [Timeframe] |

**Implementation Effort:**
- **Effort Category:** Low / Medium / High
- **Estimated Hours:** [Number]
- **Complexity:** Low / Medium / High
- **Risk:** Low / Medium / High

**Priority:** High / Medium / Low
**Status:** Identified / In Progress / Implemented / Rejected
**Identified:** [Date]
**Implemented:** [Date, if applicable]

**Dependencies:**
- [ ] [Dependency 1]
- [ ] [Dependency 2]

**Decision Rationale:**
[Why this optimization was/wasn't implemented]

**Related Artifacts:**
- Cost Item: [Link]
- ADR: [Link]
- Story: [Link]
```

### Appendix C: Monthly Cost Report Template

```markdown
# Monthly Cost Report — [Month] [Year]

**Reporting Period:** [Start Date] to [End Date]
**Report Date:** [Date]
**Prepared By:** Menno Drescher

## Executive Summary

- **Total Spend:** $[Amount]
- **Vs. Forecast:** $[Variance] ([Variance %]%)
- **Vs. Previous Month:** $[Change] ([Change %]%)
- **Cost per Story:** $[Amount] ([Number] stories)

## Cost by Category

| Category | Budget | Actual | Variance | % of Total |
|----------|--------|--------|----------|------------|
| Cloud Infrastructure | [Amount] | [Amount] | [Amount] | [%] |
| API Services | [Amount] | [Amount] | [Amount] | [%] |
| AI Services | [Amount] | [Amount] | [Amount] | [%] |
| Development Tools | [Amount] | [Amount] | [Amount] | [%] |
| AI Agent Services | [Amount] | [Amount] | [Amount] | [%] |
| **Total** | **[Amount]** | **[Amount]** | **[Amount]** | **100%** |

## Cost by Service

| Service | Provider | Category | Actual Cost | % of Category | Notes |
|---------|----------|----------|-------------|----------------|-------|
| PostgreSQL | Azure | Cloud Infrastructure | [Amount] | [%] | [Notes] |
| Key Vault | Azure | Cloud Infrastructure | [Amount] | [%] | [Notes] |
| GNews API | GNews | API Services | [Amount] | [%] | [Notes] |
| [etc.] | [etc.] | [etc.] | [Amount] | [%] | [Notes] |

## Cost Trends

[Graph or table showing cost trends over time]

### Month-over-Month Comparison
| Metric | [Previous Month] | [Current Month] | Change | % Change |
|--------|------------------|-----------------|--------|----------|
| Total Spend | [Amount] | [Amount] | [Amount] | [%] |
| Cloud Infrastructure | [Amount] | [Amount] | [Amount] | [%] |
| API Services | [Amount] | [Amount] | [Amount] | [%] |

### Forecast vs. Actual
| Category | Forecast | Actual | Variance | % Variance |
|----------|---------|--------|----------|------------|
| Cloud Infrastructure | [Amount] | [Amount] | [Amount] | [%] |
| API Services | [Amount] | [Amount] | [Amount] | [%] |

## Cost Anomalies

| Date | Service | Expected | Actual | Variance | Root Cause | Resolution |
|------|---------|----------|--------|----------|------------|------------|
| [Date] | [Service] | [Amount] | [Amount] | [Amount] | [Cause] | [Resolution] |

## Optimization Activities

### Implemented
- [ ] [Optimization 1] — Savings: [Amount] — Effort: [Hours]

### Planned
- [ ] [Optimization 2] — Expected Savings: [Amount] — Priority: [Level]

## Next Month Forecast

| Category | Forecast | Notes |
|----------|----------|-------|
| Cloud Infrastructure | [Amount] | [Notes] |
| API Services | [Amount] | [Notes] |
| AI Agent Services | [Amount] | [Notes] |
| **Total** | **[Amount]** | |

## Recommendations

1. [Recommendation 1]
2. [Recommendation 2]

**Approval:**
- **Reviewed By:** Menno Drescher
- **Review Date:** [Date]
```

### Appendix D: Cost Alert Configuration

**Azure Cost Alerts:**

```bash
# Azure CLI commands to set up cost alerts

# Create a budget (example: $50/month)
az budget create \
  --budget-name "SparkCapture-Monthly" \
  --amount 50 \
  --time-grain Monthly \
  --start-date 2026-08-01 \
  --end-date 2026-12-31 \
  --contact-emails menno.drescher@gmail.com \
  --scope "subscriptions/[subscription-id]"

# Create an alert for 80% of budget
az consumption budget alert create \
  --budget-name "SparkCapture-Monthly" \
  --alert-name "80PercentAlert" \
  --alert-type Actual \
  --threshold 80 \
  --threshold-type Percent \
  --contact-emails menno.drescher@gmail.com

# Create an alert for $10/day daily spend
az consumption budget alert create \
  --budget-name "SparkCapture-Monthly" \
  --alert-name "Daily10DollarAlert" \
  --alert-type Actual \
  --threshold 10 \
  --threshold-type Absolute \
  --time-grain Daily \
  --contact-emails menno.drescher@gmail.com
```

### Appendix E: Cost Optimization Checklist

**Monthly:**
- [ ] Review Azure Cost Management dashboard
- [ ] Check for unused or underutilized resources
- [ ] Review API usage against limits
- [ ] Update cost forecast

**Quarterly:**
- [ ] Conduct full cost review
- [ ] Identify optimization opportunities
- [ ] Implement high-priority optimizations
- [ ] Review cost vs. value for all expenses
- [ ] Update cost register

**When Adding New Services:**
- [ ] Estimate cost before provisioning
- [ ] Set up cost alerts
- [ ] Tag resources for cost allocation
- [ ] Document in cost register
- [ ] Update forecast

---

## 10. References

- [PMBOK 7th Edition](https://www.pmi.org/pmbok-guide-standards/foundational/pmbok)
- [Project Charter](../Project-Charter.md)
- [Business Case](../Business-Case-v6.0.md)
- [Implementation Plan](../../implementation-plan.md)
- [Uncertainty Management Plan](Uncertainty-Management-Plan.md)
- [Planning Management Plan](Planning-Management-Plan.md)
- [Azure Cost Management Documentation](https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/)
- [Azure Pricing Calculator](https://azure.microsoft.com/en-us/pricing/calculator/)

---

*This document is maintained as part of the Spark Capture project's Project Management Plans. For questions or updates, contact Menno Drescher.*
