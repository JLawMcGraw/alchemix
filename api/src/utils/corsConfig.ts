/**
 * CORS (Cross-Origin Resource Sharing) Configuration
 *
 * CORS is a security feature that controls which websites can access this API.
 * Without proper CORS configuration, browsers would block all requests from
 * the Next.js frontend (different port = different origin).
 *
 * How CORS Works:
 * 1. Browser makes request to API from frontend (port 3001)
 * 2. Browser checks if API allows requests from that origin
 * 3. If allowed: Request proceeds normally
 * 4. If blocked: Browser throws CORS error
 *
 * Security Benefits:
 * - Prevents unauthorized websites from using our API
 * - Protects users from CSRF (Cross-Site Request Forgery) attacks
 * - Ensures only our frontend can access user data
 *
 * Development vs Production:
 * - Dev: Allow localhost:3001 (Next.js dev server)
 * - Prod: Allow only deployed frontend URL (e.g., https://alchemix.com)
 */

import { CorsOptions } from 'cors';

/**
 * Allowed Origins List
 *
 * These are the only websites allowed to make requests to this API.
 * Any request from a different origin will be rejected.
 *
 * Origins included:
 * - http://localhost:3001: Local Next.js dev server (default port)
 * - http://localhost:3000: Alternative local port (if needed)
 * - process.env.FRONTEND_URL: Production frontend URL (set in .env)
 *
 * The filter(Boolean) removes undefined values (e.g., if FRONTEND_URL not set)
 */
const allowedOrigins = [
  'http://localhost:3001',   // Local Next.js development server
  'http://localhost:3000',   // Alternative local port
  process.env.FRONTEND_URL,  // Production frontend URL from environment
].filter(Boolean) as string[];

/**
 * CORS Options Configuration
 *
 * Defines the CORS policy for the API.
 */
export const corsOptions: CorsOptions = {
  /**
   * Origin Validation Function
   *
   * Called for every incoming request to determine if it should be allowed.
   *
   * SECURITY FIX #4: Improved null origin handling
   * - Development: Allow null origin (for tools like Postman, curl)
   * - Production: Reject null origin (prevents file:// protocol attacks)
   *
   * @param origin - The origin of the incoming request (e.g., "http://localhost:3001")
   * @param callback - Function to call with decision: callback(error, allow)
   */
  origin: function (origin, callback) {
    /**
     * Handle Requests Without Origin Header
     *
     * Requests without an Origin header include:
     * - Server-to-server requests
     * - Mobile apps (native, not web)
     * - Development tools (Postman, curl)
     * - File-based attacks (file:/// protocol)
     *
     * Security Trade-off:
     * - Allow in development: Convenient for testing with tools
     * - Block in production: Prevents file-based and extension attacks
     */
    if (!origin) {
      // In production, require an origin header for security
      if (process.env.NODE_ENV === 'production') {
        console.warn('⚠️  CORS: Rejected request with no origin header (production mode)');
        return callback(new Error('Origin header required in production'));
      }

      // In development, allow for easier testing with curl/Postman
      console.log('✓ CORS: Allowed request with no origin header (development mode)');
      return callback(null, true);
    }

    /**
     * Check if Origin is in Allowed List
     *
     * Compare the request origin against our whitelist.
     */
    if (allowedOrigins.indexOf(origin) !== -1) {
      // Origin is allowed - proceed with request
      console.log(`✓ CORS: Allowed request from ${origin}`);
      callback(null, true);
    } else {
      // Origin is not allowed - block request
      console.warn(`❌ CORS: Blocked request from unauthorized origin: ${origin}`);
      console.warn(`   Allowed origins: ${allowedOrigins.join(', ')}`);
      callback(new Error('Not allowed by CORS'));
    }
  },

  /**
   * Credentials Support
   *
   * Allow cookies and authorization headers to be sent with requests.
   *
   * When true:
   * - Frontend can send Authorization: Bearer <token> headers
   * - Cookies are included in cross-origin requests
   * - Required for JWT authentication
   *
   * Security Note:
   * - Must be combined with specific origin (can't use wildcard *)
   * - Our config correctly specifies exact origins
   */
  credentials: true,

  /**
   * Allowed HTTP Methods
   *
   * Specifies which HTTP verbs can be used in cross-origin requests.
   *
   * - GET: Read data (list bottles, recipes, etc.)
   * - POST: Create data (add bottle, signup, login)
   * - PUT: Update data (edit bottle)
   * - DELETE: Remove data (delete bottle, remove favorite)
   * - OPTIONS: Preflight check (browser automatically sends before actual request)
   */
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],

  /**
   * Allowed Request Headers
   *
   * Specifies which headers the frontend can include in requests.
   *
   * - Content-Type: Indicates request body format (application/json)
   * - Authorization: Contains JWT token (Bearer eyJhbGci...)
   *
   * Browsers will reject requests with headers not in this list.
   */
  allowedHeaders: ['Content-Type', 'Authorization']
};
