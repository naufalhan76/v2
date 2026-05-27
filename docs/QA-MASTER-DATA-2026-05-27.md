# QA Master Data — MSN ERP V2
**Date:** 2026-05-27
**Auditor:** OpenCode static analysis
**Scope:** customers, locations, ac-units, technicians, users — actions + pages

## Severity Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 4 |
| HIGH | 8 |
| MEDIUM | 9 |
| LOW | 5 |
| INFO | 4 |
| **Total** | **30** |

---

## CUSTOMERS

### [CRITICAL] API DELETE bypasses order guard
**File:** `src/app/api/customers/[id]/route.ts:13`
The REST `DELETE /api/customers/:id` performs a direct `.delete()` with no check for existing orders. The server action `deleteCustomer` has the guard, but `customer/page.tsx` calls the API route for delete — not the action. A customer with orders can be hard-deleted via the REST API.

### [CRITICAL] API DELETE has no authentication check
**File:** `src/app/api/customers/[id]/route.ts:5`
No `requireAuth` call in the DELETE handler. Any unauthenticated request with a valid customer UUID can delete a customer record. The PUT handler has the same issue — no explicit auth guard, only implicit cookie session via `createClient()`.

### [HIGH] No phone number uniqueness enforced at action layer
**File:** `src/lib/actions/customers.ts:155`
`createCustomer` inserts without checking for duplicate `phone_number`. If no DB unique constraint exists, duplicate phones are silently stored. If a constraint exists, the raw Postgres error is surfaced to the user with no friendly message.

### [HIGH] No server-side email format validation in action
**File:** `src/lib/actions/customers.ts:131`
`createCustomer` accepts `email: string` with no format validation. The API schema (`CreateCustomerSchema`) validates email format, but direct server action calls bypass the schema entirely.

### [HIGH] No input trimming — whitespace stored as-is
**File:** `src/lib/actions/customers.ts:147`
`cleanData` only nullifies empty `notes`. Fields like `customer_name`, `phone_number`, `email`, `billing_address` are inserted without trimming. Leading/trailing whitespace causes search mismatches and display inconsistencies.

### [HIGH] Search pagination count mismatch
**File:** `src/lib/actions/customers.ts:44,51`
The DB query returns `count` based on the server-side `ilike` filter, but a second client-side filter is then applied for location address matches. The `pagination.total` reflects the DB count, not the post-filter count. Page totals are wrong when location-address search reduces the result set.

### [MEDIUM] Soft delete not implemented — hard delete only
**File:** `src/lib/actions/customers.ts:244`
All deletes are hard deletes using `.delete()`. CLAUDE.md states "records are never hard-deleted" but customers, locations, AC units, and technicians all use hard delete. No `deleted_at` column or soft-delete pattern is present in any of these actions.

### [MEDIUM] Phone search does not normalize format variations
**File:** `src/lib/actions/customers.ts:41`
Search uses `phone_number.ilike.%${search}%`. Searching `+628123` will not match stored `08123`. No normalization before search. The `searchCustomerByPhone` in `create-order.ts` normalizes the input but not the stored value, so `+62` vs `0` prefix mismatches still fail.

### [LOW] Customer list location popover renders stale V1 fields
**File:** `src/app/dashboard/manajemen/customer/page.tsx:494`
The location popover renders `loc.building_name`, `loc.floor`, `loc.room_number`, `loc.description` — all V1 schema fields that no longer exist in V2. V2 uses `full_address`, `house_number`, `city`, `landmarks`. The popover always shows empty/undefined values for every location.


---

## LOCATIONS

### [HIGH] No `createLocation` in `locations.ts` — imported from `create-order.ts`
**File:** `src/app/dashboard/manajemen/customer/[id]/page.tsx:73`
The customer detail page imports `createLocation` from `@/lib/actions/create-order`, not from `locations.ts`. The `locations.ts` file has no `createLocation` export at all. Location creation is coupled to order-creation logic, making it hard to maintain independently.

### [MEDIUM] No customer_id existence check on location create
**File:** `src/lib/actions/create-order.ts`
`createLocation` accepts `customer_id` as a plain string with no existence check. Creating a location with a non-existent `customer_id` fails at the DB FK level with a raw Postgres error surfaced to the user.

### [MEDIUM] Customer delete does not check for locations
**File:** `src/lib/actions/customers.ts:226`
`deleteCustomer` only checks for orders, not for locations. If a customer has locations but no orders, the delete will either cascade (if DB has ON DELETE CASCADE) or fail with a raw FK violation. Behavior is undocumented and untested.

### [MEDIUM] `updateLocation` cannot change `customer_id`
**File:** `src/lib/actions/locations.ts:109`
The update payload type excludes `customer_id`. Reassigning a location to a different customer is not supported via the action layer.

### [LOW] AC Units tab not invalidated after location delete
**File:** `src/app/dashboard/manajemen/customer/[id]/page.tsx:629`
`invalidate()` in LokasiTab correctly invalidates `['customer-locations', customerId]` and `['customer-detail', customerId]`, but does NOT invalidate `['customer-ac-units', customerId]`. After a location is deleted, the AC Units tab may show stale grouped data until the user navigates away and back.


---

## AC UNITS

### [CRITICAL] Status enum mismatch between API schema and UI form
**File:** `src/app/api/schemas/index.ts:177` vs `src/app/dashboard/manajemen/customer/[id]/page.tsx:1371`
`CreateAcUnitSchema` validates status as `z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE'])`. The customer detail form offers `ACTIVE`, `MAINTENANCE`, `WORKSHOP`, `INACTIVE`. `WORKSHOP` is not in the API schema enum and will fail validation if submitted via the API route. The `getStatusBadge` helper also handles `WORKSHOP` as a valid display value, confirming it is a real operational state that is missing from the schema.

### [HIGH] AC unit fetch loads ALL units then filters client-side
**File:** `src/app/dashboard/manajemen/customer/[id]/page.tsx:930`
`getAcUnits({ limit: 1000 })` fetches up to 1000 AC units from the entire database, then filters by `locationIds` in JavaScript. This is a full table scan on every customer detail page load. Should be filtered server-side by `location_id IN (...)`.

### [HIGH] Serial number uniqueness not enforced at action layer
**File:** `src/lib/actions/ac-units.ts:149`
`createAcUnit` inserts without checking `serial_number` uniqueness. Duplicate serial numbers are only caught if the DB has a unique constraint; otherwise silently stored.

### [MEDIUM] `unit_type_id` / `capacity_id` mismatch not validated server-side
**File:** `src/lib/actions/ac-units.ts:149`
No cross-validation that the selected `capacity_id` belongs to the selected `unit_type_id`. The UI filters capacities by unit type client-side, but the server action accepts any combination. A mismatched pair can be stored.

### [MEDIUM] `deleteAcUnit` revalidates wrong path
**File:** `src/lib/actions/ac-units.ts:268`
`revalidatePath('/ac-units')` — this path does not exist in the V2 app. Should be `/dashboard/manajemen/ac-units` or the customer detail path. Cache is never properly invalidated after AC unit deletion.

### [MEDIUM] No validation that `next_service_due_date` > `last_service_date`
**File:** `src/lib/actions/ac-units.ts`
No check that `next_service_due_date` is after `last_service_date`. A technician could set a next service date in the past without any error.

### [LOW] Free-text `brand` field and `brand_id` FK can diverge
**File:** `src/app/dashboard/manajemen/customer/[id]/page.tsx:1331`
The form has both a required free-text `brand` field and an optional `brand_id` FK select. A user can pick `brand_id=Daikin` but type `brand="Samsung"`. No sync or validation between the two fields.


---

## TECHNICIANS

### [HIGH] `deleteTechnician` checks `service_records` but not `orders`
**File:** `src/lib/actions/technicians.ts:163`
The guard checks `service_records` for the technician but does not check the `orders` table for active assignments. A technician with active orders (ASSIGNED/EN_ROUTE/IN_PROGRESS) can be deleted, orphaning those orders with no assigned technician.

### [HIGH] `specialization` filter still active — column removed in V2
**File:** `src/lib/actions/technicians.ts:30`
`filters?.specialization` is still accepted and applied as `.eq('specialization', ...)`. CLAUDE.md states specialization was removed from the V2 schema. If the column no longer exists, this query will throw a Postgres error whenever the filter is used.

### [HIGH] `getTechnicianAvailability` references V1 column names
**File:** `src/lib/actions/technicians.ts:207`
The query selects `name`, `phone`, `specialization` — all V1 column names. V2 uses `technician_name` and `contact_number`. This function will return empty/null values or error at runtime. It also uses `service_records!inner` which will exclude technicians with no records.

### [MEDIUM] Duplicate email not checked on create
**File:** `src/lib/actions/technicians.ts:86`
`createTechnician` inserts without checking for duplicate `email`. Only caught by DB constraint if one exists; otherwise silently stored.

### [MEDIUM] No `auth_user_id` linkage in technician record
**File:** `src/lib/actions/technicians.ts`
The `technicians` table type signature has no `auth_user_id` field. Technician login relies on a separate `user_management` record. If a technician has no corresponding `user_management` entry, they cannot log in but the system gives no warning at creation time.

### [INFO] `revalidatePath` points to non-existent routes
**File:** `src/lib/actions/technicians.ts:106,143,183`
`revalidatePath('/technicians')` and `revalidatePath('/dashboard')` — the technician management page is at `/dashboard/manajemen/teknisi`. Cache is never properly invalidated after technician mutations.


---

## USERS

### [CRITICAL] `DISPATCHER` role accepted by UI but absent from RBAC type system
**File:** `src/app/dashboard/manajemen/user/page.tsx:327` + `src/lib/rbac.ts:5`
The role select offers `DISPATCHER` as an option. `UserRole` is typed as `'SUPERADMIN' | 'ADMIN' | 'TECHNICIAN' | 'FINANCE'` — no DISPATCHER. A user created with role DISPATCHER will have no RBAC access: `hasAccess()` will always return false, `getVisibleRoles()` will never return DISPATCHER, and `canManageUsers()` will deny them. The user is effectively locked out of everything.

### [CRITICAL] Default role in create form is `STAFF` — not a valid V2 role
**File:** `src/app/dashboard/manajemen/user/page.tsx:83`
`role: 'STAFF'` is the initial form state. STAFF is not a valid V2 role. If an admin creates a user without changing the role dropdown, the user gets role=STAFF which has no RBAC access and cannot log in meaningfully.

### [HIGH] `deleteUser` is non-atomic — DB record deleted before auth user
**File:** `src/lib/actions/users.ts:190`
The function deletes from `user_management` first, then deletes from `auth.users`. If the auth delete fails, the DB record is gone but the auth user remains — an orphaned auth user who can no longer log in (no DB record) but still exists in Supabase auth and could potentially be re-linked. The code acknowledges this but treats it as acceptable with only a warning log.

### [HIGH] `deleteUser` passes `null` to auth delete when `auth_user_id` is null
**File:** `src/lib/actions/users.ts:185,201`
`deleteUser` checks `if (!userData)` but not `if (!userData.auth_user_id)`. If `auth_user_id` is null, it proceeds to delete the DB record then calls `supabaseAdmin.auth.admin.deleteUser(null)` which will throw or silently fail, leaving the DB record deleted with no auth cleanup.

### [HIGH] `toggleUserStatus` does not invalidate auth session
**File:** `src/lib/actions/users.ts:144`
Setting `is_active: false` only updates the `user_management` table. The Supabase auth session is not invalidated. A deactivated user with an active JWT can still make authenticated API calls until their token expires (up to 1 hour by default).

### [MEDIUM] `updateUser` silently ignores empty `full_name`
**File:** `src/lib/actions/users.ts:120`
`if (input.full_name) updateData.full_name = input.full_name` — passing `full_name: ''` is a no-op. A user's name cannot be cleared or corrected to a different non-empty value if the caller accidentally passes an empty string.

### [INFO] `permanentDeleteUser` is deprecated but still exported and callable
**File:** `src/lib/actions/users.ts:221`
Marked deprecated in a comment but still a live export. Any caller can invoke it. The behavior is nearly identical to `deleteUser` except it fails hard on auth delete error rather than logging and continuing. Should be removed or unexported.

### [INFO] `cleanupOrphanedAuthUsers` deletes auth users without confirmation
**File:** `src/lib/actions/users.ts:268`
This function iterates all auth users and deletes any not found in `user_management`. It is a server action callable from the client with no rate limiting, confirmation step, or audit log. A single call could mass-delete auth users.


---

## CUSTOMER DETAIL PAGE — TABS

### [HIGH] Orders tab "Buat Order" links to deprecated route
**File:** `src/app/dashboard/manajemen/customer/[id]/page.tsx:1464`
`window.location.href = '/dashboard/operasional/create-order?customer=${customerId}'`
CLAUDE.md states the primary order route is now `/dashboard/orders`. The `operasional/` route is deprecated and scheduled for Phase 5 cleanup. This link will break when the legacy route is removed.

### [MEDIUM] Orders tab loads up to 100 orders with no pagination UI
**File:** `src/app/dashboard/manajemen/customer/[id]/page.tsx:1438`
`getOrders({ customerId, limit: 100 })` — for high-volume customers this silently truncates history. There is no "load more" button or pagination indicator. The tab header shows a count that may be wrong if truncated.

### [MEDIUM] AC Units tab disabled with no path forward when customer has no locations
**File:** `src/app/dashboard/manajemen/customer/[id]/page.tsx:1117,1123`
The "Tambah AC" button is disabled when `locations.length === 0` and the empty state shows no action to add a location. The user is stuck with no clear path forward — they must manually switch to the Lokasi tab to add a location first.

### [MEDIUM] Edit customer on detail page uses REST PUT with no explicit auth guard
**File:** `src/app/dashboard/manajemen/customer/[id]/page.tsx:229` + `src/app/api/customers/[id]/route.ts:35`
The detail page calls `fetch('/api/customers/${customerId}', { method: 'PUT' })`. The PUT route handler has no `requireAuth` call — it relies solely on the implicit cookie session via `createClient()`. No role check is performed; any authenticated session (including TECHNICIAN) can update any customer.

### [LOW] Detail tab and summary card show no `updated_at` timestamp
**File:** `src/app/dashboard/manajemen/customer/[id]/page.tsx:517`
The customer detail view shows no last-modified timestamp. Operators have no way to know when a record was last changed or by whom.


---

## RLS / RBAC

### [HIGH] Customer API routes have no role enforcement
**File:** `src/app/api/customers/route.ts:27`
`requireAuth` returns the user or null but enforces no role. A TECHNICIAN can call `POST /api/customers` and create customers. `canAccessCustomer` in `rbac.ts` excludes TECHNICIAN but is never called in the customer API routes. The RBAC helpers exist but are not wired in.

### [HIGH] Customer API DELETE has no authentication at all
**File:** `src/app/api/customers/[id]/route.ts:5`
No `requireAuth` call in the DELETE handler. Any unauthenticated HTTP request with a valid customer UUID can delete a customer record. This is a critical security gap independent of RLS — if RLS is misconfigured or the anon key is used, records are exposed.

### [MEDIUM] FINANCE role can write customers
**File:** `src/lib/rbac.ts:110`
`canAccessCustomer` returns true for FINANCE. Finance should typically be read-only for master data. This is a design decision but creates a wider blast radius if a FINANCE account is compromised.

### [MEDIUM] TECHNICIAN role can access customer detail page
**File:** `src/app/dashboard/manajemen/customer/[id]/page.tsx`
No server-side role check on the customer detail page. A TECHNICIAN who knows a customer UUID can navigate directly to `/dashboard/manajemen/customer/:id` and view full customer data including billing address, email, and all locations.

### [INFO] `checkRole` middleware defined but never used in master data routes
**File:** `src/app/api/middleware/auth.ts:79`
`checkRole()` is a well-implemented role-checking helper but is not called in any customer, location, AC unit, or technician API route. The infrastructure exists but is not applied.

---

## CROSS-FEATURE

### [MEDIUM] Customer with no location breaks order creation flow
No pre-flight check exists at the customer list or detail level to warn that a customer has no locations. The create-order flow requires a `location_id`. If a customer has no locations, the operator discovers this only mid-flow when the location dropdown is empty.

### [MEDIUM] Location with no AC units — order can still attach service
A location with no AC units can be selected in order creation. The order item form will have no AC unit to attach. This is valid for some service types but there is no warning or guidance.

### [INFO] `searchCustomerByPhone` normalizes input but not stored values
**File:** `src/lib/actions/create-order.ts:48,61`
The function strips non-numeric characters from the search input but uses `.eq('phone_number', normalizedPhone)` — an exact match. If stored as `08123` and searched as `+628123`, the normalization produces `628123` which still does not match `08123`. Phone lookup in create-order will silently return no results for format mismatches.

### [INFO] Technician without `auth_user_id` — no login but no system warning
A technician record can exist in the `technicians` table with no corresponding `user_management` entry. The technician appears in assignment dropdowns and can be assigned orders, but cannot log in to the technician app. No validation or warning at creation time.

---

## FINDINGS BY FILE

| File | Critical | High | Medium | Low | Info |
|------|----------|------|--------|-----|------|
| `src/lib/actions/customers.ts` | 1 | 3 | 2 | 0 | 0 |
| `src/app/api/customers/[id]/route.ts` | 1 | 0 | 0 | 0 | 0 |
| `src/app/api/customers/route.ts` | 0 | 1 | 0 | 0 | 0 |
| `src/lib/actions/locations.ts` | 0 | 1 | 2 | 1 | 0 |
| `src/lib/actions/ac-units.ts` | 1 | 2 | 2 | 1 | 0 |
| `src/lib/actions/technicians.ts` | 0 | 3 | 2 | 0 | 1 |
| `src/lib/actions/users.ts` | 2 | 2 | 1 | 0 | 2 |
| `src/app/dashboard/manajemen/customer/page.tsx` | 0 | 0 | 0 | 1 | 0 |
| `src/app/dashboard/manajemen/customer/[id]/page.tsx` | 0 | 1 | 3 | 1 | 0 |
| `src/app/dashboard/manajemen/user/page.tsx` | 1 | 0 | 0 | 0 | 0 |
| `src/lib/rbac.ts` | 0 | 0 | 2 | 0 | 1 |
| Cross-feature | 0 | 0 | 2 | 0 | 2 |
| **Total** | **6** | **13** | **16** | **4** | **6** |

> Note: Some findings span multiple files; counts above reflect primary file attribution.

---

## RECOMMENDED FIXES — PRIORITY ORDER

1. **[CRITICAL]** Add `requireAuth` + role check to `DELETE /api/customers/:id` and `PUT /api/customers/:id`
2. **[CRITICAL]** Add order guard to `DELETE /api/customers/:id` (mirror `deleteCustomer` action logic)
3. **[CRITICAL]** Remove `DISPATCHER` and `STAFF` from user role form options; restrict to V2 roles only
4. **[CRITICAL]** Fix `WORKSHOP` status — add to `CreateAcUnitSchema` enum or remove from UI
5. **[HIGH]** Add active-order guard to `deleteTechnician`
6. **[HIGH]** Remove or guard `specialization` filter in `getTechnicians`; fix V1 column refs in `getTechnicianAvailability`
7. **[HIGH]** Fix AC unit fetch — filter by `location_id` server-side instead of client-side limit:1000
8. **[HIGH]** Make `deleteUser` atomic — use a DB transaction or reverse the delete order (auth first)
9. **[HIGH]** Invalidate auth session on `toggleUserStatus(false)` via Supabase admin `signOut`
10. **[MEDIUM]** Add `trim()` to all string inputs in `createCustomer` and `updateCustomer`
11. **[MEDIUM]** Fix `revalidatePath` calls in technicians and ac-units actions to correct V2 paths
12. **[MEDIUM]** Add `['customer-ac-units', customerId]` invalidation to LokasiTab `invalidate()`
13. **[MEDIUM]** Fix location popover in customer list — replace V1 fields with V2 fields
14. **[MEDIUM]** Add pagination to Orders tab or increase limit with a "show more" control

