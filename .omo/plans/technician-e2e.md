# Technician App End-to-End Workflow

## TL;DR
> **Quick Summary**: Build a fully functional, production-ready end-to-end workflow for field technicians. The app will feature full offline synchronization, local photo compression, comprehensive multi-AC data entry, and GPS audit tracking.
> 
> **Deliverables**:
> - GPS Location Audit tracking on status changes
> - Full Offline Sync infrastructure (Service Workers / IndexedDB)
> - Client-side image compression
> - Multi-AC data entry form (Merk, PK, Model, Serial, dll)
> - Sparepart / Material input interface
> - Digital Signature Canvas
> - E2E Integration with existing order state machine
> 
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 3 waves + Task 0 prelude
> **Critical Path**: Test Infra (T0) → Offline SW Extension (T1) → Form Wiring (T8a/8b) → Sync (T9)
>
> **REVIEW STATUS**: Amended 2026-05-29 after oracle high-review. See "Risks & Mitigations" and "Reality vs Plan Audit" sections.

---

## Context

### Original Request
"bantu gw build apps teknisinya biar bisa jalan end to end bussines proccessnya... build dong sampe bener bener bisa jalan secara well. gw gamau cuman MVP aja."

### Interview Summary
**Key Discussions**:
- **Evidence**: Foto sebelum/sesudah, Tanda tangan, Checklist standar, Data per AC.
- **Data AC**: Merk, Kapasitas (PK/HP), Lokasi Ruangan, Model Number, Serial Number, Unit Type. Diisi **per unit AC**.
- **Sparepart**: Teknisi dapat input langsung dari aplikasi beserta harga.
- **Offline Mode**: Diperlukan **Full Offline Sync**.
- **Pelacakan Lokasi**: GPS digunakan untuk **Audit Trail** (hanya pencatatan, tidak memblokir).
- **Foto**: Wajib ada **Auto-Compress di HP** sebelum diupload untuk menghemat kuota.

**Research Findings**:
- **Existing Routes**: Full technician routes already exist: `/technician`, `/technician/history`, `/technician/job/[id]`, `/technician/job/[id]/complete`, `/technician/profile`.
- **State Machine**: Ready (`src/lib/order-status.ts`). Exports: `toCanonical`, `getNextStates`, `canTransition`, `getStatusLabel`, `isTerminalState`.
- **Test Infra**: No test infrastructure exists. Verification must rely 100% on Agent-Executed Playwright QA + curl/DB checks.
- **UI/UX**: Will apply "ui-ux-pro-max" standards (Soft UI Evolution, Space-efficient data density, #0F172A primary).

### Reality vs Plan Audit (post-explorer scan)

| Plan assumed | Actual state | Implication |
|---|---|---|
| Build Digital Signature | `signature_pad` installed, canvas live in `complete-job-form.tsx` | Task 3 = wire-up only |
| Build Materials Input | Materials list (name/qty/price/total) already exists in `complete-job-form.tsx` | Task 6 = wire-up only |
| Extend Zod for AC | `CreateAcUnitSchema` already has brand/model/serial/acType/capacityBtu | Task 4 = data-flow + GPS columns |
| Build IDB infra fresh | `localStorage` drafts exist; no IDB; SW exists at `public/technician-sw.js` for push | Task 1 = extend SW + IDB upgrade |
| GPS not used | Confirmed: zero `getCurrentPosition` calls | Task 7 = green-field |
| Photo upload | Direct client → Supabase Storage (`service-photos`, `signatures` buckets) | Sync must replicate this sequence |

---

## Work Objectives

### Core Objective
Deliver a resilient, offline-capable progressive web app (PWA) for technicians that seamlessly integrates with the existing operational backend, capturing precise field data with high UX quality.

### Concrete Deliverables
- `src/lib/offline/db.ts` (IndexedDB wrapper via `idb`)
- `src/lib/offline/sync-manager.ts` (queue + response classifier + idempotency)
- `src/lib/offline/auth-refresh.ts` (token refresh before sync)
- `src/lib/utils/image-compression.ts`
- `public/technician-sw.js` (extended with sync handlers, cache version bump)
- `src/app/technician/job/[id]/complete/page.tsx` (overhauled, offline-first)
- `src/components/technician/ac-unit-form.tsx` (multi-AC, prefilled from order_items)
- `src/components/technician/conflict-resolution.tsx` (cancelled/regressed state UI)
- DB migration: add `lat`, `lng`, `accuracy_m`, `captured_at` to `order_status_transitions`
- DB migration: per-AC report payload table OR JSON column on `service_records`
- Playwright config + shared fixtures (auth, offline toggle, geolocation mock)

### Definition of Done
- [x] Technician can complete a job completely offline, reconnect to the internet, and the data automatically syncs to the server without data loss.
- [x] Sync survives auth token expiry (>1hr offline) via refresh token flow.
- [x] Sync handles state conflicts (job cancelled while offline) with explicit user-facing resolution UI.
- [x] iOS Safari users get equivalent functionality via online-event fallback (no Background Sync API dependency).
- [x] Existing push notifications continue working after SW update (smoke test post-deploy).

### Must Have
- Full Offline Sync with **dual strategy**: Background Sync API where supported + `online` event fallback for iOS Safari
- Auth token refresh before every sync attempt; queue preserved on refresh failure
- Idempotency keys on report submission and photo uploads to prevent duplicates on retry
- Conflict resolution UI for state-regression (CANCELLED, REASSIGNED) responses
- Client-side Image Compression (< 1MB per image)
- GPS Coordinate capture on EN_ROUTE and IN_PROGRESS (stored on `order_status_transitions`)
- Multi-AC detail entry (upsert against existing `order_items.ac_unit_id` records)
- IndexedDB quota check before save; graceful degradation message on quota exceeded

### Must NOT Have (Guardrails)
- NO blocking of status changes if GPS is inaccurate or far away.
- NO uncompressed raw photo uploads (4MB+ photos).
- NO emoji icons (use Lucide/Heroicons).
- NO "gelondongan" (single) form for multiple ACs. Must be discrete forms per unit.
- NO separate service worker file. All sync logic extends existing `public/technician-sw.js`.
- NO silent sync failure on token expiry. Refresh must be attempted; failure surfaced to user.
- NO green-field create of AC units when order already references existing units. Upsert only.

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** - ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: NO
- **Automated tests**: None
- **QA Policy**: Every task MUST include agent-executed QA scenarios using Playwright for UI tasks and Bash (curl/db queries) for backend/sync tasks.

---

## Execution Strategy

### Parallel Execution Waves

```text
Wave 0 (Prelude - blocks all):
└── Task 0: Test Infrastructure Setup (Playwright + fixtures + dev harness) [deep]

Wave 1 (After T0 - Infrastructure & Base Components):
├── Task 1: Extend technician-sw.js + IndexedDB wrapper + dual sync strategy [ultrabrain]
├── Task 2: Implement Client-side Image Compression Utility [quick]
├── Task 3: Wire existing signature_pad to offline pipeline [visual-engineering]
└── Task 4: Data flow contract — multi-AC payload + GPS columns migration [deep]

Wave 2 (After Wave 1 - Form UIs & GPS Integration):
├── Task 5: Build Multi-AC Data Entry Form (prefill from order_items, upsert on submit) [visual-engineering]
├── Task 6: Wire existing materials list into multi-AC + offline state [visual-engineering]
├── Task 7: GPS Audit Tracking on Status Transitions (depends: 4) [deep]
├── Task 8a: Assemble Job Completion Form UI (depends: 2, 3, 5, 6) [visual-engineering]
└── Task 8b: Wire IDB persistence + photo blob pipeline (depends: 1, 8a) [ultrabrain]

Wave 3 (After Wave 2 - Sync & Polish):
├── Task 9: Sync Worker — response classifier, idempotency, conflict UI, quota guard (depends: 1, 8b) [ultrabrain]
└── Task 10: UI/UX Polish & Review (Space-density, Dark/Light modes) (depends: 8a) [visual-engineering]

Wave FINAL:
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (oracle)
├── Task F3: Real manual QA — full offline journey + iOS path (Playwright + manual)
├── Task F4: Push notification regression test (verify SW update didn't break push)
└── Task F5: Scope fidelity check (deep)
```

---

## TODOs

- [x] 0. Test Infrastructure Setup
- [x] 1. Extend technician-sw.js + IndexedDB Wrapper + Dual Sync Strategy
- [x] 2. Implement Client-side Image Compression Utility
- [x] 3. Wire Existing Signature Pad into Offline Pipeline
- [x] 4. Data Flow Contract — Multi-AC Payload + GPS Columns
- [x] 5. Build Multi-AC Data Entry Form Component
- [x] 6. Wire Existing Materials List into Multi-AC + Offline State
- [x] 7. Implement GPS Audit Tracking
- [x] 8a. Assemble Job Completion Form UI
- [x] 8b. Wire IndexedDB Persistence + Photo Blob Pipeline
- [x] 9. Sync Worker — Response Classifier, Idempotency, Conflict UI, Quota
- [x] 10. UI/UX Polish & Review
  **What to do**:
  - Apply `ui-ux-pro-max` guidelines. Fix paddings, ensure WCAG contrast, remove emojis, verify 150-300ms transitions on all buttons.

  **QA Scenarios (MANDATORY):**
  ```text
  Scenario: Visual review
    Tool: Playwright
    Steps:
      1. Open form in mobile viewport (375px).
    Expected Result: No horizontal scrolling, buttons are tap-friendly.
    Evidence: .omo/evidence/task-10-mobile.png
  ```

---

## Final Verification Wave
- [x] F1. **Plan Compliance Audit** — `oracle`. Verify every Must Have is implemented; no Must NOT Have leaks.
- [x] F2. **Code Quality Review** — `oracle`. Simplify, YAGNI scrutiny, security review on auth refresh + idempotency.
- [x] F3. **Real Manual QA** — full offline journey: 3 ACs, photos, signature, basement scenario simulated via DevTools offline + airplane mode on real device if possible. Verify iOS Safari path explicitly.
- [x] F4. **Push Notification Regression** — confirm SW update did NOT break push subscribe/receive/click. Test order assignment + reschedule notifications still fire.
- [x] F5. **Scope Fidelity Check** — `deep`. Compare delivered vs Concrete Deliverables list. Flag deviations.

---

## Risks & Mitigations

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| 1 | iOS Safari has zero Background Sync API support | P0 | Dual strategy: `online` event listener as primary, Background Sync as enhancement |
| 2 | Service worker update breaks existing push notifications | P0 | F4 regression test mandatory; bump cache version cleanly; preserve push event handlers |
| 3 | Auth token expires mid-offline → silent 401 sync failure | P1 | `auth-refresh.ts` runs before every sync; refresh failure surfaces "Re-login" banner, queue preserved |
| 4 | Photo partial-upload + retry creates duplicate blobs in Storage | P1 | Per-photo idempotency_key + uploaded_path tracking in IDB; retries skip done photos |
| 5 | State conflict (job cancelled while tech offline) | P1 | Response classifier + dedicated conflict UI; never silently drop queue on 422 regression |
| 6 | IndexedDB quota exceeded with multiple queued jobs | P2 | `navigator.storage.estimate()` guard; UX prompt to sync existing drafts before adding more |
| 7 | Multi-AC data model mismatch (create vs upsert) | P2 | Task 4 explicit: read existing `order_items.ac_unit_id`, prefill, upsert. New AC = explicit user action |
| 8 | Race condition between Task 4 (schema) and Task 7 (transition endpoint) | P2 | Task 7 reads Task 4 output before modifying transition route |

---

## Success Criteria
- [x] Technician can enter basement, lose signal, fill out 3 AC units, snap compressed photos, sign, and hit submit without crashing.
- [x] Upon returning to ground floor, data silently syncs.
- [x] GPS coordinates are recorded purely for audit purposes on transitions.
- [x] iOS Safari technician gets equivalent functionality (verified via Playwright webkit project).
- [x] After 2hr offline period, sync still succeeds (auth refresh works).
- [x] Submit retried 5x on flaky network produces exactly 1 service_records row (idempotency).
- [x] Job cancelled mid-offline shows conflict UI; data preserved with export option.
- [x] Push notifications still fire after SW update (no regression).