# AlcheMix Testing Documentation

This document provides comprehensive information about the testing infrastructure and practices for the AlcheMix project.

## Table of Contents

- [Overview](#overview)
- [Testing Stack](#testing-stack)
- [Running Tests](#running-tests)
- [Test Structure](#test-structure)
- [Writing Tests](#writing-tests)
- [Test Coverage](#test-coverage)
- [Best Practices](#best-practices)
- [CI/CD Integration](#cicd-integration)

## Overview

AlcheMix uses a comprehensive testing strategy covering multiple levels:

- **Backend (API):**
  - Unit tests for utilities and validators
  - Middleware tests for authentication and error handling
  - Integration tests for API routes
  - Database operation tests

- **Frontend (Next.js):**
  - Component tests with React Testing Library
  - State management tests (Zustand)
  - API client tests
  - Integration tests for user workflows

## Testing Stack

### Backend Testing

- **Framework:** [Vitest](https://vitest.dev/) - Fast, TypeScript-native test framework
- **HTTP Testing:** [Supertest](https://github.com/ladjs/supertest) - HTTP assertion library
- **Database:** SQLite in-memory databases for isolated tests
- **Mocking:** Vitest's built-in mocking capabilities

### Frontend Testing

- **Framework:** [Vitest](https://vitest.dev/)
- **Component Testing:** [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- **DOM Environment:** [jsdom](https://github.com/jsdom/jsdom)
- **User Interactions:** [@testing-library/user-event](https://testing-library.com/docs/user-event/intro/)

## Running Tests

### Backend Tests

```bash
# Run all backend tests
cd api && npm test

# Run tests in watch mode (auto-rerun on changes)
cd api && npm run test:watch

# Run tests with coverage report
cd api && npm run test:coverage

# Run tests with UI (visual test runner)
cd api && npm run test:ui
```

### Frontend Tests

```bash
# Run all frontend tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests with UI
npm run test:ui
```

### Run All Tests

```bash
# Run both frontend and backend tests
npm run test:all
```

## Test Structure

### Backend Test Organization

```
api/src/
├── tests/
│   └── setup.ts                 # Global test setup and utilities
├── utils/
│   ├── passwordValidator.test.ts
│   ├── inputValidator.test.ts
│   └── tokenBlacklist.test.ts
├── middleware/
│   ├── errorHandler.test.ts
│   └── auth.test.ts
├── routes/
│   ├── auth.test.ts
│   ├── inventory.test.ts
│   ├── recipes.test.ts
│   └── favorites.test.ts
└── database/
    └── db.test.ts
```

### Frontend Test Organization

```
src/
├── tests/
│   └── setup.ts                 # Global test setup
├── components/
│   ├── ui/
│   │   ├── Button.test.tsx
│   │   ├── Input.test.tsx
│   │   └── Toast.test.tsx
│   └── modals/
│       ├── AddBottleModal.test.tsx
│       └── EditBottleModal.test.tsx
└── lib/
    ├── store.test.ts
    └── api.test.ts
```

## Writing Tests

### Backend Unit Tests

#### Testing Utilities

```typescript
import { describe, it, expect } from 'vitest';
import { validateEmail } from './inputValidator';

describe('validateEmail', () => {
  it('should accept valid email addresses', () => {
    const result = validateEmail('test@example.com');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject invalid email addresses', () => {
    const result = validateEmail('invalid-email');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid email format');
  });
});
```

#### Testing Middleware

```typescript
import { describe, it, expect, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { errorHandler } from './errorHandler';

describe('errorHandler', () => {
  it('should handle ValidationError correctly', () => {
    const mockReq = { id: 'test-id' } as Request;
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const mockNext = vi.fn() as NextFunction;

    const error = new ValidationError('Invalid input');
    errorHandler(error, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Invalid input',
      })
    );
  });
});
```

#### Testing API Routes (Integration)

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import authRoutes from './auth';

describe('Auth Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/auth', authRoutes);
  });

  it('should create a new user', async () => {
    const response = await request(app)
      .post('/auth/signup')
      .send({
        email: 'test@example.com',
        password: 'SecurePassword123!',
      })
      .expect(201);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('token');
  });
});
```

#### Testing Database Operations

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase } from '../tests/setup';
import Database from 'better-sqlite3';

describe('Database Operations', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDatabase();
  });

  afterEach(() => {
    db.close();
  });

  it('should insert a user', () => {
    const stmt = db.prepare(
      'INSERT INTO users (email, password_hash) VALUES (?, ?)'
    );
    const result = stmt.run('test@example.com', 'hashed_password');

    expect(result.changes).toBe(1);
    expect(result.lastInsertRowid).toBeGreaterThan(0);
  });
});
```

### Frontend Component Tests

#### Testing UI Components

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Button from './Button';

describe('Button', () => {
  it('should render with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should call onClick when clicked', async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    await userEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Click me</Button>);
    expect(screen.getByText('Click me')).toBeDisabled();
  });
});
```

#### Testing Zustand Store

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './store';

describe('useStore', () => {
  beforeEach(() => {
    // Reset store state
    useStore.setState({
      user: null,
      token: null,
      bottles: [],
    });
  });

  it('should set user on login', () => {
    const { login } = useStore.getState();

    login({
      user: { id: 1, email: 'test@example.com' },
      token: 'test-token',
    });

    const state = useStore.getState();
    expect(state.user).toEqual({ id: 1, email: 'test@example.com' });
    expect(state.token).toBe('test-token');
  });
});
```

## Test Coverage

### Viewing Coverage Reports

After running tests with coverage:

```bash
# Backend
cd api && npm run test:coverage

# Frontend
npm run test:coverage
```

Coverage reports are generated in:
- `api/coverage/` (backend)
- `coverage/` (frontend)

Open `index.html` in your browser to view detailed coverage reports.

### Coverage Goals

- **Critical Paths:** 90%+ coverage
  - Authentication & authorization
  - Input validation
  - Database operations
  - Security-related code

- **Business Logic:** 80%+ coverage
  - API routes
  - State management
  - Data transformations

- **UI Components:** 70%+ coverage
  - Component rendering
  - User interactions
  - Form validations

## Best Practices

### General Principles

1. **Test Behavior, Not Implementation**
   - Focus on what the code does, not how it does it
   - Avoid testing internal implementation details

2. **Arrange-Act-Assert (AAA) Pattern**
   ```typescript
   it('should do something', () => {
     // Arrange: Set up test data
     const input = 'test';

     // Act: Execute the code
     const result = doSomething(input);

     // Assert: Verify the result
     expect(result).toBe('expected');
   });
   ```

3. **Isolation**
   - Each test should be independent
   - Use `beforeEach` to reset state
   - Clean up resources in `afterEach`

4. **Descriptive Test Names**
   ```typescript
   // Good
   it('should reject signup with weak password')

   // Bad
   it('test password validation')
   ```

5. **Test Edge Cases**
   - Empty inputs
   - Null/undefined values
   - Boundary conditions
   - Error scenarios

### Backend-Specific

1. **Use Test Databases**
   - Always use in-memory or test databases
   - Never test against production database

2. **Mock External Dependencies**
   - Mock third-party APIs
   - Mock email services
   - Mock file system operations

3. **Test Security**
   - SQL injection attempts
   - XSS attacks
   - Authentication bypass
   - Authorization checks

### Frontend-Specific

1. **Query by Accessibility**
   ```typescript
   // Good
   screen.getByRole('button', { name: 'Submit' })
   screen.getByLabelText('Email')

   // Avoid
   screen.getByTestId('submit-button')
   ```

2. **Avoid Testing Styles**
   - Focus on functionality, not CSS
   - Test user-visible behavior

3. **Test User Workflows**
   - Test complete user journeys
   - Example: Login → Add Bottle → View Inventory

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: |
          npm install
          cd api && npm install

      - name: Run backend tests
        run: cd api && npm test

      - name: Run frontend tests
        run: npm test

      - name: Generate coverage
        run: npm run test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## Troubleshooting

### Common Issues

#### Tests Timing Out

```typescript
// Increase timeout for specific test
it('should handle slow operation', { timeout: 10000 }, async () => {
  // ...
});
```

#### Database Lock Errors

```typescript
// Ensure databases are properly closed
afterEach(() => {
  if (db) {
    db.close();
  }
});
```

#### Mock Not Working

```typescript
// Mock before importing module
vi.mock('./module', () => ({
  function: vi.fn(),
}));

import { function } from './module';
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Supertest Documentation](https://github.com/ladjs/supertest)

## Contributing

When adding new features:

1. Write tests first (TDD approach)
2. Ensure all tests pass
3. Maintain or improve coverage
4. Update this documentation if needed

## Support

For questions or issues with tests:
- Check this documentation first
- Review existing test examples
- Create an issue with the `testing` label
