/**
 * Classifications Routes (Periodic Table of Mixology V2)
 *
 * Handles HTTP layer for inventory item classification overrides.
 * Business logic delegated to ClassificationService.
 *
 * Endpoints:
 * - GET  /api/inventory-items/classifications       - Get user's classification overrides
 * - GET  /api/inventory-items/:id/classification    - Get single item classification
 * - PUT  /api/inventory-items/:id/classification    - Set/update classification override
 * - DELETE /api/inventory-items/:id/classification  - Delete override (revert to auto)
 * - DELETE /api/inventory-items/classifications     - Delete all overrides (bulk reset)
 *
 * Security:
 * - All routes require JWT authentication (authMiddleware)
 * - User isolation: Can only access their own classification overrides
 * - Input validation: Group/Period must be 1-6
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { validateNumber } from '../utils/inputValidator';
import ClassificationService from '../services/ClassificationService';
import type { MixologyGroup, MixologyPeriod } from '../types/periodicTable';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /api/inventory-items/classifications
 *
 * Get all classification overrides for the authenticated user.
 *
 * Response:
 * - 200: { success: true, overrides: ClassificationOverride[] }
 * - 401: Unauthorized
 */
router.get(
  '/classifications',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const overrides = ClassificationService.getAll(userId);

    return res.json({
      success: true,
      overrides,
      count: overrides.length,
    });
  })
);

/**
 * DELETE /api/inventory-items/classifications
 *
 * Delete all classification overrides for the authenticated user.
 * Reverts all items to auto-classification.
 *
 * Response:
 * - 200: { success: true, deleted: number }
 * - 401: Unauthorized
 */
router.delete(
  '/classifications',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const deletedCount = ClassificationService.deleteAllOverrides(userId);

    return res.json({
      success: true,
      deleted: deletedCount,
      message: `Reverted ${deletedCount} items to auto-classification`,
    });
  })
);

/**
 * GET /api/inventory-items/:id/classification
 *
 * Get classification override for a specific inventory item.
 *
 * Response:
 * - 200: { success: true, override: ClassificationOverride }
 * - 401: Unauthorized
 * - 404: No override found (item uses auto-classification)
 */
router.get(
  '/:id/classification',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    // Validate item ID
    const idValidation = validateNumber(req.params.id, 1, undefined);
    if (!idValidation.isValid || !idValidation.sanitized) {
      return res.status(400).json({
        success: false,
        error: 'Invalid inventory item ID',
        details: idValidation.errors,
      });
    }

    const inventoryItemId = idValidation.sanitized;
    const override = ClassificationService.getOne(userId, inventoryItemId);

    if (!override) {
      return res.status(404).json({
        success: false,
        error: 'No classification override found',
        message: 'Item uses auto-classification',
      });
    }

    return res.json({
      success: true,
      override,
    });
  })
);

/**
 * PUT /api/inventory-items/:id/classification
 *
 * Set or update classification override for an inventory item.
 *
 * Body:
 * - group: number (1-6) - Functional role column
 * - period: number (1-6) - Origin/source row
 *
 * Response:
 * - 200: { success: true, override: ClassificationOverride }
 * - 400: Invalid group/period
 * - 401: Unauthorized
 */
router.put(
  '/:id/classification',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    // Validate item ID
    const idValidation = validateNumber(req.params.id, 1, undefined);
    if (!idValidation.isValid || !idValidation.sanitized) {
      return res.status(400).json({
        success: false,
        error: 'Invalid inventory item ID',
        details: idValidation.errors,
      });
    }

    const inventoryItemId = idValidation.sanitized;

    // Validate group (1-6)
    const { group, period } = req.body;

    if (typeof group !== 'number' || group < 1 || group > 6) {
      return res.status(400).json({
        success: false,
        error: 'Invalid group',
        message: 'Group must be a number between 1 and 6',
        received: group,
      });
    }

    if (typeof period !== 'number' || period < 1 || period > 6) {
      return res.status(400).json({
        success: false,
        error: 'Invalid period',
        message: 'Period must be a number between 1 and 6',
        received: period,
      });
    }

    try {
      const override = ClassificationService.setOverride(
        userId,
        inventoryItemId,
        group as MixologyGroup,
        period as MixologyPeriod
      );

      return res.json({
        success: true,
        override,
        message: 'Classification override saved',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return res.status(500).json({
        success: false,
        error: 'Failed to save classification',
        message,
      });
    }
  })
);

/**
 * DELETE /api/inventory-items/:id/classification
 *
 * Delete classification override for an inventory item.
 * Reverts the item to auto-classification.
 *
 * Response:
 * - 200: { success: true }
 * - 401: Unauthorized
 * - 404: No override found
 */
router.delete(
  '/:id/classification',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    // Validate item ID
    const idValidation = validateNumber(req.params.id, 1, undefined);
    if (!idValidation.isValid || !idValidation.sanitized) {
      return res.status(400).json({
        success: false,
        error: 'Invalid inventory item ID',
        details: idValidation.errors,
      });
    }

    const inventoryItemId = idValidation.sanitized;
    const deleted = ClassificationService.deleteOverride(userId, inventoryItemId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'No classification override found',
        message: 'Item was already using auto-classification',
      });
    }

    return res.json({
      success: true,
      message: 'Classification override removed, reverted to auto-classification',
    });
  })
);

export default router;
