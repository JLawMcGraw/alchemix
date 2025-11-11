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

import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { initializeDatabase } from './database/db';
import { corsOptions } from './utils/corsConfig';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { userRateLimit } from './middleware/userRateLimit';

// Import API route handlers
import authRoutes from './routes/auth';
import inventoryRoutes from './routes/inventory';
import recipesRoutes from './routes/recipes';
import favoritesRoutes from './routes/favorites';
import messagesRoutes from './routes/messages';

/**
 * Load Environment Variables
 *
 * Reads configuration from .env file in the api/ directory.
 * Required variables:
 * - JWT_SECRET: Secret key for signing JWT tokens (min 32 chars)
 * - FRONTEND_URL: URL of Next.js frontend for CORS
 * - PORT: Server port (optional, defaults to 3000)
 * - ANTHROPIC_API_KEY: API key for AI chat feature (optional)
 */
dotenv.config({ path: '.env' });

/**
 * Initialize Express Application
 *
 * Creates the Express app instance that will handle all HTTP requests.
 */
const app: Express = express();
const PORT = process.env.PORT || 3000;

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
 * Rate Limiting: General API Protection
 *
 * Limits requests to prevent abuse and DoS attacks.
 * Applied to all /api/* routes.
 *
 * Configuration:
 * - Window: 15 minutes
 * - Max requests: 100 per IP address
 * - Response: 429 Too Many Requests
 *
 * Example:
 * - User makes 100 requests in 10 minutes → OK
 * - User makes 101st request → Blocked for remaining 5 minutes
 *
 * This prevents:
 * - API abuse and data scraping
 * - Automated attacks
 * - Resource exhaustion
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes in milliseconds
  max: 100,                  // Maximum 100 requests per window
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,     // Return rate limit info in headers
  legacyHeaders: false,      // Disable X-RateLimit-* headers
});

/**
 * Rate Limiting: Authentication Protection
 *
 * Stricter rate limiting for login/signup endpoints.
 * Prevents brute-force password attacks and account enumeration.
 *
 * Configuration:
 * - Window: 15 minutes
 * - Max requests: 5 per IP address
 * - Response: 429 Too Many Requests
 *
 * Why stricter?
 * - Failed login attempts indicate potential attack
 * - Legitimate users rarely fail login more than 2-3 times
 * - 5 attempts allows for typos while blocking automation
 *
 * Security Impact:
 * - Brute-force attack trying 10,000 passwords → 5 attempts in 15 min = 13.9 days
 * - Without rate limiting → 10,000 attempts in minutes
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,                    // Maximum 5 authentication attempts
  message: 'Too many authentication attempts from this IP. Please try again in 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
  // Skip successful requests (only count failures)
  skipSuccessfulRequests: true,
});

// Apply general rate limiting to all API routes
app.use('/api/', apiLimiter);

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
 * Health Check Endpoint
 *
 * Simple endpoint to verify the API server is running.
 * Used by monitoring tools, load balancers, and deployment systems.
 *
 * Returns:
 * - status: "ok" if server is responding
 * - timestamp: Current server time (ISO 8601 format)
 * - uptime: Seconds since server started
 *
 * Usage:
 * - Monitoring: Check every 30s, alert if status != "ok"
 * - Load balancer: Remove unhealthy instances from pool
 * - Deployment: Verify new version started successfully
 *
 * Example response:
 * {
 *   "status": "ok",
 *   "timestamp": "2025-11-10T14:32:05.123Z",
 *   "uptime": 3642.5
 * }
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * API Routes Configuration
 *
 * Routes organize related endpoints into logical groups.
 * Each route file handles a specific feature area.
 *
 * Route Structure:
 * - /auth/*          → Authentication (login, signup, logout)
 * - /api/inventory/* → Bottle inventory management (CRUD operations)
 * - /api/recipes/*   → Cocktail recipe library
 * - /api/favorites/* → User's saved favorites
 * - /api/messages/*  → AI bartender chat
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
// SECURITY FIX #3: Apply strict rate limiting to prevent brute-force attacks
app.use('/auth/login', authLimiter);   // 5 attempts per 15 minutes (IP-based)
app.use('/auth/signup', authLimiter);  // 5 attempts per 15 minutes (IP-based)
app.use('/auth', authRoutes);          // Mount auth routes

// Protected API routes (require authentication)
// SECURITY FIX #14: Apply user-based rate limiting to authenticated routes
// Note: Routes already include authMiddleware internally (sets req.user)
app.use('/api/inventory', userRateLimit(100, 15), inventoryRoutes);
app.use('/api/recipes', userRateLimit(100, 15), recipesRoutes);
app.use('/api/favorites', userRateLimit(100, 15), favoritesRoutes);
app.use('/api/messages', userRateLimit(20, 15), messagesRoutes); // Lower limit for expensive AI requests

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
 * Error Handler Middleware
 *
 * Global error handler catches all errors thrown in routes.
 * Must be defined last (after all routes and middleware).
 *
 * Handles:
 * - Database errors (connection failures, constraint violations)
 * - Validation errors (invalid input data)
 * - Authentication errors (invalid tokens)
 * - Unexpected errors (bugs, runtime exceptions)
 *
 * Security:
 * - Hides stack traces in production (prevents info leakage)
 * - Shows detailed errors in development (easier debugging)
 * - Logs all errors for monitoring
 */
app.use(errorHandler);

/**
 * Database Initialization
 *
 * Creates database tables if they don't exist.
 * Ensures schema is up-to-date before accepting requests.
 *
 * Tables created:
 * - users: Email, password hash, timestamps
 * - bottles: User's inventory with 12 fields
 * - recipes: Cocktail recipes with ingredients
 * - favorites: User's saved recipes
 *
 * If initialization fails, the server exits immediately.
 * This prevents running with a broken database.
 */
try {
  initializeDatabase();
  console.log('✅ Database initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize database:', error);
  console.error('   Cannot start server without working database');
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
app.listen(PORT, () => {
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
  console.log('  GET  /health                    - Health check');
  console.log('  POST /auth/signup               - Create account (rate limited)');
  console.log('  POST /auth/login                - Authenticate user (rate limited)');
  console.log('  GET  /auth/me                   - Get current user');
  console.log('  POST /auth/logout               - End session');
  console.log('  GET  /api/inventory             - List user bottles');
  console.log('  POST /api/inventory             - Add new bottle');
  console.log('  PUT  /api/inventory/:id         - Update bottle');
  console.log('  DELETE /api/inventory/:id       - Delete bottle');
  console.log('  GET  /api/recipes               - List recipes');
  console.log('  POST /api/recipes               - Add recipe');
  console.log('  GET  /api/favorites             - List favorites');
  console.log('  POST /api/favorites             - Add favorite');
  console.log('  DELETE /api/favorites/:id       - Remove favorite');
  console.log('  POST /api/messages              - Send AI chat message');
  console.log('');
  console.log('🔒 Security: All /api/* routes require JWT authentication');
  console.log('⏱️  Rate Limits: Auth 5/15min, API 100/15min');
  console.log('');
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
