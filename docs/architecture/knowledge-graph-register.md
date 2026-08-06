# Knowledge-Graph & Semantic Data Modeling Register

**Maintained by:** the Knowledge-Graph & Semantic Data Modeling Reviewer role (Claude Code, internal, Governed — `docs/project docs/Stakeholder-Register.md` S-24), per `.claude/agents/knowledge-graph-semantic-data-modeling-reviewer.md`. Internal, invoked natively via the Agent tool — unlike the external reviewers above, no separate script or manual copy/paste is needed; the agent appends its own finding here as the last step of every invocation, per its own charter's instruction. Menno may edit this file directly at any time (e.g. to mark a finding Resolved); the agent itself only ever appends.

**Convention:** append-only, same discipline as `docs/implementation-log.md` and `docs/security/security-register.md`. A finding here is never silently deleted or rewritten once logged — a correction or resolution gets a new dated note referencing the original entry, not an edit to it.

---

## Findings Log (append-only, dated entries)

## 2026-08-06 — Wikipedia connector authorship: relational storage sufficient, no graph-shaped signal; framing 1's real defect is cardinality collapse, not a graph gap — reviewed pre-ADR design discussion for a prospective Wikipedia connector (docs/open-decisions.md's 2026-08-06 dated entry, docs/implementation-plan.md's Phase 4 note)

**Finding: sufficient.** Neither framing floated (whole-article-as-SocialPost with Author pointing at the article's contributor-history page; RAG-sized chunks as the ingested unit) names or implies a deep/variable-length traversal or a dense many-to-many query pattern — the specific signal this charter requires before graph-shaped storage is even worth naming. A bounded contributors:articles relationship, if it were ever modeled at all, is ordinary relational junction-table territory; nothing proposed here even builds that.

**Real defect found, but it is a relational-modeling anti-pattern, not evidence for graph storage:** framing 1 ("Author = the article's own contributor-history page, a dynamic list, not one fixed organization") does not preserve the property that made ADR-0024/ADR-0026's issuer-as-Author exception valid — a reused, independently-identified entity across many posts. A per-article history-page reference is 1:1 with the SocialPost being ingested, which collapses Author normalization to exactly the "embed author fields per post" alternative ADR-0004's own Alternatives Considered section rejected. Whether this becomes a legitimate third rule-of-three instance depends on an unresolved ingestion-cadence question (does a Wikipedia connector re-ingest an article as it's edited, producing real many-post-to-one-Author reuse at the article level, or is each article ingested once as a static snapshot?) — named as an open design question for the ADR drafter, not resolved here, per this charter's scope boundary against prescribing schema.

**Grounding correction:** this question does not engage the future-subsystems.md "Unresolved" section's named gap (Author cross-platform merge/dedupe; labeled business-relationship-edge extraction — hiring/M&A/partnerships/funding). It's a narrower, connector-specific single-post-attribution question, not either of those two things. The Topic-Center-chartered revisit trigger governing that Unresolved gap is therefore not the applicable gate for this question — flagging this as a correction to the framing the review request grounded itself in, not a silent pass-through.

**Framing 2 (chunk-level RAG ingestion) confirmed, independently, as a separate concern:** it introduces no new entity type or labeled edge — it's a source-agnostic ingestion-granularity/indexing-strategy decision (applies identically to any connector), and does not solve framing 1's attribution-cardinality problem, only moves it to a smaller grain (a paragraph can still have multiple editors; diff-level attribution isn't available as a plain Wikipedia API field per Menno's own note). Should not be bundled into a Wikipedia-specific ADR.

**Re-verified per this charter's standing instruction:** `enrichment.entities` (ADR-0038, Accepted 2026-08-06) remains a flat `{ text, category, confidenceScore }[]` with no relation/edge data — unchanged from future-subsystems.md's snapshot; not touched by anything in this Wikipedia discussion.

No graph-shaped storage recommendation made or implied, consistent with this charter's permanent boundary.

---

*Each entry follows: `## YYYY-MM-DD — <one-line summary> — reviewed <material: ADR / story / design change>`, then the agent's finding in its own charter's Output format (a direct sufficient/insufficient/premature claim with specific evidence), then (added later, separately, by Menno or a follow-up review) a Resolution note when a finding is closed.*
