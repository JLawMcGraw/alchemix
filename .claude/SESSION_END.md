# Session End Documentation

Update project documentation before ending the session. **This does NOT commit to git - you control when to commit.**

---

## Required Updates (All 4 Steps)

### 1. Update `Documentation/PROJECT_PROGRESS.md`

Add new session entry at the **top** with:
- Date and title
- Work completed summary
- Components/features modified
- Tasks completed → move to "Recently Completed"
- New tasks identified
- Blockers discovered
- Next priorities

**Keep only 10 most recent sessions.** Archive older ones to `Documentation/archives/progress-archive.md`.

### 2. Update `Documentation/DEV_NOTES.md`

Document:
- Technical decisions
- Workarounds and gotchas
- Code snippets or config changes
- Dependencies or breaking changes
- Database schema changes

### 3. Update `README.md`

- Version number (if features added)
- "What's Working" section
- Feature checkboxes (✅/🚧/⬜)
- New API endpoints
- Setup instructions (if changed)

### 4. Update `Documentation/metrics/prompt-effectiveness.md`

Add entry with:
- Session focus and files updated
- Completion status (✅/⚠️/❌)
- Time saved estimate
- Quality rating (1-5)
- Observations

---

## Verification Checklist

**Code Quality**:
- [ ] TypeScript passes (`npm run type-check` and `cd api && npm run type-check`)
- [ ] No console errors
- [ ] App starts (`npm run dev:all`)

**Documentation**:
- [ ] PROJECT_PROGRESS.md updated
- [ ] DEV_NOTES.md updated
- [ ] README.md current
- [ ] Metrics recorded

---

## Response Template

After completing updates:

```
✅ Session documentation updated!

**Updates**:
- PROJECT_PROGRESS.md: [brief summary]
- DEV_NOTES.md: [decisions documented]
- README.md: [changes made]
- Metrics: Recorded

**Session Summary**: [1-2 sentences]

**Project Status**: v1.X.X - [phase] - [blockers if any]

**Next Session**: [top priority]

Ready to commit when you are.
```

---

## AlcheMix Quick Reference

**Architecture**: Monorepo (Frontend: root, Backend: api/)
**Stack**: Next.js 14 + Express + TypeScript + SQLite
**Ports**: Frontend 3001, Backend 3000
**Commands**: `npm run install:all` → `npm run dev:all`
