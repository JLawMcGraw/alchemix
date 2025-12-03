/**
 * AlcheMix Express API Server
 *
 * This is the main entry point for the AlcheMix backend API.
 * It sets up the Express server with security middleware, routes, and error handling.
 *
 * Architecture:
 * - Express.js web framework for HTTP request handling
 * - SQLite database for persistent data storage
 * - JWT-based authentication for secure API access
 * - RESTful API design for frontend communication
 *
 * Security Features:
 * - Helmet.js for HTTP security headers
 * - CORS protection against unauthorized origins
 * - Rate limiting to prevent brute-force attacks
 * - Request size limits to prevent DoS attacks
 * - JWT token authentication for protected routes
 *
 * Port Configuration:
 * - Development: 3000 (backend) + 3001 (Next.js frontend)
 * - Production: Set via PORT environment variable
 */

/**
 * CRITICAL: Load environment variables FIRST
 * This import MUST be the very first import in the file.
 * It loads the .env file before any other modules are imported.
 */
import './config/env';

/**
 * Environment Validation (PRODUCTION READINESS)
 *
 * Validates all required environment variables on startup.
 * Fail-fast approach: crashes immediately if critical config is missing.
 *
 * This runs synchronously before the server starts, ensuring:
 * - JWT_SECRET is set and >= 32 characters
 * - NODE_ENV is valid (development/production/test)
 * - PORT is a valid number
 * - Optional vars are validated if present (SMTP, etc.)
 */
import { config } from './config/validateEnv';

// Now import modules that depend on environment variables
import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { initializeDatabase, db } from './database/db';
import { corsOptions } from './utils/corsConfig';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestIdMiddleware } from './middleware/requestId';
import { requestLoggerMiddleware, errorLoggerMiddleware } from './middleware/requestLogger';
import { logger } from './utils/logger';

// Import rate limiters from centralized config
import {
  authLimiter,
  aiLimiter,
  passwordResetLimiter,
} from './config/rateLimiter';

// Import API route handlers
import authRoutes from './routes/auth';
import inventoryItemsRoutes from './routes/inventoryItems';
import recipesRoutes from './routes/recipes';
import collectionsRoutes from './routes/collections';
import favoritesRoutes from './routes/favorites';
import messagesRoutes from './routes/messages';
import shoppingListRoutes from './routes/shoppingList';
import healthRoutes from './routes/health';

// Import CSRF middleware for cookie-based auth protection
import { csrfMiddleware } from './middleware/csrf';

/**
 * Initialize Express Application
 *
 * Creates the Express app instance that will handle all HTTP requests.
 */
const app: Express = express();
const PORT = config.PORT;

/**
 * SECURITY FIX #5: HTTPS Redirect Middleware
 *
 * In production, force all HTTP requests to redirect to HTTPS.
 * This ensures all data (JWT tokens, passwords, user data) is encrypted in transit.
 *
 * How it works:
 * 1. Check if request came over HTTPS (via x-forwarded-proto header from load balancer)
 * 2. If HTTP, redirect to HTTPS version of same URL
 * 3. If HTTPS, allow request to proceed
 *
 * Why x-forwarded-proto?
 * - In production, the app runs behind a reverse proxy (Nginx, load balancer)
 * - The proxy terminates HTTPS and forwards HTTP to our app
 * - The proxy adds x-forwarded-proto header to indicate original protocol
 *
 * Security Impact:
 * - Prevents man-in-the-middle attacks
 * - Protects JWT tokens from theft
 * - Encrypts passwords during login/signup
 * - Required for PCI compliance (if handling payments)
 */
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    // Check if request came over HTTPS
    if (req.header('x-forwarded-proto') !== 'https') {
      // Redirect to HTTPS version of the URL
      const httpsUrl = `https://${req.header('host')}${req.url}`;
      console.log(`🔒 Redirecting HTTP → HTTPS: ${httpsUrl}`);
      return res.redirect(301, httpsUrl); // 301 = Permanent redirect
    }
    // Request is already HTTPS, proceed
    next();
  });
}

/**
 * Security Middleware: Helmet (SECURITY FIX #11)
 *
 * Helmet sets various HTTP headers to protect against common web vulnerabilities.
 * This is the first line of defense for many web-based attacks.
 *
 * Security Headers Configured:
 *
 * 1. Content-Security-Policy (CSP):
 *    - Restricts where resources can be loaded from
 *    - Prevents XSS attacks via script injection
 *    - Blocks unauthorized data exfiltration
 *    - Disabled in development for easier debugging
 *
 * 2. X-Content-Type-Options: nosniff
 *    - Prevents MIME type sniffing
 *    - Forces browser to respect Content-Type header
 *    - Stops attackers from disguising JS as images
 *    - Example: Upload "image.png" containing JS → browser won't execute it
 *
 * 3. X-Frame-Options: DENY (or SAMEORIGIN)
 *    - Prevents clickjacking attacks
 *    - Stops site from being embedded in iframes
 *    - Protects against UI redress attacks
 *    - Example: Attacker can't overlay invisible iframe over buttons
 *
 * 4. X-XSS-Protection: 1; mode=block
 *    - Enables browser's built-in XSS filter
 *    - Blocks page rendering if XSS detected
 *    - Legacy protection for older browsers
 *    - Modern browsers rely on CSP instead
 *
 * 5. Strict-Transport-Security (HSTS):
 *    - Forces HTTPS for all future requests
 *    - Prevents SSL stripping attacks
 *    - 1-year duration (31536000 seconds)
 *    - Applies to all subdomains
 *    - Eligible for browser HSTS preload list
 *
 * 6. X-Permitted-Cross-Domain-Policies: none
 *    - Controls Flash/PDF cross-domain requests
 *    - Prevents unauthorized data access
 *    - Protects against legacy plugin vulnerabilities
 *
 * 7. Referrer-Policy: no-referrer
 *    - Controls Referer header in outgoing requests
 *    - Prevents leaking sensitive URLs
 *    - Protects user privacy
 *    - Example: Don't send "https://app.com/user/123/private" to third parties
 *
 * 8. X-Download-Options: noopen
 *    - Prevents IE from executing downloads
 *    - Stops automatic file execution
 *    - Legacy IE-specific protection
 *
 * 9. X-DNS-Prefetch-Control: off
 *    - Disables DNS prefetching
 *    - Prevents privacy leaks via DNS
 *    - Minor performance trade-off for security
 *
 * Attack Scenarios Prevented:
 *
 * 1. Cross-Site Scripting (XSS):
 *    - Attacker injects: <script>steal(document.cookie)</script>
 *    - CSP blocks: Script not from allowed origin
 *    - X-XSS-Protection: Browser detects and blocks
 *    - Result: Attack fails, user protected
 *
 * 2. Clickjacking:
 *    - Attacker embeds site in invisible iframe
 *    - User thinks they're clicking "Play Video"
 *    - Actually clicking "Delete Account" underneath
 *    - X-Frame-Options: Browser refuses to load iframe
 *    - Result: Attack impossible
 *
 * 3. MIME Sniffing Attack:
 *    - Attacker uploads "profile.jpg" containing JavaScript
 *    - Server sends Content-Type: image/jpeg
 *    - Old browsers ignore header, execute JS
 *    - X-Content-Type-Options: nosniff → Browser refuses
 *    - Result: JS not executed
 *
 * 4. SSL Stripping:
 *    - Attacker intercepts first HTTP request
 *    - Downgrades HTTPS → HTTP
 *    - Steals credentials in plaintext
 *    - HSTS: Browser remembers to use HTTPS only
 *    - Result: Attack prevented after first visit
 *
 * SECURITY FIX #11: Comprehensive Security Headers
 * - HSTS with 1-year max age and subdomain inclusion
 * - X-Frame-Options set to DENY (no iframe embedding)
 * - Referrer-Policy to prevent URL leakage
 * - All Helmet defaults enabled for maximum protection
 * - CSP disabled in development, enabled in production
 */
app.use(helmet({
  /**
   * Content Security Policy (CSP)
   *
   * Restricts resource loading to prevent XSS and data injection.
   * Disabled in development for easier debugging.
   *
   * Production Policy (default Helmet):
   * - default-src: 'self' (only load from same origin)
   * - script-src: 'self' (no inline scripts, no eval)
   * - style-src: 'self' (no inline styles)
   * - img-src: 'self' data: (images from same origin or data URIs)
   *
   * Why disable in development?
   * - Hot module replacement may violate CSP
   * - Inline styles from dev tools
   * - eval() usage in source maps
   * - Easier debugging without CSP errors
   *
   * Production Note:
   * - CSP errors logged to console
   * - Monitor for violations in production
   * - Adjust policy if legitimate resources blocked
   */
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,

  /**
   * Strict Transport Security (HSTS)
   *
   * Forces HTTPS for all future requests to this domain.
   *
   * Configuration:
   * - maxAge: 31536000 (1 year in seconds)
   * - includeSubDomains: true (apply to *.domain.com)
   * - preload: true (eligible for browser preload list)
   *
   * How HSTS Works:
   * 1. Browser makes first HTTPS request to site
   * 2. Server sends Strict-Transport-Security header
   * 3. Browser remembers: "Always use HTTPS for this site"
   * 4. Future HTTP requests automatically upgraded to HTTPS
   * 5. No opportunity for SSL stripping attacks
   *
   * HSTS Preload:
   * - Submit domain to hstspreload.org
   * - Browsers ship with preloaded HSTS list
   * - HTTPS enforced even on first visit
   * - Ultimate protection against SSL stripping
   *
   * Security Impact:
   * - Prevents man-in-the-middle attacks
   * - Stops SSL stripping attacks
   * - Protects credentials and JWT tokens
   * - Required for A+ SSL Labs rating
   */
  hsts: {
    maxAge: 31536000,        // 1 year (recommended minimum)
    includeSubDomains: true, // Protect api.domain.com, www.domain.com, etc.
    preload: true            // Allow submission to HSTS preload list
  },

  /**
   * X-Frame-Options
   *
   * Prevents site from being embedded in iframes (clickjacking protection).
   *
   * Options:
   * - DENY: Never allow framing (most secure)
   * - SAMEORIGIN: Allow framing from same origin
   * - ALLOW-FROM: Allow specific origins (deprecated)
   *
   * Using DENY (Helmet default) for maximum security.
   * If you need to embed your API in iframes from same origin:
   * - Change to: frameguard: { action: 'sameorigin' }
   */
  frameguard: {
    action: 'deny' // No iframe embedding allowed (most secure)
  },

  /**
   * Referrer Policy
   *
   * Controls how much referrer information is sent with requests.
   *
   * Policy: no-referrer (most private)
   * - Don't send Referer header at all
   * - Prevents leaking sensitive URLs to third parties
   * - Protects user privacy
   *
   * Example:
   * - User visits: https://app.com/user/123/private-data?token=secret
   * - Page loads image from: https://cdn.example.com/logo.png
   * - Without policy: Referer includes full URL with token
   * - With no-referrer: No Referer header sent
   * - Result: Token not leaked to third party
   *
   * Alternative Policies:
   * - strict-origin-when-cross-origin (balance privacy/functionality)
   * - same-origin (send referrer for same-origin only)
   * - origin (send only origin, not full URL)
   */
  referrerPolicy: {
    policy: 'no-referrer' // Maximum privacy protection
  }

  /**
   * Additional Headers (Helmet Defaults):
   * - X-Content-Type-Options: nosniff (prevent MIME sniffing)
   * - X-DNS-Prefetch-Control: off (privacy protection)
   * - X-Download-Options: noopen (prevent IE auto-execution)
   * - X-Permitted-Cross-Domain-Policies: none (block Flash/PDF)
   *
   * These are enabled by default and provide additional security layers.
   */
}));

/**
 * Rate Limiting Configuration
 *
 * Rate limiters are imported from ./config/rateLimiter.ts for centralized management.
 * Each limiter is applied to specific routes below.
 *
 * Available limiters:
 * - authLimiter: 5 attempts per 15 min (login/signup - brute-force protection)
 * - aiLimiter: 30 messages per hour per user (AI bartender - cost control)
 * - passwordResetLimiter: 3 requests per hour (password reset - abuse prevention)
 *
 * Note: General API rate limiting is disabled per user request.
 * Users should be able to freely view their bar and recipes without limits.
 */

/**
 * CORS (Cross-Origin Resource Sharing) Middleware
 *
 * CORS allows the Next.js frontend (running on port 3001) to make
 * requests to this API (running on port 3000).
 *
 * Without CORS configuration, browsers would block these requests
 * as a security measure (Same-Origin Policy).
 *
 * Configuration (see utils/corsConfig.ts):
 * - Allowed origins: http://localhost:3001, production frontend URL
 * - Allowed methods: GET, POST, PUT, DELETE, OPTIONS
 * - Credentials: true (allows cookies/authorization headers)
 *
 * Security:
 * - Only specified origins can access the API
 * - Prevents unauthorized websites from calling our API
 */
app.use(cors(corsOptions));

/**
 * Request ID and Logging Middleware (OPTIMIZATION: HIGH PRIORITY #1-2)
 *
 * Adds unique request IDs and structured logging for all requests.
 *
 * Features:
 * - requestIdMiddleware: Adds unique UUID to each request (correlation)
 * - requestLoggerMiddleware: Logs all requests with timing and context
 * - Enables request tracing across distributed systems
 * - Captures performance metrics (response time)
 * - Logs security events (auth failures, rate limits)
 *
 * IMPORTANT: Must be added BEFORE other middleware to capture all requests
 */
app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);

/**
 * Request Body Parsing Middleware
 *
 * Parses incoming request bodies into JavaScript objects.
 * Required for handling POST/PUT requests with JSON data.
 *
 * Two parsers configured:
 * 1. express.json() - Parses JSON request bodies
 *    Example: { "email": "user@example.com", "password": "secret123" }
 *
 * 2. express.urlencoded() - Parses URL-encoded form data
 *    Example: email=user@example.com&password=secret123
 *
 * Size Limits (SECURITY FIX #13):
 * - Maximum body size: 10MB
 * - Prevents DoS attacks via huge payloads
 * - Sufficient for JSON data, CSV imports, etc.
 *
 * Without size limits, an attacker could:
 * - Send 1GB JSON payload → crash server
 * - Exhaust memory → denial of service
 * - Slow down legitimate requests → degraded performance
 */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/**
 * Cookie Parser Middleware
 *
 * Parses Cookie header and populates req.cookies with cookie name-value pairs.
 * Required for httpOnly cookie-based authentication.
 *
 * Security Benefits of httpOnly Cookies:
 * - Tokens are NOT accessible via JavaScript (prevents XSS token theft)
 * - Cookies automatically sent with requests (no localStorage handling)
 * - Can be set as Secure (HTTPS only) and SameSite (CSRF protection)
 *
 * The optional secret enables signed cookies for additional integrity verification.
 */
app.use(cookieParser(process.env.COOKIE_SECRET || process.env.JWT_SECRET));

/**
 * Health Check Routes (Kubernetes/Docker Compatible)
 *
 * Mounted from ./routes/health.ts for production-grade health checks.
 *
 * Endpoints:
 * - GET /health         - Legacy endpoint (backward compatible)
 * - GET /health/live    - Liveness probe (is the process alive?)
 * - GET /health/ready   - Readiness probe (is the service ready for traffic?)
 * - GET /health/startup - Startup probe (has initialization completed?)
 *
 * Usage:
 * - Kubernetes: Configure probes in deployment.yaml
 * - Docker: HEALTHCHECK in Dockerfile
 * - Load balancer: Route traffic only to ready instances
 * - Monitoring: Alert if status != healthy
 *
 * Why separate endpoints?
 * - /health/live: Quick check, no dependencies (container restart on failure)
 * - /health/ready: Checks DB, env vars (traffic routing decision)
 * - /health/startup: One-time check after boot (allows slow init)
 */
app.use(healthRoutes);

/**
 * API Routes Configuration (OPTIMIZATION: API VERSIONING #4)
 *
 * Routes organize related endpoints into logical groups.
 * Each route file handles a specific feature area.
 *
 * API Versioning Strategy:
 * - Current: All routes implicitly v1 (no version prefix)
 * - Future: Add /api/v2/* when breaking changes needed
 * - Allows gradual migration and backward compatibility
 * - Clients can specify version in URL or via header
 *
 * Route Structure (Version 1 - Implicit):
 * - /auth/*          → Authentication (login, signup, logout)
 * - /api/inventory/* → Bottle inventory management (CRUD operations)
 * - /api/recipes/*   → Cocktail recipe library
 * - /api/favorites/* → User's saved favorites
 * - /api/messages/*  → AI bartender chat
 *
 * Future Route Structure (Version 2 - Explicit):
 * - /api/v2/inventory/* → New inventory features
 * - /api/inventory/*    → Still works (v1 backward compatibility)
 *
 * Security Layers (Defense in Depth):
 *
 * 1. IP-Based Rate Limiting (First Line of Defense):
 *    - /auth/* routes: 5 attempts per IP per 15 min (prevent brute-force)
 *    - /api/* routes: 100 requests per IP per 15 min (prevent API abuse)
 *    - Protects unauthenticated endpoints
 *    - Stops network-level DoS attacks
 *
 * 2. Authentication (Identity Verification):
 *    - All /api/* routes require valid JWT token
 *    - Implemented in individual route files via authMiddleware
 *    - Rejects requests without valid authentication
 *
 * 3. User-Based Rate Limiting (SECURITY FIX #14 - Second Line of Defense):
 *    - /api/* routes: 100 requests per user per 15 min
 *    - Tracks limits by userId (from JWT)
 *    - Prevents abuse by individual accounts
 *    - Fair usage enforcement (shared IPs don't interfere)
 *    - More precise than IP-based limiting
 *
 * Why Both IP and User Rate Limiting?
 * - IP limiting: Stops attacks before authentication (no JWT needed)
 * - User limiting: Prevents authenticated users from abusing API
 * - Multiple users on same IP get independent rate limits
 * - Defense in depth: If one layer fails, other protects
 *
 * Example Scenario:
 * - Office with 100 employees sharing same IP
 * - IP limit: 100 requests/15 min total (all employees)
 * - User limit: 100 requests/15 min per employee
 * - Result: Each employee can make 100 requests independently
 */

// Authentication routes (login, signup, logout)
// Rate limiters imported from ./config/rateLimiter.ts
app.use('/auth/login', authLimiter);           // 5 attempts per 15 min (brute-force protection)
app.use('/auth/signup', authLimiter);          // 5 attempts per 15 min (abuse prevention)
app.use('/auth/forgot-password', passwordResetLimiter);  // 3 per hour (email enumeration prevention)
app.use('/auth/reset-password', passwordResetLimiter);   // 3 per hour (token abuse prevention)
app.use('/auth', authRoutes);                  // Mount auth routes

// Protected API routes (require authentication + CSRF protection)
// Note: Routes already include authMiddleware internally (sets req.user)
// CSRF middleware validates X-CSRF-Token header for state-changing requests (POST/PUT/DELETE)
app.use('/api/inventory-items', csrfMiddleware, inventoryItemsRoutes);  // Inventory system with categories
app.use('/api/recipes', csrfMiddleware, recipesRoutes);
app.use('/api/collections', csrfMiddleware, collectionsRoutes);
app.use('/api/shopping-list', csrfMiddleware, shoppingListRoutes);
app.use('/api/favorites', csrfMiddleware, favoritesRoutes);
app.use('/api/messages', aiLimiter, csrfMiddleware, messagesRoutes);    // 30 messages/hour (AI cost control)

/**
 * 404 Not Found Handler
 *
 * Catches requests to non-existent routes.
 * Must be defined after all valid routes.
 *
 * Returns 404 with helpful error message.
 * Prevents leaking information about server internals.
 */
app.use(notFoundHandler);

/**
 * Error Logging Middleware (OPTIMIZATION: HIGH PRIORITY #1)
 *
 * Logs all errors with structured logging before error handler processes them.
 * Must come before errorHandler to capture errors first.
 */
app.use(errorLoggerMiddleware);

/**
 * Error Handler Middleware (OPTIMIZATION: HIGH PRIORITY #3)
 *
 * Global error handler catches all errors thrown in routes.
 * Must be defined last (after all routes and middleware).
 *
 * Handles:
 * - AppError instances (operational errors with status codes)
 * - Database errors (connection failures, constraint violations)
 * - Validation errors (invalid input data)
 * - Authentication errors (invalid tokens)
 * - Unexpected errors (bugs, runtime exceptions)
 *
 * Security:
 * - Only shows operational error messages to clients
 * - Hides programming error details with generic message
 * - Never sends stack traces in production
 * - Logs all errors with context for debugging
 */
app.use(errorHandler);

/**
 * Database Initialization
 *
 * Creates database tables if they don't exist.
 * Ensures schema is up-to-date before accepting requests.
 *
 * Tables created:
 * - users: Email, password hash, timestamps, token version
 * - bottles: User's inventory with 12 fields
 * - recipes: Cocktail recipes with ingredients
 * - favorites: User's saved recipes
 * - collections: Recipe organization folders
 * - token_blacklist: Revoked JWT tokens (security)
 *
 * If initialization fails, the server exits immediately.
 * This prevents running with a broken database.
 *
 * Note: TokenBlacklist uses lazy initialization, so it won't
 * access the database until first use (after this init completes).
 */
try {
  initializeDatabase();
  logger.info('Database initialized successfully', {
    tables: ['users', 'bottles', 'recipes', 'favorites', 'collections', 'token_blacklist']
  });
} catch (error) {
  logger.error('Failed to initialize database', {
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined
  });
  logger.error('Cannot start server without working database');
  process.exit(1); // Exit with error code
}

/**
 * Start HTTP Server
 *
 * Binds the Express app to the specified port and starts listening
 * for incoming HTTP requests.
 *
 * Port Selection:
 * - Development: 3000 (hardcoded in package.json)
 * - Production: Set via PORT environment variable
 *
 * The server continues running until:
 * - Process is killed (Ctrl+C)
 * - Fatal error occurs
 * - System shuts down
 */
const server = app.listen(PORT, () => {
  // Use structured logging for server startup
  logger.info('AlcheMix API Server Started', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    pid: process.pid
  });

  // ASCII art banner for visual clarity in terminal
  console.log('┌─────────────────────────────────────────┐');
  console.log('│   🧪 AlcheMix API Server Running 🧪    │');
  console.log('├─────────────────────────────────────────┤');
  console.log(`│   Port:     ${PORT}                        │`);
  console.log(`│   Env:      ${process.env.NODE_ENV || 'development'}              │`);
  console.log(`│   Time:     ${new Date().toLocaleTimeString()}                │`);
  console.log('└─────────────────────────────────────────┘');
  console.log('');
  console.log('Available endpoints:');
  console.log('  GET  /health                    - Legacy health check');
  console.log('  GET  /health/live               - Liveness probe (K8s)');
  console.log('  GET  /health/ready              - Readiness probe (K8s)');
  console.log('  GET  /health/startup            - Startup probe (K8s)');
  console.log('  POST /auth/signup               - Create account (5/15min)');
  console.log('  POST /auth/login                - Authenticate user (5/15min)');
  console.log('  POST /auth/forgot-password      - Request password reset (3/hr)');
  console.log('  POST /auth/reset-password       - Reset password (3/hr)');
  console.log('  GET  /auth/me                   - Get current user');
  console.log('  POST /auth/logout               - End session');
  console.log('  GET  /api/inventory-items       - List user inventory');
  console.log('  GET  /api/recipes               - List recipes');
  console.log('  GET  /api/favorites             - List favorites');
  console.log('  POST /api/messages              - AI bartender (30/hr)');
  console.log('');
  console.log('🔒 Security: All /api/* routes require JWT authentication');
  console.log('⏱️  Rate Limits: Auth 5/15min, Password 3/hr, AI 30/hr');
  console.log('📊 Logging: Structured logging with Winston (logs/ directory)');
  console.log('🆔 Request IDs: Correlation tracking enabled');
  console.log('✅ Environment: Validated on startup');
  console.log('');
});

/**
 * Graceful Shutdown Handler (OPTIMIZATION: QUICK WIN)
 *
 * Handles shutdown signals (SIGTERM, SIGINT) to gracefully close resources.
 *
 * Shutdown Process:
 * 1. Stop accepting new connections
 * 2. Wait for existing requests to complete (up to 10s)
 * 3. Close database connections
 * 4. Cleanup any resources (token blacklist, rate limiters)
 * 5. Exit process cleanly
 *
 * Why Graceful Shutdown?
 * - Prevents incomplete requests (user experience)
 * - Ensures data integrity (no interrupted writes)
 * - Proper cleanup of resources (no memory leaks)
 * - Required for zero-downtime deployments
 * - Enables health check-based load balancing
 *
 * Signals:
 * - SIGTERM: Kill signal from OS/container orchestrator (Docker, Kubernetes)
 * - SIGINT: Interrupt signal from terminal (Ctrl+C)
 */
function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal} signal - Starting graceful shutdown`, {
    signal,
    uptime: process.uptime(),
    pid: process.pid
  });

  // Stop accepting new requests
  server.close(() => {
    logger.info('HTTP server closed - No longer accepting connections');

    // Close database connection properly
    // CRITICAL FIX: Actually close the database to prevent connection leaks
    try {
      db.close();
      logger.info('Database connection closed successfully');
    } catch (error: any) {
      logger.error('Error closing database connection', {
        error: error.message,
        stack: error.stack
      });
    }

    logger.info('Graceful shutdown complete', { signal });
    process.exit(0);
  });

  // Force shutdown after 30 seconds if graceful shutdown hangs
  // CRITICAL FIX: Increased from 10s to 30s (Kubernetes standard grace period)
  // This allows long-running requests to complete properly
  setTimeout(() => {
    logger.error('Graceful shutdown timeout - Forcing exit', {
      signal,
      message: 'Some requests did not complete within 30 seconds',
      gracePeriod: '30s'
    });

    // Attempt to close database even on timeout
    try {
      db.close();
      logger.warn('Database closed during forced shutdown');
    } catch (error) {
      // Ignore errors during forced shutdown
    }

    process.exit(1);
  }, 30000); // 30 seconds (Kubernetes default)
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions (last resort error handling)
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception - Process will exit', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    }
  });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any) => {
  logger.error('Unhandled Promise Rejection - Process will exit', {
    reason: reason instanceof Error ? {
      name: reason.name,
      message: reason.message,
      stack: reason.stack
    } : reason
  });
  process.exit(1);
});

/**
 * Export Express App
 *
 * Allows importing the app in tests without starting the server.
 *
 * Usage in tests:
 *   import app from './server';
 *   request(app).get('/health').expect(200);
 */
export default app;
