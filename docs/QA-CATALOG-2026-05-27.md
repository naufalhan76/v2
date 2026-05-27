# QA Findings — Service Catalog + Addons + Service Types + Unit Types + Capacity
## Date: 2026-05-27  Auditor: automated QA agent

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 3 |
| HIGH | 7 |
| MEDIUM | 8 |
| LOW | 5 |
| INFO | 4 |


---

## CRITICAL

### [CRITICAL-1] toggleCatalogActive silently succeeds on non-existent ID
**File:** `src/lib/actions/service-catalog.ts:173`
**Issue:** `toggleCatalogActive` calls `.update().eq('catalog_id', catalogId).select().single()`. If the ID does not exist, Supabase returns PGRST116 (no rows), which is treated as an error and returned as `{ success: false, error: ... }`. However the UI switch in `settings/service-catalog/page.tsx:404` does not re-fetch the row to confirm the new state — it only invalidates the query. If the toggle fires on a stale ID (e.g. row deleted in another tab), the switch visually snaps back only after the next refetch, giving a false-positive success toast for a brief window.
**Repro:** Delete a catalog entry in tab A while tab B has the same entry loaded. Toggle the switch in tab B before the query refetches.
**Fix:** Check `data === null` after `.single()` and return `{ success: false, error: 'Entry not found' }` explicitly before the revalidatePath call.

### [CRITICAL-2] Hard delete on service_catalog entries — no soft-delete guard
**File:** `src/lib/actions/service-config.ts:215`
**Issue:** `deleteServiceCatalogEntry` issues a hard `DELETE` against `service_catalog`. The CLAUDE.md convention states "records are never hard-deleted". If a catalog entry is referenced by existing `order_items.catalog_id`, the FK will either cascade-delete order item references or block the delete depending on DB constraint. No application-level guard checks for dependent order items before deletion.
**Repro:** Create an order referencing a catalog entry, then delete that entry via the ServiceCatalogTab.
**Fix:** Check `order_items` for any rows with `catalog_id = id` before deleting. If found, block and return an error. Use soft-delete (`is_active = false`) instead.

### [CRITICAL-3] bulkImportServiceCatalog creates unit types and service types without uniqueness check
**File:** `src/lib/actions/service-config.ts:262`
**Issue:** The bulk import loop uses `.ilike('name', unitTypeName).single()` to find existing unit types, but if two rows match the ilike (e.g. "Room Air" and "room air"), `.single()` throws PGRST116 and the code falls through to create a duplicate. Similarly for service types, the code generates a `serviceCode` from the CSV service name and does `eq('code', serviceCode)` — if the code already exists but with a different case or trailing space, a duplicate is inserted. No DB-level unique constraint is enforced at the application layer.
**Repro:** Import a CSV with "Room Air" when "room air" already exists in unit_types.
**Fix:** Use `.maybeSingle()` instead of `.single()` for all lookup queries in the bulk import loop. Add explicit duplicate handling.


---

## HIGH

### [HIGH-1] No server-side validation for negative base_price in service_catalog
**File:** `src/lib/actions/service-catalog.ts:107`
**Issue:** `createCatalogEntry` and `updateCatalogEntry` accept `base_price` from the caller with no server-side range check. The UI form schema uses `z.coerce.number().min(0)` (page.tsx:80), but the server action itself has no Zod schema — it trusts the input directly. A direct API call or a future server action caller can insert a negative price, which would propagate to invoices.
**Repro:** Call `createCatalogEntry({ ..., base_price: -50000 })` directly from a server context.
**Fix:** Add a Zod schema in the server action validating `base_price >= 0`, `duration_minutes >= 0`, and `msn_code` non-empty before the Supabase insert.

### [HIGH-2] No server-side validation for negative stock_quantity or unit_price in addons
**File:** `src/lib/actions/addons.ts:175`
**Issue:** `createAddon` and `updateAddon` accept `stock_quantity`, `minimum_stock`, and `unit_price` with no server-side validation. The UI form uses regex `^\d+(\.\d{1,2})?$` which prevents negatives in the browser, but the server action has no guard. A direct call can set `stock_quantity: -10` or `unit_price: -1`.
**Fix:** Validate all numeric fields server-side before insert/update.

### [HIGH-3] bulkUpdateStock is N+1 with no transaction — partial failure leaves inconsistent state
**File:** `src/lib/actions/addons.ts:371`
**Issue:** `bulkUpdateStock` fires one Supabase update per addon in `Promise.all`. If 3 of 10 updates fail, the function throws but the 7 successful updates are already committed. There is no rollback. The error message "Gagal mengupdate beberapa stok" gives no detail on which items failed.
**Repro:** Pass a mix of valid and invalid addon_ids to `bulkUpdateStock`.
**Fix:** Use a Supabase RPC or a DB function for atomic bulk update. At minimum, collect failed IDs and return them in the error so the caller can retry only the failed rows.

### [HIGH-4] Service pricing and service_catalog coexist with no clear precedence in order creation
**File:** `src/lib/actions/create-order.ts:447`
**Issue:** `getServicePricing()` in create-order.ts (line 447) still queries the legacy `service_pricing` table for price auto-fill in the order form. `getOrderConfigMasterData()` (line 565) queries `service_catalog`. Both are available to the UI simultaneously. The order form UI uses `serviceCatalog` for item selection but the legacy `getServicePricing` function is still exported and callable. There is no documented or enforced rule about which takes precedence when both have entries for the same service type.
**Fix:** Deprecate `getServicePricing` in create-order.ts. Remove it from the exported surface or add a comment marking it legacy-only. Ensure the order form exclusively uses `service_catalog` prices.

### [HIGH-5] deleteServicePricing is a hard delete with no FK guard
**File:** `src/lib/actions/service-pricing.ts:180`
**Issue:** `deleteServicePricing` issues a hard DELETE. The `orders` table has a legacy `order_type` field with an FK constraint to `service_pricing` (noted in create-order.ts:262). Deleting a pricing row that is referenced by existing orders will either fail silently or cascade depending on the DB constraint — the application does not check for dependent orders before deletion.
**Fix:** Check for dependent orders before deleting. Use soft-delete (set `is_active = false`) as the primary deactivation path.

### [HIGH-6] Service type active=false has no enforcement in order creation
**File:** `src/lib/actions/service-config.ts:9`
**Issue:** `getServiceTypes` returns all service types ordered by `display_order`. `getOrderConfigMasterData` in create-order.ts filters `service_types` with `.eq('is_active', true)`, which is correct. However `getCatalogLookups` in service-catalog.ts (line 237) fetches service types with no `is_active` filter — inactive service types appear in the catalog creation form dropdowns.
**Fix:** Add `.eq('is_active', true)` to the service_types query in `getCatalogLookups`.

### [HIGH-7] applicable_service_types is stored as raw text with no parsing or validation
**File:** `src/lib/actions/addons.ts:17`
**Issue:** The `applicable_service_types` field on `addon_catalog` is typed as `string | null` and stored/retrieved as raw text. There is no parsing, no validation, and no documented format (CSV? JSON array? space-separated?). The field is never read or filtered anywhere in the audited codebase — it is written but never consumed. This means the field is dead data with an undefined contract.
**Fix:** Define the format (recommend JSON array to match the `includes` pattern). Add a parser helper. Either enforce it in the server action or remove the field from the public interface until it is used.


---

## MEDIUM

### [MEDIUM-1] Duplicate msn_code — relies solely on DB constraint, no app-level pre-check
**File:** `src/lib/actions/service-catalog.ts:107`
**Issue:** `createCatalogEntry` does not pre-check for duplicate `msn_code` before inserting. It relies on the DB unique constraint to reject duplicates, which returns a raw Postgres error string to the client. The error message is not user-friendly and leaks DB internals.
**Fix:** Add a `.maybeSingle()` lookup for `msn_code` before insert and return a clean error message if found.

### [MEDIUM-2] includes array stored as null when empty — inconsistent with empty array
**File:** `src/lib/actions/service-catalog.ts:119`
**Issue:** `createCatalogEntry` normalises an empty `includes` array to `null`. `updateCatalogEntry` does the same. The UI parses `includes` back via `(entry.includes ?? []).join(', ')`. This is consistent within the V2 catalog, but `service_pricing` stores `includes` as a JSON array and the legacy page has defensive parsing (JSON.parse, Array.isArray checks) suggesting the DB may have mixed formats. If a catalog entry is created with `includes: []` it becomes `null` in DB, but if read back and compared to a service_pricing row with `includes: []` the types differ.
**Fix:** Document the canonical format. Add a migration to normalise all existing `includes` values to either always-null-when-empty or always-array.

### [MEDIUM-3] getCatalogLookups fetches all capacity ranges without is_active filter
**File:** `src/lib/actions/service-catalog.ts:233`
**Issue:** `getCatalogLookups` fetches capacity ranges with no `is_active` filter. Inactive capacity ranges appear in the catalog creation form. A user can create a catalog entry referencing a deactivated capacity.
**Fix:** Add `.eq('is_active', true)` to the capacity_ranges query in `getCatalogLookups`.

### [MEDIUM-4] getCatalogLookups fetches all unit types without is_active filter
**File:** `src/lib/actions/service-catalog.ts:230`
**Issue:** Same as MEDIUM-3 — unit types are fetched without an `is_active` filter, so inactive unit types appear in the catalog form dropdowns.
**Fix:** Add `.eq('is_active', true)` to the unit_types query in `getCatalogLookups`.

### [MEDIUM-5] deleteUnitType has no cascade guard for capacity_ranges or service_catalog
**File:** `src/lib/actions/service-config.ts:76`
**Issue:** `deleteUnitType` issues a hard DELETE with no check for dependent `capacity_ranges` or `service_catalog` rows. If the DB has ON DELETE CASCADE, all capacity ranges and catalog entries for that unit type are silently deleted. If it has ON DELETE RESTRICT, the delete fails with a raw DB error. Neither outcome is handled gracefully at the application layer.
**Fix:** Check for dependent capacity_ranges and service_catalog rows before deleting. Return a descriptive error listing the count of dependent records.

### [MEDIUM-6] deleteCapacityRange has no guard for dependent service_catalog entries
**File:** `src/lib/actions/service-config.ts:120`
**Issue:** Same pattern as MEDIUM-5. Deleting a capacity range that is referenced by `service_catalog.capacity_id` will either cascade or fail at the DB level with no application-level guard.
**Fix:** Check `service_catalog` for rows with `capacity_id = id` before deleting.

### [MEDIUM-7] ServiceCatalogTab (legacy) and settings/service-catalog page both write to the same table — dual edit surfaces
**File:** `src/app/dashboard/konfigurasi/service-config/components/ServiceCatalogTab.tsx` and `src/app/dashboard/settings/service-catalog/page.tsx`
**Issue:** Two separate UI surfaces can create, update, and delete entries in `service_catalog`. They use different server actions (`service-config.ts` vs `service-catalog.ts`), different validation logic, and different revalidation paths. The legacy tab does not revalidate `/dashboard/settings/service-catalog` and vice versa. An edit in one surface is not reflected in the other until the user navigates away and back.
**Fix:** Consolidate to a single server action module. Add cross-path revalidation to both action files, or deprecate the legacy ServiceCatalogTab and redirect users to the V2 page.

### [MEDIUM-8] Service pricing page uses hardcoded SERVICE_TYPES enum — diverges from DB
**File:** `src/app/dashboard/konfigurasi/service-pricing/page.tsx:71`
**Issue:** The service pricing page hardcodes 5 service types: CLEANING, REFILL_FREON, REPAIR, INSTALLATION, INSPECTION. The `service_types` table is dynamic and managed via the ServiceTypeTab. If an admin adds a new service type in the DB, it will not appear in the service pricing dropdown. Conversely, if a pricing row has a `service_type` value not in the hardcoded list, the badge renders the raw DB value instead of a label.
**Fix:** Fetch service types dynamically from the DB instead of using the hardcoded array.


---

## LOW

### [LOW-1] duration_minutes allows 0 — semantically invalid
**File:** `src/app/dashboard/settings/service-catalog/page.tsx:81`
**Issue:** The Zod schema uses `z.coerce.number().int().min(0)` for `duration_minutes`. A value of 0 passes validation but is semantically meaningless (a service with zero duration). The server action also accepts 0 without complaint.
**Fix:** Change min to 1, or treat 0 the same as null (no duration specified).

### [LOW-2] AC brand duplicate name — no app-level pre-check
**File:** `src/lib/actions/service-config.ts:143`
**Issue:** `createAcBrand` inserts without checking for an existing brand with the same name. Relies on DB constraint if one exists. No user-friendly duplicate error.
**Fix:** Add a `.maybeSingle()` name lookup before insert.

### [LOW-3] unit_of_measure is free text — typos silently accepted
**File:** `src/lib/actions/addons.ts:13`
**Issue:** `unit_of_measure` is stored as a free-text string. The UI offers a fixed list via `SearchableSelect` (pcs, kg, hour, visit, meter, set, unit, liter), but the server action accepts any string. A direct API call or future form change can store "pcs." or "Pcs" creating display inconsistencies.
**Fix:** Add an enum validation in the server action, or normalise to lowercase on write.

### [LOW-4] Display order conflicts not detected
**File:** `src/lib/actions/service-config.ts:9,48`
**Issue:** `createServiceType` and `createUnitType` accept a `display_order` field (via `Record<string, unknown>`) with no uniqueness check. Two entries can have the same `display_order`, resulting in non-deterministic sort order.
**Fix:** Either auto-assign display_order as max+1, or add a uniqueness check before insert.

### [LOW-5] getLowStockAddons fetches all active addons into memory for JS filtering
**File:** `src/lib/actions/addons.ts:343`
**Issue:** `getLowStockAddons` fetches all active addons and filters `stock_quantity < minimum_stock` in JavaScript because "Supabase doesn't support column-to-column comparison". This is correct for the Supabase JS client, but at scale (thousands of addons) this is a full table scan into memory. The comment acknowledges this.
**Fix:** Use a Postgres RPC or a DB view `low_stock_addons` that does the column comparison server-side. This is a performance issue, not a correctness issue.

---

## INFO

### [INFO-1] Two duplicate service catalog action modules
**Files:** `src/lib/actions/service-catalog.ts` and `src/lib/actions/service-config.ts`
**Note:** Both files export functions that read/write `service_catalog`. `service-catalog.ts` is the V2 canonical module used by the new settings page. `service-config.ts` contains the legacy versions used by the konfigurasi tabs. They have divergent filter capabilities (service-catalog.ts supports `isActive` filter; service-config.ts does not). This duplication will cause drift over time.
**Recommendation:** Migrate all callers to `service-catalog.ts` and delete the catalog-related functions from `service-config.ts`.

### [INFO-2] Invoice line items use service_catalog FK join — no addon FK validation
**File:** `src/lib/actions/invoices.ts:384`
**Issue:** `getOrderItemsForInvoice` joins `order_items` to `service_catalog` for price resolution. There is no equivalent join or validation for addon line items (`order_addons`). If an addon is deleted (hard delete) after being added to an order, the invoice will have a dangling reference. The `deleteAddon` function does check `order_addons` before deleting (addons.ts:266), which partially mitigates this, but only for the standalone delete path — bulk operations do not have this guard.
**Recommendation:** Add the same order_addons guard to any bulk delete or deactivation path for addons.

### [INFO-3] Capacity ranges can belong to only one unit type — by design
**Note:** `capacity_ranges.unit_type_id` is a single FK. A capacity label like "1.5 HP" cannot be shared across unit types without creating duplicate rows. This is by design (each unit type has its own capacity vocabulary) but worth documenting explicitly to avoid confusion when the same label appears under multiple unit types.

### [INFO-4] Legacy /konfigurasi/service-pricing page performs hard deletes
**File:** `src/app/dashboard/konfigurasi/service-pricing/page.tsx:237`
**Note:** The legacy service pricing page exposes a delete button that calls `deleteServicePricing` — a hard delete. Per CLAUDE.md convention, records should never be hard-deleted. This page should be deprecated or the delete replaced with a deactivation toggle.

---

## Cross-feature findings

### Order creation price source
`getOrderConfigMasterData` (create-order.ts:565) is the primary data source for the order form and correctly uses `service_catalog`. The legacy `getServicePricing` (create-order.ts:447) is still exported but appears unused by the current order form UI — it exists as a fallback. Invoice resolution (invoices.ts:444) falls back to `service_pricing` for old orders that predate the catalog migration. This two-tier fallback is intentional and documented in the code, but there is no explicit precedence rule if both tables have an entry for the same service type on a new order.

### Edit in one surface does not reflect in the other
Changes made via `/dashboard/settings/service-catalog` revalidate only that path. Changes made via `/dashboard/konfigurasi/service-config` (ServiceCatalogTab) revalidate only `/dashboard/konfigurasi/service-config`. A user editing in one tab will see stale data in the other until they navigate away and back.

