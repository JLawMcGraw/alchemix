import { queryOne, queryAll, execute } from '../database/db';
import { logger } from './logger';

/**
 * Token Blacklist System
 *
 * SECURITY FIX #7: Database-backed token revocation for immediate logout.
 *
 * Purpose:
 * - Immediately invalidate JWT tokens on logout
 * - Revoke tokens on security events (password change, suspicious activity)
 * - Prevent token replay attacks after logout
 * - Enable forced logout (admin/security features)
 *
 * Implementation: PostgreSQL Database + In-Memory Cache
 * - Database stores blacklisted tokens persistently
 * - In-memory Map provides fast lookup cache
 * - Automatic cleanup of expired tokens
 */

/**
 * Maximum number of tokens allowed in the in-memory blacklist cache.
 * Prevents memory exhaustion attacks where attacker repeatedly logs out.
 * Database persistence ensures tokens are still checked even if evicted from cache.
 */
const MAX_BLACKLIST_CACHE_SIZE = 10000;

class TokenBlacklist {
  /**
   * Blacklist Storage (In-Memory Cache)
   * Map structure:
   * - Key: JWT token string (full token)
   * - Value: Expiry timestamp (Unix timestamp in seconds)
   */
  private blacklist: Map<string, number>;

  /**
   * Cleanup Interval Timer
   */
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.blacklist = new Map();

    // Start cleanup task (runs every 15 minutes)
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 15 * 60 * 1000);

    // Load existing blacklisted tokens from database
    this.loadFromDatabase();

    logger.info('Token blacklist initialized', { cleanupInterval: '15 minutes' });
  }

  /**
   * Load persisted blacklist entries from database on startup.
   */
  private async loadFromDatabase(): Promise<void> {
    try {
      const now = Math.floor(Date.now() / 1000);
      const rows = await queryAll<{ token: string; expires_at: number }>(
        'SELECT token, expires_at FROM token_blacklist WHERE expires_at > $1',
        [now]
      );

      for (const row of rows) {
        this.blacklist.set(row.token, row.expires_at);
      }

      // Clean up expired entries
      await execute('DELETE FROM token_blacklist WHERE expires_at <= $1', [now]);

      logger.debug('Token blacklist loaded from database', { count: rows.length });
    } catch (error) {
      logger.error('Failed to load token blacklist from database', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Add Token to Blacklist
   */
  async add(token: string, expiryTimestamp: number): Promise<void> {
    // Enforce cache size limit
    if (this.blacklist.size >= MAX_BLACKLIST_CACHE_SIZE) {
      await this.cleanup();

      // If still at limit, evict oldest entries from cache
      if (this.blacklist.size >= MAX_BLACKLIST_CACHE_SIZE) {
        const entriesToRemove = Math.floor(MAX_BLACKLIST_CACHE_SIZE * 0.1);
        const entries = Array.from(this.blacklist.entries())
          .sort((a, b) => a[1] - b[1])
          .slice(0, entriesToRemove);

        for (const [oldToken] of entries) {
          this.blacklist.delete(oldToken);
        }
        logger.warn('Token blacklist cache at limit, evicted oldest entries', { evictedCount: entriesToRemove });
      }
    }

    this.blacklist.set(token, expiryTimestamp);

    try {
      await execute(
        'INSERT INTO token_blacklist (token, expires_at) VALUES ($1, $2) ON CONFLICT (token) DO UPDATE SET expires_at = $2',
        [token, expiryTimestamp]
      );
      logger.debug('Token blacklisted', { expiresAt: new Date(expiryTimestamp * 1000).toISOString() });
    } catch (error) {
      logger.error('Failed to persist blacklisted token', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Check if Token is Blacklisted
   */
  async isBlacklisted(token: string): Promise<boolean> {
    const now = Math.floor(Date.now() / 1000);
    const cachedExpiry = this.blacklist.get(token);

    if (cachedExpiry) {
      if (cachedExpiry < now) {
        this.blacklist.delete(token);
        // Async cleanup - don't await
        execute('DELETE FROM token_blacklist WHERE token = $1', [token]).catch(() => {});
        return false;
      }
      return true;
    }

    // Check database
    try {
      const row = await queryOne<{ expires_at: number }>(
        'SELECT expires_at FROM token_blacklist WHERE token = $1',
        [token]
      );

      if (!row) {
        return false;
      }

      if (row.expires_at < now) {
        await execute('DELETE FROM token_blacklist WHERE token = $1', [token]);
        return false;
      }

      // Cache the result
      this.blacklist.set(token, row.expires_at);
      return true;
    } catch (error) {
      logger.error('Failed to check token blacklist', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Remove Expired Tokens (Cleanup)
   */
  private async cleanup(): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    let removedCount = 0;

    // Clean in-memory cache
    for (const [token, expiryTimestamp] of this.blacklist.entries()) {
      if (expiryTimestamp < now) {
        this.blacklist.delete(token);
        removedCount++;
      }
    }

    // Clean database
    try {
      const result = await execute('DELETE FROM token_blacklist WHERE expires_at < $1', [now]);
      const dbCleanup = result.rowCount ?? 0;

      if (removedCount > 0 || dbCleanup > 0) {
        logger.debug('Token blacklist cleanup completed', {
          removedCount: removedCount + dbCleanup,
          remainingSize: this.blacklist.size
        });
      }
    } catch (error) {
      logger.error('Failed to cleanup token blacklist', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get Blacklist Size
   */
  size(): number {
    return this.blacklist.size;
  }

  /**
   * Graceful Shutdown
   */
  shutdown(): void {
    clearInterval(this.cleanupInterval);
    logger.info('Token blacklist shutdown complete');
  }
}

/**
 * Export Singleton Instance (LAZY INITIALIZATION)
 */
let _tokenBlacklistInstance: TokenBlacklist | null = null;

function getTokenBlacklistInstance(): TokenBlacklist {
  if (!_tokenBlacklistInstance) {
    _tokenBlacklistInstance = new TokenBlacklist();
  }
  return _tokenBlacklistInstance;
}

// Export object with delegating methods (backwards compatible API)
export const tokenBlacklist = {
  async add(token: string, expiresAt: number): Promise<void> {
    return getTokenBlacklistInstance().add(token, expiresAt);
  },
  async isBlacklisted(token: string): Promise<boolean> {
    return getTokenBlacklistInstance().isBlacklisted(token);
  },
  size(): number {
    return getTokenBlacklistInstance().size();
  },
  shutdown(): void {
    return getTokenBlacklistInstance().shutdown();
  }
};
