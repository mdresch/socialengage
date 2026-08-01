# Git Hooks for Spark Capture Project

This directory contains git hooks used to enforce project discipline, particularly mandatory time tracking.

## Pre-commit Hook

The `pre-commit` hook enforces **mandatory time tracking** for all project commits. When you attempt to commit changes, the hook will:

1. Prompt you for time tracking information:
   - Date (auto-filled with current date)
   - Start Time (HH:MM format)
   - End Time (HH:MM format)
   - Duration (auto-calculated)
   - Activity (what you were doing)
   - Story/ADR (which story or ADR this relates to)
   - Notes (optional)

2. Automatically add this entry as a line item to `docs/time-tracking.md`

3. Continue with the commit

## Installation

### Automatic Setup

Run the setup script from the project root:

```bash
# Using bash
node scripts/setup-git-hooks.js

# Using Windows PowerShell
node scripts\setup-git-hooks.js
```

This will:
- Copy the pre-commit hook to `.git/hooks/pre-commit`
- Make it executable
- Output installation status

### Manual Setup

Alternatively, you can install the hook manually:

```bash
# Copy the hook
cp scripts/git-hooks/pre-commit .git/hooks/pre-commit

# Make it executable (Unix/Linux/Mac)
chmod +x .git/hooks/pre-commit
```

On Windows, you may need to:
1. Copy the file manually
2. Ensure Node.js is in your PATH
3. The file should work without explicit execute permissions on Windows

## When the Hook Runs

The hook runs on **every git commit** and will prompt for time tracking information.

### Skipped Scenarios

The hook automatically skips in these cases:
- **Merge commits** - Detected automatically, no prompt
- **Initial commit** - First commit in the repository
- **Time-tracking only commits** - If you're only committing changes to `docs/time-tracking.md`

### Bypassing the Hook

To bypass the hook (not recommended):

```bash
git commit --no-verify -m "Your commit message"
```

Use this sparingly, as it defeats the purpose of tracking time spent on the project.

## Time Tracking File Format

The hook adds entries to `docs/time-tracking.md` in the following format:

```markdown
| Date | Start Time | End Time | Duration (min) | Activity | Story/ADR | Notes |
|------|------------|----------|----------------|----------|-----------|-------|
| 2026-08-01 | 09:00 | 10:30 | 90 | Implement Story 2.7 | Story 2.7 / ADR-0026 | GNews connector |
| 2026-08-01 | 13:00 | 14:15 | 75 | Debug test failures | Story 2.7 | Contract edge cases |
```

## Requirements

- Node.js must be installed and available in your PATH
- The hook must be executable (on Unix-like systems)
- `docs/time-tracking.md` will be created automatically if it doesn't exist

## Troubleshooting

### "Error: Cannot find module"

Ensure Node.js is installed and in your PATH. Test with:

```bash
node --version
```

### Hook doesn't run

1. Check that the file is in `.git/hooks/pre-commit`
2. Check that it's executable: `ls -la .git/hooks/pre-commit`
3. Check the shebang line is correct: `head -1 .git/hooks/pre-commit`
4. Try running it manually: `.git/hooks/pre-commit`

### "Time entry already exists"

The hook prevents duplicate entries for the same date. If you've already entered time for today, you can:
- Amend your previous entry manually in `docs/time-tracking.md`
- Use `--no-verify` to bypass (not recommended)
- Wait until tomorrow for a new date

## Files

- `pre-commit` - The main hook script (Node.js)
- This README.md - Documentation

## Related Documentation

- [Project Work Management Plan](../../docs/project%20docs/Project%20Management%20Plans/Project-Work-Management-Plan.md)
- [Time Tracking Template](../../docs/time-tracking.md)
- [Implementation Methodology](../../docs/implementation-methodology.md)
