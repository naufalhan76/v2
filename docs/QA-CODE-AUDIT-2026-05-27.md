# Code Audit Findings — 2026-05-27

## Critical (security / data corruption)

### [CRITICAL] Legacy order status values used in production code
File: src/lib/actions/orders.ts:201
Issue: `createOrder()` sets `status: 'NEW'` which is not in the V2 canonical status enum. V2 schema only allows: PENDING, ASSIGNED, EN_ROUTE, IN_PROGRESS, COMPLETED, INVOICED, PAID, CANCELLED
Repro: Create a new order via the createOrder server action
Fix: Change `status: 'NEW'` to `status: 'PENDING'`

### [CRITICAL] Legacy order status values used in create-order.ts
File: src/lib/actions/create-order.ts:260, 288
Issue: `createOrderWithItems()` sets status to 'ASSIGNED' or 'ACCEPTED'. 'ACCEPTED' is not a valid V2 status enum value.
Repro: Create an order with/without technician assignment
Fix: Use 'PENDING' for unassigned orders, 'ASSIGNED' for assigned orders. Remove 'ACCEPTED' completely.

### [CRITICAL] Non-existent column `specialization` queried in technicians
File: src/lib/actions/technicians.ts:30-31, 210, 232
Issue: Code queries `specialization` column which does NOT exist in V2 schema. The schema shows `technicians` table has: technician_id, technician_name, company, contact_number, email, auth_user_id, created_at, updated_at. No specialization column.
Repro: Call getTechnicians() with a specialization filter, or call getTechnicianAvailability()
Fix: Remove all references to `specialization` or add the column to the schema if needed

### [CRITICAL] Legacy status values in dashboard KPIs
File: src/lib/actions/dashboard.ts:64, 126
Issue: Dashboard queries use legacy status values ['NEW', 'ACCEPTED', 'ASSIGNED', 'EN ROUTE', 'ARRIVED', 'IN_PROGRESS'] which are not in the V2 enum. 'NEW', 'ACCEPTED', 'EN ROUTE', 'ARRIVED' are not valid.
Repro: Load dashboard page, observe pending orders count may be incorrect
Fix: Use canonical V2 statuses: ['PENDING', 'ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS']

### [CRITICAL] Legacy status values in completed orders query
File: src/lib/actions/dashboard.ts:72, 133
Issue: Completed orders query uses ['PAID', 'CLOSED']. 'CLOSED' is not a valid V2 status.
Repro: Load dashboard, completed orders count may be incorrect
Fix: Use ['PAID'] only, or ['COMPLETED', 'INVOICED', 'PAID'] depending on business logic

## High (broken features in common paths)

### [HIGH] Duplicate filter condition in getOrders
File: src/lib/actions/orders.ts:84-90
Issue: The `dateTo` filter is applied twice (lines 84-86 and 88-90), making the second one redundant.
Repro: Call getOrders with dateTo filter - works but confusing
Fix: Remove the duplicate block at lines 88-90

### [HIGH] Wrong status filter for assignable orders
File: src/app/dashboard/operasional/assign-order/page.tsx:63
Issue: Page queries orders with statusIn: 'ACCEPTED,RESCHEDULE'. Neither 'ACCEPTED' nor 'RESCHEDULE' are valid V2 status values. This will return no results.
Repro: Navigate to assign-order page, no orders will appear even if there are pending orders
Fix: Query for status 'PENDING' (and possibly 'ASSIGNED' for reassignment)

### [HIGH] AC status 'PENDING' referenced but not in V2 schema
File: src/lib/actions/orders.ts:517
Issue: Code checks `ac_units.status = 'PENDING'` but V2 schema defines ac_status enum as: 'ACTIVE', 'INACTIVE', 'RETIRED'. No 'PENDING' value exists.
Repro: Cancel an order with AC units, the AC status update will fail silently
Fix: Remove the PENDING status check or update schema to include PENDING in ac_status enum

### [HIGH] Missing auth check in several server actions
File: src/lib/actions/customers.ts, src/lib/actions/technicians.ts, src/lib/actions/service-pricing.ts, src/lib/actions/addons.ts
Issue: These action files use `createClient()` but do not verify user role before performing operations. RLS provides some protection but explicit role checks should exist for sensitive operations (create, update, delete).
Repro: An authenticated TECHNICIAN could potentially call createCustomer() or updateServicePricing()
Fix: Add role checks using `isAdmin()` or `isSuperAdmin()` for write operations

### [HIGH] Service report missing fields in type definition
File: src/lib/service-report.ts:12-33
Issue: The ServiceReport interface is missing `next_service_recommendation_date` and `next_service_recommendation_notes` columns that were added in Phase 5 migration (02_phase5_reminders.sql).
Repro: Fetch a service report, the new fields won't be available in the TypeScript type
Fix: Add the missing fields to the ServiceReport interface

### [HIGH] Monitoring ongoing page uses RESCHEDULE status
File: src/app/dashboard/operasional/monitoring-ongoing/page.tsx:483, 773
Issue: Code sets status to 'RESCHEDULE' when rescheduling an order. 'RESCHEDULE' is not a valid V2 status - the action should reset to 'PENDING'.
Repro: Reschedule an order from the monitoring page, order status becomes invalid
Fix: Use `status: 'PENDING'` instead of 'RESCHEDULE'

### [HIGH] Invoice creation checks for wrong order status
File: src/lib/actions/invoices.ts:754
Issue: `createInvoice()` checks `order.status !== 'DONE'` but 'DONE' is a legacy status. V2 uses 'COMPLETED'.
Repro: Try to create an invoice for an order with status 'COMPLETED', it will fail with wrong error
Fix: Check for `order.status !== 'COMPLETED'`

### [HIGH] Invoice sync uses legacy DONE status
File: src/lib/actions/invoices.ts:833, 1353, 1486
Issue: Code syncs order status to/from 'DONE' which is not a valid V2 status.
Repro: Invoice payment completion may set order to invalid status
Fix: Use 'COMPLETED' instead of 'DONE'

## Medium (broken edge cases, bad UX)

### [MEDIUM] Suspense boundary missing for useSearchParams
Files: 
- src/components/orders/orders-page-client.tsx:31
- src/components/orders/order-filters.tsx:41
- src/app/(auth)/confirm/page.tsx:15
- src/app/(auth)/login/page.tsx:27
- src/app/dashboard/reminders/page.tsx:36
- src/app/dashboard/keuangan/invoices/[id]/page.tsx:93
- src/app/dashboard/operasional/assign-order/success/page.tsx:21
- src/app/dashboard/operasional/monitoring-ongoing/page.tsx:159
Issue: useSearchParams() is called without Suspense boundary. In Next.js 15, this can cause runtime errors during static rendering.
Repro: Navigate to these pages during build/static generation
Fix: Wrap components using useSearchParams in <Suspense> boundary

### [MEDIUM] Payment records use TEXT for payment_method instead of enum
File: supabase/migrations/00_v2_schema.sql:457, src/lib/actions/invoices.ts:1368
Issue: `payment_records.payment_method` is TEXT in schema but `payments.payment_method` uses `payment_method` enum. Inconsistent - should use enum for consistency.
Repro: Payment records allow arbitrary text values for payment_method
Fix: Either add a check constraint or migrate to use the enum type

### [MEDIUM] N+1 query pattern in bulkUpdateStock
File: src/lib/actions/addons.ts:377-385
Issue: bulkUpdateStock performs individual UPDATE queries in a Promise.all map. While parallelized, this could hit connection pool limits for large batches.
Repro: Update stock for 100+ addons at once
Fix: Consider using a single bulk upsert or stored procedure for better performance

### [MEDIUM] Missing error handling in push notification senders
File: src/lib/server/push-sender.ts:217, 243, 262
Issue: Push notification functions catch errors and log them, but the caller (orders.ts) uses `void Promise.allSettled()` so failures are completely silent.
Repro: Push notification fails, no indication to user
Fix: Consider returning success/failure status or showing toast notification for important failures

### [MEDIUM] Date handling without timezone consideration
Files: src/lib/actions/orders.ts, src/lib/actions/reminders.ts
Issue: Dates like `scheduled_visit_date` and `next_service_due_date` are stored as DATE (no timezone) but formatted without explicit timezone handling. Could cause issues for international operations.
Repro: Service scheduled at midnight may appear on different date depending on user timezone
Fix: Use date-fns with explicit timezone or ensure all dates are handled consistently as local dates

### [MEDIUM] Unused filter parameter in getTechnicianAvailability
File: src/lib/actions/technicians.ts:198
Issue: Function accepts `date` parameter but the query doesn't filter by it - it fetches ALL service records and filters in memory.
Repro: Call getTechnicianAvailability with a specific date, gets all records anyway
Fix: Add date filter to the Supabase query or remove the unused parameter

### [MEDIUM] Inconsistent query key patterns
File: Various hooks and components
Issue: Query keys like ['orders', 'assignable'] in assign-order/page.tsx don't follow a consistent pattern across the codebase. Some use object filters, some use string suffixes.
Repro: Cache invalidation may miss related queries
Fix: Standardize query key factory pattern

## Low (style, dead code, minor issues)

### [LOW] Duplicate function: getTechnicians in create-order.ts
File: src/lib/actions/create-order.ts:526-563
Issue: `getTechnicians()` function exists here but a different implementation exists in technicians.ts. This is confusing and could lead to inconsistency.
Repro: Developers may not know which getTechnicians to use
Fix: Consolidate into a single implementation in technicians.ts, import where needed

### [LOW] Deprecated permanentDeleteUser still exported
File: src/lib/actions/users.ts:221-262
Issue: `permanentDeleteUser` is marked deprecated but still exported and functional. Creates confusion about which function to use.
Repro: Code could accidentally use deprecated function
Fix: Remove the deprecated function or remove the deprecation notice if both are needed

### [LOW] Unused date formatting import
File: src/lib/actions/reminders.ts:437-448
Issue: Custom DATE_FMT formatter is defined but could use date-fns format() for consistency with the rest of the codebase.
Repro: Inconsistent date formatting across the app
Fix: Use date-fns format() with locale for consistency

### [LOW] Magic numbers in dashboard calculations
File: src/lib/actions/dashboard.ts:6
Issue: `DAY_MS = 24 * 60 * 60 * 1000` and similar calculations are duplicated. Could use date-fns constants.
Repro: N/A - code works but less maintainable
Fix: Use date-fns constants or define in a shared utils file

### [LOW] Type assertion required for Supabase joined results
File: Multiple files
Issue: When selecting with joins (e.g., orders with customers), TypeScript requires type assertions like `as unknown as AcUnitRow[]` because Supabase types don't properly infer nested joins.
Repro: Type checking works but code is verbose
Fix: Consider defining explicit types for common join patterns or using Supabase's generated types

### [LOW] Inconsistent error message format
File: src/lib/actions/*.ts
Issue: Some actions return `{ success: false, error: 'message' }`, others throw, others do both. Inconsistent error handling pattern.
Repro: Error handling in UI must handle multiple patterns
Fix: Standardize on one error handling pattern (recommend Result type pattern)

### [LOW] Missing index hints in comments
File: supabase/migrations/00_v2_schema.sql
Issue: Some indexes are created but not all common query patterns have corresponding indexes documented.
Repro: Query planner may not use optimal index
Fix: Review query patterns and add indexes for frequently filtered columns

### [LOW] Accept order page references legacy status
File: src/app/dashboard/operasional/accept-order/page.tsx:65
Issue: Page queries `status: 'NEW'` which is a legacy status. While order-status.ts maps it to PENDING, the filter won't match actual PENDING orders.
Repro: Accept order page shows no orders if using V2 statuses
Fix: Change to query `status: 'PENDING'`

### [LOW] Technician jobs API uses legacy statuses
File: src/app/api/technician/jobs/today/route.ts:78
Issue: Uses 'EN ROUTE' and 'ARRIVED' which are legacy statuses not in V2 enum.
Repro: Technician app may not show correct jobs
Fix: Use canonical V2 statuses: 'EN_ROUTE', 'IN_PROGRESS'

## Recommendations

1. **Urgent: Status Migration**: The codebase has significant confusion between V1 legacy statuses and V2 canonical statuses. Run a data migration to convert all legacy statuses in the database, then update all code references. The `order-status.ts` mapper exists but is not consistently used.

2. **Schema-Code Sync**: Establish a process to regenerate TypeScript types from the Supabase schema after each migration. Consider using Supabase CLI's type generation: `supabase gen types typescript --local > src/types/database.ts`

3. **Role Check Standardization**: Create a higher-order function or wrapper that enforces role checks for server actions, similar to how API routes use middleware.

4. **Query Key Factory**: Implement a centralized query key factory (e.g., using TanStack Query's best practices) to ensure consistent cache management.

5. **Error Boundary for useSearchParams**: Add error boundaries around components using useSearchParams, or wrap them in Suspense, to prevent runtime errors during static rendering.

6. **Add Missing Columns to Types**: Update TypeScript interfaces to match the Phase 5 schema additions (next_service_recommendation_date, next_service_recommendation_notes, next_service_due_date).

7. **Remove or Document Dead Code**: Either remove deprecated functions like `permanentDeleteUser` or add clear JSDoc explaining when to use which version.

8. **Test Coverage**: No test framework is configured. Add Jest/Vitest with integration tests for critical paths like order status transitions, invoice creation, and payment recording.

---

**Summary**: 5 Critical, 9 High, 7 Medium, 10 Low findings
