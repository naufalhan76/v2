# V1 vs V2 — Feature & Behavior Comparison

> **Status**: 2026-05-26 — V2 staging (after Phases 0-4)
> **Scope**: What changed, removed, added, or deferred between V1 (production) and V2 (staging)

This document is for QA / stakeholder review before merging V2 to production. It's organized by **what V1 users will notice missing** first, then everything else.

---

## TL;DR

V2 isn't a feature reduction — it's a **consolidation**. Almost nothing was *removed* in the sense of "users can no longer do X". A handful of pages were collapsed into unified views, redundant states were flattened, and one role (DISPATCHER) was merged into ADMIN.

The big additions: **technician mobile PWA**, **service reports with photos/signature**, **Kanban board with drag-drop**, **push notifications**, **auto-populate invoices**.

---

## 1. Pages REMOVED from sidebar (still accessible by direct URL during soft launch)

These pages no longer appear in the sidebar but the URLs still respond. They will be deleted in Phase 5 (cleanup).

| V1 sidebar item | V1 URL | V2 replacement |
|-----------------|--------|----------------|
| Operasional → Accept Order | `/dashboard/operasional/accept-order` | **Removed entirely.** V2 model: admin creates an order = order is already accepted. New orders land in `PENDING` directly. |
| Operasional → Assign Order | `/dashboard/operasional/assign-order` | Drag PENDING card → ASSIGNED column on `/dashboard/orders` Board, or "Assign Teknisi" button in Order Detail Panel |
| Operasional → Monitoring Ongoing | `/dashboard/operasional/monitoring-ongoing` | "Active" column on `/dashboard/orders` Board (shows EN_ROUTE + IN_PROGRESS together), or List view filtered by status |
| Operasional → Monitoring History | `/dashboard/operasional/monitoring-history` | List view at `/dashboard/orders?view=list&status=PAID,CANCELLED` |
| Operasional → Create Order | `/dashboard/operasional/create-order` | `/dashboard/orders/new` (currently redirects to existing form; full accordion rewrite deferred to Phase 3) |
| Manajemen → Lokasi | `/dashboard/manajemen/lokasi` | Tab inside Customer detail page (planned but not yet built — page still accessible via direct URL) |
| Manajemen → AC Units | `/dashboard/manajemen/ac-units` | Tab inside Customer detail page (planned but not yet built — page still accessible via direct URL) |
| Konfigurasi → Service Pricing | `/dashboard/konfigurasi/service-pricing` | Tab inside `/dashboard/settings/service-catalog` |
| Konfigurasi → Service Config | `/dashboard/konfigurasi/service-config` | Tab inside `/dashboard/settings/service-catalog` |
| Konfigurasi → SLA Service | `/dashboard/konfigurasi/sla-service` | Planned to become a field in service catalog entry (not yet implemented — page still accessible via direct URL) |
| Konfigurasi → Addons Catalog | `/dashboard/konfigurasi/addons-catalog` | `/dashboard/settings/addons` (sidebar link points here, page is the same) |
| Konfigurasi → Invoice Config | `/dashboard/konfigurasi/invoice-config` | `/dashboard/settings/invoice-settings` (sidebar link, same page) |

**No data was lost** for any of these. Just the navigation entry was removed/relocated.

---

## 2. Order State Machine — 16 states → 8 states

V1 had 16 distinct order statuses. V2 reduced to 8 canonical states with a status-mapper layer that converts legacy values at runtime, so existing orders in DB don't break.

| V1 state | V2 mapping | Reason |
|----------|------------|--------|
| `NEW` | → `PENDING` | Merged. Admin creating an order = order is accepted. |
| `ACCEPTED` | → `PENDING` | Merged. Same reason. |
| `ASSIGNED` | `ASSIGNED` | Kept |
| `EN ROUTE` (with space) | `EN_ROUTE` | Renamed (underscore for consistency) |
| `ARRIVED` | → `IN_PROGRESS` | Merged. V2 collapses "arrived but not started" into "in progress" since technician taps "Mulai Kerja" right after arriving. |
| `IN_PROGRESS` | `IN_PROGRESS` | Kept |
| `DONE` | → `COMPLETED` | Renamed for clarity |
| `RESCHEDULE` | → action, not state | V2 reschedule resets order to `PENDING` with a reason logged. No more permanent RESCHEDULE state. |
| `INVOICED` | `INVOICED` | Kept |
| `PAID` | `PAID` | Now a terminal state |
| `CLOSED` | → `PAID` | V1 had `PAID → CLOSED` distinction (closed = archived). V2: PAID is terminal. |
| `CANCELLED` | `CANCELLED` | Kept |
| `TO_WORKSHOP` | **dropped** | V2 has no workshop — service is on-site only |
| `IN_WORKSHOP` | **dropped** | Same |
| `READY_TO_RETURN` | **dropped** | Same |
| `DELIVERED` | **dropped** | Same |

**V2 canonical sequence:**
```
PENDING → ASSIGNED → EN_ROUTE → IN_PROGRESS → COMPLETED → INVOICED → PAID
                                                                       ↑ end
[Any state before COMPLETED] → CANCELLED → end
ASSIGNED / EN_ROUTE → reschedule action → PENDING
```

**What V1 users will notice:**
- Status badges show fewer distinct labels
- "Reschedule" is no longer a status — it's an action that pushes back to "Menunggu" (PENDING)
- Workshop-related statuses are gone

---

## 3. Workshop Flow — REMOVED ENTIRELY

V1 had concepts around taking AC units back to a workshop for repair. V2 is **on-site only**.

| V1 feature | V2 status |
|------------|-----------|
| `ac_status` enum: `WORKSHOP`, `PENDING` | Removed. V2 only has `ACTIVE`, `INACTIVE`, `RETIRED` |
| Order states: `TO_WORKSHOP`, `IN_WORKSHOP`, `READY_TO_RETURN`, `DELIVERED` | Removed |
| UI screens for workshop management | None existed in V1 codebase that we found, just enum values |

**Impact**: If you actually used workshop flow in V1, V2 staging won't support it. Need to discuss before merge.

---

## 4. Roles — DISPATCHER role removed

| V1 roles | V2 roles |
|----------|----------|
| SUPERADMIN | SUPERADMIN |
| ADMIN | ADMIN |
| **DISPATCHER** | merged into ADMIN |
| FINANCE | FINANCE |
| TECHNICIAN | TECHNICIAN |

**What V1 users will notice:**
- DISPATCHER users in V1 won't be able to log into V2 unless their role is updated to ADMIN
- V2 RLS policies don't reference DISPATCHER

**Migration note**: When promoting V2 to prod, need to UPDATE existing DISPATCHER rows in `user_management` table to ADMIN.

---

## 5. Tables / Schema — Added, kept-but-deprecated, none truly removed

### V2 ADDITIONS

| Table | Purpose |
|-------|---------|
| `service_reports` | Technician laporan (foto, material, harga aktual, signature). V2-only. |
| `push_subscriptions` | Web push subscriptions for technicians |

### V2 KEPT (legacy, still in schema for V1 compat — not used by V2 UI)

| Table | V2 status |
|-------|-----------|
| `service_records` | Kept for backward compat. V2 uses `service_reports` instead. Phase 5 migration script will copy old records → new reports format if needed. |
| `service_pricing` | Kept. V2 uses both `service_pricing` (simple flat) and `service_catalog` (per unit-type/capacity). They coexist for now; Phase 3 was supposed to merge them, deferred. |
| `payments` (legacy) | Kept. V2 uses `payment_records` for invoice payments. The old `payments` table is preserved for V1 compat but V2 doesn't write to it. |
| `service_reminders` | Kept and accessible. V2 didn't add new UI for it. |
| `sheet_sync_config` | Kept. V2 didn't add new UI. |

### V2 NOT YET APPLIED (Phase 5 cleanup)

These will be dropped in Phase 5 only after data migration:
- `orders.assigned_technician_id` column (V2 uses `order_technicians` join table for both lead + helpers)
- `orders.req_visit_date` column (duplicate of `scheduled_visit_date`)
- `orders.order_type` column (duplicated from `order_items.service_type`)

V2 reads from these columns when present, but doesn't rely on them.

---

## 6. Features V1 had that V2 DIDN'T touch (still work in V2)

These were preserved as-is:

- **Email invoice sending** (Resend integration) — works in V2 if `RESEND_API_KEY` is set
- **PDF export** (jsPDF + html2canvas) — works in V2
- **Blank invoice creation** — works in V2 (not order-linked; standalone billing)
- **Invoice revision** (re-issue with new number) — works in V2
- **API key management** — works in V2 at `/dashboard/admin/api-docs` (SUPERADMIN)
- **API documentation page** — same
- **Dashboard KPIs + charts** — preserved at `/dashboard`
- **Customer search by phone** during order creation — preserved
- **Multi-AC-unit orders** (one order can cover multiple AC units across multiple locations) — preserved
- **Helper technicians** (lead + N helpers per order) — preserved + improved (V2 adds reassign UI)
- **Soft delete pattern** (`deleted_at` columns) — preserved everywhere
- **Realtime channels** (orders, payments, service-records, service-pricing, service-sla) — preserved + extended

---

## 7. NEW in V2 (not in V1)

### Technician Mobile App (`/technician/*`)
- Mobile-first PWA (installable to home screen)
- 5 screens: Today's Jobs, Job Detail, Complete Form, History, Profile
- Photo upload with client-side compression
- HTML5 Canvas signature pad (`signature_pad` library)
- Material input with live total calculation
- localStorage auto-save draft (debounced)
- Offline banner when no connection
- Web push notifications (subscribe via Profile page)

### Admin Dashboard
- **Order Board** (Kanban) at `/dashboard/orders?view=board` with drag-drop status transitions
- **Order List** view at `/dashboard/orders?view=list` (TanStack Table with bulk actions)
- **Order Detail Panel** (slide-over Sheet) with 4 tabs: Detail, Technician Report, Invoice, History
- **Technician Report tab** — view photos/materials/signature submitted by technician
- **Auto-populate invoice from service report** at `/dashboard/keuangan/invoices/create/from-order/[orderId]`
- **Reassign action** (replace lead technician while ASSIGNED)
- **Reschedule modal** (drag ASSIGNED→PENDING with reason)
- **Realtime sync** — admin board live-updates when technician changes status
- **Optimistic mutations** — drag-drop feels instant, rolls back on error

### Invoice Flow
- **Prominent remaining-balance banner** for partial-paid invoices
- **Payment history with running-balance column**
- **RecordPaymentModal** with "Bayar Penuh" shortcut + partial payment validation
- **Service report integration** — invoice line items pre-filled from technician's report

### Push Notifications
- VAPID-based web push for technicians
- Triggers: new job assigned, job rescheduled, job reassigned away
- Service worker handles push, notification click, subscription change events
- Profile page toggle to enable/disable
- Backend auto-prunes dead subscriptions (404/410)

### UI/UX
- **8-color status badge system** (single source of truth in `src/lib/order-status.ts`)
- **EmptyState component** used across all pages
- **Skeleton loading** replaces spinner-only loading on all pages
- **Status mapper layer** — UI speaks 8 canonical states, mapper handles legacy DB values
- **Error boundaries** at root, dashboard, and technician routes
- **Sidebar restructure** — flat 5 top-level + Settings group

---

## 8. Deferred — planned for V2 but not yet shipped

These were spec'd but pushed to later phases (out of scope for this staging release):

| Feature | Phase | Status |
|---------|-------|--------|
| Single-page accordion Create Order form | Phase 3 | **Deferred**. V2 currently redirects `/dashboard/orders/new` to existing wizard. |
| Service Catalog data model merge (pricing + config in one table) | Phase 3 | **Deferred**. V2 ships tabbed shell embedding both old pages. |
| SLA Service field merged into service catalog | Phase 3 | **Deferred** |
| Customer detail page with Lokasi/AC Units tabs inline | Phase 1+ | **Deferred**. Old pages still work at their original URLs. |
| Phase 5 cleanup: drop legacy enum values | Phase 5 | **Not started** |
| Phase 5: drop redundant columns (`assigned_technician_id`, etc.) | Phase 5 | **Not started** |
| Phase 5: delete legacy operasional pages | Phase 5 | **Not started** |
| Form validation migration (useState → RHF+Zod across all forms) | Phase 4 audit | **Inventory only**. Migration tracked as follow-up issue. |
| Bulk cancel multiple orders (batch action) | Phase 1 | UI shipped, backend uses sequential cancellation as workaround |
| Offline-first technician app | Out of scope | Just shows offline banner; no sync queue |
| GPS tracking technician | Out of scope | Not planned |
| Customer self-service portal | Out of scope | Not planned |

---

## 9. Database — schema differences from V1

V2 staging Supabase project has the **same schema** as V1 production, plus:

```sql
-- Added enum values (additive, V1 still works)
ALTER TYPE order_status ADD VALUE 'PENDING';
ALTER TYPE order_status ADD VALUE 'COMPLETED';

-- New tables
CREATE TABLE service_reports (...);
CREATE TABLE push_subscriptions (...);

-- New columns (additive)
ALTER TABLE technicians ADD COLUMN auth_user_id UUID;
```

V2 staging uses a **separate Supabase project** (`dejzpeytapjolajveond.supabase.co`), so testing won't touch V1 production data.

---

## 10. Quick visual cheat-sheet

```
                    V1                              V2
                    ──                              ──
Sidebar              Dashboard                       Dashboard
                     Operasional (5 sub)             Orders          ← unified
                     Manajemen (5 sub)               Invoices
                     Konfigurasi (5 sub)             Customers
                     Keuangan (1 sub)                Technicians
                     Admin (1 sub)                   Settings (group)

Order states         16 distinct                     8 canonical

Roles                5 (incl. DISPATCHER)            4 (no DISPATCHER)

Technician access    None (WhatsApp only)            Mobile PWA at /technician

Service report       Manual via WhatsApp             Photos+materials+signature in app

Push notifications   None                            Web push for technicians

Invoice creation     Manual line items               Auto-populate from service report

Drag-drop board      None                            Yes, with optimistic updates

Status colors        Hard-coded per page (97x)       Single source (badge components)

Empty states         Mostly missing                  Standardized EmptyState component

Loading patterns     Mostly Loader2 spinner          Skeleton patterns (4-tier rules)
```

---

## 11. Risk register for V2 → V1 promotion

If we eventually merge V2 to production, these are the gotchas:

| Risk | Mitigation |
|------|-----------|
| DISPATCHER users can't log in | UPDATE script to convert DISPATCHER → ADMIN before deploy |
| Old order data uses legacy states (NEW/ACCEPTED/DONE/CLOSED) | Status mapper handles at runtime; data migration script in Phase 5 finalizes |
| Workshop flow gone | Confirm with stakeholders this isn't actively used |
| `service_records` rows still exist but UI shows nothing | Migrate to `service_reports` if historical data matters |
| Forms still using useState (not RHF+Zod) | Inventory documented; migrate gradually post-launch |
| Phase 5 not done = legacy URLs still work | Acceptable for soft launch; lock down before final cutover |

---

## 12. Documents for deeper reading

- **PRD**: `docs/superpowers/specs/2026-05-26-msn-erp-v2-prd.md`
- **Design Spec**: `docs/superpowers/specs/2026-05-26-msn-erp-v2-design.md`
- **Phase plans**: `docs/superpowers/plans/2026-05-26-phase-{0,1,2,3,4}-*.md`
- **UX audits**: `docs/superpowers/audits/2026-05-26-{empty-states,loading-states,forms}-audit.md`
- **Staging guide**: `docs/STAGING.md`
