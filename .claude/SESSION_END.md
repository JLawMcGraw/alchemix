# Session End Protocol

Update docs before ending. Does NOT auto-commit.

---

## Required Updates

### 1. `Documentation/PROJECT_PROGRESS.md`
Add session entry at **top**: date, work done, tasks completed/new, blockers, next priority.
Keep 10 sessions max → archive older to `Documentation/archives/progress-archive.md`.

### 2. `Documentation/REDESIGN_PLAN.md` (if redesign work)
Update for visual redesign work:
- Mark completed checkboxes in phase sections
- Update phase status percentages in summary table
- Add entry to Progress Log section with date and changes
- Update Next Steps if priorities changed

### 3. `Documentation/DEV_NOTES.md` (if applicable)
Only update for: technical decisions, workarounds, schema changes, breaking changes.

### 4. `README.md` (if applicable)
Only update for: version bump, new features, changed setup steps.

### 5. `.claude/SESSION_START.md` (if significant changes)
Update for: phase completion, new blockers, changed priorities, version bumps.

---

## Redesign-Specific Checklist

If working on visual redesign phases:
- [ ] Updated phase status in `REDESIGN_PLAN.md`
- [ ] Added Progress Log entry with files changed
- [ ] Updated Next Steps section
- [ ] Updated SESSION_START.md redesign progress if phase completed

---

## Confirm Before Ending

```
✅ Session docs updated

Summary: [1-2 sentences of work done]
Status: v1.X.X - [any blockers]
Redesign: Phase X - [percentage]%
Next: [top priority]

Ready to commit when you are.
```
