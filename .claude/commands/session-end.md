---
description: Update session documentation before ending work
---

# Session End

Update all session documentation before ending work. Does NOT auto-commit.

## Instructions

### 1. Gather Session Information

If not already clear from conversation context, ask the user:
- What was the main work accomplished this session?
- Were there any blockers or issues to note?

### 2. Read Current State

Read:
- `Documentation/PROJECT_PROGRESS.md` (first 100 lines) - For format and current status
- `.claude/SESSION_START.md` - For current version and test counts

### 3. Generate PROJECT_PROGRESS.md Entry

Create a new session entry to add at the TOP (after "Current Status" section):

```markdown
---

## Recent Session (YYYY-MM-DD): [Brief Title]

### Summary
[1-2 sentence description of work completed]

### Work Completed

#### 1. [Feature/Fix Name]
**Problem**: [What was the issue]
**Solution**: [How it was fixed]

### Files Changed
```
[list of files modified/created]
```

### Next Steps
- [Priority items for next session]

---
```

### 4. Check if Other Files Need Updates

Ask yourself:
- **SESSION_START.md**: Did test counts change? Version bump? New features?
- **DEV_NOTES.md**: Any technical decisions or workarounds to document?
- **README.md**: Setup steps or features changed?

Only update if changes are significant.

### 5. Present Changes for Approval

Show the user:
- The new PROJECT_PROGRESS.md entry
- Any other files that need updates
- Ask for approval before writing

### 6. Apply Updates

After user approval:
1. Update `Documentation/PROJECT_PROGRESS.md` (add entry at top)
2. Update other files as needed
3. Display confirmation:

```
Session docs updated

Summary: [work done]
Status: v[version]
Tests: [count]
Next: [priority]

Ready to commit when you are.
```

## Important Notes

- NEVER commit automatically - user must explicitly request commits
- Keep session entries concise but complete
- Archive old sessions if PROJECT_PROGRESS.md exceeds 10 sessions
- Update SESSION_START.md test counts if they changed
