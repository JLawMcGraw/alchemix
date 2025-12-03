/**
 * Health Check Routes
 *
 * Kubernetes/Docker-compatible health check endpoints for container orchestration.
 *
 * Endpoints:
 * - GET /health/live   - Liveness probe (is the process alive?)
 * - GET /health/ready  - Readiness probe (is the service ready for traffic?)
 * - GET /health/startup - Startup probe (has initialization completed?)
 * - GET /health        - Backward compatibility endpoint
 *
 * @version 1.0.0
 * @date December 2025
 */

import { Router, Request, Response } from 'express';
import { db } from '../database/db';

const router = Router();

/**
 * Application version (should match package.json)
 */
const APP_VERSION = '1.20.0';

/**
 * Liveness Probe - GET /health/live
 *
 * Used by: Kubernetes/Docker to detect dead containers
 *
 * Purpose: Check if the process is alive and responding.
 * Should be lightweight with no external dependencies.
 *
 * Response: Always 200 if the process can respond
 * Failure: Container restart
 */
router.get('/health/live', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    pid: process.pid,
  });
});

/**
 * Readiness Probe - GET /health/ready
 *
 * Used by: Load balancers to route traffic
 *
 * Purpose: Check if the service is ready to accept traffic.
 * Checks all critical dependencies (database, required env vars).
 *
 * Response: 200 if ready, 503 if not ready
 * Failure: Traffic routed away from this instance
 */
router.get('/health/ready', (req: Request, res: Response) => {
  const checks: Record<string, { status: string; message?: string; value?: any }> = {};

  try {
    // Check 1: Database connectivity
    try {
      const dbCheck = db.prepare('SELECT 1 as ready').get() as { ready: number } | undefined;
      if (dbCheck?.ready === 1) {
        checks.database = { status: 'ok' };
      } else {
        checks.database = { status: 'failed', message: 'Unexpected query result' };
      }
    } catch (dbError: any) {
      checks.database = { status: 'failed', message: dbError.message };
    }

    // Check 2: Required environment variables
    if (process.env.JWT_SECRET) {
      checks.environment = { status: 'ok' };
    } else {
      checks.environment = { status: 'failed', message: 'JWT_SECRET not set' };
    }

    // Check 3: Memory usage (warn if heap > 512MB)
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);

    if (heapUsedMB < 512) {
      checks.memory = {
        status: 'ok',
        value: { heapUsedMB, heapTotalMB },
      };
    } else {
      checks.memory = {
        status: 'warning',
        message: 'High memory usage',
        value: { heapUsedMB, heapTotalMB },
      };
    }

    // Determine overall status
    const failedChecks = Object.values(checks).filter(c => c.status === 'failed');

    if (failedChecks.length > 0) {
      res.status(503).json({
        status: 'not_ready',
        checks,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.status(200).json({
      status: 'ready',
      checks,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Startup Probe - GET /health/startup
 *
 * Used by: Kubernetes to know when to start routing traffic after boot
 *
 * Purpose: Indicate that the application has completed initialization.
 * Takes longer than liveness/readiness probes.
 *
 * Response: 200 with version and environment info
 */
router.get('/health/startup', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'started',
    version: APP_VERSION,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Legacy Health Endpoint - GET /health
 *
 * Backward compatibility endpoint.
 * Redirects users to use the new specific endpoints.
 */
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    version: APP_VERSION,
    endpoints: {
      liveness: '/health/live',
      readiness: '/health/ready',
      startup: '/health/startup',
    },
    message: 'Use /health/ready for production health checks',
  });
});

export default router;
