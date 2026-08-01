# Time Tracking
## Spark Capture Project

**Purpose:** Track time spent on project activities to enable estimation accuracy metrics and capacity planning.

**Approach:** Mandatory time tracking for all project commits (enforced via git pre-commit hook).

---

## 📊 Time Tracking Log

**Format:** One row per session. Use ISO dates (YYYY-MM-DD).

| Date | Start Time | End Time | Duration (min) | Activity | Story/ADR | Notes |
|------|------------|----------|----------------|----------|-----------|-------|

**Total Time:** 0 minutes

---

## 📈 Metrics Derived from Time Tracking

### Estimation Accuracy
| Metric | Calculation | Current Value |
|--------|-------------|---------------|
| Avg Estimate vs. Actual | (Estimated Hours - Actual Hours) / Estimated Hours | TBD |
| Estimation Error % | (Actual - Estimated) / Estimated × 100 | TBD |

### Velocity
| Metric | Calculation | Current Value |
|--------|-------------|---------------|
| Stories per Hour | Stories Completed / Total Hours | TBD |
| Points per Hour | Story Points / Total Hours | TBD |

### Capacity
| Metric | Calculation | Current Value |
|--------|-------------|---------------|
| Available Hours/Week | Self-reported capacity | TBD |
| Utilization % | Actual Hours / Available Hours × 100 | TBD |

---

## 🎯 Usage Instructions

### For Each Work Session:
1. **Before committing:** The git pre-commit hook will prompt you for time tracking information
2. **Enter details:** Provide start time, end time, activity, story/ADR, and optional notes
3. **Automatic entry:** The hook adds your entry to this file
4. **Proceed with commit:** The commit continues after time is recorded

### Manual Entry (if needed):
Add entries directly to the table above following the format:
```
| YYYY-MM-DD | HH:MM | HH:MM | minutes | Activity | Story/ADR | Notes |
```

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

**Hook Location:** `.git/hooks/pre-commit`

**Hook Type:** Node.js script (requires Node.js to be installed)

**Skipped Scenarios:**
- Merge commits (automatically detected)
- Initial commit (first commit in repo)
- Commits that only modify time-tracking.md itself

**Bypass:** To bypass the hook, use `git commit --no-verify` (not recommended)

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

*This file is automatically maintained by the git pre-commit hook. Manual edits are permitted but should follow the established format.*
