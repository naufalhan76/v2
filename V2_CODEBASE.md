# MSN ERP V2 — Codebase, Database, & Deployment Audit

> Generated: 2026-05-30
> Full V1 vs V2 feature comparison: `docs/V1-vs-V2-comparison.md`

---

## 1. Overview

V2 = same codebase, same Next.js App Router routes. Bukan branch terpisah. V2 adalah **next iteration** dari V1 dengan fitur baru + restruktur. V1 dan V2 **bisa** jalan bareng di VPS yang sama (beda port, beda Supabase project).

| Concern | V1 (Production) | V2 (Staging) |
|---------|----------------|--------------|
| **Hosting** | Vercel (serverless) | Docker di VPS (`msn-erp-v2` container) |
| **Port** | Vercel-managed | `127.0.0.1:3001` (map ke `:3000` dalam container) |
| **URL** | (Vercel domain) | `https://v2.nufnh.my.id` via Cloudflare tunnel `hermes-stack` |
| **Supabase** | `ybxnosmcjubuezefofko.supabase.co` | `dejzpeytapjolajveond.supabase.co` (SEPARATE project) |
| **Auth** | Supabase Auth (project A) | Supabase Auth (project B) — **beda user pool** |
| **Supabase Anon Key** | V1 punya | `eyJhbGci...3UHqCg` |
| **Supabase Service Role** | V1 punya | `eyJhbGci...XN7KI` |
| **Storage Buckets** | V1 punya | `service-photos` (public read), `signatures` (private) |
| **Web Push VAPID** | V1 punya | Public: `BKGK-Gp...GC_w`, Private: `Ookg6-...8jyE` |
| **Email (Resend)** | Active (V1 key) | Not configured (RESEND_API_KEY= kosong) |
| **Cron Secret** | V1 punya | `fbbcde...92e05` |

---

## 2. Supabase — Dua Project Terpisah

V1 dan V2 pakai **Supabase project berbeda**. Tidak share data.

### V1 Supabase (`ybxnosmcjubuezefofko`)
- Production data
- Direferensi di `.env.staging.example` (template awal staging)
- V1 Vercel deployment pakai ini

### V2 Supabase (`dejzpeytapjolajveond`)
- Staging/testing data
- Direferensi di `.env.staging` (aktif digunakan Docker)
- Schema: V1 schema + V2 additions (additive migrations)
- `docs/V1-vs-V2-comparison.md:264`: "V2 staging uses a separate Supabase project"

### V2 Schema Additions di Supabase `dejzpeytapjolajveond`

| Migration | File | Isi |
|-----------|------|-----|
| Schema + RLS | `supabase/migrations/00_v2_schema.sql` | Full V2 schema (enums, tables, indexes) |
| RLS Policies | `supabase/migrations/01_v2_rls.sql` | Row-level security per role |
| Reminders | `supabase/migrations/02_phase5_reminders.sql` | `reminder_rules`, `customer_reminders` |
| Integrity | `supabase/migrations/03_phase7_integrity.sql` | FK constraints, NOT NULL, cascades |
| Invoice RPC | `supabase/migrations/04_invoice_number_rpc.sql` | `next_invoice_number()` function |
| Enum + Tables | `supabase/migrations/20260526000000_add_pending_completed_service_reports_push.sql` | Add `PENDING`, `COMPLETED` enum values + `service_reports`, `push_subscriptions` |

### Schema Key Changes dari V1

- **Enum `order_status`**: V1 16 states → V2 8 canonical (`PENDING`, `ASSIGNED`, `EN_ROUTE`, `IN_PROGRESS`, `COMPLETED`, `INVOICED`, `PAID`, `CANCELLED`). Legacy values mapped at runtime via `src/lib/order-status.ts`.
- **Enum `role_type`**: V2 drops `DISPATCHER` (merge ke ADMIN). Hanya 4: `SUPERADMIN`, `ADMIN`, `FINANCE`, `TECHNICIAN`.
- **Enum `ac_status`**: V2 drops `WORKSHOP`, `PENDING` (workshop flow removed).
- **New table `service_reports`**: Ganti `service_records` untuk laporan teknisi (foto, material, harga, signature).
- **New table `push_subscriptions`**: Web push subscriptions per user.
- **New column `technicians.auth_user_id`**: Link teknisi ke Supabase Auth user (untuk RLS + `/technician` routes).
- **New column `ac_units.next_service_due_date`**: Untuk reminder system.
- **Legacy table `service_pricing`**: Masih ada (V1 compat). V2 pakai `service_catalog` yang lebih granular (per unit_type + capacity).
- **Legacy table `payments`**: Masih ada. V2 pakai `payment_records` untuk invoice payments.
- **Dropped columns (Phase 5)**: `orders.assigned_technician_id`, `orders.req_visit_date`, `orders.order_type`.

---

## 3. Deployment — Docker vs Vercel

### V2 Deployment (Docker di VPS)

```
Browser ──HTTPS──▶ Cloudflare Tunnel (hermes-stack) ──▶ 127.0.0.1:3001 ──▶ Docker container (port 3000)
                                                                                  │
                                                                                  └── Supabase: dejzpeytapjolajveond
```

**File kunci:**
| File | Purpose |
|------|---------|
| `Dockerfile` | Multi-stage build (deps → builder → runner). `NEXT_PUBLIC_*` di-bake saat build. |
| `docker-compose.yml` | Container config: image `msn-erp-v2:latest`, port `3001:3000`, env dari `.env.staging`, healthcheck, logging rotation. |
| `.dockerignore` | Standard exclusions. |
| `scripts/staging.sh` | Deploy helper: `start`, `stop`, `restart`, `logs`, `status`, `tunnel`. Cloudflare tunnel auto-config. |
| `.env.staging` | Runtime env vars untuk container (Supabase URL project B, VAPID keys, CRON_SECRET). |
| `next.config.js` | `output: 'standalone'` — wajib untuk Docker build. |

**Commands:**
```bash
./scripts/staging.sh start      # Build + start container
./scripts/staging.sh stop       # Stop container
./scripts/staging.sh restart    # Rebuild + restart
./scripts/staging.sh logs       # Tail logs
./scripts/staging.sh status     # Health check
./scripts/staging.sh tunnel     # Add v2.nufnh.my.id to Cloudflare
```

**Update V2:**
```bash
git pull
./scripts/staging.sh restart
```

**URL untuk cron:**
- `https://v2.nufnh.my.id/api/admin/reminders/run` (Bearer `CRON_SECRET`)

### V1 Deployment (Vercel)

- Tidak ada `vercel.json` di repo (Vercel auto-detect Next.js).
- Supabase project: `ybxnosmcjubuezefofko`.
- Deploy via push to main → Vercel auto-build.

### Promosi V2 → V1

1. Test di `https://v2.nufnh.my.id`
2. Push branch → Vercel deploy preview
3. Merge ke main → Vercel production
4. Stop V2 staging: `./scripts/staging.sh stop`

---

## 4. Environment Variables — Per Environment

### `.env.local` (dev/test — dummy values)
```
NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<placeholder>
SUPABASE_SERVICE_ROLE_KEY=<placeholder>
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<placeholder>
VAPID_PRIVATE_KEY=<placeholder>
VAPID_SUBJECT=mailto:test@example.com
```

### `.env.staging` (V2 Docker — active)
```
NEXT_PUBLIC_SUPABASE_URL=https://dejzpeytapjolajveond.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...3UHqCg
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...XN7KI
POSTGRES_URL=postgresql://postgres.dejzpeytapjolajveond:...@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BKGK-Gp...GC_w
VAPID_PRIVATE_KEY=Ookg6-...8jyE
VAPID_SUBJECT=mailto:admin@nufnh.my.id
RESEND_API_KEY=
CRON_SECRET=fbbcde...92e05
```

### `.env.staging.example` (template — points to V1 Supabase)
```
NEXT_PUBLIC_SUPABASE_URL=https://ybxnosmcjubuezefofko.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@nufnh.my.id
RESEND_API_KEY=
CRON_SECRET=
```

> **⚠️ Discrepancy**: `.env.staging.example` points to V1 project (`ybxnosmcjubuezefofko`) tapi `.env.staging` (aktif) points ke V2 project (`dejzpeytapjolajveond`). Docs `STAGING.md:3` juga outdated — bilang "Same Supabase database as V1" padahal beda project. Realitanya: **V2 staging pakai Supabase project sendiri**.

---

## 5. V2-Specific Code — Semua File Terkait

### V2 Schema & Migration
| File | Keterangan |
|------|------------|
| `supabase/migrations/00_v2_schema.sql` | Full schema V2 (≈450 lines). Semua enum, tabel, index. |
| `supabase/migrations/01_v2_rls.sql` | RLS policies V2. Semua tabel + role-based access. |
| `supabase/migrations/02_phase5_reminders.sql` | `reminder_rules`, `customer_reminders`. |
| `supabase/migrations/03_phase7_integrity.sql` | FK constraints, cascades. |
| `supabase/migrations/04_invoice_number_rpc.sql` | `next_invoice_number()` RPC. |
| `supabase/migrations/20260526000000_add_pending_completed_service_reports_push.sql` | Additive: enum values + new tables. |

### V2 Core Library
| File | Keterangan |
|------|------------|
| `src/lib/order-status.ts` | Status mapper — `toCanonical()` convert legacy state ke 8 canonical. Single source of truth untuk status colors. |
| `src/lib/status-colors.ts` | Invoice + service type color tokens. |
| `src/lib/push.ts` | Browser push helpers (VAPID). |
| `src/lib/server/push-sender.ts` | Server-side push notification sender. |
| `src/lib/realtime.ts` | Supabase realtime channels (orders, payments, service-reports, pricing, SLA). |
| `src/lib/actions/reminders.ts` | Reminder generation + send logic. |
| `src/lib/reminder-utils.ts` | Template helpers. |

### V2 Hooks
| File | Keterangan |
|------|------------|
| `src/hooks/use-order-mutation.ts` | Standardized order mutations (optimistic updates). |
| `src/hooks/use-invoice-mutation.ts` | Standardized invoice mutations. |

### V2 Components — Orders
| File | Keterangan |
|------|------------|
| `src/components/orders/status-badge.tsx` | Order status badge (8 canonical states). |
| `src/components/orders/service-type-badge.tsx` | Service type color coding. |
| `src/components/orders/order-card.tsx` | Card di Kanban board (urgency border). |
| `src/components/orders/order-detail-panel.tsx` | Slide-over Sheet (4 tabs: Detail, Technician Report, Invoice, History). |
| `src/components/orders/kanban-board.tsx` | Drag-drop board wrapper (`@dnd-kit`). |

### V2 Components — Technician
| File | Keterangan |
|------|------------|
| `src/components/technician/complete-job-form-v2.tsx` | **V2 Complete Job Form** (381 lines). Foto, material, harga, signature, auto-save draft localStorage, offline support via `sync-manager`. |
| `src/components/technician/signature-pad.tsx` | HTML5 Canvas signature wrapper (`signature_pad` library). |
| `src/components/technician/ac-unit-form.tsx` | Multi-AC unit sub-form dalam complete job. |
| `src/components/technician/sync-status.tsx` | Offline sync status indicator. |

### V2 Components — Invoice
| File | Keterangan |
|------|------------|
| `src/components/invoices/status-badge.tsx` | Invoice status badge. |

### V2 Components — UI
| File | Keterangan |
|------|------------|
| `src/components/ui/empty-state.tsx` | Reusable empty state placeholder. |

### V2 Pages — Admin Dashboard
| File | Keterangan |
|------|------------|
| `src/app/dashboard/orders/page.tsx` | **V2 Orders page** (Board + List dual view). |
| `src/app/dashboard/orders/new/page.tsx` | Create Order (accordion sections, redirect from old wizard). |
| `src/app/dashboard/reminders/page.tsx` | Reminder queue UI. |
| `src/app/dashboard/settings/reminder-rules/page.tsx` | Reminder rules CRUD. |
| `src/app/dashboard/manajemen/customer/[id]/page.tsx` | Customer detail with Lokasi/AC Units/Orders tabs. |
| `src/app/dashboard/settings/service-catalog/page.tsx` | Unified service catalog (merge pricing + config). |
| `src/app/dashboard/keuangan/invoices/create/from-order/page.tsx` | Invoice auto-populate dari service report. |

### V2 Pages — Technician PWA
| File | Keterangan |
|------|------------|
| `src/app/technician/page.tsx` | Today's Jobs. |
| `src/app/technician/job/[...id]/page.tsx` | Job Detail (state-aware UI). Pakai `?v=1` query param toggle V1 vs V2 form. |
| `src/app/technician/history/page.tsx` | Full history (paginated). |
| `src/app/technician/profile/page.tsx` | Profile + push notification toggle. |

### V2 API Routes — Technician
| File | Keterangan |
|------|------------|
| `src/app/api/technician/jobs/today/route.ts` | GET today's assigned jobs. |
| `src/app/api/technician/jobs/[...id]/route.ts` | GET job detail, POST status transition, POST submit report. Line 333: calls `technician_submit_report_v2` RPC. |
| `src/app/api/technician/history/route.ts` | GET past jobs (paginated). |
| `src/app/api/technician/push/subscribe/route.ts` | POST register push subscription. |
| `src/app/api/technician/push/unsubscribe/route.ts` | DELETE unregister. |
| `src/app/api/technician/push/public-key/route.ts` | GET VAPID public key. |

### V2 API Routes — Admin
| File | Keterangan |
|------|------------|
| `src/app/api/admin/reminders/run/route.ts` | POST trigger reminder generation (cron endpoint). |
| `src/app/api/service-reports/[reportId]/route.ts` | GET service report detail. |
| `src/app/api/service-reports/[reportId]/signature/route.ts` | GET/POST customer signature. |

### V2 Schemas
| File | Keterangan |
|------|------------|
| `src/app/api/schemas/technician.ts` | Zod schemas untuk technician API (report payload, etc.). |

### V2 Offline/Sync
| File | Keterangan |
|------|------------|
| `src/lib/offline/sync-manager.ts` | Offline queue manager — `enqueueReport()`, `enqueuePhoto()`, `newIdempotencyKey()`. |

### V2 Static / Public
| File | Keterangan |
|------|------------|
| `public/technician-sw.js` | Service worker untuk push notifications + PWA. |
| `public/manifest.json` | PWA manifest (MSN ERP - Technician). |

### V2 Scripts
| File | Keterangan |
|------|------------|
| `scripts/staging.sh` | Deploy helper (≈178 lines). Container + Cloudflare tunnel management. |
| `scripts/generate-vapid-keys.ts` | Generate VAPID key pair. |
| `scripts/bootstrap-staging.mjs` | Bootstrap staging environment. |
| `scripts/phase5-migrate.mjs` | Phase 5 data migration script. |
| `scripts/qa-cleanup.ts` | QA environment cleanup. |
| `scripts/seed-qa-accounts.ts` | Seed QA test accounts. |

### V2 Docs
| File | Keterangan |
|------|------------|
| `docs/superpowers/specs/2026-05-26-msn-erp-v2-prd.md` | Full PRD — goals, stories, requirements, states, risks. |
| `docs/superpowers/specs/2026-05-26-msn-erp-v2-design.md` | Technical design — architecture, DB, UI, phases. |
| `docs/plan-restructure-v2.md` | Earlier restructure plan (pre-design spec). |
| `docs/V1-vs-V2-comparison.md` | Feature comparison — what changed, removed, added, deferred. |
| `docs/STAGING.md` | Staging deployment guide. |
| `docs/CRON-SETUP.md` | Cron setup for reminders (references `v2.nufnh.my.id`). |
| `docs/REMINDER-SYSTEM.md` | Reminder system documentation. |
| `docs/QA-*.md` | QA audit docs (V1 vs V2 schema differences, leaks). |

---

## 6. V1-vs-V2 Toggle di Code

### Technician Job Form — `?v=1`

`src/app/technician/job/[...id]/page.tsx:22`:
```tsx
// Pakai search param v=1 untuk fallback ke V1 form
const showV1 = searchParams?.v === '1'
{showV1 ? <CompleteJobForm ... /> : <CompleteJobFormV2 ... />}
```

V2 form = default. V1 form = fallback via query param.

### RPC — `technician_submit_report_v2`

`src/app/api/technician/jobs/[...id]/route.ts:333`:
```ts
const { data: result, error: rpcError } = await supabase.rpc('technician_submit_report_v2', {
  p_order_id: orderId,
  p_technician_id: technicianId,
  p_photos_before: photos_before,
  p_photos_after: photos_after,
  p_materials: materials,
  p_actual_total_price: actual_total_price,
  p_customer_signature_url: customer_signature_url,
  p_customer_name_signed: customer_name_signed,
  p_signed_at: signed_at,
  p_notes: notes,
  p_work_started_at: work_started_at,
  p_work_completed_at: work_completed_at,
})
```

V2 report submission = database RPC, bukan direct INSERT.

---

## 7. Status Mapper — Bridging V1 ↔ V2

`src/lib/order-status.ts`:

```ts
export function toCanonical(status: string): CanonicalOrderStatus {
  switch (status) {
    case 'NEW':
    case 'ACCEPTED':
      return 'PENDING'
    case 'ARRIVED':
      return 'IN_PROGRESS'
    case 'DONE':
      return 'COMPLETED'
    case 'CLOSED':
      return 'PAID'
    default:
      return status as CanonicalOrderStatus
  }
}
```

UI layer hanya bicara 8 canonical states. Mapper handle legacy DB values. Phase 5 akan migrate semua data + drop mapper.

---

## 8. Sidebar Restructure

| V1 Sidebar | V2 Sidebar |
|------------|------------|
| Dashboard | Dashboard |
| Operasional (5 sub: accept-order, assign-order, create-order, monitoring-ongoing, monitoring-history) | **Orders** (unified) |
| Manajemen (5 sub: customer, teknisi, lokasi, ac-units, user) | **Customers** |
| | **Technicians** |
| | **Invoices** |
| Konfigurasi (5 sub) | **Settings** (group: Service Catalog, Addons, Invoice Settings, Users, API Docs) |
| Keuangan (1 sub) | |
| Admin (1 sub) | |

---

## 9. Tech Stack (V2-Specific Additions)

| Library | Purpose | V1 | V2 |
|---------|---------|:--:|:--:|
| `@dnd-kit/core` | Drag-drop Kanban | ✗ | ✓ |
| `@dnd-kit/sortable` | Sortable Kanban columns | ✗ | ✓ |
| `signature_pad` | HTML5 Canvas signature | ✗ | ✓ |
| `web-push` | Server push notifications | ✗ | ✓ |
| `serwist` | Service worker tooling | ✗ | ✓ |

---

## 10. Quick Reference — Deploy Commands

```bash
# V2 staging — build & start
./scripts/staging.sh start

# V2 staging — stop
./scripts/staging.sh stop

# V2 staging — rebuild after git pull
git pull && ./scripts/staging.sh restart

# V2 staging — health check
./scripts/staging.sh status

# V2 staging — logs
./scripts/staging.sh logs

# V2 staging — expose via Cloudflare
./scripts/staging.sh tunnel

# Generate VAPID keys (if needed)
npx tsx scripts/generate-vapid-keys.ts
```