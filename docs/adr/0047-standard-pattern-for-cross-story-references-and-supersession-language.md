# ADR-0047: Standard pattern for cross-story references and supersession language

**Status:** Accepted (2026-08-11)
**Source:** Backlog item (per `docs/open-decisions.md` / the project backlog's 2026-08-08 entry on Epic 2 cross-story dependency clarity — Stories 2.3, 2.4, 2.5; ADR-0009, ADR-0010, ADR-0020, ADR-0023), focused on standardizing the wording pattern used for superseded ACs and cross-story conflict notes after the 2026-07-30 supersession of Story 2.3/4.3's flat-failure threshold by Story 2.5's rate-relative rule.
**Acceptance note:** Accepted by Menno 2026-08-11, verbatim: *"ADR-0047 is approved."* Accepted as drafted — no revisions at acceptance. This is a no-story ADR (meta-decision about authoring practice, same category as ADR-0027/ADR-0041/ADR-0037-adjacent precedent) — accepting it requires no contract, no implementation, and no user story; it takes effect immediately as the working pattern for future cross-story/cross-ADR references. Its own Open Questions section names a lint/consistency script (flagging unowned TBDs, incomplete cross-dependency notes, and non-conforming obsolete markers) as **explicitly deferred, not decided by this ADR** — noted at acceptance as not yet due for revisiting, per its own stated "likely useful once the series exceeds ~50 ADRs" threshold, which this series has now reached; left deferred rather than decided differently.

## Context

The current corpus uses terms such as "supersession," "superseded AC," and "known cross-story conflict" across several stories and ADR notes. This is correct in intent, but the wording style is not always uniform, and different documents sometimes apply different levels of precision about what changed, when it changed, and which contract is currently live.

This creates avoidable interpretation risk for implementation and review, especially in areas with real historical transitions (for example, the Story 2.3 flat threshold language later superseded by Story 2.5's rate-relative rule, and the interaction between ADR-0010, ADR-0023, and queue/gate behavior around ADR-0020).

The project already has strong historical-record conventions in [`docs/adr/README.md`'s `## Conventions for changing an existing ADR` table](README.md) — seven explicit categories covering Decision changes, parameter tweaks, implicit-requirement clarifications, and forward/back supersession pointers. This ADR does **not** replace that table. It codifies the working pattern for *how* a story or ADR author should write the resulting entry in any of those seven categories, so the table's intent is applied uniformly in concrete prose rather than re-derived per-document.

## Relation to `docs/adr/README.md`'s governance table

The seven-row table in `docs/adr/README.md`'s `## Conventions for changing an existing ADR` is the authority for **which** of the seven supersession-related situations applies to a given change (Decision change vs. parameter tweak vs. implicit-requirement clarification vs. forward/back supersession pointer vs. Note on relation, etc.). **This ADR does not extend, narrow, or override that table.** Where any tension ever appears between this ADR's prose and the README's table, the README wins, and this ADR is amended via its own Amendment Log to match.

Concretely: a contributor who needs to write a supersession note should first identify which of the README's seven rows applies, then write the entry using this ADR's pattern below. If the change doesn't fit any of the seven rows, that's a real signal — it may mean a new row belongs in the README's table (governance change), not in this ADR's prose.

## Decision

### 1. Superseded acceptance criteria — mark in place, but only when a real Decision changed

For an AC whose underlying **Decision** has been superseded (README row 1 — e.g. Story 2.3's AC4 when ADR-0023 replaced the flat "≥10 failures/hour" rule with a rate-relative one):

- The original AC text remains as written (historical record preserved).
- It must carry an explicit obsolete marker — a parenthetical of the form `(originally ...; superseded YYYY-MM-DD by <Story X.Y / ADR-NNNN>'s <specific rule> — see <pointer>)`.
- Where the new rule is still applicable to the same scenario, the AC is rewritten with the new numbers/text immediately after the marker (as Story 2.3's AC4 was); where the AC is no longer applicable at all, it is struck through but kept in place.

For an AC whose underlying **adjustable parameter** changed without the Decision itself changing (README row 3 — e.g. ADR-0017's deprecation window shortening from 6 months to 90 days), **no in-place obsolete marker is required.** An Amendment Log entry in the parent ADR is sufficient. Adding "obsolete" markers to parameter-tweak changes would clutter the historical record without information value.

For an **implicit-requirement clarification** (README row 4 — e.g. ADR-0013's dated Clarification section), the parent ADR gets a new dated Clarification section; AC text in dependent stories is untouched unless the clarification actually rewrites the AC's intent.

The worked example for the in-place-marker case is Story 2.3 AC4: `"(originally the flat ≥10/hour placeholder; superseded 2026-07-30 by Story 2.5's rate-relative rule — see that story below)"`. That exact wording pattern is what §1 mandates; deviations from it (e.g. "this no longer applies, see ADR-0023") are insufficient.

### 2. Name exact references and dates — with the README's row 6 rule built in

Any cross-dependency note (Pending supersession note, Supersession update, Note on relation to ADR-XXXX, or in-place AC obsolete marker per §1) must include:

- **Exact AC identifier or quoted AC text fragment** — never a vague "the relevant AC"; either an AC number (`AC4`) or a literal quote of the fragment being referenced.
- **Superseding ADR/story identifier by number** — e.g. "ADR-0023 (Accepted)" or "Story 2.5"; never a bare narrative reference.
- **Decision date (acceptance date)** — `YYYY-MM-DD`; not a relative "later."
- **Implementation-status note when acceptance and implementation happened at different times** — per `docs/adr/README.md`'s row 6, verbatim: *"and don't assume already-shipped code changes automatically; it only changes when the superseding ADR's own story is actually built."* A note that only says "ADR-0023 was accepted on 2026-07-29" without also saying "Story 2.5 was implemented on 2026-07-30" is incomplete whenever the two dates differ.

The canonical worked example for §2 is `docs/user-stories/README.md`'s "Known cross-story conflict — resolved, 2026-07-30" entry: it explicitly distinguishes the 2026-07-29 acceptance date from the 2026-07-30 implementation date, names both Story 2.3 (ADR-0010) and Story 4.3 (ADR-0009) as the affected stories, and records what did and didn't change in each story's own contract. Any future cross-story conflict note that does not match this level of precision is grounds for revision before acceptance.

### 3. Resolve every known-conflict note to a named owner artifact

A "known conflict," "open question," or "TBD" note inside a story or ADR must always state one of:

- **Resolved by** an accepted superseding ADR/story (named by number + acceptance date — §2's pattern).
- **Deferred to** a named future story (e.g. "deferred to Story 5.18" — Story 5.18 then actually has to be drafted, or the conflict note becomes a stale TBD).
- **Deferred to** a named future ADR (e.g. "deferred to candidate ADR #3" — that ADR must actually be drafted before this one ships, or the conflict note is upgraded to a Pending supersession note per the README's row 5).
- **Intentionally retained as obsolete historical behavior** (a deliberate, named design choice to keep the old wording visible — e.g. the README's row 5/6 historical-record principle).

**A bare "to be decided," "TBD," "needs further discussion," or similar note with no concrete owner is not acceptable.** If a reviewer encounters one during review, the fix is to convert it to one of the four forms above before the parent ADR/story is accepted. This rule exists because unowned TBDs are the most common source of "the conflict note was here all along, nobody picked it up, and we shipped without resolving it" incidents — the pattern this whole ADR exists to prevent.

### 4. The live contract is the last dated appendix — not a separate "current contract" sentence

Where the historical Decision text and the live contract differ (because of one or more appended Clarification / Supersession update / Note on relation to ADR-XXXX sections), the **last** dated appendix is the live contract. The original Decision text above it stays as the historical record and is never rewritten to match.

A separate "current contract" or "what's currently enforceable" sentence at the top of the file is **not** required by this ADR — it would create two sources of truth (the top-of-file sentence vs. the last dated appendix), which is the exact dual-source problem `docs/adr/README.md`'s "common thread" paragraph exists to avoid. Where a future reviewer would benefit from a quick-glance summary at the top, that summary is a documentation-stewardship concern (handled in the relevant `docs/` file), not an ADR-amendment concern.

The worked example for §4 is ADR-0023: its Acceptance note ("Story 2.5 has now been implemented (2026-07-30) — `connectorHealth.ts`'s `failing` derivation is the rate-relative rule...") is both the last dated appendix and the live contract — there is no separate top-of-file restatement.

### 5. Preserve historical text; append clarifications — same as the README's common thread

This ADR does not permit rewriting prior Decision history. Clarifications and supersession updates are appended as dated sections (Clarification, Supersession update, Note on relation to ADR-XXXX, or in-place AC markers per §1), using the seven categories already defined in `docs/adr/README.md`'s table. The original Decision and Consequences text is a historical record and stays put.

This is the same rule as the README's "common thread" paragraph, restated here as a working-pattern commitment so that future story/ADR authors have a single place to look when asking "am I allowed to edit this?"

## Consequences

**Positive**
- Codifies a writing pattern already partially in practice across the series (Story 2.3 AC4, ADR-0009/0010 Pending supersession notes, ADR-0024/0026 Note on relation to ADR-0027, `docs/user-stories/README.md`'s "Known cross-story conflict" entry) so future contributors don't re-derive it per-document.
- Reduces accidental implementation against outdated contract fragments by requiring exact identifiers, dates, and implementation-status distinctions in every cross-dependency note.
- Prevents the "second governance document" risk by explicitly deferring to `docs/adr/README.md`'s seven-row table as the authority for which category applies.
- Eliminates the "unowned TBD" failure mode by requiring one of four named resolution forms for every known-conflict note (§3).
- Makes review outcomes less ambiguous when acceptance and implementation are separated in time (§2's implementation-status note).

**Negative**
- Slightly increases authoring overhead for story and ADR maintenance — every cross-dependency note now needs the four §2 fields plus, where applicable, a §3 resolution form.
- Requires disciplined updates whenever supersession occurs — a §1 in-place AC marker must be added at acceptance time, not "later when someone notices."
- §3's strict no-unowned-TBDs rule means a few existing "needs further discussion" notes scattered through older ADRs may surface during review and require back-fixing. Named explicitly as a consequence, not silently.

## Scope and applicability

This pattern applies project-wide. It is immediately relevant to Epic 2 materials that currently reference supersession logic (notably Stories 2.3, 2.4, 2.5 and their linked ADRs), but the rule generalizes to every story and every ADR that may need a future cross-dependency note.

## Open Questions

- [ ] **[Q-0047-1]** **Whether to introduce a strict AC label convention (e.g. AC1/AC2 numbering in every story)** to make cross-document references even more precise. **Note:** if pursued, this would require its own ADR — changing the metadata convention of every existing story file is exactly the breaking-change-to-record-format case ADR-0017 governs. This ADR deliberately does not decide that question; flagged here so the answer is "separate ADR if ever pursued," not "decide inside this ADR."
- [ ] **[Q-0047-2]** **Whether to add a lightweight lint/check script** that flags (a) unowned TBDs (§3), (b) cross-dependency notes missing one of §2's four fields, and (c) ACs whose obsolete-marker pattern doesn't match §1's exact wording. Likely useful once the series exceeds ~50 ADRs; premature now per the rule-of-three discipline this project already applies elsewhere (ADR-0020's deferred distributed rate-limit gate is the direct precedent for "build when actually needed, not speculatively").

## Amendment Log

- 2026-08-08 — Initial proposal drafted from backlog input (Epic 2 cross-story dependency clarity); left Proposed since the drafting persona does not hold ADR-acceptance authority.
- 2026-08-08 — **Revised in place, same day**, in response to a review finding that the prior version risked duplicating `docs/adr/README.md`'s seven-row governance table rather than codifying an existing pattern. Changes (each logged honestly in the order they happened):
  - **Added a "Relation to docs/adr/README.md's governance table" section** between Context and Decision, explicitly deferring to the README's seven-row table as the authority for *which* category applies. Fixes the "second governance document" risk.
  - **Split §1 into three cases** — Decision changes (require in-place obsolete marker), parameter tweaks (Amendment Log only), implicit-requirement clarifications (dated Clarification section in parent ADR). Prior version conflated the three.
  - **In §2, cited `docs/user-stories/README.md`'s "Known cross-story conflict — resolved, 2026-07-30" entry as the canonical worked example**, and added a verbatim reference to the README's row 6 ("don't assume already-shipped code changes automatically"). Prior version's "implementation-status note" bullet was correct but under-cited.
  - **In §3, enumerated the four valid resolution forms** (resolved by ADR/story / deferred to named future story / deferred to named future ADR / intentionally retained obsolete) and explicitly forbade unowned TBDs. Prior version was aspirational.
  - **Rephrased §4** as "the last dated appendix is the live contract" — consistent with the README's "common thread" rather than introducing a separate "current contract" sentence that would create a dual source of truth. Prior version's wording would have invited dual-source duplication.
  - **Updated Source** to name the backlog's actual location pattern (`docs/open-decisions.md` / project backlog) rather than the bare "backlog input" framing. Matches the series' "named provenance" convention.
  - Per this project's own in-place-revision-before-acceptance convention (ADR-0030/ADR-0031/ADR-0032/ADR-0036/ADR-0037's own precedent), this does not reopen this ADR's Status — it remains **Proposed**, awaiting Menno's separate review and acceptance.
