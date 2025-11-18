# Testing Guide for Claude Code

This document provides instructions for Claude Code on how to run and manage tests for the AlcheMix project.

## Quick Commands

### Before Committing Code
```bash
cd api
npm test
```
✅ All 195 tests pass together (test interference fixed!)

### Run Specific Category
```bash
cd api
npm run test:unit      # Utils + Middleware (164 tests)
npm run test:db        # Database (31 tests)
npm run test:routes    # Routes (25 tests)
```

### Run Specific File
```bash
cd api
npm test -- src/utils/passwordValidator.test.ts
npm test -- src/routes/auth.test.ts
```

## Test Categories

### Unit Tests (`test:unit`)
- Location: `api/src/utils/`, `api/src/middleware/`
- Files: 5 test files
- Tests: 164 total
- Runtime: ~500ms
- Purpose: Test pure functions and middleware

### Database Tests (`test:db`)
- Location: `api/src/database/`
- Files: 1 test file
- Tests: 31 total
- Runtime: ~150ms
- Purpose: Test schema, CRUD, constraints

### Route Tests (`test:routes`)
- Location: `api/src/routes/`
- Files: 1 test file
- Tests: 25 total
- Runtime: ~2s
- Purpose: Integration tests for API endpoints

## When User Asks to Run Tests

1. **Determine which tests to run**:
   - If they say "run tests" → ask which category or run `test:all`
   - If they mention a specific feature → run relevant category
   - If before commit → run `test:all`

2. **Change to api directory**:
   ```bash
   cd /Users/jlawmcgraw/Desktop/DEV/alchemix/api
   ```

3. **Run the appropriate command**:
   ```bash
   npm run test:all      # All categories
   npm run test:unit     # Just unit tests
   npm run test:db       # Just database tests
   npm run test:routes   # Just route tests
   ```

4. **Report results**:
   - Total tests run
   - Pass/fail count
   - Any failures with details
   - Execution time

## Expected Pass Rates

✅ **Test interference FIXED!** All tests pass when run together.

- ✅ `npm test` → 195/195 (100%)
- ✅ `test:unit` → 164/164 (100%)
- ✅ `test:db` → 31/31 (100%)
- ✅ `test:routes` → 25/25 (100%)
- ✅ `test:all` → 195/195 (100%)

## If Tests Fail

1. **Show the failure details** to the user
2. **Identify the category**:
   - Unit test failure → likely logic bug
   - Database test failure → likely schema issue
   - Route test failure → likely API contract change
3. **Offer to investigate and fix**
4. **Reference**: `api/TESTING.md` for troubleshooting

## Important Notes

- ✅ **Test interference is FIXED!** You can now run `npm test` safely
- ✅ All 195 tests pass when run together (100% pass rate)
- ✅ Tests can also be run by category for faster feedback
- 📖 Full documentation: `api/TESTING.md`
- 📝 Quick reference: `api/TEST_COMMANDS.md`

## When Adding New Tests

If user asks to add tests:

1. **Determine category**:
   - Utility function → `api/src/utils/<name>.test.ts`
   - Middleware → `api/src/middleware/<name>.test.ts`
   - Database → `api/src/database/<name>.test.ts`
   - Routes → `api/src/routes/<name>.test.ts`

2. **Follow existing patterns**:
   - Import from vitest: `describe, it, expect, beforeEach, afterEach`
   - Use TypeScript
   - Follow naming: `<feature>.test.ts`

3. **Run tests after adding**:
   ```bash
   npm test -- src/path/to/new.test.ts
   ```

4. **Verify in category**:
   ```bash
   npm run test:unit    # If added to utils or middleware
   npm run test:db      # If added to database
   npm run test:routes  # If added to routes
   ```

## Slash Command

User can type `/test` to trigger the test slash command which will:
1. Ask which category to run
2. Execute the appropriate npm script
3. Show results
4. Offer to fix failures

## Coverage Reports

If user wants coverage:
```bash
cd api
npm run test:coverage    # Terminal report
npm run test:ui          # Browser UI
```

## Watch Mode (TDD)

For active development:
```bash
cd api
npm run test:watch
```

This will:
- Watch for file changes
- Auto-rerun affected tests
- Provide instant feedback

## Resources

- 📖 Complete guide: `api/TESTING.md`
- 📝 Quick commands: `api/TEST_COMMANDS.md`
- ⚙️ Test scripts: `api/package.json` (scripts section)
- 📂 Test files: `api/src/**/*.test.ts`
