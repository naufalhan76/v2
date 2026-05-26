# Empty States Audit — 2026-05-26

**Goal:** Confirm every primary list/table/board uses `<EmptyState />` with an
icon, title, and helpful description (and an action button when applicable).

**Reference component:** `src/components/ui/empty-state.tsx`

## Audit Matrix

| # | Page                  | Route                                       | Pattern                                            | Verdict |
|---|-----------------------|---------------------------------------------|----------------------------------------------------|---------|
| 1 | Orders Board          | `/dashboard/orders?view=board`              | `<EmptyState />` per column (Phase 1)              | OK      |
| 2 | Orders List           | `/dashboard/orders?view=list`               | `<EmptyState />` (Phase 1)                         | OK      |
| 3 | Invoices List         | `/dashboard/keuangan/invoices`              | `<EmptyState />` icon `Receipt` (Phase 4 fix)      | OK      |
| 4 | Invoice Detail (payments) | `/dashboard/keuangan/invoices/[id]`     | `<EmptyState />` icon `Receipt` (Phase 4 fix)      | OK      |
| 5 | Customers             | `/dashboard/manajemen/customer`             | `<EmptyState />` icon `Users` (Phase 4 fix)        | OK      |
| 6 | Technicians           | `/dashboard/manajemen/teknisi`              | `<EmptyState />` icon `Wrench` (Phase 4 fix)       | OK      |
| 7 | Users                 | `/dashboard/manajemen/user`                 | `<EmptyState />` icon `User` (Phase 4 fix, table + mobile cards) | OK |
| 8 | Addons Catalog        | `/dashboard/konfigurasi/addons-catalog`     | `<EmptyState />` icon `Package` (Phase 4 fix)      | OK      |
| 9 | Service Pricing       | `/dashboard/konfigurasi/service-pricing`    | `<EmptyState />` icon `DollarSign` (Phase 4 fix)   | OK      |
| 10 | Today's Jobs         | `/technician`                                | `<EmptyTodayJobs />` (Phase 2)                     | OK      |
| 11 | History              | `/technician/history`                        | `<EmptyState />` (Phase 2)                         | OK      |

## Fixes Applied (this pass)

- **`src/app/dashboard/keuangan/invoices/page.tsx`** — replaced inline placeholder
  (`FileText` ad-hoc layout) with `<EmptyState icon={Receipt} title="Belum ada
  invoice" />` and an action that opens the "Buat Invoice Kosong" route. Loader2
  spinner replaced with `<TableSkeleton rows={8} columns={10} />` (cross-listed
  in loading audit).
- **`src/app/dashboard/keuangan/invoices/[id]/page.tsx`** — payment history
  card now always renders. When `payments.length === 0`, shows
  `<EmptyState icon={Receipt} title="Belum ada pembayaran" />` instead of
  hiding the entire card. Loader2 page-level spinner replaced with structured
  detail-page skeleton (cross-listed in loading audit).
- **`src/app/dashboard/manajemen/customer/page.tsx`** — replaced
  `Tidak ada data customer` placeholder cell with `<EmptyState icon={Users} />`
  + "Tambah Pelanggan" action that opens the create sheet.
- **`src/app/dashboard/manajemen/teknisi/page.tsx`** — replaced
  `No technicians found` placeholder cell with `<EmptyState icon={Wrench} />`
  + "Tambah Teknisi" action that opens the create sheet. Also replaced
  `Loading...` text with `<TableSkeleton />` (cross-listed in loading audit).
- **`src/app/dashboard/manajemen/user/page.tsx`** — replaced
  `Tidak ada user...` placeholder (both desktop table and mobile cards) with
  `<EmptyState icon={User} />`. Loader2 spinner replaced with table/card
  skeletons (cross-listed in loading audit). Empty state copy adapts to
  `searchQuery` to distinguish "no data" from "filter mismatch".
- **`src/app/dashboard/konfigurasi/addons-catalog/page.tsx`** — replaced
  ad-hoc `Belum ada add-ons` block with `<EmptyState icon={Package} />`
  + "Tambah Item" action wired to `handleOpenDialog()`.
- **`src/app/dashboard/konfigurasi/service-pricing/page.tsx`** — replaced
  ad-hoc `Belum ada harga service` block with `<EmptyState icon={DollarSign} />`
  + "Tambah Harga" action wired to `handleOpenDialog()`.

## Pages confirmed already-OK (no change)

- `/dashboard/orders` (board + list) — Phase 1.
- `/technician` and `/technician/history` — Phase 2.

## Out of scope / deferred

- Legacy `/dashboard/operasional/*` pages — to be removed in Phase 5; do not
  invest in empty-state polish there.
- `/dashboard/manajemen/lokasi`, `/dashboard/manajemen/ac-units` — legacy,
  Phase 5 cleanup.
- `/dashboard/keuangan/invoices/create*` — wizards/forms, not list-style empty
  states.

## Verification

```bash
npm run type-check
npm run lint
# Manual:
# 1. With a fresh DB (or filters that produce zero rows), visit each fixed
#    page. Confirm <EmptyState /> renders with icon + title + description.
# 2. Confirm the action button is wired (clicking opens the right modal/sheet).
```
