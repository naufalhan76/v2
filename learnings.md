# Learnings

## orders-auto-revert.ts (2026-06-29)

- **Multi-table mock pattern**: When `from(table)` is called with different table names in sequence, track call counts per table (`byTable` map) to return the correct chain per invocation. First `from('orders')` → select chain; subsequent `from('orders')` → update chain.
- **Fire-and-forget testing**: `void Promise.allSettled(...)` means push notification failures are absorbed. Test only verifies the main result is unaffected — cannot assert on notification error handling since errors are swallowed before the function returns.
- **Concurrent modification guard**: The `.eq('status', order.status)` pattern is a poor-man's optimistic concurrency control. When mocking, return `error` from the update chain to simulate concurrent modification — the function `continue`s, so `revertedIds` excludes that order.
- **UTC date boundary bug**: `new Date().toISOString().slice(0, 10)` is UTC midnight. In UTC+7 (Indonesia), 00:00–06:59 local → UTC "today" is wrong. This is a real date-arithmetic bug exposed during test design.
- **`.lt()` excludes today**: Boundary test confirmed by verifying the chain mock receives `.lt` (not `.lte`). Null dates excluded by SQL semantics (NULL < anything = NULL/false).

## orders-mutations-cancel.test.ts (2026-06-29)

- **Chain `.then` must support two args**: `(onFulfilled, onRejected)`. Single-arg `then` silently swallows rejections — cascade-failure tests hang indefinitely because the rejected promise never propagates through `await`.
- **Per-table call counting** (`fromCalls.filter(t => t === table).length`) is cleaner than `mockReturnValueOnce` when `from('invoices')` is called 3+ times for different query stages (FINAL select, PROFORMA select, cascade update).
- **Outer try/catch wraps non-Error throws**: cancelOrder's fetch error path throws a plain object `{ message }`, not an `Error` instance. The catch's `instanceof Error ? error.message : fallback` check means the wrapped message leaks to assertions — test for the wrapped string, not the inner message.
- **`void Promise.allSettled` in tests**: The function returns before push promises settle. Assert `pushMock.toHaveBeenCalled()` synchronously after cancelOrder resolves — no need to flush microtasks.

## invoices-create.test.ts (2026-06-29)

- **`vi.hoisted()` is required for ALL mocks referenced in `vi.mock` factories**: Any `vi.fn()` used inside a `vi.mock()` factory body must be declared via `vi.hoisted()` — not `const` — otherwise Vitest throws "Cannot access 'X' before initialization" because mock factories are hoisted to the top before `const` declarations evaluate.
- **Two mock client patterns, two names**: `makeBlankClient(operations)` records all insert payloads per table for `createBlankInvoice` tests. `makeOrderInvoiceClient(orderData, opts)` captures a single invoice insert payload + exposes update/delete mocks for `createInvoice` tests. The different table shapes (orders needs maybeSingle vs single) justify separate factories.
- **`||` vs `??` for defaults is a real bug**: `input.tax_percentage || 11` silently converts `0` (tax-exempt) to `11`. `input.tax_percentage ?? 11` preserves `0`. Found by reading the source, not by running tests — a unit test with `tax_percentage: 0` would catch this (test added).

## orders-mutations-assign.test.ts (2026-06-29)

- **Counter-based `from` mock for same-table queries**: assignOrdersToTechnician calls `from('order_technicians')` twice (prevLeads + capacity check). A simple `callCount++` counter routing (1→prevLeads chain, 2+→existing chain) is the cleanest approach when table names are identical.
- **PostgrestError must be Error instance**: Source's `if (error) throw error` followed by `error instanceof Error ? error.message : fallback` means plain-object errors hit the fallback branch. Mock errors need `Object.assign(new Error(msg), { code })` to get proper message propagation.
- **`void Promise.allSettled` push mocks are called synchronously**: The `sendJobAssignedNotification(orderId, techId)` invocation happens inside the `.flatMap()` callback, which runs synchronously before the function returns. Only promise resolution is deferred. Can assert immediately without flush.
- **Auth-less server actions**: addHelperTechnician / removeHelperTechnician have zero auth guards. Tests document this as baseline — function succeeds even without `auth.getUser()` mocks. Security finding appended to bug-findings.
- **Deduplication gaps**: orderIds arrays are never deduplicated before capacity counting or RPC calls. Test pins the current (buggy) behavior where `['o1', 'o1']` is counted as 2 items in capacity check.

## orders-mutations-schedule.test.ts (2026-06-29)

- **`instanceof Error` check drops real messages**: PostgrestError IS an Error instance, but catch uses `instanceof Error ? error.message : fallback`. The chain mock returns plain objects `{ message }`, so tests always hit the fallback branch. This documents a latent bug — real production errors would leak their message, but the test can't prove that path works.
- **Queue-based `from` mock for heterogeneous tables**: `rescheduleOrder` calls `from()` on 4 different tables (orders, order_technicians ×2, order_status_transitions). A flat chain queue (`chains.shift()`) is cleaner than per-table routing — call order in source is deterministic and readable.
- **Fire-and-forget push with `.catch(() => undefined)`**: The `.catch` swallows errors *and* returns a new promise. `void` discards it. `expect(pushMock).toHaveBeenCalledWith(...)` works synchronously after `rescheduleOrder` resolves — the call happens before the promise chain is discarded.

## invoices-order.ts (2026-06-29)

- **Queue-based `from` mock for multi-table actions**: `invoices-order.ts` calls `from()` with 4+ different tables (orders, order_addons, invoices, invoice_items) and some tables multiple times (invoices queried for existing check AND used for insert). A sequential queue (`fromQueue.shift()`) is simpler and more predictable than per-table tracking when internal mocked functions (getServiceReport, getOrderItemsForInvoice) are fully mocked and DON'T consume from the queue.
- **Mocked internals don't touch `from`**: When `getServiceReport` and `getOrderItemsForInvoice` are mocked at module level, they don't call `createClient()` internally. This means the from queue count only reflects calls from the function UNDER test, not from mocked collaborators. Critical for queue correctness.
- **`vi.clearAllMocks()` preserves implementations**: Only clears call history. Mock factories' default return values survive. Re-mocking with `mockResolvedValue()` in tests overrides defaults; `beforeEach` just resets queue, not mock implementations.
- **`finalizeInvoiceFromOrder` is a misnomer**: Tests pin that it does NOT transition invoice status to SENT — it just deletes proforma and creates a DRAFT FINAL via `createInvoiceFromOrder`. Queue layout: [PROFORMA check, 4 admin deletes, invoices existing check, orders].
- **Admin client shares `from` mock**: `createAdminClient` returns `{ from: fromMock }` — same mock as `createClient`. Both consume from the same queue, so admin cascade deletes (invoice_communications, payment_records, invoice_items, invoices) must be accounted for in queue order.

## invoices-revision.test.ts (2026-06-29)

- **`mockReturnValueOnce` queue works when from-call order is deterministic**: updateInvoice makes exactly 2 from-calls (fetch + update) for the simple "notes" path. The sequential queue approach is cleaner than per-table routing when the function's internal call order is stable and testable.
- **`normalizeRevisionItems` validates BEFORE DB writes**: Validation throws synchronously before any Supabase calls. This means validation tests need only ONE from-mock (the invoice fetch) — no need to set up delete/insert/update chains.
- **`canReviseInvoice` is a pure import — no mock needed**: Since it's a pure function that checks status against a constant array, using the real implementation is correct and simpler than mocking. Same for `getInvoiceSource` — it just reads `source` or `order_id`.
- **`Object.keys(safeUpdates).length === 0` branch**: Passing only disallowed fields triggers a re-fetch of the unchanged invoice. Test pins this behavior — it's a deliberate no-op optimization, not a silent failure.
- **`reviseInvoice` integration test needs 7 from-mocks**: updateInvoice (2) + reviseInvoiceItems (5). Queue is fragile — any refactor that adds/removes Supabase calls breaks the test. Worth documenting the expected call sequence in a comment.
- **invoice-communications mock pattern**: `supaFrom` needs to return a plain object `{select: ...}` (not a function) since source chains `supabase.from(table).select(...)`. The `logInvoiceCommunication` action branches on `from` table name — `invoice_communications` (insert) vs `invoices` (select+eq+single) — so mock must use `mockImplementation((table) => ...)` with table-aware routing. `getInvoiceCommunicationStats` returns zeros on error (graceful fallback), while `getInvoiceCommunications` throws — document both behaviors.
- **Supabase errors are plain objects, not Error instances**: All `throw supabaseError` paths in server actions trigger `instanceof Error === false` in catch blocks. Tests must assert the fallback string, not the Supabase message. Upgrade: use duck-typing `(err as any)?.message`.
- **`createCustomer` phone uniqueness check**: Queries `.select('customer_id').eq('phone_number', ...).single()` before insert. If a row is found, short-circuits with a hardcoded duplicate error — doesn't rely on DB unique constraint.
- **`createOrderWithItems` rollback pattern**: On order_items insert failure, deletes the inserted order row. Technician assignment failure is logged but NOT rolled back (partial success allowed).

## invoices-queries-listing.test.ts (2026-06-29)

- **`createChain` import works post-hoist**: Unlike `createSupabaseMock()` (cannot call imported functions in `vi.hoisted`), `createChain` is imported after `vi.mock` and used directly in test bodies. This is the simpler pattern: `fromMock = vi.fn()` in `vi.hoisted()` + `fromMock.mockReturnValue(createChain({...}))` in tests.
- **Call counter with `mockImplementation`**: When a function calls `from()` 3-4 times on different tables (invoices → invoice_items → payment_records → optionally order_items), a mutable `let call = 0; ++call` counter is the most readable routing approach. The `from` chain mock returns a shared `createChain` for all tables but tests control per-call behavior via the counter.
- **OVERDUE as a computed, not stored, status**: Both `getInvoiceById` and `getInvoices` compute `computed_status = 'OVERDUE'` in-memory using `isOverdue()` (past due_date, non-PAID, non-CANCELLED). Tests pin this with future/past date fixtures — the date boundary is `new Date().toISOString().split('T')[0]`.
- **Post-query OVERDUE filter breaks pagination**: `getInvoices({ status: 'OVERDUE' })` skips the DB status filter entirely, fetches all rows, then filters in-memory. Total count remains the unfiltered DB count. Test pins the discrepancy: `total === 2` but only 1 row returned.
- **`rpc` on the client is separate from `from`**: `generateInvoiceNumber` uses `supabase.rpc()`, not `from('invoices')`. Test must mock `rpcMock` (a separate `vi.fn()` on the client object), not `fromMock`.


## orders-queries-and-history.test.ts (2026-06-29)

- **Combined small files into one test**: `orders-queries.ts` (177 LOC) and `order-history.ts` (36 LOC) fit in a single test file at ~110 LOC. The "combine if both small" heuristic works well when the modules share the same domain and mock pattern.
- **`withCount` controls PostgREST count behavior**: When `count` option is `undefined` (not `'exact'`), Supabase returns `count: null`. Tests pin this: `withCount: true` → `total: 5`, omitted → `total: 0`. Pagination UI must handle the "unknown total" case.
- **Chain method assertions via mock tracking**: Filter tests assert `chain.eq.toHaveBeenCalledWith('status', 'COMPLETED')` rather than checking the final query. This is more explicit than snapshot testing the SQL string, but couples tests to the chain API. If Supabase changes the builder pattern, these tests break even though behavior is unchanged.
- **`order-history.ts` is trivial to test**: Single query, single table, no filters. The test file is longer than the source file. This is the right ratio for integration tests that document the contract.
- **No bugs found in either file**: Both have clean error handling (`instanceof Error ? error.message : fallback`), proper logging, and type-safe returns. The only finding is the `withCount` pagination edge case, which is documented Supabase behavior rather than a logic error.

## reminders-rules.test.ts (2026-06-29)

- **Queue-based `from` mock for multi-table actions**: `generateRemindersFromAcUnits` calls `from()` on 5 tables in sequence (reminder_rules → ac_units → customer_reminders ×2 → order_items). A simple queue (`chains[i++]`) is cleaner than per-table routing when internal call order is deterministic. The "6-table" in the task spec refers to logical table interactions (6 join paths across the nested queries), not 6 distinct `from()` invocations.
- **`formatReminderMessage` must be mocked separately**: The function is imported from `@/lib/reminder-utils` and used in both `generateRemindersFromAcUnits` and `createManualReminder`. Mocking via `vi.mock('@/lib/reminder-utils', async (importOriginal) => ({ ...await importOriginal(), formatReminderMessage: mock }))` preserves other exports while intercepting the template engine. Tests verify call arguments (template + context) rather than output strings.
- **`updateReminderRule` validation asymmetry**: `createReminderRule` validates empty name (`.trim()` check) and message_template, but `updateReminderRule` only validates `days_before_due` and `channel` — name and message_template can be set to `""` via update. Tests pin the happy path; bug-findings documents the validation gap.
- **`createManualReminder` nested join mock**: The query `from('ac_units').select('...locations (...customers (...))').eq('ac_unit_id', ...).single()` returns a deeply nested object. The mock flattens this to `{ ac_unit_id, brand, ..., locations: { ..., customers: { customer_id, ... } } }` — the function accesses `unit.locations?.customers` directly. Testing the "no customer" path uses `locations: { ..., customers: null }`.
- **UTC date boundary appears again**: `generateRemindersFromAcUnits` (line 149) and `createManualReminder` (line 211) both use `new Date().toISOString().slice(0, 10)` for date calculations. Same UTC midnight bug as `orders-auto-revert.ts`. In WIB (UTC+7), 00:00–06:59 local → UTC yesterday. Documented in bug-findings; tests don't pin exact dates to avoid fragility.

## dashboard-combined.test.ts (2026-06-29)

- **`count`-aware chain mock**: `dashboard-stats.ts` uses `{ count: 'exact', head: true }` which returns `count` on the result alongside `data`. The standard `createChain` mock only supports `data`/`error`. Built an enhanced `chain()` helper that includes `count` in the resolved value. This pattern is reusable for any action using Supabase count queries.
- **Per-table `from` routing for Promise.all with 16 queries**: `getDashboardKpis` fires 16 queries in Promise.all across 6 tables. All `from('orders')` calls return the same chain (same count for current and previous windows). Tests verify shape and revenue calculation, not per-window differentiation — this is intentional to keep the mock simple. If per-window values matter, a call-counter approach (like `orders-mutations-assign`) would be needed.
- **Revenue calculation is testable**: `totalRevenue` sums `payment_records.amount`, `estimatedRevenue` prefers `actual_price ?? estimated_price` from `order_items`. Tests pin this with `[{ amount: 200000 }, { amount: 300000 }]` → 500000 and `[{ estimated_price: 50000, actual_price: 75000 }]` → 75000.
- **Charts `estimated` join mock**: `getChartData` queries `order_items` with `orders!inner(order_date, status)`. The mock returns `orders: { order_date: '...' }` (object, not array) because `!inner` joins return objects. The source defensively handles both (`Array.isArray(item.orders) ? item.orders[0] : item.orders`).
- **`instanceof Error` hides real messages**: Test confirmed — plain-object Supabase errors produce the generic fallback. Used `Object.assign(new Error('DB down'), { code: 'PGRST116' })` to make the error test pass while documenting the production bug.


## api/customers/route.test.ts + api/ac-units/route.test.ts + api/ac-units/[id]/route.test.ts (2026-06-29)

- **Two auth patterns coexist**: Old routes use `getUserFromRequest` (middleware/auth.ts) + manual role query. New routes use `requireApiRole` (lib/api-auth.ts) which wraps Clerk's `auth()` + Supabase role lookup in one call. Tests must mock the module the route actually imports — check the import statement before writing mocks.
- **Mock `@/lib/api-auth` directly**: Don't mock Clerk's `auth()` — mock the project's wrapper. `requireApiRole` returns a discriminated union (`{authorized: true, user, role}` | `{authorized: false, response}`). Tests construct these shapes directly via `vi.mocked(requireApiRole).mockResolvedValue(...)`.
- **Mock server actions at the import boundary**: Routes import `getCustomers`, `createCustomer` etc. from `@/lib/actions/*`. Mocking the action module lets tests control success/failure without touching Supabase. This is the cleanest integration test boundary for API routes.
- **Logging middleware must always be mocked**: `logRequest`/`logResponse` call `logger.debug` which works but pollutes test output. The no-op mock (`vi.fn()`) is sufficient. `measureDuration` needs a factory: `vi.fn(() => vi.fn(() => 42))` — outer fn creates a timer, inner fn returns a number.
- **No locations route exists**: The glob for `src/app/api/locations/**/route.ts` returned nothing — ac-units location filtering is done via query param on the ac-units route itself.
- **NextRequest URL construction**: `new NextRequest(url, { method, body })` — method defaults to GET if omitted. Body must be `JSON.stringify`-ed. For GET requests with query params, build the URL with `URLSearchParams` or construct the full URL string.
- **`NextResponse.json` shape**: Test bodies match `{ success, data?, error?, pagination? }` from `utils.ts`'s `jsonSuccess`/`jsonError` helpers. Assertions on `body.success` + `body.data` confirm the right helper was used.


## push-subscribe + push-unsubscribe + photos-signed-upload-url route tests (2026-06-29)

- **Logger mock must include top-level methods**: `api/utils.ts` calls `logger.error` directly (not through `.child()`). Mocking only `child: () => ({error})` causes `jsonError` and `handleApiError` to throw "logger.error is not a function" during error-path tests. Fix: `{ ...logMock, child: () => logMock }` where `logMock = {debug, error, info, warn}`.
- **`vi.mocked()` is cleaner than `vi.hoisted()` for simple overrides**: When the mock factory default matches the happy-path (e.g., `authenticateTechnician` returning `{userId, technicianId}`), use `vi.mocked(fn).mockResolvedValueOnce(errorResponse)` for failure cases. No need for hoisted variables unless the factory itself needs closure over the mock.
- **Supabase JS chain `.then` mock pattern**: For Postgrest chains (`from().delete().eq().eq()`), the chain resolves when awaited. Mock: `vi.fn().mockReturnThis()` for each chainable + `then: vi.fn((resolve) => resolve({error}))` for the terminal await.
- **Two auth patterns on routes**: `technician/` routes use `authenticateTechnician` + `isTechnicianContext` from `helpers.ts`. `photos/` routes use `getAuth` directly from Clerk. Tests mock whichever module the route imports — check import before writing tests.
- **`jsonError` calls `logger.error`**: All 400/500 paths go through `jsonError` or `handleApiError`, both of which call `logger.error`. Any test that triggers an error response MUST have a working top-level logger mock.
- **`createAdminClient` returns synchronously**: Unlike `createClient` (async, returns Promise), `createAdminClient` is synchronous — mock with `vi.mocked(createAdminClient).mockReturnValueOnce(...)`, not `mockResolvedValueOnce`.


## orders API route tests (2026-06-29)

- **Two auth patterns coexist in orders**: GET /api/orders and POST /api/orders/create use `requireApiRole` from `@/lib/api-auth` (does Clerk auth + Supabase role lookup in one call, returns `{authorized, response, user, role}`). PATCH /api/orders/[id] uses `requireAuth` from `@/app/api/middleware/auth` (returns `{id}` or null) then manually queries `user_management` via `createClient`. Tests mock whichever module the route actually imports — never assume.
- **`requireApiRole` mocks return shape not function**: When mocking `requireApiRole`, you return the full object `{authorized, response, user, role}` — the `response` field is already a `Response` object for the failure case (used verbatim as `auth.response`). Success case sets `response: null`. This is simpler to test than auth middleware chains.
- **PATCH dispatch routing is body-shape driven**: The `[id]` PATCH endpoint dispatches to one of four server actions based on the combination of `status` + companion fields (cancellation_reason, assigned_technician_id, scheduled_visit_date). Tests pin each dispatch branch by asserting the specific action was called with the expected args — no need to re-test the business logic inside the actions.
- **Empty body edge cases differ by route**: GET handles no searchParams gracefully (defaults page=1, limit=20 via Zod coerce). POST with empty body fails validation (400) because `customerId` is required. PATCH with empty body `{}` hits the "No actionable fields provided" 400. Each route's empty-body behavior is pinned separately.
- **Role check via `createClient` chain in PATCH**: The PATCH route calls `createClient().from('user_management').select('role').eq(...).maybeSingle()`. Mock needs to return `{data: {role}, error: null}` from `maybeSingle` — returning `data: null` simulates no-role (403). No need to mock the full chain since PATCH only uses this one table pre-validation.


## api/invoices/route.test.ts + api/invoices/send-email/route.test.ts (2026-06-29)

- **`vi.hoisted()` + class mock for Resend**: `vi.clearAllMocks()` resets `vi.fn().mockImplementation(...)` factory functions back to the initial `vi.fn()` (returning undefined). A `class MockResend { emails = { send: resendSendMock } }` defined at module level survives `clearAllMocks()` since it's a real class declaration, not a `vi.fn()`. Use this pattern for any third-party class constructor in tests.
- **`requireFinanceRoleAPI` returns NextResponse or null**: The middleware function either returns `null` (user authorized, test proceeds) or a `NextResponse` with 403 (user not authorized, test returns that response directly). Mocking it directly is cleaner than mocking Clerk + Supabase for the finance check — the middleware is tested elsewhere, the route just needs the binary gate.
- **Per-table `from` routing without call counter**: When the route calls `from()` with known table names (invoices, invoice_items, payment_records, invoice_configuration), routing by `table === 'xxx'` is cleaner than a call counter. Each table branch returns its own chain. Only use counters when the same table is queried multiple times.
- **Invoices list has GET-only (no POST, no [id])**: `src/app/api/invoices/route.ts` is the only invoice API route besides `send-email/`. Invoice CRUD is server-action-only, not REST API. The task for `api/invoices/[id]` and `api/payments/*` routes was "if exists" — neither exists. Documented in bug-findings.
- **`sendEmailMock.mockResolvedValueOnce({..., headers: null} as never)`**: Resend's `CreateEmailResponse` type requires `headers` field. The `as never` cast silences TypeScript while keeping the test focused on the error path. This is acceptable test ergonomics for third-party type mismatches.

