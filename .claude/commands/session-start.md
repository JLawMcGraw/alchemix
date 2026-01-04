---
description: Load session context and display current project status
---

# Session Start

Load context for a new Claude Code session on the AlcheMix project.

## Instructions

### 1. Load Session Context

Read the following files:

1. `.claude/SESSION_START.md` - Full project context, tech stack, directory structure, critical rules
2. `Documentation/PROJECT_PROGRESS.md` (first 300 lines) - Recent session history and current status

### 2. Display Session Summary

After reading, display a concise summary:

```
## AlcheMix Session Ready

**Version**: [version from SESSION_START.md]
**Branch**: [current git branch]
**Tests**: [test counts]

**Recent Work** ([date]):
[1-2 line summary of last session from PROJECT_PROGRESS.md]

**Blockers**: [any blockers, or "None"]
```

### 3. Ask for Task

End with: "What would you like to work on?"

## Example Output

```
## AlcheMix Session Ready

**Version**: v1.36.0
**Branch**: feature/molecule-visual-variety
**Tests**: 1685 total (927 backend, 460 frontend, 298 recipe-molecule)

**Recent Work** (Jan 3):
Fixed ItemDetailModal zero-stock display and modal close on save.

**Blockers**: None

What would you like to work on?
```

## Notes

- This command replaces manually reading SESSION_START.md
- For deep context on architecture, read `Documentation/ARCHITECTURE.md`
- For design system details, read `alchemix-design-system.md`
