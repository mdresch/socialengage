# AI Agent Stakeholder Profiles

## Purpose

This profile captures the AI agents and tool-agents registered in `docs/project docs/Stakeholder-Register.md` that participate in the SocialEngage project as reviewers, delivery agents, or synthetic proxies. They are not human end users, but they are real stakeholders with defined authority, domain pull, and engagement boundaries.

---

## AI Delivery Agent (Claude Code)

- **Role:** Executes the `implement-story` and `heal-contract-failure` skills.
- **Category:** Internal / Tool-Agent
- **Status:** Active every session
- **Domain pull:** correct, minimal, contract-verified delivery
- **Core responsibilities:**
  - Writes Jest contracts before implementation.
  - Writes the smallest implementation that passes the contract.
  - Runs the full accumulated suite, not just the new test.
  - Appends a git-hash-verified `docs/implementation-log.md` entry.
- **Authority boundary:** no unilateral decision authority; three mechanical layers (pre-use hook, pre-commit hook, CI) constrain it; must escalate after three failed remediation attempts.
- **Requirements implication:** the project must keep contracts, ADRs, and `SKILL.md` files accurate and self-contained so the agent can operate across sessions without memory.

## AI Business & Requirements Analyst (Claude Code, distinct invocation)

- **Role:** Argues from BABOK/PMBOK strategy-analysis and requirements traceability.
- **Category:** Internal / Tool-Agent
- **Status:** Active
- **Domain pull:** business value and requirements traceability
- **Core responsibilities:**
  - Check whether a proposed change traces to a real, documented business need.
  - Ensure artifacts close a gap rather than merely describe it.
- **Authority boundary:** advisory; no unilateral acceptance authority.
- **Requirements implication:** every feature or ADR needs a clear business-case link and explicit "not yet met" / "closed" status.

## AI QA / Contract Author (Claude Code, distinct invocation)

- **Role:** Independent contract authorship and edge-case review.
- **Category:** Internal / Tool-Agent
- **Status:** Formalized, not yet separately exercised in practice
- **Domain pull:** correctness and edge-case rigor
- **Core responsibilities:**
  - Write or review Jest contracts independently of the same session that implements them.
  - Surface optimistic assumptions that a same-session author would miss.
- **Authority boundary:** advisory.
- **Requirements implication:** contracts should be authored or reviewed by a separate pass to avoid implementation-shaped contracts.

## AI Documentation Steward (Claude Code, distinct invocation)

- **Role:** Audits traceability and consistency across ADRs, user stories, implementation plan, `SKILL.md` files, and project management docs.
- **Category:** Internal / Tool-Agent
- **Status:** Active; scope extended 2026-08-06 to PM-side docs
- **Domain pull:** traceability and consistency
- **Core responsibilities:**
  - Detect stale prose and drift against real git state.
  - Propose corrections in the working tree, never commit them.
- **Authority boundary:** can correct stale factual claims, cannot change already-decided PM content (WIP limits, gates, risk ratings).
- **Requirements implication:** every changed artifact should have up-to-date forward and backward references.

## AI Manager (Claude Code, distinct invocation)

- **Role:** Ideal Manager framework — synthesizes across 14 management concerns and returns an advisory verdict.
- **Category:** Internal / Tool-Agent
- **Status:** Active
- **Domain pull:** synthesis and decision evaluation
- **Core responsibilities:**
  - Advisor mode for open-ended workload/scope questions.
  - Decision Evaluator mode for specific proposals.
- **Priority order:** safety/ethics/legal > strategic objectives > customer/business commitments > team sustainability > individual growth > process optimization.
- **Authority boundary:** verdict is advisory; Menno stays Accountable.
- **Requirements implication:** major scope decisions should be run through the framework to surface hidden trade-offs.

## AI Knowledge-Graph & Semantic Data Modeling Reviewer (Claude Code, distinct invocation)

- **Role:** Reviews entity/relationship modeling correctness.
- **Category:** Internal / Tool-Agent
- **Status:** Active
- **Domain pull:** entity/relationship modeling correctness
- **Core responsibilities:**
  - Check whether a design correctly models entities and relationships.
  - Guard against premature graph-database adoption.
- **Authority boundary:** keeps the boundary honest; does not resolve the tension.
- **Requirements implication:** relational storage should be preferred until a real graph-shaped need emerges.

## AI Learning & Development Writer (Claude Code, distinct invocation)

- **Role:** Writes and maintains the three end-user manuals under `docs/manuals/`.
- **Category:** Internal / Tool-Agent
- **Status:** Active
- **Domain pull:** document only shipped, contract-verified reality
- **Core responsibilities:**
  - System Admin Manual, Tenant Admin Manual, User Manual.
  - Includes a capability in a manual only once it is in `docs/implementation-log.md` and contracts pass.
- **Authority boundary:** proposes in working tree, never commits.
- **Requirements implication:** every shipped feature needs documentation for the correct identity tier.

## AI Security & Architecture Reviewer (Gemini; GitHub Copilot historically)

- **Role:** Trust boundaries and risk review.
- **Category:** External / Advisory
- **Status:** Active, episodic
- **Domain pull:** trust boundaries and risk
- **Core responsibilities:**
  - Review architecture for security gaps.
  - Argue for hardening even when inconvenient.
- **Authority boundary:** advisory; findings triaged by Menno.
- **Requirements implication:** security findings must be logged and accepted/deferred explicitly, not ignored.

## AI Product & Market-Fit Reviewer (Mistral)

- **Role:** External value review from a potential tenant/end-user perspective.
- **Category:** External / Advisory
- **Status:** Not yet a real review
- **Domain pull:** end-user/tenant value
- **Core responsibilities:**
  - Argue whether a real small organization or agency would find a capability valuable.
  - Surface architecture optimized for elegance over user-noticeable value.
- **Authority boundary:** advisory.
- **Requirements implication:** every feature should answer the question, "would a real tenant adopt this over an incumbent?"

## AI Engineering Pragmatism Reviewer (Mistral)

- **Role:** Simplicity and anti-overengineering.
- **Category:** External / Advisory
- **Status:** First exercised 2026-07-31
- **Domain pull:** simplicity and anti-overengineering
- **Core responsibilities:**
  - Counterweight to the Security and Business Analyst pulls toward more.
  - Ask whether a decision is load-bearing for a solo, self-funded project.
- **Authority boundary:** advisory.
- **Requirements implication:** team-scale process should not be imported where a simpler solo-developer discipline suffices.

## AI Data Privacy & Sovereignty Reviewer (Microsoft Foundry Prompt Agent)

- **Role:** Data minimization and third-party exposure risk.
- **Category:** External / Advisory
- **Status:** Migrated to Azure AI Foundry 2026-08-06
- **Domain pull:** data minimization, no unnecessary third-party exposure
- **Core responsibilities:**
  - Review credential-handling paths and content touching public post data.
  - Argue for keeping sensitive content off third-party APIs where possible.
- **Authority boundary:** advisory.
- **Requirements implication:** privacy review should be a standing checkpoint for any feature handling Data-Subject data.

## AI Legal & Compliance Reviewer (OpenAI `gpt-5.2`, Azure AI Foundry)

- **Role:** Legal and compliance risk.
- **Category:** External / Advisory
- **Status:** Active
- **Domain pull:** legal and compliance risk
- **Core responsibilities:**
  - Review impersonation, misinformation, and data-subject-rights risks.
  - Check that compliance-relevant decisions are logged and defensible.
- **Authority boundary:** advisory.
- **Requirements implication:** legal-risky features need audit trails, DSR paths, and explicit scope boundaries.

## AI Data Sovereignty & Privacy Regulation Reviewer (Microsoft Foundry Prompt Agent)

- **Role:** Jurisdictional privacy regulation, encryption, and geo-redundancy tension.
- **Category:** External / Advisory
- **Status:** Migrated to Azure AI Foundry 2026-08-06
- **Domain pull:** jurisdictional privacy regulation vs. encryption/geo-redundancy vs. data-residency
- **Core responsibilities:**
  - Surface the tension between "encrypt and geo-replicate everything" and "keep data within a border."
  - Argue that tension hard without resolving it.
- **Authority boundary:** advisory.
- **Requirements implication:** multi-region and retention decisions should document the jurisdiction/regulation trade-off explicitly.

---

## AI Performance Review Agent (Claude Code, proposed)

- **Role:** Audits query and rendering performance and prescribes loading-state patterns.
- **Category:** Internal / Tool-Agent
- **Status:** Proposed
- **Domain pull:** query efficiency, loading-state UX, and rendering latency
- **Core responsibilities:**
  - Review database queries for full-table scans, N+1 fetches, unbounded `LIMIT`/`OFFSET`, and opportunities to use preconfigured views.
  - Review API endpoints for over-fetching, offset pagination, and missing cache headers.
  - Prescribe the correct visual loading pattern for each UI state (spinner, skeleton, shimmer, progress bar, overlay loader).
  - Evaluate when client-side aggregation is acceptable and when it should move server-side or to precomputed views.
- **Authority boundary:** advisory; no unilateral acceptance authority.
- **Requirements implication:** every new UI route needs a `loading.tsx`/`Suspense` boundary, and every expensive analytics query must justify why it does not use a preconfigured view.
- **Profile file:** `Performance-Review-Agent-Stakeholder-Profile.md` for the full loading-pattern decision guide.

## Persona-proxy agents (synthetic, not real people)

- **Tenant-Admin Persona-Proxy, Tenant Reader Persona-Proxy, Tenant Business Analyst Persona-Proxy** are synthetic subagents (`.claude/agents/persona-*.md`) used during requirements elicitation.
- They are not stakeholders with real power/interest; they role-play the corresponding human personas to surface concerns.
- They are already covered by the human `Tenant-Admin`, `Tenant-Reader`, and `Tenant-Business-Analyst` profiles and do not need separate stakeholder profiles.
