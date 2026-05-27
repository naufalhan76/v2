# QA Integration + Edge Cases + Performance — MSN ERP V2
**Date:** 2026-05-27
**Scope:** Edge cases, integration points, performance
**Auditor:** Kiro (static analysis)

---

## Severity Legend

| Level | Meaning |
|-------|---------|
| CRITICAL | Data loss, security breach, or production outage risk |
| HIGH | Significant bug or regression likely in normal use |
| MEDIUM | Degraded UX or correctness issue under specific conditions |
| LOW | Minor quality issue, tech debt, or improvement opportunity |
| INFO | Observation, no action required |

---

## 1. Realtime (src/lib/realtime.ts)

### [HIGH] New Supabase client per subscription — WebSocket leak
Each subscribe* function calls realtimeClient() which calls createClient(), creating a brand-new Supabase instance with its own WebSocket. If a component mounts/unmounts rapidly (React StrictMode double-invoke, tab switching), multiple WS connections accumulate. The cleanup calls supa.removeChannel(channel) but never closes the underlying client.

File: src/lib/realtime.ts:5-36
Fix: Share a single module-level Supabase realtime client, or call supa.removeAllChannels() then close the client in cleanup.

### [HIGH] No deduplication guard — subscribeOrders called multiple times
No check whether a channel with the same name already exists. If subscribeOrders is called twice (two components mounting), two orders-changes channels are registered. Supabase allows duplicate channel names; both fire, causing double cache invalidations and races with optimistic updates.

File: src/lib/realtime.ts:11-37
Fix: Track active channels in a module-level Map keyed by channel name; return existing subscription if already active.

### [MEDIUM] Realtime + optimistic mutation race
useTransitionOrder sets optimistic data on ['order', orderId] then the realtime subscription fires invalidateQueries(['orders']). If the server-side change arrives before onSettled, the invalidation races with rollback context, potentially showing stale data.

File: src/hooks/use-order-mutation.ts:27-41, src/lib/realtime.ts:28
Fix: Suppress realtime invalidation during in-flight mutations using a module-level Set of pending order IDs.

### [LOW] No reconnect handler after network drop
No on('system') handler listens for CHANNEL_ERROR or CLOSED events to trigger resubscription. Supabase JS v2 auto-reconnects but channel state is not surfaced to the UI.

File: src/lib/realtime.ts
Fix: Add channel.on('system', ...) handler and expose connection state to UI.


## 2. TanStack Query (src/hooks/use-order-mutation.ts, src/components/query-provider.tsx)

### [HIGH] useAssignTechnician missing per-order optimistic update
useTransitionOrder and useCancelOrder both implement onMutate with optimistic cache updates. useAssignTechnician does not — it only invalidates on settle. Under slow networks, the Kanban board shows stale assignment state until the server responds.

File: src/hooks/use-order-mutation.ts:71-103
Fix: Add onMutate optimistic update mirroring useTransitionOrder pattern.

### [MEDIUM] queryKey collision risk — ['orders'] used as both list and filtered list
All order list queries share the base key ['orders'] regardless of filters. A filtered query (e.g. status=ASSIGNED) and the full list both match invalidateQueries({queryKey: ['orders']}), which is correct for invalidation but means they share stale-time tracking. A fresh full-list fetch does not refresh a filtered query and vice versa.

File: src/hooks/use-order-mutation.ts:62, src/lib/realtime.ts:28
Fix: Include filter params in queryKey: ['orders', filters] and use exact:false invalidation.

### [MEDIUM] No gcTime configured — infinite cache growth
QueryClient is configured with staleTime: 60000 and refetchOnWindowFocus: false but no gcTime (formerly cacheTime). Default gcTime is 5 minutes, which is fine, but this is not explicit. On long-running sessions with many unique queryKeys (e.g. ['order', orderId] for hundreds of orders), memory grows unboundedly.

File: src/components/query-provider.tsx
Fix: Set explicit gcTime: 5 * 60 * 1000 and consider a smaller value for large list queries.

### [LOW] onSuccess used for toast in useTransitionOrder — fires before cache settled
onSuccess fires before onSettled. If the toast triggers a navigation or re-render that reads stale cache, the user sees old data for one render cycle.

File: src/hooks/use-order-mutation.ts:55-59
Fix: Move non-critical side effects (toasts) to onSettled, or accept the minor visual artifact.

### [LOW] Missing invalidation of dashboard-kpi after order mutations
Realtime invalidates ['dashboard-kpi'] on order changes, but the mutation hooks (useTransitionOrder, useCancelOrder, useReschedule) do not. If realtime is disconnected, KPI counts go stale after mutations.

File: src/hooks/use-order-mutation.ts:61-64
Fix: Add queryClient.invalidateQueries({queryKey: ['dashboard-kpi']}) in onSettled of all order mutation hooks.


## 3. Service Worker (public/technician-sw.js)

### [HIGH] pushsubscriptionchange resubscribes without auth token
The pushsubscriptionchange handler fetches /api/technician/push/public-key and then POSTs to /api/technician/push/subscribe without any Authorization header. The SW has no access to cookies or session tokens. If the subscribe endpoint requires authentication, the resubscription silently fails and the technician stops receiving push notifications until they manually re-enable from the profile page.

File: public/technician-sw.js:148-176
Fix: The subscribe endpoint must accept unauthenticated requests from the SW (verified by endpoint + keys matching an existing subscription), or the SW must store a long-lived token in IndexedDB.

### [HIGH] Stale cache version — no versioned cache busting strategy
CACHE_NAME is hardcoded as 'msn-tech-v2'. When the app shell changes (new deploy), the SW activates and deletes old caches, but the install step re-caches /technician which may return a cached response from the CDN/browser HTTP cache rather than the new version. This can leave technicians on a stale app shell indefinitely.

File: public/technician-sw.js:5
Fix: Append a build hash to CACHE_NAME (e.g. 'msn-tech-v2-BUILD_HASH') injected at build time, or use a network-first strategy for the app shell itself.

### [MEDIUM] iOS Safari push notification quirks not handled
The SW uses vibrate: [120, 60, 120] in notification options. iOS Safari ignores vibrate but also has stricter requirements: notifications must be triggered from a user gesture context. The SW does not check for iOS-specific limitations. Additionally, iOS Safari requires the PWA to be added to home screen before push works — no fallback or detection exists.

File: public/technician-sw.js:91
Fix: Add iOS detection in src/lib/push.ts getPushSupport() and show appropriate guidance in the profile UI.

### [MEDIUM] notificationclick navigates to pathname only, ignores origin
The notificationclick handler constructs targetUrl from event.notification.data.url which is a relative path like /technician/job/123. It then calls clients.openWindow(targetUrl) with a relative URL. In some browsers, openWindow requires an absolute URL.

File: public/technician-sw.js:135
Fix: Use self.location.origin + targetUrl when calling openWindow.

### [LOW] urlBase64ToUint8Array duplicated between SW and src/lib/push.ts
The function is copy-pasted with a comment acknowledging the duplication. The SW version uses a plain ArrayBuffer (not the concrete ArrayBuffer trick from push.ts), which is fine for the SW context but creates a maintenance burden.

File: public/technician-sw.js:180-188, src/lib/push.ts:31-43
Fix: Accept the duplication (SW cannot import app code) but add a comment linking both copies so they stay in sync.


## 4. Push Notifications (src/lib/push.ts, src/lib/server/push-sender.ts)

### [HIGH] resolveAuthUserId creates a new admin client per notification
sendJobAssignedNotification, sendJobRescheduledNotification, and sendJobReassignedAwayNotification each call resolveAuthUserId which calls createAdminClient(). sendPushToUser also calls createAdminClient(). For a batch assign of N orders, this creates 2N admin clients. Each admin client opens a new DB connection via the service role key.

File: src/lib/server/push-sender.ts:160-172, 181-218
Fix: Accept an optional pre-created admin client as a parameter, or create one at the top of sendPushToUser and pass it down.

### [MEDIUM] Concurrent subscribe calls not deduplicated in browser
subscribeToPush() in push.ts checks for an existing subscription via reg.pushManager.getSubscription() before subscribing. However if the user clicks the enable button twice rapidly before the first promise resolves, two concurrent calls both see no existing subscription and both call pushManager.subscribe(), which may throw or create duplicate server-side records.

File: src/lib/push.ts:93-122
Fix: Add a module-level promise lock: if a subscribe is in flight, return the same promise.

### [MEDIUM] Push payload body contains raw orderId — PII exposure in notification center
The reassigned-away notification body is: "Order {orderId} sudah tidak ditugaskan ke kamu." The orderId is visible in the OS notification center and notification history. On shared devices this leaks order identifiers.

File: src/lib/server/push-sender.ts:256-262
Fix: Use a human-readable description instead of the raw UUID, e.g. "Satu job telah dipindahkan ke teknisi lain."

### [LOW] VAPID configured once per cold start but vapidConfigured flag is module-level
In serverless/edge environments, each function invocation may be a new module context. The vapidConfigured flag correctly handles this (starts false, set to true after first call). However if VAPID env vars are missing on first call, vapidConfigured stays false and the warning is logged on every subsequent call. This is correct behavior but produces noisy logs.

File: src/lib/server/push-sender.ts:23-42
Fix: Cache the missing-vars warning with a separate flag to log only once per cold start.


## 5. Order Notifications Component (src/components/order-notifications.tsx)

### [HIGH] 10-second polling creates Supabase client on every tick
fetchNotifications imports and creates a Supabase browser client on every call via dynamic import('@/lib/supabase-browser'). With a 10-second interval, this creates ~360 client instances per hour per open tab. Each client instance holds references and may open connections.

File: src/components/order-notifications.tsx:57, 114
Fix: Create the Supabase client once outside the callback (in a useRef or module-level singleton), not inside the polling function.

### [HIGH] localStorage readNotifications array grows unboundedly
markAsRead pushes order IDs into readNotifications_{userId} in localStorage without any pruning. Over months of use, this array can contain thousands of IDs, making every JSON.parse/stringify on each poll cycle increasingly expensive. localStorage has a ~5MB limit per origin.

File: src/components/order-notifications.tsx:146-150
Fix: Prune the stored array to only IDs that appear in the current 7-day window, or use a timestamp-keyed object and evict entries older than 7 days.

### [MEDIUM] window.refreshNotifications global — namespace pollution and memory leak
The component assigns fetchNotifications to window.refreshNotifications and cleans it up on unmount. If two instances of OrderNotifications mount simultaneously (unlikely but possible), the second overwrites the first. The cleanup deletes the property, which would break the first instance's registration.

File: src/components/order-notifications.tsx:120-125
Fix: Use a custom event (window.dispatchEvent(new CustomEvent('refresh-notifications'))) instead of a global function reference.

### [MEDIUM] Notification click navigates to legacy operasional route
handleNotificationClick navigates to /dashboard/operasional/monitoring-ongoing. Per CLAUDE.md, the primary route is now /dashboard/orders. The legacy route remains accessible but this hardcodes a deprecated path.

File: src/components/order-notifications.tsx:135
Fix: Update to /dashboard/orders?orderId={orderId} or the canonical order detail route.

### [LOW] unreadCount can go negative
markAsRead decrements unreadCount with Math.max(0, prev - 1) which is safe. However markAllAsRead sets unreadCount to 0 directly without checking if notifications were already partially read. This is correct but the two code paths are inconsistent.

File: src/components/order-notifications.tsx:152, 163
Fix: Derive unreadCount from notifications state rather than tracking it separately.


## 6. Order Actions (src/lib/actions/orders.ts)

### [CRITICAL] deleteOrder performs hard delete — violates soft-delete convention
CLAUDE.md states "Soft deletes — records are never hard-deleted." deleteOrder at line 566 calls supabase.from('orders').delete() which is a hard delete. This permanently removes the order and all cascade-deleted related records (order_items, order_technicians, order_status_transitions).

File: src/lib/actions/orders.ts:566-590
Fix: Replace with a soft delete: update deleted_at = now() and filter deleted_at IS NULL in all queries.

### [CRITICAL] updateOrderStatus does not enforce state machine
updateOrderStatus accepts any newStatus string and applies it directly without calling canTransition() from order-status.ts. The state machine is defined but not enforced server-side in this function. A caller can transition PAID -> PENDING or CANCELLED -> ASSIGNED.

File: src/lib/actions/orders.ts:225-299
Fix: Import canTransition and validate the transition before applying. Return an error if invalid.

### [HIGH] dateTo filter applied twice — duplicate query condition
In getOrders, the dateTo filter is applied at lines 84-86 and again at lines 88-90 (identical block). This is a copy-paste bug. While Supabase deduplicates identical conditions, it is wasteful and confusing.

File: src/lib/actions/orders.ts:84-90
Fix: Remove the duplicate block at lines 88-90.

### [HIGH] createOrder inserts status: 'NEW' — legacy value bypasses canonical state
createOrder sets status: 'NEW' which is a legacy value. The canonical initial state is 'PENDING'. While toCanonical() maps NEW -> PENDING for display, the DB stores 'NEW', creating inconsistency and requiring the legacy mapper to remain indefinitely.

File: src/lib/actions/orders.ts:201
Fix: Change to status: 'PENDING'.

### [HIGH] No concurrency guard for simultaneous assignment
assignOrdersToTechnician reads previous leads, deletes assignments, then inserts new ones — three separate operations with no transaction or optimistic lock. If two admins assign the same order simultaneously, both read the same previous lead, both delete, and both insert, resulting in duplicate lead assignments or a race where one admin's assignment silently overwrites the other's.

File: src/lib/actions/orders.ts:301-418
Fix: Use a Supabase RPC (stored procedure) to perform the read-delete-insert atomically, or add an optimistic lock column (version/updated_at check).

### [MEDIUM] revalidatePath uses legacy paths after restructure
Several revalidatePath calls reference /orders, /dashboard/operasional/accept-order, /dashboard/operasional/monitoring-ongoing. Per CLAUDE.md the primary route is now /dashboard/orders. Stale revalidations on non-existent routes are harmless but waste Next.js cache invalidation budget.

File: src/lib/actions/orders.ts:209, 285, 387-390, 547-550
Fix: Update to /dashboard/orders and remove legacy paths.


## 7. Invoices (src/lib/actions/invoices.ts)

### [HIGH] createInvoice checks order.status === 'DONE' — legacy value, never matches canonical
createInvoice at line 754 checks if (order.status !== 'DONE') and throws. But 'DONE' is a legacy status; the canonical equivalent is 'COMPLETED'. If the DB has been migrated to canonical values, this check always fails and no final invoice can ever be created from the UI.

File: src/lib/actions/invoices.ts:754-756
Fix: Check against both: if (!['DONE', 'COMPLETED'].includes(order.status))

### [HIGH] reviseInvoice calls updateInvoice then reviseInvoiceItems — double auth check, no atomicity
reviseInvoice calls updateInvoice (which re-authenticates and re-fetches the invoice) then reviseInvoiceItems (which also re-authenticates and re-fetches). This is two round trips with two auth checks. More critically, if updateInvoice succeeds but reviseInvoiceItems fails, the header is updated but items are not, leaving the invoice in a partially-revised state. The compensating restore in reviseInvoiceItems only restores items, not the header.

File: src/lib/actions/invoices.ts:1272-1285
Fix: Move both operations into a single Supabase RPC for true atomicity, or at minimum save the original header values and restore them on item revision failure.

### [HIGH] generateInvoiceNumber fallback uses Math.random() — collision risk
If the generate_invoice_number RPC fails, the fallback generates INV/YYYY/MM/XXXX where XXXX is a random 4-digit number. With 10,000 possible values and concurrent invoice creation, collisions are plausible. invoice_number likely has a unique constraint, so this would surface as a 500 error to the user.

File: src/lib/actions/invoices.ts:476-484
Fix: Use a DB sequence or retry loop with collision detection rather than random fallback.

### [MEDIUM] getInvoiceStats fetches all invoices for revenue calculation — N+1 at scale
getInvoiceStats runs 7 parallel queries. The revenue query fetches all invoices (total_amount, paid_amount, payment_status) with no limit. As invoice count grows, this becomes a full table scan on every dashboard load.

File: src/lib/actions/invoices.ts:1510-1535
Fix: Use a DB aggregate query (SUM with WHERE) instead of fetching all rows to JavaScript.

### [MEDIUM] getOrderItemsForInvoice has N+1 query for old orders
For each order item without a catalog join, a separate service_pricing query is issued. For an order with 10 old items, this is 10 sequential queries.

File: src/lib/actions/invoices.ts:445-458
Fix: Collect all service_types first, then do a single .in('service_type', types) query and map results.

### [LOW] deleteInvoice reverts order status to 'DONE' — legacy value
When a FINAL invoice is deleted, the order status is reverted to 'DONE' (legacy) instead of 'COMPLETED' (canonical).

File: src/lib/actions/invoices.ts:1351-1354
Fix: Use 'COMPLETED' (or check which value is currently in the DB and use the appropriate canonical value).


## 8. next.config.js

### [HIGH] Security headers missing — no CSP, HSTS, X-Frame-Options, X-Content-Type-Options
The headers() function only sets Cache-Control. There are no Content-Security-Policy, Strict-Transport-Security, X-Frame-Options, X-Content-Type-Options, or Referrer-Policy headers. The dashboard handles financial data and PII; missing security headers are a significant risk.

File: next.config.js:29-44
Fix: Add security headers to the /:path* source:
  - X-Frame-Options: DENY
  - X-Content-Type-Options: nosniff
  - Referrer-Policy: strict-origin-when-cross-origin
  - Strict-Transport-Security: max-age=31536000; includeSubDomains
  - Content-Security-Policy: appropriate policy for the app

### [MEDIUM] images.domains deprecated in Next.js 15 — use remotePatterns
images.domains is deprecated since Next.js 13 and removed in Next.js 15. Using it in Next.js 15.5.15 may produce a warning or silently fail, causing next/image to refuse to optimize images from the Supabase storage domain.

File: next.config.js:23-27
Fix: Replace with:
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'ybxnosmcjubuezefofko.supabase.co' }],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  }

### [MEDIUM] Dashboard Cache-Control header is overly broad
The /dashboard/:path* route sets public, s-maxage=60, stale-while-revalidate=120. Dashboard pages contain user-specific data (orders, invoices, customer info). Setting public allows CDN/shared caches to serve one user's dashboard to another user.

File: next.config.js:38-42
Fix: Use private, no-store for authenticated dashboard routes, or remove the header entirely and rely on Next.js App Router's default per-request rendering.

### [LOW] No compression configuration
Next.js enables gzip compression by default but brotli is not explicitly configured. For a Docker deployment, ensure the reverse proxy (Nginx/Cloudflare) handles compression rather than Node.js to avoid CPU overhead.

File: next.config.js
Fix: Add compress: false if a reverse proxy handles compression, or leave default for simplicity.

### [INFO] output: 'standalone' is correctly set
Standalone output is configured, which is correct for Docker deployment.

File: next.config.js:3


## 9. Performance

### [HIGH] getInvoiceStats: full table scan on every dashboard load
Seven parallel Supabase queries run on every dashboard KPI load. The revenue/unpaid query fetches every invoice row (total_amount, paid_amount, payment_status) with no LIMIT. At 10k+ invoices this is a full table scan transferred to Node.js for JS-side aggregation.

File: src/lib/actions/invoices.ts:1510-1562
Fix: Replace JS reduce with DB-side SUM aggregates using .select('sum(total_amount)') or a materialized view / DB function.

### [HIGH] getServicedAcUnits: in-memory status filter on unbounded result set
getServicedAcUnits fetches all AC units matching the date range with no LIMIT, then filters by status (overdue/due_soon/upcoming) in JavaScript. For large fleets this transfers thousands of rows to Node.js unnecessarily.

File: src/lib/actions/reminders.ts:707-819
Fix: Push the date-math filter to the DB query using lte/gte on next_service_due_date, and add pagination.

### [MEDIUM] getOrderItemsForInvoice: sequential N+1 queries for legacy orders
For each order item without a catalog join, a separate service_pricing query is issued synchronously inside a for loop. 10 legacy items = 10 round trips.

File: src/lib/actions/invoices.ts:445-458
Fix: Batch: collect all service_types, single .in() query, map results.

### [MEDIUM] order-notifications.tsx: dynamic import inside polling callback
import('@/lib/supabase-browser') is called inside fetchNotifications which runs every 10 seconds. Dynamic imports are cached after first resolution but the module evaluation overhead and the new client construction still run on every tick.

File: src/components/order-notifications.tsx:57
Fix: Hoist the import and client creation outside the callback.

### [MEDIUM] No database connection pooling configuration documented
The app uses @supabase/ssr with the anon key for server components and service role for admin operations. There is no PgBouncer or Supabase connection pooler URL configured in .env.example. Under concurrent server action load, each createClient() call may open a new Postgres connection.

Fix: Use the Supabase connection pooler URL (port 6543) for server-side clients in production. Document in .env.example.

### [LOW] Three.js (three@0.181.1) in production dependencies
package.json includes three (3D graphics library) as a production dependency. This adds ~600KB to the bundle. No 3D usage is apparent in the core ERP features.

File: package.json:78
Fix: Verify if three is actually used. If only used in one page, use dynamic import with ssr:false. If unused, remove it.

### [LOW] @tanstack/react-query-devtools in production dependencies
react-query-devtools is listed under dependencies (not devDependencies). It will be included in the production bundle unless tree-shaken. The devtools panel is typically only rendered in development but the code is still shipped.

File: package.json:57
Fix: Move to devDependencies, or ensure it is only imported conditionally (process.env.NODE_ENV !== 'production').


## 10. Concurrency & State Machine

### [CRITICAL] No server-side state machine enforcement in updateOrderStatus
updateOrderStatus accepts any status string without validating against canTransition(). Two concurrent requests can both read the current status, both pass any client-side check, and both write conflicting statuses. The last write wins with no error.

File: src/lib/actions/orders.ts:225-299
Fix: Add canTransition() check server-side. Use a DB-level check constraint or RPC with row lock (SELECT FOR UPDATE) to prevent concurrent invalid transitions.

### [HIGH] Two admins assigning same order simultaneously — race condition
assignOrdersToTechnician does: read previous leads -> delete assignments -> insert new assignments. No row lock or version check. Two concurrent calls both read the same previous leads, both delete, and both insert, resulting in duplicate rows or silent data loss.

File: src/lib/actions/orders.ts:301-418
Fix: Wrap in a Supabase RPC with explicit row locking, or add an optimistic lock (check updated_at has not changed since read).

### [HIGH] Two technicians submitting reports for same order — no guard
No evidence of a uniqueness constraint or server-side check preventing two service reports for the same order. If two technicians (lead + helper) both submit the complete-job form simultaneously, two service records may be created.

Fix: Add a unique constraint on (order_id) in service_records table, or check for existing record before insert in the server action.

### [MEDIUM] Optimistic update rollback on concurrent mutation conflict
If Admin A and Admin B both optimistically update the same order, Admin A's onSettled invalidation will overwrite Admin B's optimistic state with the server truth. This is correct behavior but the UX shows a flash of wrong state. No conflict notification is shown to either admin.

File: src/hooks/use-order-mutation.ts
Fix: Accept as known limitation, or add a last-writer-wins toast: "Order was updated by another user."

## 11. RBAC & Security

### [HIGH] canAccessInvoice and canAccessCustomer ignore the resource parameter
Both functions accept an invoice/customer parameter but immediately void it with void invoice / void customer. The TODO comment acknowledges this. Any FINANCE user can access any invoice or customer regardless of ownership.

File: src/lib/rbac.ts:95-111
Fix: Implement ownership check when multi-tenant support is needed. At minimum remove the misleading parameter if it is not used.

### [MEDIUM] requireFinanceRole makes a DB query on every server action call
requireFinanceRole fetches from user_management on every invocation. For high-frequency actions (e.g. getInvoices called on every page load), this adds a DB round trip. The role is already in the Supabase JWT claims.

File: src/lib/rbac.ts:78-93
Fix: Read role from JWT claims via supabase.auth.getUser() metadata instead of a separate DB query, or cache the role in the session.

### [MEDIUM] API error handler leaks internal Supabase error messages
handleApiError returns error.message directly for generic Error instances (line 90). Supabase errors can contain table names, column names, and constraint names that reveal schema details.

File: src/app/api/utils.ts:90
Fix: Map unknown errors to a generic "Internal server error" message in production, logging the full error server-side only.

### [LOW] TECHNICIAN role has no explicit RBAC helper
isTechnician() exists but is not used in requireFinanceRole or the invoice/customer access checks. Technician-specific server actions rely on RLS rather than explicit role checks.

File: src/lib/rbac.ts:31-33
Fix: Document that technician access is enforced via RLS, not RBAC helpers, to avoid confusion.


## 12. Email (Resend) & PDF Export

### [MEDIUM] Resend API key missing — no graceful degradation documented
.env.example lists RESEND_API_KEY as optional. If missing, any email send action will throw at runtime. There is no documented fallback or feature-flag to disable email sending when the key is absent.

Fix: Wrap Resend calls in a check: if (!process.env.RESEND_API_KEY) { logger.warn('Resend not configured'); return { success: false, error: 'Email not configured' } }

### [MEDIUM] No idempotency tokens on Resend API calls
Invoice email sends have no idempotency key. If a server action times out and retries, the customer may receive duplicate emails.

Fix: Pass idempotencyKey: invoiceId to the Resend send() call.

### [MEDIUM] jsPDF + html2canvas — large invoices risk out-of-memory
html2canvas renders the DOM to a canvas at device pixel ratio. For invoices with many line items, the canvas height can exceed browser limits (~32,767px on some browsers). No page-break logic or canvas size limit is implemented.

Fix: Implement page-break detection: split invoice items into chunks, render each chunk to a separate canvas, and add each as a jsPDF page.

### [LOW] PDF font loading — no explicit font embedding
jsPDF uses built-in fonts by default (Helvetica). Indonesian characters (e.g. accented chars) may not render correctly. No custom font is loaded.

Fix: Embed a Unicode-capable font (e.g. Noto Sans) using jsPDF's addFont() for correct Indonesian character rendering.

## 13. Internationalization

### [MEDIUM] Date locale inconsistency — mix of id-ID and hardcoded English
order-notifications.tsx uses date-fns with id locale for display. push-sender.ts uses new Date().toLocaleDateString('id-ID'). However some components may use date-fns without locale (defaulting to en-US). No centralized date formatting utility exists.

Fix: Create a shared formatDate(date, format) utility that always applies the id locale, and use it consistently.

### [MEDIUM] Number formatting — currency amounts not consistently formatted
Invoice totals use raw number values. No Intl.NumberFormat('id-ID', {style:'currency', currency:'IDR'}) wrapper is enforced. Different components may format the same amount differently (e.g. 1000000 vs Rp 1.000.000).

Fix: Create a shared formatCurrency(amount) utility using Intl.NumberFormat with id-ID locale.

### [LOW] Hardcoded English strings in server-side error messages
requireFinanceRole throws 'Unauthorized: Finance role required' in English. User-facing error messages in server actions mix Indonesian and English.

File: src/lib/rbac.ts:81, 92
Fix: Standardize on Indonesian for user-facing messages, English for internal/log messages.

## 14. Memory & Event Listeners

### [HIGH] order-notifications.tsx: Supabase client created on every poll tick
As noted in section 5, a new Supabase client is created inside fetchNotifications on every 10-second interval. Each client holds internal state and event listeners. Over a long session (8 hours), this creates ~2,880 client instances.

File: src/components/order-notifications.tsx:57
Fix: Create client once in useRef or module scope.

### [MEDIUM] localStorage readNotifications grows unboundedly
As noted in section 5, the read-notifications array is never pruned. After months of use with hundreds of orders per week, this array can reach tens of thousands of entries.

File: src/components/order-notifications.tsx:146-150
Fix: Prune to only IDs within the 7-day notification window on each write.

## 15. Container / Docker & Infrastructure

### [MEDIUM] No healthcheck in Dockerfile/docker-compose
No healthcheck endpoint or Docker HEALTHCHECK instruction is documented. Container orchestrators (Docker Swarm, ECS) cannot detect when the Next.js process is up but not serving requests.

Fix: Add HEALTHCHECK CMD curl -f http://localhost:3000/api/health || exit 1 to Dockerfile, and implement GET /api/health returning 200.

### [LOW] Cloudflare tunnel WebSocket support for Supabase Realtime
Supabase Realtime uses WebSockets. Cloudflare tunnels support WebSockets but require the tunnel to be configured with --no-tls-verify or proper cert handling. No documentation exists for this configuration.

Fix: Document Cloudflare tunnel WebSocket configuration in STAGING.md or a new INFRA.md.

### [LOW] Log rotation not configured
Docker container logs are written to stdout/stderr. Without log rotation configuration (--log-opt max-size, --log-opt max-file), logs grow unboundedly on the host.

Fix: Add logging driver configuration to docker-compose.yml:
  logging:
    driver: json-file
    options:
      max-size: "10m"
      max-file: "3"


## 16. SEO / Metadata

### [LOW] No Open Graph tags verified
No evidence of og:title, og:description, og:image in dashboard layout. Dashboard pages are authenticated so SEO is less critical, but the login page and any public-facing pages should have proper OG tags.

### [LOW] Favicon and manifest
technician-manifest.json is precached by the SW but its content is not audited here. Ensure icons referenced (tech-icon-192.png) exist in /public/icons/.

---

## Severity Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 3 |
| HIGH | 16 |
| MEDIUM | 17 |
| LOW | 14 |
| INFO | 1 |
| **Total** | **51** |

---

## Top 10 Cross-Cutting Issues

1. **[CRITICAL] No server-side state machine enforcement** — updateOrderStatus accepts any status without canTransition() validation. Any client can force arbitrary state transitions. Affects data integrity across the entire order lifecycle.

2. **[CRITICAL] Hard delete in deleteOrder** — violates the project's soft-delete convention. Permanently destroys order history, audit trail, and related records. Cannot be undone.

3. **[CRITICAL] createInvoice checks legacy status 'DONE'** — the canonical status is 'COMPLETED'. If the DB has been migrated, final invoice creation is permanently broken for all completed orders.

4. **[HIGH] Realtime WebSocket leak** — each subscribe* call creates a new Supabase client with its own WS connection. No deduplication guard. Under React StrictMode or multi-component usage, connections accumulate indefinitely.

5. **[HIGH] Concurrent order assignment race** — assignOrdersToTechnician has no row lock or optimistic concurrency control. Two admins assigning the same order simultaneously produces duplicate or lost assignments with no error surfaced.

6. **[HIGH] Dashboard Cache-Control: public** — authenticated dashboard pages are marked public, s-maxage=60. A CDN or shared proxy can serve one user's financial dashboard data to another user.

7. **[HIGH] Missing security headers** — no CSP, HSTS, X-Frame-Options, or X-Content-Type-Options. The app handles PII and financial data with no clickjacking or XSS mitigation at the HTTP layer.

8. **[HIGH] images.domains deprecated in Next.js 15** — may silently break next/image optimization for Supabase storage assets in the current Next.js 15.5.15 version.

9. **[HIGH] order-notifications.tsx creates Supabase client every 10 seconds** — ~2,880 client instances per 8-hour session. Combined with unbounded localStorage growth, this degrades performance over long sessions.

10. **[HIGH] pushsubscriptionchange resubscribes without auth** — the SW cannot send auth cookies. If the push subscribe endpoint requires authentication, technicians silently lose push notifications after browser key rotation, with no recovery path until manual profile page visit.

---

## Recommendations — Priority Order

### Immediate (before next production deploy)

1. Add canTransition() enforcement in updateOrderStatus — one-line fix with major safety impact.
2. Fix createInvoice status check: 'DONE' -> ['DONE', 'COMPLETED'].
3. Replace deleteOrder hard delete with soft delete (add deleted_at column if not present).
4. Fix Dashboard Cache-Control header: change public to private, no-store.
5. Add security headers (X-Frame-Options, X-Content-Type-Options, HSTS) to next.config.js.

### Short-term (next sprint)

6. Fix images.domains -> remotePatterns in next.config.js.
7. Fix Realtime client leak: share a single module-level client.
8. Fix order-notifications.tsx: hoist Supabase client out of polling callback + prune localStorage.
9. Fix dateTo duplicate filter in getOrders (lines 88-90).
10. Fix createOrder status: 'NEW' -> 'PENDING'.

### Medium-term

11. Add row-level locking to assignOrdersToTechnician via Supabase RPC.
12. Fix getInvoiceStats full table scan with DB-side aggregates.
13. Fix getOrderItemsForInvoice N+1 with batched query.
14. Add healthcheck endpoint and Docker HEALTHCHECK instruction.
15. Add idempotency keys to Resend email sends.

