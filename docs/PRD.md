# PRD — MSN ERP

> **Product Requirements Document** — Sistem Manajemen Operasional AC Service B2B
> Versi: 1.0 | Status: Draft | Tanggal: 2026-06-01

---

## Daftar Isi

1. [Ringkasan Eksekutif](#1-ringkasan-eksekutif)
2. [Target Pasar & Persona](#2-target-pasar--persona)
3. [Tujuan Produk](#3-tujuan-produk)
4. [Fitur per Modul](#4-fitur-per-modul)
   - 4.1 Manajemen Order
   - 4.2 Mobile Technician (PWA)
   - 4.3 Invoicing & Pembayaran
   - 4.4 Dashboard & KPI
   - 4.5 Master Data
   - 4.6 Pengingat Servis (Reminders)
   - 4.7 Manajemen Pengguna & RBAC
   - 4.8 Konfigurasi Sistem
5. [Alur Workflow](#5-alur-workflow)
6. [Kebutuhan Non-Fungsional](#6-kebutuhan-non-fungsional)
7. [Metrik Kesuksesan](#7-metrik-kesuksesan)
8. [Batasan Teknis](#8-batasan-teknis)

---

## 1. Ringkasan Eksekutif

MSN ERP adalah platform operasional internal untuk perusahaan AC service B2B di Indonesia. Sistem ini mengelola siklus hidup penuh order servis AC: dari pembuatan order dan penugasan teknisi, pelaporan servis di lapangan (foto, material, tanda tangan pelanggan), pembuatan invoice dan pencatatan pembayaran, hingga pengingat servis berkala otomatis.

### Visi

Menjadi pusat kendali operasional AC service yang menyatukan admin kantor, teknisi lapangan, dan tim keuangan dalam satu platform yang andal, cepat, dan offline-resilient.

### Mengapa Ini Ada

Sebelum MSN ERP, operasional berjalan secara manual:
- Order masuk via WhatsApp → admin catat di kertas/spreadsheet
- Teknisi selesai kerja → telepon kantor untuk laporan
- Invoice dibuat manual di Excel
- Pembayaran dicatat terpisah
- Servis berkala kehilangan track

MSN ERP mengeliminasi semua friction point tersebut.

---

## 2. Target Pasar & Persona

### Target Pasar

Perusahaan AC service B2B skala kecil-menengah di Indonesia yang memiliki:
- 5-50 teknisi lapangan
- 50-500+ pelanggan korporat/ritel
- Order harian 5-50+
- Melayani area Jakarta dan sekitarnya

### Persona

#### SUPERADMIN
- **Akses penuh** ke seluruh sistem
- Mengelola pengguna, roles, API keys
- Melihat semua data lintas modul
- **Kebutuhan**: kontrol penuh, audit trail, konfigurasi sistem

#### ADMIN
- **Operasional harian** — membuat, menugaskan, memonitor order
- Mengelola pelanggan, teknisi, AC unit, lokasi
- **Kebutuhan**: kecepatan input, visibilitas status order, drag-and-drop Kanban

#### FINANCE
- **Melihat order**, mengelola invoice & pembayaran
- Mencatat pembayaran cicilan
- **Kebutuhan**: akurasi perhitungan, jejak audit, PDF invoice, riwayat pembayaran

#### TECHNICIAN
- **Pengguna mobile PWA** di lapangan
- Melihat jadwal hari ini, update status, submit laporan servis
- **Kebutuhan**: offline-first, touch target besar, GPS capture, foto, tanda tangan

### Konteks Bisnis

- Order masuk via WhatsApp → admin input manual ke sistem
- Semua pekerjaan bersifat on-site (tidak ada workshop)
- Mendukung pembayaran cicilan (partial payment)
- Zona waktu Jakarta (WIB), bahasa Indonesia
- B2B — pelanggan adalah korporat/bisnis, bukan retail

---

## 3. Tujuan Produk

| Tujuan | Metrik |
|--------|--------|
| Admin menugaskan teknisi dalam <30 detik | Time-to-assign |
| Teknisi laporan tanpa telepon kantor | % laporan via PWA |
| Finance melacak invoice & pembayaran akurat | Saldo invoice = 0 selisih |
| Servis berkala tidak terlewat | % AC unit dengan reminder aktif |

### Prinsip Desain

1. **Task-first, not feature-first** — Setiap layar ada untuk memajukan order, pembayaran, atau pekerjaan teknisi
2. **Trust through consistency** — Tombol, form control, dan warna status sama di seluruh aplikasi
3. **Field-tested mobile** — PWA teknisi bukan afterthought. Touch target minimal 44px, offline indicator jelas
4. **State is truth** — 8 state order adalah backbone. Setiap transisi eksplisit, setiap status terlihat
5. **Respect the user's time** — Skeleton loading, empty states yang informatif, error yang bisa diatasi

---

## 4. Fitur per Modul

### 4.1 Manajemen Order

Modul inti sistem. Mengelola siklus penuh order servis AC.

#### 4.1.1 Pembuatan Order
- Admin input order dari WhatsApp/telepon
- Flow: **Cari/daftarkan pelanggan** → **Pilih lokasi** → **Pilih AC unit** → **Pilih tipe servis & kuantitas** → **Tentukan teknisi & jadwal** (opsional)
- Order otomatis mendapat ID format: `REQ/YYYY-MM/NNNNNN`
- Status awal: `PENDING`
- Opsi buat **Proforma Invoice** langsung dari form pembuatan order

#### 4.1.2 Kanban Board (Default View)
- 8 kolom: PENDING → ASSIGNED → EN_ROUTE → IN_PROGRESS → COMPLETED → INVOICED → PAID + CANCELLED
- Drag & drop antar kolom dengan validasi state machine
- **Aturan drop**: PENDING→ASSIGNED (buka modal Assign), ASSIGNED→PENDING (buka modal Reschedule), COMPLETED→INVOICED (buka modal Create Invoice), INVOICED→PAID (buka modal Record Payment)
- Kolom terminal (PAID) collapse otomatis ke 5 kartu + "N lebihnya"
- Urutan berdasarkan urgensi: overdue → hari ini → masa depan
- Warna tepi kiri sesuai urgensi (merah=overdue, biru=hari ini)

#### 4.1.3 List View (Alternatif)
- TanStack Table dengan sorting, pagination (20/halaman), selection mode
- Responsive: desktop tabel penuh, mobile daftar kartu
- Bulk cancel, bulk assign

#### 4.1.4 Filter
- Search (debounce), teknisi, tipe servis, urgensi, status, date range
- Semua filter tersimpan di URL search params (shareable)

#### 4.1.5 Detail Panel (Slide-over Sheet)
- 4 tab: **Detail** (pelanggan, jadwal, teknisi, layanan, estimasi harga), **Report** (hasil servis: foto, material, tanda tangan), **Invoice** (daftar invoice), **History** (timeline transisi status)
- Context-aware footer buttons (Assign/Cancel utk PENDING, "Buat Invoice" utk COMPLETED, dll)

#### 4.1.6 State Machine (8 Status)

```
PENDING ──→ ASSIGNED ──→ EN_ROUTE ──→ IN_PROGRESS ──→ COMPLETED ──→ INVOICED ──→ PAID
    ↑            |            |              |                                |
    └── Reschedule ┘            └─── Cancelled (terminal) ────────────────────┘
         ↻ PENDING
```

**Aturan transisi per role:**
| Dari | Admin | Teknisi | Finance |
|------|-------|---------|---------|
| PENDING | ASSIGNED, CANCELLED | — | — |
| ASSIGNED | PENDING, CANCELLED | EN_ROUTE | — |
| EN_ROUTE | PENDING, CANCELLED | IN_PROGRESS | — |
| IN_PROGRESS | CANCELLED | COMPLETED | — |
| COMPLETED | INVOICED | — | INVOICED |
| INVOICED | PAID, CANCELLED | — | PAID |
| PAID | — | — | — |
| CANCELLED | — | — | — |

Setiap transisi tercatat di `order_status_transitions` dengan timestamp, user, GPS (dari teknisi), dan idempotency key.

#### 4.1.7 Assignment Flow
- Pilih 1+ order → modal Assign → pilih teknisi lead + helper(s) → pilih jadwal
- Jika reassign: menyimpan previous lead, notifikasi teknisi lama (best-effort push)
- Helper teknisi bisa ditambah/dihapus dari detail order

#### 4.1.8 Reschedule
- Pindahkan dari ASSIGNED → PENDING
- Wajib isi alasan + tanggal baru
- Bersihkan assignment teknisi

#### 4.1.9 Cancel
- Konfirmasi via AlertDialog
- Opsional alasan
- Cancel cascade ke Proforma Invoice
- Deactivate AC unit terkait

#### 4.1.10 Soft Delete
- Order tidak pernah hard-delete
- `deleted_at` timestamp untuk soft-delete

---

### 4.2 Mobile Technician (PWA)

Aplikasi mobile progresif untuk teknisi lapangan. **Offline-first** dengan IndexedDB sync engine.

#### 4.2.1 App Shell
- Bottom tab bar: **Hari Ini** / **Riwayat** / **Profil**
- PWA manifest, service worker, push notifications
- Touch target minimal 44px
- Status sync indicator (online/offline/pending)

#### 4.2.2 Hari Ini (Today's Jobs)
- Daftar job hari ini dari API, auto-refresh tiap 60 detik
- Urutan: job aktif (EN_ROUTE / IN_PROGRESS) di atas
- Kartu: waktu, status badge, nama pelanggan, tipe servis, alamat
- Active state: pulse indicator

#### 4.2.3 Detail Job & Transisi Status
- Lihat detail lengkap: pelanggan, servis, timer kerja live
- Tombol kontekstual:
  - **ASSIGNED** → "Berangkat" (transisi EN_ROUTE + capture GPS)
  - **EN_ROUTE** → "Mulai Kerja" (transisi IN_PROGRESS + foto kedatangan, min 1)
  - **IN_PROGRESS** → "Selesai Kerja" (buka form completion)
  - **COMPLETED** → "Laporan sudah disubmit"
- Setiap transisi menyertakan GPS + idempotency key (safe retry)

#### 4.2.4 Job Completion (Wizard 4 Langkah)
Langkah 1 — **Inspeksi AC**:
- Form per-AC unit: brand, kapasitas, tipe, lokasi ruangan, model/serial
- Skip toggle (jika AC tidak diservis) + alasan
- Foto before/after per AC (offline upload, IndexedDB)
- Material/sparepart per AC dengan catalog search

Langkah 2 — **Tanda Tangan**:
- Canvas signature pad, retina-aware
- Nama penandatangan

Langkah 3 — **Jadwal & Biaya**:
- Total harga aktual
- Rekomendasi tanggal servis berikutnya (default +90 hari)
- Catatan tambahan

Langkah 4 — **Review**:
- Ringkasan + validasi
- Submit → enqueue ke sync manager

#### 4.2.5 Offline Sync Engine
- **IndexedDB** untuk queue: `pending_reports`, `pending_photos`, `pending_transitions`
- Auto-drain saat online: window.online, service worker sync, visibilitychange
- Conflict resolution dialog: untuk order yang dibatalkan/direassign saat offline
- Progress indicator: "Belum tersinkron" badge di foto

#### 4.2.6 Riwayat (History)
- Infinite scroll, filter tab: Semua / Selesai / Dibatalkan
- 10 item per page
- Kartu kompak: pelanggan, status, harga

#### 4.2.7 Profil & Push Notifikasi
- Informasi teknisi, toggle push notification
- Subscribe/unsubscribe via VAPID keys
- Logout

#### 4.2.8 Push Notifications
- VAPID Web Push
- Dikirim saat: assign job baru, reschedule, reassign
- Service worker: notifikasi + deep link ke job detail

---

### 4.3 Invoicing & Pembayaran

#### 4.3.1 Jenis Invoice

| Tipe | Deskripsi | Sumber |
|------|-----------|--------|
| **Proforma** | Tagihan awal saat order dibuat, estimasi harga | ORDER_LINKED |
| **Final** | Tagihan setelah servis selesai, harga aktual dari laporan | SERVICE_REPORT |
| **Blank** | Invoice mandiri tanpa order | BLANK |

#### 4.3.2 Invoice Lifecycle
```
DRAFT → SENT → PARTIAL_PAID → PAID
  ↓                              ↓
CANCELLED                    OVERDUE (jika melewati due_date)
```

#### 4.3.3 Status Invoice
- **DRAFT** — bisa direvisi, dihapus, dikirim
- **SENT** — sudah dikirim ke pelanggan via email
- **PARTIAL_PAID** — sudah dibayar sebagian
- **PAID** — lunas (sync order ke PAID)
- **OVERDUE** — komputasi real-time (due_date < hari ini)
- **CANCELLED** — batal (sync order kembali ke COMPLETED)

#### 4.3.4 Kalkulasi
```
subtotal = SUM(base_service_total + addons_subtotal)
discount = PERCENTAGE atau FIXED (capped ke subtotal)
tax      = (subtotal - discount) × tax_rate (default 11%)
total    = subtotal - discount + tax
paid     = SUM(payment_records.amount)
remaining = total - paid
```

#### 4.3.5 Pembayaran
- Metode: CASH, TRANSFER, CHECK, CREDIT_CARD, DEBIT_CARD, QRIS
- Validasi: amount ≤ remaining
- Cicilan: multiple payments per invoice
- "Pay full" shortcut button

#### 4.3.6 Sync Order → Invoice
| Aksi | Efek ke Order |
|------|---------------|
| Create Final Invoice | COMPLETED → INVOICED |
| Delete Final Invoice | INVOICED → COMPLETED |
| Pay Final Invoice (lunas) | INVOICED → PAID |
| Cancel Final Invoice | INVOICED → COMPLETED |

#### 4.3.7 Revisi Invoice
- Hanya DRAFT dan SENT yang bisa direvisi
- Field yang bisa diubah: pelanggan, due_date, notes, terms, diskon, pajak, bank account
- Line items: bisa diganti semua (delete old + insert new + restore on failure)
- Nomor invoice tetap

#### 4.3.8 Email Invoice
- Kirim via Resend API
- Template HTML kaya bahasa Indonesia
- Menyertakan: tabel item, riwayat pembayaran, rekening bank, syarat & ketentuan
- Tercatat di `invoice_communications`

#### 4.3.9 PDF Export
- jsPDF A4
- Kop perusahaan, info pelanggan, tabel item, ringkasan, info bank, T&C
- Download atau attachment email

#### 4.3.10 Konfigurasi Invoice
- Nama & alamat perusahaan
- NPWP
- Rekening bank (bisa multiple)
- Default: due days (30), tax rate (11%), prefix (INV)

---

### 4.4 Dashboard & KPI

Halaman utama admin setelah login.

#### 4.4.1 Kartu KPI (16 queries paralel)
- Total order, pending, completed, cancelled
- Total pelanggan, teknisi
- Revenue aktual (dari payments), revenue estimasi (dari order_items)
- Transaksi unpaid
- Perbandingan periode sebelumnya

#### 4.4.2 Grafik
- **Revenue vs Orders**: Bar (order count) + line (revenue) — dual Y-axis
- **Success vs Cancel**: Donut chart — completed vs cancelled vs in-progress
- **Status Breakdown**: 8 kolom warna per status

#### 4.4.3 Top Technicians
- 10 teknisi teratas berdasarkan jumlah order selesai
- Badge completion rate: hijau ≥80%, kuning ≥50%, merah <50%

#### 4.4.4 Recent Orders
- 5 order terbaru

#### 4.4.5 Date Range Filter
- Picker start date / end date
- Mempengaruhi semua KPI dan chart

#### 4.4.6 Onboarding
- Banner selamat datang untuk kunjungan pertama
- Persisten di localStorage

---

### 4.5 Master Data

#### 4.5.1 Pelanggan (Customers)
- CRUD + search by name/phone
- View: daftar pelanggan dengan lokasi dan AC unit
- Soft delete via `deleted_at` tidak ada — hard delete (by design)

#### 4.5.2 Lokasi
- CRUD per pelanggan
- Tidak bisa dihapus jika ada AC unit

#### 4.5.3 AC Unit
- CRUD per lokasi
- Fields: brand, kapasitas (PK), tipe (Split/Cassette/Standing/Window/Floor/Ceiling), model, serial number, instalasi, status (ACTIVE/INACTIVE/RETIRED)
- `next_service_due_date` untuk reminder

#### 4.5.4 Teknisi
- CRUD
- Bisa assign ke auth user
- Availability check (max 3 servis/hari)

#### 4.5.5 Service Catalog (Multi-dimensional pricing)
- Kombinasi: unit_type + capacity_range + service_type → price
- msn_code unik untuk setiap kombinasi

#### 4.5.6 Service Pricing (Flat pricing — legacy)
- Satu harga per service_type

#### 4.5.7 Addon/Sparepart Catalog
- Kategori: PARTS, FREON, LABOR, TRANSPORTATION, OTHER
- Stock management: quantity, minimum stock, bulk update
- Tidak bisa dihapus jika sudah dipakai di order

#### 4.5.8 Master Reference Data
- AC brands, unit types, capacity ranges, service types
- Semua configurable via UI

---

### 4.6 Pengingat Servis (Reminders)

#### 4.6.1 Reminder Rules
- Nama, days_before_due (≥0), channel (WHATSAPP/EMAIL), template pesan, auto_send
- CRUD — soft delete via is_active

#### 4.6.2 Generator
- Scan `ac_units.next_service_due_date` terhadap semua active rules
- Dedup: (ac_unit_id, rule_id, due_date) — unique composite
- Skip jika tidak ada kontak (no phone/email)
- Trigger via cron (`POST /api/admin/reminders/run`) atau manual

#### 4.6.3 Customer Reminders Queue
- Status: PENDING → SENT / FAILED / DISMISSED / CANCELLED
- Filterable list dengan status badge warna
- Manual create per AC unit

#### 4.6.4 Serviced AC Unit View
- Filter: overdue, due_soon, upcoming, no_date
- Lihat status reminder terakhir

---

### 4.7 Manajemen Pengguna & RBAC

#### 4.7.1 Role Hierarchy
```
SUPERADMIN (level 4) — full control
  └── ADMIN (level 3) — operasional
        ├── TECHNICIAN (level 2) — field mobile
        └── FINANCE (level 2) — billing
```

#### 4.7.2 Manajemen User
- SUPERADMIN bisa manage semua user
- ADMIN hanya bisa lihat/mengelola TECHNICIAN dan FINANCE
- CRUD user + toggle active status
- Permanent delete user (cleanup auth.users orphan)
- Auto-create `user_management` row via DB trigger

#### 4.7.3 API Keys
- Format: `sk_` + 64 karakter HMAC-SHA512
- Stateless (tidak disimpan di DB)
- Expiry 30 hari
- SUPERADMIN only

#### 4.7.4 Route Protection
- Middleware: cek session + is_active + role-based routing
- TECHNICIAN ke `/dashboard` → redirect ke `/technician`
- Non-TECHNICIAN ke `/technician` → redirect ke `/dashboard`
- Inactive user → signOut + redirect `/login?error=Akun tidak aktif`

---

### 4.8 Konfigurasi Sistem

#### 4.8.1 Invoice Config
- Nama perusahaan, alamat, NPWP, kontak, website, logo
- Akun bank (bisa multiple)
- Default: due days, tax rate, prefix
- Notes & T&C template

#### 4.8.2 Service Catalog Config
- Manage: brands, unit types, capacities, service types, pricing catalog
- Bulk import CSV untuk pricing

#### 4.8.3 Reminder Rules Config
- CRUD rule + template editor

---

## 5. Alur Workflow

### 5.1 Order Lifecycle (End-to-End)

```
1. ADMIN: Order masuk via WhatsApp
   ├─ Cari/daftar pelanggan
   ├─ Pilih lokasi & AC unit
   ├─ Pilih tipe servis (cleaning/refill/repair/install/inspect)
   ├─ Tentukan harga estimasi (dari catalog)
   └─ Optional: buat Proforma Invoice

2. ADMIN: Assign teknisi
   ├─ Pilih teknisi lead + helper(s)
   ├─ Tentukan jadwal kunjungan
   └─ Push notification → teknisi

3. TECHNICIAN: Terima notifikasi → lihat job hari ini

4. TECHNICIAN: "Berangkat"
   ├─ GPS capture
   └─ Status → EN_ROUTE

5. TECHNICIAN: "Mulai Kerja"
   ├─ Foto kedatangan (min 1)
   ├─ GPS capture
   └─ Status → IN_PROGRESS

6. TECHNICIAN: Selesai kerja
   ├─ Wizard 4 langkah:
   │   1. Inspeksi AC (foto, material per unit)
   │   2. Tanda tangan pelanggan
   │   3. Biaya & jadwal berikutnya
   │   4. Review & submit
   ├─ Enqueue report (offline-safe)
   ├─ Sync → server
   └─ Status → COMPLETED

7. ADMIN/FINANCE: Buat Final Invoice
   ├─ Dari service report (base items + materials)
   ├─ Edit diskon, pajak, terms
   ├─ Kirim email PDF ke pelanggan
   └─ Status → INVOICED

8. FINANCE: Catat pembayaran
   ├─ Cicilan atau lunas
   ├─ Pilih metode pembayaran
   └─ Status → PAID (jika lunas)

9. REMINDER: Servis berikutnya
   ├─ Teknisi input next_service_due_date
   ├─ Sistem generate reminder menjelang due date
   └─ Kirim WhatsApp/email otomatis
```

### 5.2 Invoice Flow

```
ORDER_COMPLETED
  │
  ├── Optional: Proforma dibuat saat order
  │
  └── Final Invoice:
       ├── Butuh service report (base items)
       ├── Tambah materials sebagai ADDON items
       ├── Set diskon & pajak
       ├── Kalkulasi total
       └── Sync COMPLETED → INVOICED

INVOICED
  │
  ├── Kirim email ke pelanggan
  │     └── Status → SENT
  │
  ├── Catat pembayaran (partial/lunas)
  │     ├── Validasi amount
  │     └── Automatic sync INVOICED → PAID jika lunas
  │
  ├── Revisi (DRAFT/SENT only)
  │     └── Update header + ganti line items
  │
  └── Cancel
        └── INVOICED → COMPLETED

PAID
  └── Terminal — tidak ada aksi lebih lanjut
```

### 5.3 Reminder Flow

```
AC Unit dengan next_service_due_date
  │
  ├── Cron (POST /api/admin/reminders/run) atau manual
  │
  ├── Scan semua ac_units.next_service_due_date
  │     └── Cocokkan dengan reminder_rules
  │         ├── Tambah ke customer_reminders (PENDING)
  │         │     └── Dedup: (ac_unit_id, rule_id, due_date)
  │         └── Skip jika kontak tidak tersedia
  │
  └── Send (jika auto_send = true)
        ├── WhatsApp / Email
        └── Status → SENT / FAILED
```

### 5.4 Offline Sync Flow (Technician)

```
Teknisi di lapangan (offline):
  ├── Ambil foto → enqueuePhoto → IndexedDB
  ├── Submit report → enqueueReport → IndexedDB
  └── Transisi status → enqueueTransition → IndexedDB

Saat koneksi kembali:
  ├── window.online event
  ├── Service worker background sync
  └── visibilitychange (user balik ke tab)

Drain queue:
  ├── 1. Transitions (POST /api/technician/jobs/.../transition)
  ├── 2. Photos (upload ke Supabase Storage)
  ├── 3. Reports (POST /api/technician/jobs/.../report)
  └── Conflict? → buka ConflictResolution dialog
```

---

## 6. Kebutuhan Non-Fungsional

### 6.1 Performa
- Time-to-assign teknisi: <30 detik dari buka order
- Kanban board render: <2 detik untuk 100 order
- Chart render: <1 detik
- API response: <500ms untuk 95% request
- Invoice PDF generate: <3 detik

### 6.2 Keamanan
- Semua API route pakai auth (Bearer JWT atau cookie session)
- RLS di semua tabel Supabase
- Role-based access control (4 level)
- API key stateless HMAC-SHA512 (SUPERADMIN only)
- Cron endpoint dilindungi CRON_SECRET
- Tidak ada `as any` / `@ts-ignore` untuk type safety

### 6.3 Reliabilitas
- Idempotency key di semua transisi teknisi (safe retry)
- Offline queue tidak kehilangan data
- Fire-and-forget push notification (gagal kirim tidak blokir operasi)
- Soft delete — tidak ada hard delete untuk data operasional

### 6.4 Aksesibilitas
- WCAG 2.1 AA baseline
- Touch target ≥44px di rute teknisi
- Status badge: warna + icon (tidak hanya warna)
- prefers-reduced-motion dihormati
- Keyboard navigasi untuk Kanban (konteks menu "Move to...")
- Dark mode penuh

### 6.5 Mobile (Technician PWA)
- Offline-first: semua form & foto bekerja tanpa koneksi
- Foto dikompresi (<1MB, 1600px max)
- One-handed operation
- Zero layout shift saat interaksi
- Sync status visible

---

## 7. Metrik Kesuksesan

| KPI | Target | Cara Ukur |
|-----|--------|-----------|
| Order completion time | <4 jam dari assign ke complete | Rata-rata waktu di `order_status_transitions` |
| Invoice-to-payment time | <7 hari | Rata-rata selisih invoice_date - payment_date |
| Technician report adoption | >90% | % COMPLETED orders dengan service_report |
| Offline sync success rate | >99% | Pending conflict / total report |
| Reminder coverage | >80% AC unit | % active AC unit dengan reminder generated |
| Push notification delivery | >95% | logs pengiriman |

---

## 8. Batasan Teknis

### Stack
- **Frontend**: Next.js 15 (App Router) + React 19 + TypeScript 5
- **UI**: shadcn/ui (New York, zinc) + Tailwind CSS 3.3
- **State**: TanStack Query v5 (server state) + Zustand/Context (client state)
- **Table**: TanStack Table v8
- **Forms**: React Hook Form + Zod
- **Charts**: Recharts
- **PDF**: jsPDF + html2canvas
- **Mobile**: PWA (service worker, VAPID push)
- **DB**: Supabase PostgreSQL (RLS enabled)
- **Auth**: Supabase Auth (JWT)
- **Email**: Resend
- **Drag & drop**: @dnd-kit

### Database
- PostgreSQL via Supabase
- 30 tables, 6 custom enums
- Row-Level Security untuk semua tabel
- Real-time subscriptions untuk: orders, payments, service_records, service_pricing, SLA

### Infrastruktur
- Deploy: Vercel atau Docker
- Storage: Supabase Storage (foto, tanda tangan, logo)
- Cron: Eksternal (trigger POST /api/admin/reminders/run)
- Environment: NEXT_PUBLIC_ variabel untuk client, server-only untuk secrets

### Constraints
- Semua user-facing label dalam Bahasa Indonesia
- Zona waktu: Asia/Jakarta (WIB)
- Format: IDR (Rp), id-ID locale
- Output Next.js: standalone
- Tidak ada test framework terkonfigurasi (Playwright E2E file exist)