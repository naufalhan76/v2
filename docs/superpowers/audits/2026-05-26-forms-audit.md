# Forms Audit — 2026-05-26

**Goal:** Inventory every form in the dashboard and technician app, classify
its validation pattern, note inconsistencies, and propose a follow-up
remediation plan. **No fixes in this audit.**

## Pattern legend

| Code        | Meaning                                                  |
|-------------|----------------------------------------------------------|
| RHF+Zod     | React Hook Form + zodResolver — preferred                |
| useState    | Plain React state, hand-rolled validation                |
| Mixed       | Partly RHF, partly useState                              |
| Server-only | Validation lives in the server action / API route only   |

## Inventory

| #  | Form                              | File                                                                       | Pattern   | Notes                                                                  |
|----|-----------------------------------|----------------------------------------------------------------------------|-----------|------------------------------------------------------------------------|
| 1  | Login / Signup / Reset            | `src/app/(auth)/login/page.tsx`                                            | useState  | 6 useState fields; submit calls Supabase auth directly.               |
| 2  | Create Order (legacy wizard)      | `src/app/dashboard/operasional/create-order/page.tsx`                      | useState  | 1900+ lines; Phase 5 cleanup target — do not invest.                   |
| 3  | Create Order (new route shell)    | `src/app/dashboard/orders/new/page.tsx`                                    | useState  | Re-exports legacy page (Phase 1 stub); inherits #2 pattern.            |
| 4  | Customer create/edit              | `src/app/dashboard/manajemen/customer/page.tsx`                            | useState  | Sheet form, simple — high-priority migration candidate.                |
| 5  | Technician create/edit            | `src/app/dashboard/manajemen/teknisi/page.tsx`                             | useState  | Sheet form — high-priority migration candidate.                        |
| 6  | User management                   | `src/app/dashboard/manajemen/user/page.tsx`                                | useState  | Modal — high-priority migration candidate.                             |
| 7  | Lokasi (locations)                | `src/app/dashboard/manajemen/lokasi/page.tsx`                              | useState  | Legacy, Phase 5 cleanup target.                                        |
| 8  | AC Units                          | `src/app/dashboard/manajemen/ac-units/page.tsx`                            | useState  | Legacy, Phase 5 cleanup target.                                        |
| 9  | Service Catalog (shell)           | `src/app/dashboard/settings/service-catalog/page.tsx`                      | n/a       | Tabbed shell embedding #10 + service-config; no form of its own.       |
| 10 | Service pricing                   | `src/app/dashboard/konfigurasi/service-pricing/page.tsx`                   | RHF+Zod   | Modal — OK.                                                            |
| 11 | Addons catalog                    | `src/app/dashboard/konfigurasi/addons-catalog/page.tsx`                    | RHF+Zod   | Modal — OK.                                                            |
| 12 | Invoice config                    | `src/app/dashboard/konfigurasi/invoice-config/page.tsx`                    | RHF+Zod   | Single big tabbed form — OK.                                           |
| 13 | Invoice create (blank)            | `src/app/dashboard/keuangan/invoices/create-blank/page.tsx`                | RHF+Zod   | Long form — OK.                                                        |
| 14 | Invoice create (from order)       | `src/app/dashboard/keuangan/invoices/create/page.tsx`                      | RHF+Zod   | Wizard — OK.                                                           |
| 15 | Invoice edit / revise             | `src/app/dashboard/keuangan/invoices/[id]/page.tsx`                        | useState  | Inline revisionDraft state; ad-hoc validation inside `reviseInvoice`.  |
| 16 | Record payment                    | `src/components/invoices/record-payment-modal.tsx`                         | RHF+Zod   | Modal — OK.                                                            |
| 17 | Profile (admin)                   | `src/app/dashboard/profile/page.tsx`                                       | useState  | Two sections (info + password); manual validation per field.          |
| 18 | Reschedule order                  | `src/components/orders/reschedule-modal.tsx`                               | RHF+Zod   | Modal — OK (Phase 1).                                                  |
| 19 | Reassign / Assign order           | `src/components/orders/assign-modal.tsx`                                   | RHF+Zod   | Modal — OK (Phase 1).                                                  |
| 20 | Cancel order                      | `src/components/orders/cancel-modal.tsx`                                   | useState  | Single textarea + cancellation reason — small surface, low priority.   |
| 21 | Complete Job (technician)         | `src/components/technician/complete-job-form.tsx`                          | useState  | Auto-save draft, multi-step (photos, materials, signature). Complex.   |

## Inconsistencies & risks

1. **Server-side validation drift.** All API routes use Zod schemas in
   `src/app/api/schemas/`. Client-side `useState` forms (#1, #2, #4, #5, #6,
   #7, #8, #15, #17, #20, #21) re-implement those constraints by hand →
   schemas drift over time, and required-field rules diverge between client
   and server.
2. **Error UX is inconsistent.** RHF forms show inline errors via
   `<FormMessage />`; useState forms surface errors via `useToast()` only,
   which is harder to associate with the offending field.
3. **Required-field markers.** RHF forms get the asterisk via `<FormLabel>`;
   useState forms have it inlined ad-hoc (e.g. `Name *`) or missing entirely.
4. **Async submit handling.** RHF forms standardise via
   `formState.isSubmitting`; useState forms duplicate `useState<boolean>` per
   form, which is also where the inconsistent loading-button styling came from
   (see Phase 4 loading-states audit).
5. **Login form (#1)** is the most-trafficked form in the app and still
   useState-only — should be one of the first migrations.

## Proposed remediation (follow-up ticket)

Pick a single zod schema source for shared shapes (consolidate with
`src/app/api/schemas/`), then migrate forms in priority order:

1. **High-traffic, high-leverage:**
   - Login (#1), Customer (#4), Technician (#5), User Management (#6),
     Profile (#17).
2. **Medium-priority (tactical):**
   - Cancel order (#20) — small surface, low risk migration.
   - Invoice edit / revise (#15) — currently the riskiest gap given financial
     impact, but the inline-edit shape is non-standard, so estimate carefully.
3. **Defer until specific bugs surface:**
   - Complete Job (#21) — its draft-autosave logic is more complex than typical
     RHF flows; revisit as a separate spec if/when bugs appear.
4. **Will be deleted in Phase 5 — do NOT migrate:**
   - Create Order legacy wizard (#2 + #3 shell)
   - Lokasi (#7), AC Units (#8)

Estimated effort: ~1 day per high-priority form (form + RHF refactor +
inline error UX + spot tests + code review).

## No fixes applied in this audit

This is an inventory pass only. Open ticket `forms-rhf-migration` to track.

## Verification

```bash
npm run lint
ls src/app/\(auth\)/login/page.tsx \
   src/app/dashboard/manajemen/customer/page.tsx \
   src/app/dashboard/manajemen/teknisi/page.tsx \
   src/app/dashboard/manajemen/user/page.tsx \
   src/app/dashboard/konfigurasi/addons-catalog/page.tsx \
   src/app/dashboard/konfigurasi/service-pricing/page.tsx \
   src/app/dashboard/konfigurasi/invoice-config/page.tsx \
   src/app/dashboard/keuangan/invoices/create-blank/page.tsx \
   src/app/dashboard/keuangan/invoices/[id]/page.tsx \
   src/app/dashboard/profile/page.tsx \
   src/components/orders/cancel-modal.tsx \
   src/components/technician/complete-job-form.tsx
```
