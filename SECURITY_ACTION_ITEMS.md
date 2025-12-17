# 🔐 Security Action Items

## Quick Reference

| Priority | Item | Phase | Effort | Status |
|----------|------|-------|--------|--------|
| 🚨 High | Remove debug console.log from API routes | 2 | 15 min | ⏳ TODO |
| 🚨 High | Implement rate limiting on login & API | 2 | 4-6 hours | ⏳ TODO |
| 🚨 High | Add CORS validation | 2 | 1-2 hours | ⏳ TODO |
| 📌 Medium | Centralize logging/audit system | 3 | 4-8 hours | ⏳ TODO |
| 📌 Medium | Set up error tracking (Sentry) | 3 | 2-3 hours | ⏳ TODO |
| 📋 Low | Two-factor authentication | 4 | 8-12 hours | ⏳ TODO |

---

## Phase 2: Critical Security Fixes

### 1. Remove Debug Logs (15 min)

**Files to fix:**
```
src/app/api/customers/[id]/route.ts (lines 6-27, 39-68)
src/app/dashboard/operasional/assign-order/success/page.tsx (lines 24, 25, 44-46)
src/app/dashboard/operasional/assign-order/page.tsx (lines 132, 143, 161)
src/app/dashboard/manajemen/customer/page.tsx (lines 160, 163, 170, 188, 217, 224, 243)
src/app/dashboard/operasional/accept-order/page.tsx (line 132)
```

**Replace with:**
```typescript
// Option 1: Environment-gated (recommended)
if (process.env.NODE_ENV === 'development') {
  console.log('Debug info:', data)
}

// Option 2: Remove entirely (best for production)
// Delete the console.log line
```

---

### 2. Implement Rate Limiting (4-6 hours)

**Install package:**
```bash
npm install redis @upstash/redis
```

**Apply to endpoints:**
```typescript
// src/app/api/middleware/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 requests per minute
})

export async function checkRateLimit(userId: string) {
  const { success } = await ratelimit.limit(userId)
  return success
}
```

**Apply to:**
- POST `/api/orders/create` - 5 per minute
- POST `/api/customers` - 5 per minute  
- POST `/api/orders/[id]/status` - 10 per minute
- GET `/api/orders` - 30 per minute

**For login page:**
```typescript
// src/app/(auth)/login/page.tsx
// Limit by IP: 5 failed attempts per 15 minutes
// Lockout period: 15 minutes after 5 failures
```

---

### 3. Add CORS Validation (1-2 hours)

**Create middleware:**
```typescript
// src/app/api/middleware/cors.ts
export function validateOrigin(request: NextRequest) {
  const origin = request.headers.get('origin')
  const allowedOrigins = [
    'https://yourdomain.com',
    'https://app.yourdomain.com',
    'http://localhost:3000', // dev only
  ]
  
  const isAllowed = allowedOrigins.includes(origin || '')
  
  if (!isAllowed && origin) {
    return new NextResponse('Forbidden', { status: 403 })
  }
  
  return null // Allow request
}
```

**Apply to all API routes:**
```typescript
export async function POST(request: NextRequest) {
  // Check CORS first
  const corsError = validateOrigin(request)
  if (corsError) return corsError
  
  // ... rest of handler
}
```

---

## Phase 3: Operational Security

### 1. Centralized Logging (4-8 hours)

**Create logging utility:**
```typescript
// src/lib/logger.ts
export const logger = {
  debug: (msg: string, data?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] ${msg}`, data)
    }
  },
  
  error: (msg: string, error: any) => {
    console.error(`[ERROR] ${msg}`, error)
    // Send to error tracking service
  },
  
  audit: async (action: string, userId: string, details: any) => {
    // Log to database
    const supabase = createAdminClient()
    await supabase.from('audit_logs').insert({
      action,
      user_id: userId,
      details,
      timestamp: new Date().toISOString(),
    })
  },
  
  api: (method: string, path: string, status: number, duration: number) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API] ${method} ${path} ${status} ${duration}ms`)
    }
  },
}
```

**Replace all console.log with logger calls**

---

### 2. Error Tracking Setup (2-3 hours)

**Install Sentry:**
```bash
npm install @sentry/nextjs
```

**Initialize in root:**
```typescript
// src/instrumentation.ts
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  environment: process.env.NODE_ENV,
})
```

**Use in API routes:**
```typescript
try {
  // ... handler code
} catch (error) {
  Sentry.captureException(error)
  return handleApiError(error)
}
```

---

## Phase 4: Advanced Security

### 1. Two-Factor Authentication

**Supabase supports TOTP - can be enabled per user**

### 2. API Key Management

**For AppSheet integration:**
- Generate API keys with scopes
- Implement key rotation
- Add audit trail for API key usage

### 3. Advanced Threat Detection

- Monitor for suspicious patterns
- Detect account takeover attempts
- Alert on unusual access patterns

---

## Testing Checklist

After implementing each fix:

- [ ] Rate limiting blocks requests after limit
- [ ] Debug logs don't appear in production
- [ ] CORS rejects from unknown origins
- [ ] Audit logs record user actions
- [ ] Error tracking captures exceptions
- [ ] No sensitive data in logs/errors

---

## Environment Variables to Add

```env
# Rate Limiting (Phase 2)
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...

# Error Tracking (Phase 3)
NEXT_PUBLIC_SENTRY_DSN=...

# API Key Management (Phase 4)
API_KEY_ENCRYPTION_KEY=...
```

---

## Deployment Checklist

Before going to production:

- [ ] All Phase 2 items completed
- [ ] Rate limiting tested
- [ ] Debug logs verified removed
- [ ] CORS validation working
- [ ] Error tracking operational
- [ ] Security headers added
- [ ] HTTPS enforced
- [ ] Secrets in environment variables only
- [ ] Service role key rotated
- [ ] Database backups configured
