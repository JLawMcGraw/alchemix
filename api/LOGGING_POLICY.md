# AlcheMix Logging Policy

## Overview
AlcheMix uses a hybrid logging approach that balances developer experience with production requirements.

---

## Backend Logging Standards

### ✅ **Use Winston Logger For:**

1. **Production Errors** (Critical)
   ```typescript
   import { logger } from '../utils/logger';

   try {
     // ... code
   } catch (error) {
     logger.error('Database query failed', {
       error: error.message,
       query: sql,
       userId: req.user?.userId,
       requestId: req.id
     });
   }
   ```

2. **Security Events** (Important)
   ```typescript
   import { logSecurityEvent } from '../utils/logger';

   logSecurityEvent('Failed login attempt', {
     email: credentials.email,
     ip: req.ip,
     requestId: req.id
   });
   ```

3. **Performance Metrics** (Monitoring)
   ```typescript
   import { logMetric } from '../utils/logger';

   logMetric('request_duration', duration, {
     route: req.path,
     method: req.method,
     requestId: req.id
   });
   ```

### ✅ **console.log is OK For:**

1. **Development Debugging** (Temporary)
   ```typescript
   console.log('🔍 DEBUG: Inventory items:', items);  // OK - dev debugging
   console.log('User state:', user);  // OK - will be stripped in production
   ```

2. **Startup Information** (One-time)
   ```typescript
   console.log('🚀 Server starting on port', PORT);  // OK - startup banner
   console.log('✅ Database initialized');  // OK - one-time event
   ```

3. **Migration Scripts** (One-time)
   ```typescript
   console.log('🔄 Migrating bottles table...');  // OK - migration log
   console.log('✅ Migration complete');  // OK - one-time
   ```

---

## Frontend Logging Standards

### ✅ **Use console.log For:**

1. **Development Debugging Only**
   ```typescript
   console.log('User data:', userData);  // Stripped in production build
   console.log('API response:', response);  // Stripped in production build
   ```

### ❌ **Never Use:**

1. **Sensitive Data**
   ```typescript
   console.log('Password:', password);  // ❌ NEVER log passwords
   console.log('Token:', authToken);  // ❌ NEVER log tokens
   console.log('Credit card:', ccNumber);  // ❌ NEVER log PII
   ```

2. **Production Error Handling**
   ```typescript
   // ❌ BAD
   catch (error) {
     console.error(error);  // Lost in production
   }

   // ✅ GOOD
   catch (error) {
     // Handle gracefully, show user-friendly message
     showToast('error', 'Failed to load data');
     // Log to monitoring service if needed
   }
   ```

---

## Configuration

### Backend (Winston)
- **Development:** Logs to console (human-readable) + files (JSON)
- **Production:** Logs to files only (JSON for aggregation)
- **Log Levels:** error, warn, info, debug
- **Log Files:** `logs/error.log`, `logs/combined.log`

### Frontend (Next.js)
- **Development:** All console.* statements visible
- **Production:** console.log/warn/info **stripped** by compiler
- **Kept in Production:** console.error (critical errors only)

---

## Build Configuration

### Next.js (Frontend)
```javascript
// next.config.js
module.exports = {
  compiler: {
    removeConsole: {
      exclude: ['error'],  // Keep console.error in production
    },
  },
};
```

---

## Best Practices

### ✅ DO:
- Use Winston for production errors
- Include requestId for correlation
- Include userId when available
- Use appropriate log levels
- Keep console.log for dev debugging
- Remove console.log before committing (if not needed)

### ❌ DON'T:
- Log sensitive data (passwords, tokens, PII)
- Use console.error for expected errors
- Leave debug console.log in critical paths
- Log entire request/response bodies
- Use console.log for production monitoring

---

## Examples

### Good Error Logging
```typescript
// Backend
try {
  const result = await database.query(sql);
} catch (error) {
  logger.error('Database query failed', {
    error: error.message,
    query: sql.substring(0, 100),  // Truncate for safety
    userId: req.user?.userId,
    requestId: req.id
  });
  throw new DatabaseError('Failed to fetch data');
}
```

### Good Debug Logging
```typescript
// Development debugging (temporary)
console.log('📊 Shopping list stats:', {
  totalRecipes: stats.total,
  craftable: stats.craftable,
  nearMisses: stats.nearMisses
});
```

### Bad Logging
```typescript
// ❌ BAD - Logs sensitive data
console.log('User login:', { email, password });

// ❌ BAD - No context
console.error(error);

// ❌ BAD - Logs entire object (may contain sensitive data)
console.log('Request:', req);
```

---

## Maintenance

- Review and remove unnecessary console.log statements during code review
- Monitor Winston logs in production for errors
- Rotate log files regularly (configured: 5MB max, 5 files)
- Check logs/ directory size periodically

---

Last Updated: 2025-11-22
