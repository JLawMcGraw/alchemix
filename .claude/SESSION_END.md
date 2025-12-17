# Session End Protocol

Update documentation before ending. Does NOT auto-commit.

---

## Required Updates

### 1. `Documentation/PROJECT_PROGRESS.md` (Always)

Add session entry at **top** with:
- Date
- Summary (1-2 sentences)
- Work completed (bulleted list)
- Files changed
- Any blockers or next priorities

**Keep 10 sessions max** → archive older entries to `Documentation/archives/progress-archive.md`.

### 2. `.claude/SESSION_START.md` (If Significant Changes)

Update for:
- Test count changes
- Version bumps
- New features added to Key Features list
- Changed priorities

### 3. `Documentation/DEV_NOTES.md` (If Applicable)

Only update for:
- Technical decisions
- Workarounds discovered
- Schema changes
- Breaking changes

### 4. `README.md` (If Applicable)

Only update for:
- Version bump
- New features
- Changed setup steps

### 5. `alchemix-design-system.md` (If Design Changes)

Update for:
- New colors or design tokens
- New component specifications
- Logo or branding changes

---

## Confirm Before Ending

```
✅ Session docs updated

Summary: [1-2 sentences of work done]
Status: v1.X.X - [any blockers]
Tests: [total count]
Next: [top priority]

Ready to commit when you are.
```
