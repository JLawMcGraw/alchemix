/**
 * Classifications Routes Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock auth middleware
vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn((req, res, next) => {
    req.user = { userId: 1 };
    next();
  }),
}));

// Mock ClassificationService
vi.mock('../services/ClassificationService', () => ({
  default: {
    getAll: vi.fn(),
    getOne: vi.fn(),
    setOverride: vi.fn(),
    deleteOverride: vi.fn(),
    deleteAllOverrides: vi.fn(),
  },
  ClassificationService: {
    getAll: vi.fn(),
    getOne: vi.fn(),
    setOverride: vi.fn(),
    deleteOverride: vi.fn(),
    deleteAllOverrides: vi.fn(),
  },
}));

import classificationsRouter from './classifications';
import ClassificationService from '../services/ClassificationService';
import { authMiddleware } from '../middleware/auth';

describe('Classifications Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/inventory-items', classificationsRouter);

    // Reset auth mock to authenticated user
    (authMiddleware as vi.Mock).mockImplementation((req, res, next) => {
      req.user = { userId: 1 };
      next();
    });
  });

  describe('GET /api/inventory-items/classifications', () => {
    it('should return all overrides for authenticated user', async () => {
      const mockOverrides = [
        { inventoryItemId: 1, group: 2, period: 3, createdAt: '2025-01-01', updatedAt: '2025-01-01' },
        { inventoryItemId: 2, group: 4, period: 5, createdAt: '2025-01-01', updatedAt: '2025-01-01' },
      ];
      (ClassificationService.getAll as vi.Mock).mockReturnValue(mockOverrides);

      const response = await request(app).get('/api/inventory-items/classifications');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.overrides).toEqual(mockOverrides);
      expect(response.body.count).toBe(2);
    });

    it('should return empty array when no overrides', async () => {
      (ClassificationService.getAll as vi.Mock).mockReturnValue([]);

      const response = await request(app).get('/api/inventory-items/classifications');

      expect(response.status).toBe(200);
      expect(response.body.overrides).toEqual([]);
      expect(response.body.count).toBe(0);
    });

    it('should return 401 when not authenticated', async () => {
      (authMiddleware as vi.Mock).mockImplementation((req, res, next) => {
        req.user = undefined;
        next();
      });

      const response = await request(app).get('/api/inventory-items/classifications');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/inventory-items/classifications', () => {
    it('should delete all overrides and return count', async () => {
      (ClassificationService.deleteAllOverrides as vi.Mock).mockReturnValue(5);

      const response = await request(app).delete('/api/inventory-items/classifications');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.deleted).toBe(5);
      expect(response.body.message).toContain('5 items');
    });

    it('should return 0 when no overrides to delete', async () => {
      (ClassificationService.deleteAllOverrides as vi.Mock).mockReturnValue(0);

      const response = await request(app).delete('/api/inventory-items/classifications');

      expect(response.status).toBe(200);
      expect(response.body.deleted).toBe(0);
    });
  });

  describe('GET /api/inventory-items/:id/classification', () => {
    it('should return override when it exists', async () => {
      const mockOverride = {
        inventoryItemId: 1,
        group: 3,
        period: 4,
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
      };
      (ClassificationService.getOne as vi.Mock).mockReturnValue(mockOverride);

      const response = await request(app).get('/api/inventory-items/1/classification');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.override).toEqual(mockOverride);
    });

    it('should return 404 when override does not exist', async () => {
      (ClassificationService.getOne as vi.Mock).mockReturnValue(null);

      const response = await request(app).get('/api/inventory-items/1/classification');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('No classification override found');
    });

    it('should return 400 for invalid item ID', async () => {
      const response = await request(app).get('/api/inventory-items/abc/classification');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid inventory item ID');
    });

    it('should return 400 for negative item ID', async () => {
      const response = await request(app).get('/api/inventory-items/-1/classification');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid inventory item ID');
    });
  });

  describe('PUT /api/inventory-items/:id/classification', () => {
    it('should set classification override', async () => {
      const mockOverride = {
        inventoryItemId: 1,
        group: 3,
        period: 4,
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
      };
      (ClassificationService.setOverride as vi.Mock).mockReturnValue(mockOverride);

      const response = await request(app)
        .put('/api/inventory-items/1/classification')
        .send({ group: 3, period: 4 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.override).toEqual(mockOverride);
      expect(ClassificationService.setOverride).toHaveBeenCalledWith(1, 1, 3, 4);
    });

    it('should return 400 for invalid group (< 1)', async () => {
      const response = await request(app)
        .put('/api/inventory-items/1/classification')
        .send({ group: 0, period: 3 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid group');
    });

    it('should return 400 for invalid group (> 6)', async () => {
      const response = await request(app)
        .put('/api/inventory-items/1/classification')
        .send({ group: 7, period: 3 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid group');
    });

    it('should return 400 for invalid period (< 1)', async () => {
      const response = await request(app)
        .put('/api/inventory-items/1/classification')
        .send({ group: 3, period: 0 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid period');
    });

    it('should return 400 for invalid period (> 6)', async () => {
      const response = await request(app)
        .put('/api/inventory-items/1/classification')
        .send({ group: 3, period: 7 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid period');
    });

    it('should return 400 for non-numeric group', async () => {
      const response = await request(app)
        .put('/api/inventory-items/1/classification')
        .send({ group: 'abc', period: 3 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid group');
    });

    it('should return 400 for non-numeric period', async () => {
      const response = await request(app)
        .put('/api/inventory-items/1/classification')
        .send({ group: 3, period: 'abc' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid period');
    });

    it('should handle service errors', async () => {
      (ClassificationService.setOverride as vi.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .put('/api/inventory-items/1/classification')
        .send({ group: 3, period: 4 });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to save classification');
    });
  });

  describe('DELETE /api/inventory-items/:id/classification', () => {
    it('should delete override and return success', async () => {
      (ClassificationService.deleteOverride as vi.Mock).mockReturnValue(true);

      const response = await request(app).delete('/api/inventory-items/1/classification');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('reverted to auto-classification');
    });

    it('should return 404 when override does not exist', async () => {
      (ClassificationService.deleteOverride as vi.Mock).mockReturnValue(false);

      const response = await request(app).delete('/api/inventory-items/1/classification');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('No classification override found');
    });

    it('should return 400 for invalid item ID', async () => {
      const response = await request(app).delete('/api/inventory-items/abc/classification');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid inventory item ID');
    });
  });
});
