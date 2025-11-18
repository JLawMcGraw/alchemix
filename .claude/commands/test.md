---
description: Run backend tests by category (unit, db, routes, or all)
---

Run the AlcheMix API backend tests.

## Instructions

1. Read `/Users/jlawmcgraw/Desktop/DEV/alchemix/api/TESTING.md` for comprehensive testing guide
2. Ask the user which test category they want to run:
   - **all** - Run all test categories sequentially (recommended before commits)
   - **unit** - Run utils + middleware tests (164 tests, ~500ms)
   - **db** - Run database tests (31 tests, ~150ms)
   - **routes** - Run route integration tests (25 tests, ~2s)
   - **utils** - Run only utility tests
   - **middleware** - Run only middleware tests
   - **auth** - Run only auth route tests
   - **specific** - Ask for specific test file path

3. Change to the api directory: `cd /Users/jlawmcgraw/Desktop/DEV/alchemix/api`

4. Run the appropriate npm script based on user choice:
   - `npm run test:all` (all categories)
   - `npm run test:unit` (unit tests)
   - `npm run test:db` (database tests)
   - `npm run test:routes` (route tests)
   - `npm run test:utils` (utilities only)
   - `npm run test:middleware` (middleware only)
   - `npm run test:auth` (auth routes only)
   - `npm test -- <file-path>` (specific file)

5. Show the test results to the user, including:
   - Total tests run
   - Pass/fail count
   - Any failures with details
   - Runtime

6. If tests fail:
   - Show the failure details
   - Offer to investigate and fix the failing tests
   - Reference TESTING.md for troubleshooting

## Example Usage

User: "/test"
Assistant: "Which test category would you like to run?"
User: "all"
Assistant: *runs `npm run test:all`* and shows results

## Important Notes

- Tests should be run by category to avoid database interference
- All categories should show 100% pass rate when run separately
- See `api/TESTING.md` for complete documentation
- Before commits, always run `npm run test:all`
