/**
 * AI Bartender Messages Route
 *
 * Handles communication with Anthropic's Claude API for cocktail recommendations.
 * HTTP layer only - delegates AI logic to AIService.
 *
 * SECURITY: Comprehensive AI Prompt Injection Protection
 * - Input validation (type, length, format)
 * - HTML/script sanitization (XSS prevention)
 * - Prompt injection pattern detection
 * - Server-controlled system prompt
 * - Output filtering (sensitive data detection)
 * - Rate limiting (handled by middleware)
 * - Authentication required (JWT validation)
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { userRateLimit } from '../middleware/userRateLimit';
import { sanitizeString } from '../utils/inputValidator';
import { aiService } from '../services/AIService';
import { asyncHandler } from '../utils/asyncHandler';
import { logger, logSecurityEvent } from '../utils/logger';

const router = Router();

/**
 * Dashboard Insight Cache
 *
 * Simple in-memory cache for dashboard insights to reduce AI API calls.
 * - Caches per user for 5 minutes
 * - Saves API costs since dashboard loads frequently
 * - Cleared on inventory/recipe changes (future enhancement)
 */
const DASHBOARD_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const dashboardCache = new Map<number, { data: { greeting: string; insight: string }; expires: number }>();

function getCachedDashboardInsight(userId: number): { greeting: string; insight: string } | null {
  const cached = dashboardCache.get(userId);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }
  // Clean up expired entry
  if (cached) {
    dashboardCache.delete(userId);
  }
  return null;
}

function setCachedDashboardInsight(userId: number, data: { greeting: string; insight: string }): void {
  dashboardCache.set(userId, {
    data,
    expires: Date.now() + DASHBOARD_CACHE_TTL_MS
  });
}

/**
 * Authentication Requirement
 *
 * All AI chat endpoints require valid JWT token.
 * Prevents anonymous abuse and tracks usage per user.
 */
router.use(authMiddleware);
router.use(userRateLimit(20, 15));

/**
 * POST /api/messages - Send Message to AI Bartender
 *
 * Processes user messages with comprehensive security checks before
 * sending to Claude API.
 *
 * Request Body:
 * {
 *   "message": "What cocktails can I make with vodka?",
 *   "history": [{ role: "user", content: "..." }, ...]
 * }
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "data": {
 *     "message": "Here are some great vodka cocktails..."
 *   }
 * }
 *
 * Error Responses:
 * - 400: Invalid input (missing, too long, injection detected)
 * - 401: Unauthorized (no valid JWT token)
 * - 503: AI service not configured (missing API key)
 * - 500: Server error (API call failed)
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { message, history } = req.body;
  const userId = req.user?.userId;

  // SECURITY LAYER 1: Basic Input Validation
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  if (!message || typeof message !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Message is required and must be a string'
    });
  }

  // SECURITY LAYER 2: Length Validation (DoS Prevention)
  if (message.length > 2000) {
    return res.status(400).json({
      success: false,
      error: 'Message too long (maximum 2000 characters)',
      details: `Your message is ${message.length} characters. Please shorten it.`
    });
  }

  // SECURITY LAYER 3: HTML/Script Sanitization (XSS Prevention)
  const sanitizedMessage = sanitizeString(message, 2000, true);
  const sanitizedHistory = aiService.sanitizeHistoryEntries(
    Array.isArray(history) ? history : [],
    userId
  );

  // SECURITY LAYER 4: Prompt Injection Detection
  const injectionCheck = aiService.detectPromptInjection(sanitizedMessage);
  if (injectionCheck.detected) {
    logSecurityEvent('Prompt injection attempt detected', {
      userId,
      pattern: injectionCheck.pattern,
      messageExcerpt: sanitizedMessage.substring(0, 100)
    });

    return res.status(400).json({
      success: false,
      error: 'Message contains prohibited content',
      details: 'Your message appears to contain instructions or patterns that are not allowed. Please rephrase your question about cocktails.'
    });
  }

  // SECURITY LAYER 5-7: Call AI Service (handles API key validation, prompt building, API call)
  try {
    const { response: aiMessage, usage } = await aiService.sendMessage(
      userId,
      sanitizedMessage,
      sanitizedHistory
    );

    // Log usage metrics
    if (usage) {
      const cacheCreation = usage.cache_creation_input_tokens || 0;
      const cacheRead = usage.cache_read_input_tokens || 0;
      const regularInput = usage.input_tokens || 0;
      const outputTokens = usage.output_tokens || 0;

      logger.info('AI Cost Metrics', {
        userId,
        regularInput,
        cacheCreation,
        cacheRead,
        outputTokens,
        cacheHit: cacheRead > 0
      });
    }

    // SECURITY LAYER 8: Output Filtering (Defense in Depth)
    const sensitiveCheck = aiService.detectSensitiveOutput(aiMessage);
    if (sensitiveCheck.detected) {
      logSecurityEvent('AI response contained sensitive data patterns', {
        pattern: sensitiveCheck.pattern,
        userId
      });

      return res.status(500).json({
        success: false,
        error: 'Unable to process request safely',
        details: 'The AI response contained unexpected content. Please try rephrasing your question.'
      });
    }

    res.json({
      success: true,
      data: {
        message: aiMessage
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('not configured')) {
      logger.error('ANTHROPIC_API_KEY not configured or still using placeholder value');
      return res.status(503).json({
        success: false,
        error: 'AI service is not configured. Please update ANTHROPIC_API_KEY on the API server.'
      });
    }

    throw error; // Let asyncHandler deal with other errors
  }
}));

/**
 * GET /api/messages/dashboard-insight - Get Dashboard Greeting & Insight
 *
 * Generates a proactive AI-powered greeting and actionable insight for the dashboard.
 * Uses a specialized prompt to create welcoming messages and helpful suggestions.
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "data": {
 *     "greeting": "The bar is stocked...",
 *     "insight": "With your current bourbon selection..."
 *   }
 * }
 *
 * Error Responses:
 * - 401: Unauthorized (no valid JWT token)
 * - 503: AI service not configured
 * - 500: Server error
 */
router.get('/dashboard-insight', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  // Check cache first (5-minute TTL to reduce AI API calls)
  const cached = getCachedDashboardInsight(userId);
  if (cached) {
    logger.debug('Dashboard insight cache hit', { userId });
    return res.json({
      success: true,
      data: cached,
      cached: true
    });
  }

  try {
    const parsedResponse = await aiService.getDashboardInsight(userId);

    // Cache the response
    setCachedDashboardInsight(userId, parsedResponse);

    res.json({
      success: true,
      data: parsedResponse
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('not configured')) {
      logger.error('ANTHROPIC_API_KEY not configured');
      return res.status(503).json({
        success: false,
        error: 'AI service is not configured'
      });
    }

    throw error;
  }
}));

/**
 * Export AI Messages Router
 *
 * Mounted at /api/messages in server.ts
 * All routes protected by authentication + rate limiting
 */
export default router;
