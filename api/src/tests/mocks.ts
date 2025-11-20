import { vi } from 'vitest';

/**
 * Common mocks for testing
 */

/**
 * Create a mock token blacklist
 */
export function createMockTokenBlacklist() {
  return {
    add: vi.fn(),
    remove: vi.fn(),
    isBlacklisted: vi.fn().mockReturnValue(false),
    size: vi.fn().mockReturnValue(0),
    cleanup: vi.fn(),
    shutdown: vi.fn(),
  };
}

/**
 * Create a mock Anthropic API response
 */
export function createMockAnthropicResponse(text: string) {
  return {
    data: {
      content: [{ text }],
    },
  };
}

/**
 * Create a mock Anthropic API error
 */
export function createMockAnthropicError(status: number, errorType: string = 'api_error') {
  return {
    response: {
      status,
      data: { error: { type: errorType } },
    },
  };
}

/**
 * Create a mock rate limit error from Anthropic
 */
export function createMockRateLimitError() {
  return createMockAnthropicError(429, 'rate_limit_error');
}

/**
 * Setup axios mock for Anthropic API
 */
export function setupAxiosMock(mockImplementation?: any) {
  const axios = vi.hoisted(() => ({
    post: vi.fn(),
  }));

  vi.mock('axios', () => ({
    default: axios,
  }));

  if (mockImplementation) {
    axios.post.mockImplementation(mockImplementation);
  }

  return axios;
}

/**
 * Mock successful Anthropic API responses for tests
 */
export function mockAnthropicSuccess(axios: any, responseText: string) {
  axios.post.mockResolvedValueOnce(createMockAnthropicResponse(responseText));
}

/**
 * Mock Anthropic API error for tests
 */
export function mockAnthropicError(axios: any, status: number = 500) {
  axios.post.mockRejectedValueOnce(createMockAnthropicError(status));
}

/**
 * Mock Anthropic rate limit error for tests
 */
export function mockAnthropicRateLimit(axios: any) {
  axios.post.mockRejectedValueOnce(createMockRateLimitError());
}

/**
 * Standard database mock setup
 * Returns a function to set the test database instance
 */
export function setupDatabaseMock() {
  let testDb: any;

  const mockDb = vi.hoisted(() => ({
    prepare: (sql: string) => testDb.prepare(sql),
    pragma: (pragma: string, options?: any) => testDb.pragma(pragma, options),
  }));

  vi.mock('../database/db', () => ({
    db: mockDb,
  }));

  return {
    setTestDb: (db: any) => {
      testDb = db;
    },
    mockDb,
  };
}

/**
 * Standard token blacklist mock setup
 */
export function setupTokenBlacklistMock() {
  const mockBlacklist = createMockTokenBlacklist();

  vi.mock('../utils/tokenBlacklist', () => ({
    tokenBlacklist: mockBlacklist,
  }));

  return mockBlacklist;
}

/**
 * Mock console methods to suppress output during tests
 */
export function suppressConsole() {
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
  };

  console.log = vi.fn();
  console.error = vi.fn();
  console.warn = vi.fn();
  console.info = vi.fn();

  return {
    restore: () => {
      console.log = originalConsole.log;
      console.error = originalConsole.error;
      console.warn = originalConsole.warn;
      console.info = originalConsole.info;
    },
  };
}

/**
 * Mock environment variables
 */
export function mockEnv(envVars: Record<string, string>) {
  const originalEnv = { ...process.env };

  Object.assign(process.env, envVars);

  return {
    restore: () => {
      process.env = originalEnv;
    },
  };
}

/**
 * Create a mock Express request
 */
export function createMockRequest(overrides: any = {}) {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    user: null,
    ...overrides,
  };
}

/**
 * Create a mock Express response
 */
export function createMockResponse() {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
  };
  return res;
}

/**
 * Create a mock Express next function
 */
export function createMockNext() {
  return vi.fn();
}
