# Manager Register

**Maintained by:** the Ideal Manager role (Claude Code, internal, Governed — `docs/project docs/Stakeholder-Register.md` S-20), per `.claude/agents/ideal-manager.md`. Fed by `docs/management/pending-manager-reviews.md`, which `scripts/git-hooks/post-commit` appends to automatically on every commit — non-blocking, no API call, just a queue marker. This role has no standalone invocation script (unlike the external reviewers): it runs only when a Claude Code session is actively working in this repo and checks the pending-review queue, per its own charter's instruction. Menno may edit this file directly at any time (e.g. to mark a finding Resolved); the agent itself only ever appends.

**Convention:** append-only, same discipline as `docs/implementation-log.md` and every other register in this project (`docs/security/`, `docs/legal/`, `docs/privacy/`, `docs/architecture/`). A finding here is never silently deleted or rewritten once logged — a correction or resolution gets a new dated note referencing the original entry, not an edit to it.

**What this register is for, distinct from the other four:** the other registers (Security, Legal, Data Sovereignty, Knowledge-Graph) each pull hard on one domain and argue for closing gaps in it. The Manager doesn't argue one lens — per its own charter, it synthesizes across all fourteen sections of the Ideal Manager framework (capacity, scope, decision rights, outcome stewardship, etc.) and returns an advisory verdict. Entries here are commit-level reviews: is the pace, scope, and sequencing of what's landing in this repo sustainable, not whether any single change is correct — that's every other reviewer's job, not this one's.

---

## Findings Log (append-only, dated entries)

*Empty — no review has been logged here yet. Each entry follows: `## YYYY-MM-DD — reviewed <commit hash(es)> — <one-line summary>`, then the Manager's finding (Advisor-mode read or Decision-Evaluator-mode verdict, per its own charter's output format), then a cross-reference to the corresponding entry in `docs/management/pending-manager-reviews.md` that it resolves.*
