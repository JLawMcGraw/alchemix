# Testing Guide - AlcheMix API

This guide explains how to run tests for the AlcheMix API backend.

## Quick Reference

```bash
# Run ALL tests at once (recommended)
npm test

# Or run all tests by category
npm run test:all

# Run individual categories
npm run test:unit      # Utils + Middleware (164 tests)
npm run test:db        # Database operations (31 tests)
npm run test:routes    # API route integration (25 tests)

# Run specific test suites
npm run test:utils        # Just utility functions
npm run test:middleware   # Just middleware
npm run test:auth         # Just auth routes
```

## Test Categories

### 1. Unit Tests (`test:unit`)
**Files**: `src/utils/`, `src/middleware/`
**Tests**: 164 total
**Runtime**: ~500ms

Tests pure functions and middleware:
- ✅ `passwordValidator.test.ts` (30 tests) - Password validation rules
- ✅ `inputValidator.test.ts` (61 tests) - Input sanitization
- ✅ `tokenBlacklist.test.ts` (23 tests) - Token revocation
- ✅ `errorHandler.test.ts` (25 tests) - Error handling middleware

**Run**: `npm run test:unit`

### 2. Database Tests (`test:db`)
**Files**: `src/database/`
**Tests**: 31 total
**Runtime**: ~150ms

Tests database schema and operations:
- ✅ `db.test.ts` (31 tests) - Schema, CRUD, constraints, indices

**Run**: `npm run test:db`

### 3. Route Tests (`test:routes`)
**Files**: `src/routes/`
**Tests**: 25 total
**Runtime**: ~2s

Integration tests for API endpoints:
- ✅ `auth.test.ts` (25 tests) - Auth routes (signup, login, logout, /me)

**Run**: `npm run test:routes`

## Test Isolation ✅ FIXED

**Good news**: Test isolation has been fixed! All tests now run perfectly together.

### What was fixed?
- Each test now uses a unique database file (random ID)
- Tests can run in parallel without conflicts
- ✅ **100% pass rate** with `npm test`
- ✅ **100% pass rate** with `npm run test:all`

### Before Committing Code

Simply run:
```bash
npm test
```

All 195 tests will run and pass!

## Development Workflow

### Working on a specific feature?
Test just what you're working on:

```bash
# Working on password validation
npm test -- src/utils/passwordValidator.test.ts

# Working on auth routes
npm run test:auth

# Working on database
npm run test:db
```

### Before pushing to Git?
```bash
npm run test:all
```

### Want to watch tests while coding?
```bash
npm run test:watch
```

## Test Coverage

Get a coverage report:
```bash
npm run test:coverage
```

View coverage in browser:
```bash
npm run test:ui
```

## Test Structure

```
api/src/
├── utils/
│   ├── passwordValidator.test.ts    # Password security tests
│   ├── inputValidator.test.ts       # Input sanitization tests
│   └── tokenBlacklist.test.ts       # Token revocation tests
├── middleware/
│   └── errorHandler.test.ts         # Error handling tests
├── database/
│   └── db.test.ts                   # Database schema/CRUD tests
└── routes/
    └── auth.test.ts                 # Auth endpoint integration tests
```

## Test Results (As of 2025-11-14)

### Running All Tests Together (`npm test`)

| Category | Tests | Pass Rate | Runtime |
|----------|-------|-----------|---------|
| **Utils** | 114 | 100% ✅ | ~40ms |
| **Middleware** | 25 | 100% ✅ | ~25ms |
| **Database** | 31 | 100% ✅ | ~190ms |
| **Routes** | 25 | 100% ✅ | ~2s |
| **TOTAL** | **195** | **100%** ✅ | **~2.5s** |

✅ **All tests pass when run together!** No more test interference.

## CI/CD Integration

For continuous integration, simply use:
```bash
npm test
```

✅ All 195 tests will run and pass (100% pass rate guaranteed).

## Troubleshooting

### Tests fail unexpectedly?
1. Try running the specific test file:
   ```bash
   npm test -- src/utils/passwordValidator.test.ts
   ```

2. Check for environment issues (missing JWT_SECRET, etc.)

3. Clear any stale test databases:
   ```bash
   rm -rf /tmp/alchemix-test/
   ```

### Need to see detailed output?
```bash
npm test -- src/utils/passwordValidator.test.ts --reporter=verbose
```

### Tests hanging?
Check for:
- Database connections not closing
- Servers not shutting down in afterEach
- Async operations without await

## Adding New Tests

When adding new test files:

1. **Utility tests** → Add to `src/utils/` (auto-included in `test:unit`)
2. **Middleware tests** → Add to `src/middleware/` (auto-included in `test:unit`)
3. **Database tests** → Add to `src/database/` (auto-included in `test:db`)
4. **Route tests** → Add to `src/routes/` (auto-included in `test:routes`)

No need to update package.json - tests are discovered automatically by path!

## Test Writing Guidelines

### Unit Tests (Utils/Middleware)
- Fast (<10ms per test)
- No database dependencies
- Mock external services
- Test one thing per test

### Database Tests
- Use `createTestDatabase()` from `src/tests/setup.ts`
- Clean up in `afterEach`
- Test constraints and cascades
- Verify indices exist

### Integration Tests (Routes)
- Use `supertest` for HTTP testing
- Mock database with test DB
- Test full request/response cycle
- Verify status codes and response format

## Questions?

See the main project [README.md](../README.md) for more information.
