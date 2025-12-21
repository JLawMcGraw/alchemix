# AGENTS.md

## Build/Test Commands
- **Lint:** `npm run lint` (Next.js ESLint)
- **Type check:** `npm run type-check` (runs tsc for frontend, api, and recipe-molecule)
- **All tests:** `npm run test:all` (frontend + API)
- **Frontend tests:** `npm test` or `npx vitest run src/path/to/file.test.ts`
- **API tests:** `npm run test:api` or `cd api && npx vitest run src/path/to/file.test.ts`
- **Watch mode:** `npm run test:watch` or `cd api && npm run test:watch`

## Code Style
- **TypeScript:** Strict mode enabled. Use explicit types for function params/returns.
- **Imports:** Group by external, internal (`@/`), relative. Use path aliases (`@/*` → `./src/*`).
- **Naming:** PascalCase for components/classes, camelCase for functions/variables.
- **React:** Functional components with `forwardRef` when needed. CSS Modules for styling.
- **Error handling (API):** Use typed errors from `api/src/errors/AppError.ts` (ValidationError, NotFoundError, etc.). Wrap async handlers with `asyncHandler()`.
- **Tests:** Colocate with source as `*.test.ts(x)`. Use Vitest with globals enabled.
- **Documentation:** JSDoc for utilities/services explaining purpose, usage, and examples.
