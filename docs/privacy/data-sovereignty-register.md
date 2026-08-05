# Data Sovereignty & Privacy Regulation Register

**Maintained by:** the Data Sovereignty & Privacy Regulation Reviewer role (Ollama, local, `qwen3.5:9b` — `docs/project docs/Stakeholder-Register.md` S-23), per `docs/ai-roles/data-sovereignty-privacy-regulation-reviewer.md`. External (to this repo's own tooling), episodic, human-mediated — Menno runs the invocation (manual paste, or a future generalized `invoke-ollama-agent.cjs --role sovereignty --register` once that generalization exists — not yet built, see the charter's own Status section) and reviews/commits whatever gets appended here. This file is never edited by the reviewer's own hand outside that process; Menno may edit it directly at any time (e.g. to mark a finding Resolved).

**Convention:** append-only, same discipline as `docs/implementation-log.md` and `docs/security/security-register.md`. A finding here is never silently deleted or rewritten once logged — a correction or resolution gets a new dated note referencing the original entry, not an edit to it.

**A note specific to this register, not needed by the others:** this reviewer's own charter explicitly forbids it from recommending a specific Azure region or resolving the encryption/geo-redundancy/residency tension itself — that stays a business decision informed by where Menno's actual or target tenants are. Findings logged here name the gap and the concrete scenario it matters in; they do not prescribe the resolution.

---

## Findings Log (append-only, dated entries)

*Empty — no review has been logged here yet. Each entry follows: `## YYYY-MM-DD — <one-line summary> — reviewed <material: diff / file / ADR>`, then the reviewer's numbered findings in the charter's own Output format (architectural element, residency/encryption/redundancy assumption or gap, concrete jurisdiction/data-subject scenario), then (added later, separately, by Menno or a follow-up review) a Resolution note when a finding is closed.*
