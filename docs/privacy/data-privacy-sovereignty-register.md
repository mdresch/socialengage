# Data Privacy & Sovereignty Register

**Maintained by:** the Data Privacy & Sovereignty Reviewer role (Microsoft Foundry Prompt Agent, `data-privacy-sovereignty-reviewer` — `docs/project docs/Stakeholder-Register.md` S-16), per `docs/ai-roles/data-privacy-sovereignty-reviewer.md`. External (to this repo's own tooling), episodic, human-mediated — Menno runs the invocation (`docs/ai-roles/scripts/invoke-azure-foundry-agent.mjs --role data-privacy --register`) and reviews/commits whatever gets appended here. This file is never edited by the reviewer's own hand outside that process; Menno may edit it directly at any time (e.g. to mark a finding Resolved).

**Convention:** append-only, same discipline as `docs/implementation-log.md` and `docs/security/security-register.md`. A finding here is never silently deleted or rewritten once logged — a correction or resolution gets a new dated note referencing the original entry, not an edit to it.

**A note specific to this register:** this role's own domain pull is data minimization — does a field or flow actually need to be retained/transmitted for the platform's stated listening/insights purpose, or is it kept by default. Findings here name the specific field/flow, the concern, and the minimization change (plus, where applicable, an architecture mitigation) that would close it — per the charter's own current Output Format. Distinct from `data-sovereignty-register.md` (S-23's own register): that role argues jurisdictional residency/encryption/redundancy tensions; this one argues minimization and unnecessary third-party exposure. The two roles share adjacent territory on purpose (ADR-0004-style, not yet formally reconciled) — don't assume a finding in one register also covers the other.

---

## Findings Log (append-only, dated entries)

*Empty — no review has been logged here yet. Each entry follows: `## YYYY-MM-DD — <one-line summary> — reviewed <material: diff / file / ADR>`, then the reviewer's numbered findings in the charter's own Output Format (field/flow, concern, minimization change, and — if applicable — architecture/design mitigation), then (added later, separately, by Menno or a follow-up review) a Resolution note when a finding is closed.*
