# Quick Test Commands Reference

## Run All Tests (Before Committing)
```bash
npm test
```
✅ Runs all 195 tests together (100% pass rate - test interference FIXED!)

Or run by category:
```bash
npm run test:all
```
Runs all categories sequentially: unit → db → routes (100% pass rate)

---

## By Category

### Unit Tests (Utils + Middleware)
```bash
npm run test:unit
```
**164 tests** - Password validation, input sanitization, token blacklist, error handling

### Database Tests
```bash
npm run test:db
```
**31 tests** - Schema, CRUD operations, constraints, indices

### Route Tests (Integration)
```bash
npm run test:routes
```
**25 tests** - Auth endpoints (signup, login, logout, /me)

---

## Specific Test Suites

### Just Utilities
```bash
npm run test:utils
```
passwordValidator, inputValidator, tokenBlacklist

### Just Middleware
```bash
npm run test:middleware
```
errorHandler

### Just Auth Routes
```bash
npm run test:auth
```
Auth integration tests

---

## Watch Mode (TDD)
```bash
npm run test:watch
```
Auto-rerun tests on file changes

---

## Coverage Reports
```bash
npm run test:coverage    # Terminal report
npm run test:ui          # Browser UI
```

---

## Run Specific File
```bash
npm test -- src/utils/passwordValidator.test.ts
npm test -- src/routes/auth.test.ts
```

---

## Expected Results

| Command | Tests | Pass Rate | Time |
|---------|-------|-----------|------|
| `npm test` | 195 | 100% ✅ | ~2.5s |
| `test:unit` | 164 | 100% ✅ | ~65ms |
| `test:db` | 31 | 100% ✅ | ~190ms |
| `test:routes` | 25 | 100% ✅ | ~2s |
| `test:all` | 195 | 100% ✅ | ~2.5s |

✅ **Test interference FIXED!** All tests now pass when run together.

---

See [TESTING.md](./TESTING.md) for complete documentation.
