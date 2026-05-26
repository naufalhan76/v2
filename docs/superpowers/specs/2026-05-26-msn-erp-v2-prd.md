# PRD — MSN ERP v2: Order Management & Technician Mobile App

> **Status**: Draft
> **Date**: 2026-05-26
> **Owner**: Engineering
> **Related**: `2026-05-26-msn-erp-v2-design.md` (technical design)

---

## 1. Background

MSN ERP saat ini berfungsi sebagai admin panel untuk operasi servis AC B2B. Sistem yang ada memiliki beberapa pain point yang menghambat efisiensi:

1. **Fragmentasi UI operasional** — 5 halaman terpisah (`accept-order`, `assign-order`, `monitoring-ongoing`, `monitoring-history`, `create-order`) untuk lifecycle order tunggal.
2. **State machine yang kompleks** — 16 state termasuk legacy workshop states yang tidak relevan dengan model bisnis on-site.
3. **Tidak ada digital trail untuk teknisi** — Semua komunikasi via WhatsApp, tidak ada catatan terstruktur untuk foto, material, harga aktual, dan signature customer.
4. **Inkonsistensi UI** — 6 mapping warna status yang berbeda di codebase, 97 hard-coded color classes, status badge ad-hoc per halaman.
5. **Skeleton loading tidak konsisten** — Infrastruktur skeleton sudah ada (`TableSkeleton`, `KpiCardSkeleton`, dll.) tetapi banyak halaman masih pakai `Loader2` spinner saja, menyebabkan layout shift.

## 2. Goals

### Primary Goals
- Menyederhanakan workflow order dari 5 halaman jadi 1 halaman terpadu (Orders) dengan dual view (Board + List).
- Menyediakan mobile web app untuk teknisi dengan flow lengkap: terima job → update status → submit laporan dengan foto, material, harga, signature.
- Menyederhanakan state machine dari 16 jadi 8 state, dengan migration path yang aman tanpa breaking existing data.
- Menjamin konsistensi visual: single source of truth untuk status colors, badges, dan loading states.

### Secondary Goals
- Realtime sync antara teknisi dan admin (status update teknisi muncul live di admin Order Board).
- Web push notification untuk teknisi saat ada job baru atau perubahan jadwal.
- Cleanup legacy code: redundant columns, deprecated tables, hard-coded UI patterns.

### Non-Goals (Explicitly Out of Scope)
- Customer self-service portal.
- Offline-first technician app (banner offline saja, no full sync).
- Multi-language support.
- Technician earnings/commission tracking.
- In-app chat antara admin dan teknisi.
- GPS tracking teknisi.
- Auto routing/scheduling.

## 3. Users & Roles

| Role | Primary Use Case | Platform |
|------|------------------|----------|
| **SUPERADMIN** | Full access + user management + API docs | Web admin |
| **ADMIN** | Operasional sehari-hari: create order, assign, monitor, invoice | Web admin |
| **FINANCE** | View orders, full invoice & payment management | Web admin |
| **TECHNICIAN** | Lihat job, update status di lapangan, submit laporan | Mobile web (PWA) |

Detailed access matrix tersedia di Design Spec section "Role-Based Access".

## 4. Business Reality (Constraints)

- Order masuk via WhatsApp, admin input manual ke sistem.
- B2B clients (perusahaan), bukan end-consumer.
- Teknisi: service + catat material + isi harga aktual + foto + tanda tangan customer.
- **No workshop** — semua pekerjaan on-site.
- **1 order = 1 visit** (selalu).
- Reschedule: bisa dari customer minta ganti jadwal ATAU teknisi gagal visit.
- Invoice: bisa proforma saat create order, bisa final setelah service done.
- Payment: support partial payment (multiple payments hingga lunas).

## 5. User Stories

### Admin

- **US-A1**: Sebagai admin, saya ingin melihat semua order dalam satu Board view dengan kolom per status, sehingga saya bisa langsung melihat mana yang urgent dan mana yang stuck.
- **US-A2**: Sebagai admin, saya ingin drag order dari "Pending" ke "Assigned" dan langsung memilih teknisi + jadwal di modal yang muncul.
- **US-A3**: Sebagai admin, saya ingin switch dari Board ke List view dengan filter, sehingga saya bisa kerja satu-satu untuk batch update.
- **US-A4**: Sebagai admin, saya ingin mengganti teknisi (reassign) selama status order masih `ASSIGNED`, sehingga jika teknisi sakit saya bisa langsung swap tanpa harus reschedule.
- **US-A5**: Sebagai admin, saya ingin lihat hasil kerja teknisi (foto, material, signature) di tab "Technician Report" pada order detail, sehingga saya bisa verify sebelum buat invoice final.
- **US-A6**: Sebagai admin, saya ingin "Create Invoice from Order" yang auto-populate line items dari service report teknisi, sehingga saya tidak perlu input ulang.
- **US-A7**: Sebagai admin, saya ingin live update saat teknisi ubah status (Berangkat / Mulai / Selesai) tanpa refresh, sehingga saya tahu progress lapangan real-time.

### Finance

- **US-F1**: Sebagai finance, saya ingin record payment dengan support partial (cicilan) sehingga invoice bisa berstatus `PARTIAL_PAID` hingga lunas.
- **US-F2**: Sebagai finance, saya ingin send invoice via email dengan template yang bisa di-config.

### Technician

- **US-T1**: Sebagai teknisi, saya ingin buka mobile app dan langsung lihat job hari ini sorted by jadwal, dengan info lokasi + AC units + service type.
- **US-T2**: Sebagai teknisi, saya ingin tap "Berangkat" saat berangkat, "Mulai Kerja" saat sampai, dan "Selesai" saat selesai — tanpa harus mengisi data lain dulu.
- **US-T3**: Sebagai teknisi, saya ingin upload foto before/after, catat material yang dipakai, isi harga aktual, dan minta tanda tangan customer di app — semua di satu form yang bisa auto-save kalau accidentally close.
- **US-T4**: Sebagai teknisi, saya ingin lihat history job saya sebelumnya, sehingga kalau customer tanya saya punya referensi.
- **US-T5**: Sebagai teknisi, saya ingin notifikasi push saat ada job baru di-assign atau jadwal berubah, sehingga saya tidak perlu polling app manual.

## 6. Functional Requirements

### FR-1: Order State Machine

Order memiliki 8 state: `PENDING`, `ASSIGNED`, `EN_ROUTE`, `IN_PROGRESS`, `COMPLETED`, `INVOICED`, `PAID`, `CANCELLED`. Transitions diatur strict — invalid transition harus return error.

- `RESCHEDULE` adalah **action**, bukan state. Reset order ke `PENDING`, hapus technician assignment, log alasan + tanggal baru.
- `REASSIGN` allowed hanya saat status `ASSIGNED`. Tidak ganti state, hanya replace lead technician di `order_technicians` + log audit.
- `CANCELLED` allowed dari state apapun sebelum `COMPLETED`. Set linked AC units (status PENDING) jadi INACTIVE.

### FR-2: Order Workflow

```
[Admin Web]
  Customer WA → Admin create order (PENDING)
  Admin assign teknisi + jadwal → ASSIGNED
[Mobile Web App — Technician]
  Teknisi tap "Berangkat" → EN_ROUTE
  Teknisi tap "Mulai Kerja" → IN_PROGRESS
  Teknisi submit laporan (foto, material, harga, signature) → COMPLETED
[Admin Web]
  Admin review report → Create Invoice → INVOICED
  Send invoice via email/WA
  Customer pay (full atau partial)
  Finance record payment → PARTIAL_PAID atau PAID
```

**Approval setelah teknisi submit**: auto-approve. Tidak ada `PENDING_REVIEW` state. Customer signature di lapangan = approval natural. Admin tetap bisa adjust harga di invoice creation.

### FR-3: Technician Mobile App

5 screens (PWA, mobile-first):

1. `/technician` — Today's Jobs (sorted by scheduled time)
2. `/technician/job/[id]` — Job Detail (state-aware UI per status)
3. `/technician/job/[id]/complete` — Complete Job Form
4. `/technician/history` — Full history (semua job teknisi tersebut, paginated)
5. `/technician/profile` — Profile + logout + push notification toggle

Auth: same Supabase, role check di middleware. Login → role-based redirect: TECHNICIAN ke `/technician`, lainnya ke `/dashboard`.

### FR-4: Service Report Submission

Form submission membutuhkan:
- Foto before (min 1, max 5)
- Foto after (min 1, max 5)
- Materials (array): nama, qty, unit price, total — auto-search dari `addons_catalog` atau custom entry
- Harga aktual (NUMERIC, pre-filled dari estimated + materials, editable)
- Customer signature (HTML5 Canvas → PNG → upload)
- Customer name signed (text)
- Notes (optional)

Auto-save draft to `localStorage` per orderId. Restore on accidental close.

### FR-5: Invoice Auto-Population

"Create Invoice from Order" untuk order ber-status `COMPLETED` harus:
- Auto-populate line items: service base price + materials dari service report.
- Pre-fill total dengan `actual_total_price` dari report.
- Editable sebelum send (admin bisa apply discount, tax, atau adjust per line).
- Optional toggle: include foto sebagai attachment di PDF.

### FR-6: Payment Recording

- Single payment full → status invoice `PAID`.
- Multiple partial payments → status `PARTIAL_PAID` hingga lunas, lalu `PAID`.
- Order status follow invoice: `INVOICED` saat invoice dibuat (apapun status invoice), `PAID` hanya saat invoice `PAID` (full).

### FR-7: Realtime Sync

Admin Order Board harus subscribe ke `subscribeOrders` channel. Saat ada perubahan dari teknisi (status update, report submit), board harus auto-refresh tanpa manual reload. Toast notification optional untuk perubahan signifikan.

### FR-8: Web Push Notifications

- Service worker registered di `/technician/sw.js`.
- Permission request: ask once on first login, settings to manage di profile page.
- Trigger events:
  - New job assigned
  - Existing job rescheduled (date changed)
  - Job reassigned away (no longer your job)
- Tap notification → deep link ke job detail.

## 7. Non-Functional Requirements

### Performance
- Initial page load < 3s pada koneksi 3G.
- Time to interactive < 2s pada koneksi 4G.
- Photo upload dengan compression client-side (target ~500KB per photo, JPEG q=0.7).
- Optimistic UI updates untuk drag-drop dan quick actions (rollback on error).

### Reliability
- Auto-save draft service report ke localStorage tiap field change.
- Mutation rollback on error (TanStack Query optimistic pattern).
- Retry button pada loading timeout (sudah ada di `LoadingState`).

### Security
- All API endpoints validated via `verifyAuth()` middleware.
- RLS policies enforced via `createClient()` Supabase server client.
- `createAdminClient()` hanya dipakai untuk operasi yang explicit perlu bypass RLS.
- Customer signature di-store private bucket, akses via signed URL only (PII).
- Push subscription endpoint membutuhkan auth.

### Accessibility
- Color contrast minimum 4.5:1 (text) dan 3:1 (UI elements).
- Focus visible states on all interactive elements.
- `prefers-reduced-motion` respected.
- Semantic HTML (button vs div).
- ARIA labels untuk icon-only buttons.
- Touch target minimum 44px di mobile app.
- Drag-drop di Kanban memiliki keyboard alternative (context menu "Move to...").

### Maintainability
- Single source of truth untuk status colors (`src/lib/order-status.ts`, `src/lib/status-colors.ts`).
- Reusable badge components (`StatusBadge`, `InvoiceStatusBadge`, `ServiceTypeBadge`).
- Mutation hooks standardized (`useOrderMutation`, `useInvoiceMutation`).
- All forms via React Hook Form + Zod (sesuai CLAUDE.md convention).
- Error boundaries di `/dashboard` dan `/technician`.

## 8. Success Metrics

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| Avg time admin per order (create → assign) | unknown (5 pages) | < 2 menit | Manual observation |
| Number of order pages in sidebar | 5 | 1 | Sidebar count |
| Order states | 16 | 8 | Database enum |
| Hard-coded color classes in JSX | 97 | < 10 | grep audit |
| Loading states without skeleton | 8+ pages | 0 | Code audit |
| Avg WA messages per order to teknisi (replaced by app) | Sample 10 orders pre-launch | -50% | Self-report comparison |

## 9. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| State machine migration breaks existing in-flight orders | Dual-state mapping layer di Phase 0; data migration di Phase 5 setelah semua page menggunakan new states |
| Existing 97 hard-coded color usages cause UI regression saat refactor | Gradual migration via badge components; visual diff per page sebelum merge |
| Teknisi tidak adopsi mobile app (tetap pakai WA) | Soft launch dengan 1-2 teknisi dulu, training session, monitor adoption |
| Photo upload gagal di koneksi lemah | Retry dengan exponential backoff; offline banner; auto-save draft |
| Push notification permission rejected | Fallback ke realtime in-app banner + manual refresh; tidak hard-blocker |
| Signature pad UX jelek di small screen | Test di multiple devices Phase 2; signature minimum size + clear/redo button |

## 10. Out of Scope (Confirmed)

- Customer self-service portal
- Offline-first technician app (basic offline banner only)
- Multi-language support
- Technician earnings/commission tracking
- In-app chat admin↔technician
- GPS tracking technician
- Auto routing/scheduling

## 11. Open Questions (Resolved)

| Question | Decision |
|----------|----------|
| Approval flow setelah teknisi submit | Auto-approve. Customer signature = approval. Admin adjust di invoice. |
| Reassign teknisi setelah ASSIGNED | Allowed selama status `ASSIGNED`. Setelah `EN_ROUTE` ke atas, pakai reschedule. |
| Partial payment | Supported. Status `PARTIAL_PAID` hingga lunas. |
| Technician history | Full history tab di mobile app. |
| Push notifications | Web push (PWA) — masuk scope Phase 4. |
| Primary admin view | Board + List equally important. Default Board, toggle ke List. |

## 12. Appendix: Glossary

- **Order**: Permintaan service AC dari customer, ber-state machine 8-state.
- **Service Report**: Laporan teknisi setelah selesai kerja (foto, material, harga aktual, signature).
- **Lead Technician**: Teknisi utama yang assigned ke order. 1 order = 1 lead.
- **Helper Technician**: Teknisi tambahan untuk support lead. 1 order bisa multiple helpers.
- **Proforma Invoice**: Invoice draft yang dibuat saat order create, sebelum service done.
- **Final Invoice**: Invoice setelah `COMPLETED`, auto-populate dari service report.
- **PWA**: Progressive Web App — mobile web app dengan kemampuan install & push notification.

---

**Next**: See `2026-05-26-msn-erp-v2-design.md` for technical design and implementation details.
