/**
 * Health Routes Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock the database
vi.mock('../database/db', () => ({
  db: {
    prepare: vi.fn().mockReturnValue({
      get: vi.fn().mockReturnValue({ ready: 1 }),
    }),
  },
}));

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import healthRouter from './health';
import { db } from '../database/db';

describe('Health Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(healthRouter);

    // Set JWT_SECRET for tests
    process.env.JWT_SECRET = 'test-secret';
  });

  describe('GET /health/live', () => {
    it('should return alive status', async () => {
      const response = await request(app).get('/health/live');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('alive');
      expect(response.body.uptime).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.pid).toBeDefined();
    });

    it('should return uptime as a number', async () => {
      const response = await request(app).get('/health/live');

      expect(typeof response.body.uptime).toBe('number');
      expect(response.body.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should return valid ISO timestamp', async () => {
      const response = await request(app).get('/health/live');

      const timestamp = new Date(response.body.timestamp);
      expect(timestamp.toISOString()).toBe(response.body.timestamp);
    });
  });

  describe('GET /health/ready', () => {
    it('should return ready when all checks pass', async () => {
      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ready');
      expect(response.body.checks).toBeDefined();
      expect(response.body.checks.database.status).toBe('ok');
      expect(response.body.checks.environment.status).toBe('ok');
      expect(response.body.checks.memory.status).toBe('ok');
    });

    it('should return not_ready when database fails', async () => {
      // Mock database failure
      (db.prepare as vi.Mock).mockReturnValue({
        get: vi.fn().mockImplementation(() => {
          throw new Error('Connection failed');
        }),
      });

      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('not_ready');
      expect(response.body.checks.database.status).toBe('failed');
      expect(response.body.checks.database.message).toBe('Connection failed');
    });

    it('should return not_ready when JWT_SECRET is missing', async () => {
      // Remove JWT_SECRET
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      // Restore db mock
      (db.prepare as vi.Mock).mockReturnValue({
        get: vi.fn().mockReturnValue({ ready: 1 }),
      });

      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('not_ready');
      expect(response.body.checks.environment.status).toBe('failed');
      expect(response.body.checks.environment.message).toBe('JWT_SECRET not set');

      // Restore
      process.env.JWT_SECRET = originalSecret;
    });

    it('should include memory usage in response', async () => {
      const response = await request(app).get('/health/ready');

      expect(response.body.checks.memory.value).toBeDefined();
      expect(response.body.checks.memory.value.heapUsedMB).toBeDefined();
      expect(response.body.checks.memory.value.heapTotalMB).toBeDefined();
    });

    it('should handle unexpected database response', async () => {
      (db.prepare as vi.Mock).mockReturnValue({
        get: vi.fn().mockReturnValue({ ready: 0 }),
      });

      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(503);
      expect(response.body.checks.database.status).toBe('failed');
      expect(response.body.checks.database.message).toBe('Unexpected query result');
    });
  });

  describe('GET /health/startup', () => {
    it('should return started status with version info', async () => {
      const response = await request(app).get('/health/startup');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('started');
      expect(response.body.version).toBeDefined();
      expect(response.body.environment).toBeDefined();
      expect(response.body.nodeVersion).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });

    it('should include Node.js version', async () => {
      const response = await request(app).get('/health/startup');

      expect(response.body.nodeVersion).toBe(process.version);
    });
  });

  describe('GET /health', () => {
    it('should return ok status with endpoint info', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.version).toBeDefined();
      expect(response.body.endpoints).toBeDefined();
    });

    it('should list all available health endpoints', async () => {
      const response = await request(app).get('/health');

      expect(response.body.endpoints.liveness).toBe('/health/live');
      expect(response.body.endpoints.readiness).toBe('/health/ready');
      expect(response.body.endpoints.startup).toBe('/health/startup');
    });

    it('should include guidance message', async () => {
      const response = await request(app).get('/health');

      expect(response.body.message).toBe('Use /health/ready for production health checks');
    });
  });
});
