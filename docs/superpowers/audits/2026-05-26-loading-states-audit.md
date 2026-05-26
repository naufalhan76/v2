# Loading States Audit — 2026-05-26

Reference: design spec §8.5 (4 tiers).

| Tier | Use case | Component |
|------|----------|-----------|
| 1 | Initial page load | `<TableSkeleton />`, `<KpiCardSkeleton />`, structured inline skeletons |
| 2 | Mutation in flight | inline `<Loader2 className="animate-spin" />` inside button |
| 3 | Modal / Sheet async content | `<LoadingOverlay />` |
| 4 | Optimistic | no spinner — UI updates immediately |

## Audit Matrix

| #  | Page                         | Route                                       | Initial-load pattern (after Phase 4)                  | Verdict |
|----|------------------------------|---------------------------------------------|-------------------------------------------------------|---------|
| 1  | Orders Board                 | `/dashboard/orders?view=board`              | `KanbanBoardSkeleton` (Phase 1)                        | OK      |
| 2  | Orders List                  | `/dashboard/orders?view=list`               | `TableSkeleton` (Phase 1)                              | OK      |
| 3  | Invoices List                | `/dashboard/keuangan/invoices`              | `<TableSkeleton rows={8} columns={10} />` (Phase 4)    | OK      |
| 4  | Invoice Detail               | `/dashboard/keuangan/invoices/[id]`         | Header + meta-grid + table inline skeleton (Phase 4)   | OK      |
| 5  | Customers                    | `/dashboard/manajemen/customer`             | `TableSkeleton` (existing)                             | OK      |
| 6  | Technicians                  | `/dashboard/manajemen/teknisi`              | `<TableSkeleton rows={5} columns={5} />` (Phase 4)     | OK      |
| 7  | Users                        | `/dashboard/manajemen/user`                 | `TableSkeleton` (desktop) + card skeletons (mobile, Phase 4) | OK |
| 8  | Addons Catalog               | `/dashboard/konfigurasi/addons-catalog`     | `<TableSkeleton rows={6} columns={7} />` (Phase 4)     | OK      |
| 9  | Service Pricing              | `/dashboard/konfigurasi/service-pricing`    | `<TableSkeleton rows={6} columns={7} />` (Phase 4)     | OK      |
| 10 | Invoice Config               | `/dashboard/konfigurasi/invoice-config`     | Inline form skeleton matching tabs + 6 fields (Phase 4) | OK     |
| 11 | Profile (admin)              | `/dashboard/profile`                        | Inline form skeleton (avatar + 4 fields) (Phase 4)     | OK      |
| 12 | Today's Jobs (technician)    | `/technician`                                | `TodayJobsSkeleton` (Phase 2)                          | OK      |
| 13 | History (technician)         | `/technician/history`                        | `HistoryListSkeleton` (Phase 2)                        | OK      |

## Fixes Applied (this pass)

### Tables → `<TableSkeleton />`

- **`src/app/dashboard/keuangan/invoices/page.tsx`** — replaced
  `<Loader2 ... />` centered spinner with `<TableSkeleton rows={8} columns={10} />`
  to match the invoice table layout.
- **`src/app/dashboard/manajemen/teknisi/page.tsx`** — replaced
  `<div className="text-center py-8">Loading...</div>` text with
  `<TableSkeleton rows={5} columns={5} />`.
- **`src/app/dashboard/manajemen/user/page.tsx`** — replaced two
  `Loader2` blocks: desktop table now uses `<TableSkeleton rows={6} columns={6} />`,
  mobile card list now renders 4 placeholder cards with pulse skeletons.
- **`src/app/dashboard/konfigurasi/addons-catalog/page.tsx`** — replaced
  centered `Loader2` with `<TableSkeleton rows={6} columns={7} />`.
- **`src/app/dashboard/konfigurasi/service-pricing/page.tsx`** — replaced
  centered `Loader2` with `<TableSkeleton rows={6} columns={7} />`.

### Forms → inline structured skeletons

- **`src/app/dashboard/konfigurasi/invoice-config/page.tsx`** — replaced
  full-screen centered `Loader2` with an inline skeleton matching the tabbed
  form (header + tabs strip + 6 field rows + submit button placeholder).
  Keeps the spinner in the submit button (Tier 2) untouched.
- **`src/app/dashboard/profile/page.tsx`** — replaced full-screen centered
  `Loader2` with an inline skeleton matching the profile card (avatar bubble +
  4 field rows + submit button). Keeps the upload spinner overlay (Tier 3) and
  submit-button spinners (Tier 2) untouched.

### Detail pages → structured skeleton

- **`src/app/dashboard/keuangan/invoices/[id]/page.tsx`** — replaced full-page
  `Loader2` with an inline skeleton: page header, 6-tile meta grid, then
  `<TableSkeleton rows={4} columns={5} />` for line items. Roughly matches the
  final layout to keep CLS low.

## Mutation buttons — kept as-is (Tier 2)

These spinners are inside button labels during mutation — correct per spec, no
change needed:

- `src/app/dashboard/keuangan/invoices/[id]/page.tsx` lines ~720, ~760, ~1540 —
  status update / record payment / send email buttons.
- `src/app/dashboard/manajemen/user/page.tsx` lines ~344, ~553 — modal save +
  delete confirm buttons.
- `src/app/dashboard/keuangan/invoices/create*` — wizard submit buttons.
- `src/app/dashboard/konfigurasi/addons-catalog/page.tsx`,
  `src/app/dashboard/konfigurasi/service-pricing/page.tsx`,
  `src/app/dashboard/konfigurasi/invoice-config/page.tsx` — submit buttons.
- `src/app/dashboard/profile/page.tsx` — save profile + change password buttons,
  plus avatar upload overlay.

## Modal/Sheet async content — `<LoadingOverlay />` (Tier 3)

Already-OK examples (no change):

- `src/app/dashboard/manajemen/customer/page.tsx` — wraps create/edit/delete
  flows with `<LoadingOverlay />` for the row + page-level transitions.

## Out of scope

- Legacy `/dashboard/operasional/*` pages — Phase 5 cleanup target.

## Verification

```bash
npm run type-check
npm run lint
# Manual:
# Throttle network in devtools → reload each fixed page → confirm skeleton
# matches final layout (no large CLS).
```
