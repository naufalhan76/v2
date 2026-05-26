# AC Service Dashboard — Restructure Plan v2

> End-to-end business process redesign + Technician Mobile Web App

---

## 1. CONTEXT & PROBLEMS

### Current Pain Points
- **Navigasi ribet**: 5 halaman operasional terpisah (accept, assign, create, monitoring-ongoing, monitoring-history)
- **Status tracking susah**: 16 order states, admin bingung mana yang urgent
- **Invoice creation complex**: Banyak langkah manual
- **No technician app**: Semua komunikasi via WA, no digital trail
- **Legacy code**: Dual system (service_pricing + service_catalog), redundant columns

### Business Reality
- Orders masuk via **WhatsApp → Admin input manual**
- B2B clients (perusahaan), bukan end-consumer
- Teknisi: service + catat material + isi harga + foto + tanda tangan customer
- **No workshop** — semua on-site
- **1 order = 1 visit** (always)
- Reschedule: customer minta ganti jadwal ATAU teknisi gagal visit
- Invoice: bisa proforma saat create order, bisa final setelah service done

---

## 2. PROPOSED ORDER STATES (Simplified)

### Current: 16 states → Proposed: 8 states

```
PENDING → ASSIGNED → EN_ROUTE → IN_PROGRESS → COMPLETED → INVOICED → PAID
                                                                        ↑ end state

CANCELLED (from any state before COMPLETED)
RESCHEDULED → temporary, goes back to PENDING
```

### State Definitions

| State | Meaning | Triggered By | Next States |
|-------|---------|-------------|-------------|
| `PENDING` | Order created, belum di-assign | Admin | ASSIGNED, CANCELLED |
| `ASSIGNED` | Teknisi assigned + jadwal set | Admin | EN_ROUTE, RESCHEDULED, CANCELLED |
| `EN_ROUTE` | Teknisi dalam perjalanan | Teknisi (mobile app) | IN_PROGRESS, RESCHEDULED |
| `IN_PROGRESS` | Teknisi sedang kerja | Teknisi (mobile app) | COMPLETED |
| `COMPLETED` | Service selesai, foto + material + signature uploaded | Teknisi (mobile app) | INVOICED |
| `INVOICED` | Invoice sudah dibuat & dikirim | Admin/System | PAID, CANCELLED |
| `PAID` | Pembayaran diterima (full) | Admin | — (end state) |
| `CANCELLED` | Order dibatalkan | Admin | — (end state) |

### Reschedule Flow
- Bukan state permanen, tapi **action** yang reset order ke `PENDING`
- Log reschedule reason + new date di `order_status_transitions`
- Hapus technician assignment, set new `scheduled_visit_date`

### Removed States
| Old State | Reason |
|-----------|--------|
| `NEW` | Merged with PENDING (admin create = already accepted) |
| `ACCEPTED` | Merged with PENDING |
| `ARRIVED` | Merged with IN_PROGRESS (teknisi tap "mulai kerja") |
| `DONE` | Renamed to COMPLETED |
| `CLOSED` | Removed (PAID = end state) |
| `TO_WORKSHOP` | No workshop flow |
| `IN_WORKSHOP` | No workshop flow |
| `READY_TO_RETURN` | No workshop flow |
| `DELIVERED` | No workshop flow |

---

## 3. END-TO-END BUSINESS PROCESS

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ADMIN DASHBOARD                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. Customer WA admin                                                │
│  2. Admin → Create Order                                             │
│     - Pilih/buat customer                                            │
│     - Pilih lokasi + AC units + service type                         │
│     - Set jadwal                                                     │
│     - (Optional) Assign teknisi langsung                             │
│     - (Optional) Buat Proforma Invoice                               │
│  3. Admin → Assign teknisi (jika belum)                              │
│     - Pilih teknisi + set jadwal                                     │
│     - Order status: PENDING → ASSIGNED                               │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                     TECHNICIAN MOBILE APP                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  4. Teknisi lihat order di app → tap "Berangkat"                     │
│     - Status: ASSIGNED → EN_ROUTE                                    │
│  5. Teknisi sampai → tap "Mulai Kerja"                               │
│     - Status: EN_ROUTE → IN_PROGRESS                                 │
│  6. Teknisi selesai → Complete Job Form:                              │
│     - Upload foto before/after                                       │
│     - Catat material/parts yang dipake                               │
│     - Isi actual price                                               │
│     - Customer tanda tangan digital                                  │
│     - Status: IN_PROGRESS → COMPLETED                                │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                     BACK TO ADMIN DASHBOARD                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  7. Admin review hasil kerja teknisi                                  │
│     - Lihat foto, material, actual price                             │
│  8. Admin buat Final Invoice                                         │
│     - Auto-populate dari data teknisi                                │
│     - Adjust jika perlu (diskon, addon, dll)                         │
│     - Status: COMPLETED → INVOICED                                   │
│  9. Admin kirim invoice ke customer (email/WA/PDF)                   │
│ 10. Customer bayar → Admin record payment                            │
│     - Status: INVOICED → PAID                                        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. ADMIN DASHBOARD — UI RESTRUCTURE

### Current Navigation (Confusing)
```
Dashboard
├── Operasional
│   ├── Create Order
│   ├── Accept Order      ← unnecessary (admin creates = accepted)
│   ├── Assign Order
│   ├── Monitoring Ongoing
│   └── Monitoring History
├── Manajemen
│   ├── Customer
│   ├── Lokasi
│   ├── AC Units
│   ├── Teknisi
│   └── User
├── Keuangan
│   └── Invoices
├── Konfigurasi
│   ├── Service Pricing
│   ├── Service Config
│   ├── Addons Catalog
│   ├── Invoice Config
│   └── SLA Service
└── Admin
    └── API Docs
```

### Proposed Navigation (Clear)
```
Dashboard (KPI overview + quick actions)
├── Orders
│   ├── Board View (Kanban: PENDING → ASSIGNED → ON-GOING → COMPLETED → INVOICED → PAID)
│   ├── List View (table with filters)
│   └── + Create Order (modal/page)
├── Invoices
│   ├── All Invoices (list + filters)
│   ├── + Create Invoice (from order / blank)
│   └── Payment Records
├── Customers
│   └── List + Detail (locations, AC units, order history inline)
├── Technicians
│   └── List + Schedule + Assignment
└── Settings
    ├── Service Catalog (merge pricing + config)
    ├── Addons
    ├── Invoice Settings
    └── User Management
```

### Key UI Changes

#### A. Order Board (Main View)
- **Kanban columns**: PENDING | ASSIGNED | EN_ROUTE + IN_PROGRESS | COMPLETED | INVOICED | PAID
- Drag-and-drop untuk assign teknisi (drag from PENDING → ASSIGNED)
- Color-coded urgency (overdue = red, today = orange, future = green)
- Click card → order detail slide-over panel
- Quick actions: assign, reschedule, cancel, create invoice

#### B. Create Order (Simplified)
- **Step 1**: Customer (search by phone/name, or create new)
- **Step 2**: Service (lokasi + AC + service type + pricing auto-fill)
- **Step 3**: Schedule & Assign (tanggal + teknisi, optional)
- **Step 4**: Review & Submit
- Optional: "Buat Proforma Invoice" checkbox

#### C. Order Detail Page
- Header: status badge, customer info, scheduled date
- Timeline: visual status progression with timestamps
- Tabs: Detail | Technician Report | Invoice | History
- Technician Report tab: foto, material, actual price, signature (read-only for admin)

#### D. Invoice Center
- List view with status filters (DRAFT, SENT, OVERDUE, PAID)
- Quick create from completed order (auto-populate)
- Send via email button
- Payment recording inline

---

## 5. TECHNICIAN MOBILE WEB APP

### Tech Stack
- Same Next.js project, separate route group: `/technician/`
- Mobile-first responsive design (no desktop needed)
- PWA-capable (add to home screen, offline indicator)
- Same Supabase auth (technician role)

### Screens (4 total)

#### Screen 1: Today's Jobs (`/technician`)
```
┌─────────────────────────────┐
│  Halo, [Nama Teknisi]       │
│  Senin, 26 Mei 2026         │
├─────────────────────────────┤
│                              │
│  ┌─────────────────────────┐│
│  │ 🔵 09:00 - Cuci AC      ││
│  │ PT ABC Corp             ││
│  │ Jl. Sudirman No. 12     ││
│  │ [Berangkat]              ││
│  └─────────────────────────┘│
│                              │
│  ┌─────────────────────────┐│
│  │ ⚪ 13:00 - Isi Freon    ││
│  │ CV XYZ                  ││
│  │ Jl. Gatot Subroto 45    ││
│  └─────────────────────────┘│
│                              │
│  ┌─────────────────────────┐│
│  │ ⚪ 15:30 - Repair       ││
│  │ PT DEF                  ││
│  │ Jl. Kuningan 8          ││
│  └─────────────────────────┘│
│                              │
└─────────────────────────────┘
```

#### Screen 2: Job Detail (`/technician/job/[id]`)
```
┌─────────────────────────────┐
│  ← Back                      │
├─────────────────────────────┤
│  Cuci AC - 2 Unit            │
│  Status: ASSIGNED            │
├─────────────────────────────┤
│  Customer: PT ABC Corp       │
│  Phone: 021-555-1234         │
│  Alamat: Jl. Sudirman 12    │
│  Lantai 3, Ruang Server     │
├─────────────────────────────┤
│  AC Units:                   │
│  • Daikin FTV35 (1.5 PK)    │
│  • Daikin FTV35 (1.5 PK)    │
├─────────────────────────────┤
│  Service: Cuci AC            │
│  Est. Price: Rp 300.000     │
│  Notes: Minta cuci deep     │
├─────────────────────────────┤
│                              │
│  [    📍 Berangkat    ]      │
│                              │
└─────────────────────────────┘
```

#### Screen 3: In Progress View (same page, updated)
```
┌─────────────────────────────┐
│  ← Back                      │
├─────────────────────────────┤
│  🟡 IN PROGRESS              │
│  Cuci AC - PT ABC Corp       │
│  Timer: 00:45:23             │
├─────────────────────────────┤
│                              │
│  [   ✅ Selesai Kerja   ]   │
│                              │
└─────────────────────────────┘
```

#### Screen 4: Complete Job Form (`/technician/job/[id]/complete`)
```
┌─────────────────────────────┐
│  ← Back                      │
├─────────────────────────────┤
│  Laporan Pekerjaan           │
├─────────────────────────────┤
│                              │
│  Foto Before:                │
│  [📷 Upload] [📷] [📷]      │
│                              │
│  Foto After:                 │
│  [📷 Upload] [📷] [📷]      │
│                              │
├─────────────────────────────┤
│  Material Digunakan:         │
│  ┌───────────────────────┐  │
│  │ R32 Freon - 2kg       │  │
│  │ Rp 500.000            │  │
│  └───────────────────────┘  │
│  [+ Tambah Material]        │
│                              │
├─────────────────────────────┤
│  Harga Aktual:               │
│  [Rp 800.000            ]   │
│                              │
│  Catatan:                    │
│  [Kompresor bunyi, perlu    │
│   dicek ulang bulan depan]  │
│                              │
├─────────────────────────────┤
│  Tanda Tangan Customer:      │
│  ┌───────────────────────┐  │
│  │                       │  │
│  │    [signature pad]    │  │
│  │                       │  │
│  └───────────────────────┘  │
│  [Clear]                    │
│                              │
├─────────────────────────────┤
│                              │
│  [   ✅ Submit Laporan   ]  │
│                              │
└─────────────────────────────┘
```

### Technician App — Technical Notes
- Signature pad: HTML5 Canvas (library: `signature_pad`)
- Photo upload: direct to Supabase Storage bucket
- Offline handling: show "No connection" banner, disable submit
- Auto-save draft locally (localStorage) in case of accidental close
- Push notification support (future): via Supabase Realtime or web push

---

## 6. DATABASE CHANGES

### Columns to Remove (Redundant)

| Table | Column | Reason | Migration |
|-------|--------|--------|-----------|
| `orders` | `order_type` | Redundant — info lives in `order_items.service_type` | Remove FK constraint first, then drop |
| `orders` | `assigned_technician_id` | Redundant — use `order_technicians` table | Drop after data migration |
| `orders` | `req_visit_date` | Same as `scheduled_visit_date` | Drop |
| `orders` | `location_id` | Locations are per order_item | Drop if exists |

### Enum Changes

Remove workshop states from `order_status` enum:
```sql
-- Remove: TO_WORKSHOP, IN_WORKSHOP, READY_TO_RETURN, DELIVERED
-- Remove: NEW, ACCEPTED (merge to PENDING)
-- Remove: DONE (rename to COMPLETED)
-- Remove: CLOSED (PAID is end state)
-- Add: PENDING, COMPLETED
```

### New Tables

#### `service_reports` (Technician completion data)
```sql
CREATE TABLE service_reports (
  report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL REFERENCES orders(order_id),
  technician_id UUID NOT NULL REFERENCES technicians(technician_id),
  
  -- Photos
  photos_before TEXT[], -- Array of Supabase Storage URLs
  photos_after TEXT[],
  
  -- Materials used
  materials JSONB, -- [{addon_id, name, quantity, unit_price, total}]
  
  -- Pricing
  actual_total_price NUMERIC(12,2),
  
  -- Customer sign-off
  customer_signature_url TEXT, -- Supabase Storage URL
  customer_name_signed TEXT,
  signed_at TIMESTAMPTZ,
  
  -- Notes
  notes TEXT,
  work_started_at TIMESTAMPTZ,
  work_completed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Tables to Deprecate (Not Delete Yet)

| Table | Reason | Action |
|-------|--------|--------|
| `service_pricing` | Replaced by `service_catalog` | Mark deprecated, keep for backward compat |
| `order_status_transitions` | Keep — useful audit trail | No change |
| `service_records` | Replaced by `service_reports` | Migrate data, then deprecate |

### Storage Buckets (New)
- `service-photos` — before/after photos from technicians
- `signatures` — customer signature images

---

## 7. IMPLEMENTATION PHASES

### Phase 1: Foundation (Week 1-2)
- [ ] DB migration: new states, `service_reports` table, storage buckets
- [ ] Update order state machine in code
- [ ] Simplify sidebar navigation
- [ ] Create Order Board (kanban) view

### Phase 2: Technician Mobile App (Week 2-3)
- [ ] Route group `/technician/` with mobile layout
- [ ] Auth: technician login + session persistence
- [ ] Today's Jobs list
- [ ] Job Detail page
- [ ] Status update buttons (Berangkat → Mulai → Selesai)
- [ ] Complete Job form (photos, materials, price, signature)

### Phase 3: Admin Flow Polish (Week 3-4)
- [ ] Simplified Create Order wizard
- [ ] Order Detail page with timeline + technician report tab
- [ ] Invoice auto-populate from service report
- [ ] Invoice send improvements

### Phase 4: Cleanup & Polish (Week 4-5)
- [ ] Remove deprecated pages (accept-order, old monitoring)
- [ ] DB cleanup: drop redundant columns
- [ ] Realtime: technician status updates live on admin board
- [ ] PWA manifest for technician app
- [ ] Testing & bug fixes

---

## 8. OPEN QUESTIONS

- [ ] Apakah perlu notifikasi push ke teknisi saat ada order baru?
- [ ] Apakah admin perlu approve service report sebelum buat invoice, atau langsung auto?
- [ ] Apakah perlu fitur "reassign" (ganti teknisi setelah assigned)?
- [ ] Payment partial — apakah masih perlu? Atau selalu full payment?
- [ ] Apakah teknisi bisa lihat history order mereka sebelumnya?

---

## 9. OUT OF SCOPE (For Now)

- Customer self-service portal
- Push notifications
- Offline-first technician app
- Multi-language support
- Technician earnings/commission tracking
- Chat between admin and technician
- GPS tracking teknisi
- Automated scheduling/routing
