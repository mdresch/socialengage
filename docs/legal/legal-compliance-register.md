# Legal & Compliance Register

**Maintained by:** the Legal & Compliance Reviewer role (OpenAI `gpt-5.2`, via Azure AI Foundry/Sweden Central — `docs/project docs/Stakeholder-Register.md` S-22), per `docs/ai-roles/legal-compliance-reviewer.md`. External, episodic, human-mediated — Menno runs the invocation (manual paste, or a future `invoke-azure-foundry-agent.mjs --register` once that script exists — not yet built, see the charter's own Status section) and reviews/commits whatever gets appended here, the same as every other AI-role output in this project. This file is never edited by the reviewer's own hand outside that process; Menno may edit it directly at any time (e.g. to mark a finding Resolved).

**Convention:** append-only, same discipline as `docs/implementation-log.md` and `docs/security/security-register.md`. A finding here is never silently deleted or rewritten once logged — a correction or resolution gets a new dated note referencing the original entry, not an edit to it.

---

## Findings Log (append-only, dated entries)

*Empty — no review has been logged here yet. Each entry follows: `## YYYY-MM-DD — <one-line summary> — reviewed <material: diff / file / ADR>`, then the reviewer's numbered findings in the charter's own Output format (exposure/regime affected, current treatment, concrete consequence, what closing it would require), then (added later, separately, by Menno or a follow-up review) a Resolution note when a finding is closed.*
