# Time Tracking
## SocialEngage

**Purpose:** Track commit-level activity to support estimation-accuracy metrics and capacity planning, without requiring session-level time entry.

**Approach, corrected 2026-08-06:** this file previously claimed an interactive pre-commit prompt enforced mandatory time entry — checked directly against the real `scripts/git-hooks/pre-commit`, no such prompt ever existed there (that hook is the contract-first backstop, unrelated to time tracking); this file's own log table had also sat empty since it was first added. Both this file and `docs/templates/time-tracking.md` also still carried "Spark Capture Project" branding, evidence this was copied in from some other project's template and never adapted. An interactive prompt was deliberately not built: most commits in this project are made by Claude Code on Menno's own behalf via tool calls, with no TTY attached — a blocking prompt would hang or fail on exactly those commits, not just skip them.

**What's real now:** `scripts/git-hooks/post-commit` auto-derives one log row per commit from the commit's own message — no prompt, works identically whether Menno or Claude Code committed. It infers an Activity category from the commit subject (Implementation/Debugging/Design/Documentation/Review/Infrastructure — see "Session Types" below) and extracts a Story/ADR reference via pattern match if the subject names one. **Start/End Time and Duration are honestly recorded as unavailable ("—"/"auto"), never fabricated** — this mechanism has no way to know real wall-clock time spent, and inventing a plausible-looking number would violate this project's own "never invent a figure not evidenced by a real source" discipline (the same bar `docs/project docs/Business-Case-v6.0.md` and every ADR in this series already hold themselves to). The "Metrics Derived from Time Tracking" section below is adjusted accordingly — anything requiring real duration data is marked "Not tracked," not "TBD."

---

## 📊 Time Tracking Log

**Format:** One row per session. Use ISO dates (YYYY-MM-DD).

| Date | Start Time | End Time | Duration (min) | Activity | Story/ADR | Notes |
|------|------------|----------|----------------|----------|-----------|-------|
| 2026-08-06 | — | — | auto | Documentation | — | Auto-queue bookkeeping and time-log rows for recent commits (3c96b74) |
| 2026-08-06 | — | — | auto | Documentation | — | Documentation Steward: close the Stakeholder Management cross-reference gap (f5e4e41) |
| 2026-08-06 | — | — | auto | Review | — | Data Privacy & Sovereignty Reviewer: first real review (7dddb56) |
| 2026-08-06 | — | — | auto | Review | ADR-0038 | Legal & Compliance Reviewer: first real review, ADR-0038 (3a757b7) |
| 2026-08-06 | — | — | auto | Design | ADR-0042 | Draft ADR-0042: Wikipedia connector (MediaWiki API, article-as-Author) (f932f41) |
| 2026-08-06 | — | — | auto | Documentation | — | Fix: auto-derived time-log row landed after the file footer, not in the table (406bf2c) |
| 2026-08-06 | — | — | auto | Documentation | — | Add real, auto-derived commit time-logging to post-commit; fix stale template (cd308eb) |

**Total Time:** Not tracked (see "Metrics Derived from Time Tracking" below) — the log table's own row count is the accurate figure for "commits logged," not a separately-maintained number here that could drift out of sync with it.

---

## 📈 Metrics Derived from Time Tracking

**Corrected 2026-08-06:** every metric below requires real wall-clock duration data this mechanism does not collect (see "Approach" above) — marked **Not tracked**, not "TBD," since "TBD" implies data will eventually fill this in through normal use, which it structurally cannot under the auto-derived mechanism. Commit-count-based metrics (activity mix, story/ADR coverage) are derivable from the log table's own rows today and are a more honest near-term substitute — not built here, a real follow-up if capacity planning is ever actually needed at this project's current solo-developer scale.

### Estimation Accuracy
| Metric | Calculation | Current Value |
|--------|-------------|---------------|
| Avg Estimate vs. Actual | (Estimated Hours - Actual Hours) / Estimated Hours | Not tracked — no duration data collected |
| Estimation Error % | (Actual - Estimated) / Estimated × 100 | Not tracked — no duration data collected |

### Velocity
| Metric | Calculation | Current Value |
|--------|-------------|---------------|
| Stories per Hour | Stories Completed / Total Hours | Not tracked — no duration data collected |
| Points per Hour | Story Points / Total Hours | Not tracked — no duration data collected |

### Capacity
| Metric | Calculation | Current Value |
|--------|-------------|---------------|
| Available Hours/Week | Self-reported capacity | Not tracked — no duration data collected |
| Utilization % | Actual Hours / Available Hours × 100 | Not tracked — no duration data collected |

---

## 🎯 Usage Instructions

### For Each Commit (automatic, since 2026-08-06):
1. **After committing:** `scripts/git-hooks/post-commit` reads the commit's own hash and message — no prompt, nothing to enter.
2. **Automatic entry:** the hook infers an Activity category and a Story/ADR reference (if the subject names one) and appends a row to the log table above.
3. **Honest gaps, not fabrication:** Start Time, End Time, and Duration are recorded as `—`/`auto` — this mechanism cannot know real elapsed time, and does not invent a plausible-looking number to fill the column.

### Manual Entry (if you want real duration data for a specific session):
Add a row directly to the table above, following the same format the auto-derived rows use:
```
| YYYY-MM-DD | HH:MM | HH:MM | minutes | Activity | Story/ADR | Notes |
```
A manually-entered row with real Start/End times is the only way this file will ever contain real duration data — the automatic mechanism deliberately doesn't attempt to.

---

## 📋 Session Types

| Type | Description | Example |
|------|-------------|---------|
| **Implementation** | Writing code to pass contracts | Story 2.7 implementation |
| **Design** | Drafting ADRs, architecture decisions | ADR-0026 drafting |
| **Debugging** | Investigating and fixing issues | Contract failure diagnosis |
| **Review** | AI agent review, code review | Architecture review |
| **Infrastructure** | Environment setup, CI/CD | GitHub Actions setup |
| **Documentation** | Writing docs, updating plans | Management plans |
| **Meeting** | External discussions, planning | Stakeholder review |

---

## 🔧 Technical Details

**Hook location:** `scripts/git-hooks/post-commit` (synced to `.git/hooks/post-commit` by `scripts/setup-git-hooks.js`) — corrected 2026-08-06 from this file's own prior, inaccurate claim of a `.git/hooks/pre-commit` Node.js prompt, which never actually existed.

**Hook type:** POSIX `sh`, same file that already queues the Ideal Manager/Documentation Steward/Learning & Development Writer reviews (`docs/management/pending-manager-reviews.md` and siblings) — time-logging is one more thing that same hook does per commit, not a separate mechanism.

**Skipped scenarios:**
- A commit whose only changed file is `docs/time-tracking.md` itself (avoids a self-referential logging loop).
- Non-blocking either way: this runs post-commit, after the commit has already succeeded — it can never fail or delay a commit, unlike a pre-commit hook would.

**Bypass:** not applicable — there's nothing to bypass; `--no-verify` skips pre-commit/commit-msg hooks, not post-commit.

---

## 📊 Template for Monthly Time Report

```markdown
# Monthly Time Report — [Month] [Year]

**Reporting Period:** [Start Date] to [End Date]
**Total Time:** [X] hours ([Y] minutes)

## Summary
- **Stories Completed:** [N]
- **ADRs Created:** [N]
- **Estimated Time:** [X] hours
- **Actual Time:** [Y] hours
- **Estimation Accuracy:** [Z]%

## Breakdown by Activity
| Activity | Time (hours) | % of Total |
|----------|--------------|------------|
| Implementation | [X] | [Y]% |
| Design | [X] | [Y]% |
| Debugging | [X] | [Y]% |
| Review | [X] | [Y]% |
| Infrastructure | [X] | [Y]% |
| Documentation | [X] | [Y]% |
| **Total** | **[X]** | **100%** |

## Breakdown by Story/ADR
| Story/ADR | Estimated | Actual | Variance | Notes |
|-----------|-----------|--------|----------|-------|
| Story 2.7 | [X]h | [Y]h | [Z]h | GNews connector |

## Lessons Learned
- [Lesson 1]
- [Lesson 2]

## Next Month Goals
- [Goal 1]
- [Goal 2]
```

---

*This file is automatically maintained by `scripts/git-hooks/post-commit`. Manual edits are permitted but should follow the established format.*
