# Phase 3: Invoice Flow Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Connect technician service reports to invoice flow. Expand Report tab. Auto-populate invoices from report. Polish partial payment UI.

**Architecture:** Service report fetcher utility, invoice auto-populate action, expanded OrderReportTab with photo gallery + signature, RecordPaymentModal for partial payments.

**Tech Stack:** Next.js 15, Supabase Storage (signed URLs), TanStack Query, react-hook-form + zod, jsPDF (existing PDF export)

**Spec Reference:** See `docs/superpowers/specs/2026-05-26-msn-erp-v2-design.md` section 9 (Phase 3) and section 6.3 (Order Detail panel — Technician Report tab).

**Soft Launch Strategy:** Phase 3 ships behind no feature flag — all changes are additive (Report tab expansion, new utility, new modal). The invoice create page gains an `?orderId=` pre-fill path that does not break existing manual creation.

---

## File Structure

### Files to Create

| Path | Purpose |
|------|---------|
| `src/lib/service-report.ts` | Server-side fetcher: `getServiceReport(orderId)`, `getSignedSignatureUrl(reportId)` |
| `src/components/orders/report-photo-gallery.tsx` | Photo grid + fullscreen Dialog viewer |
| `src/components/orders/report-materials-table.tsx` | Materials table read-only |
| `src/components/orders/report-signature-card.tsx` | Signed signature image + signer name |
| `src/components/invoices/record-payment-modal.tsx` | Partial payment modal (RHF + zod) |
| `src/app/dashboard/keuangan/invoices/create/from-order/[orderId]/page.tsx` | Pre-filled create-invoice route from service report |

### Files to Modify

| Path | Purpose |
|------|---------|
| `src/components/orders/order-report-tab.tsx` | Replace placeholder with full report display |
| `src/lib/actions/invoices.ts` | Add `createInvoiceFromOrder(orderId)` action |
| `src/app/dashboard/keuangan/invoices/[id]/page.tsx` | Replace inline payment dialog with `RecordPaymentModal`, add remaining-balance prominence + improved payment history |
| `src/components/orders/order-detail-panel.tsx` | Pass `currentTechnicianId` to AssignModal in ASSIGNED footer |
| `src/components/orders/assign-modal.tsx` | Accept optional `currentTechnicianId` prop and pre-select |
| `src/lib/realtime.ts` | (Optional) Add `subscribeServiceReports` for live Report tab refresh |

### Phase 0 / 1 / 2 Imports (Already Exist)

| Symbol | File |
|--------|------|
| `EmptyState` | `src/components/ui/empty-state.tsx` |
| `useRecordPayment` | `src/hooks/use-invoice-mutation.ts` |
| `useReschedule`, `useAssignTechnician` | `src/hooks/use-order-mutation.ts` |
| `RescheduleModal` | `src/components/orders/reschedule-modal.tsx` |
| `AssignModal` | `src/components/orders/assign-modal.tsx` |
| `OrderReportTab` (placeholder) | `src/components/orders/order-report-tab.tsx` |
| `getOrderItemsForInvoice`, `recordPayment`, `createInvoice` | `src/lib/actions/invoices.ts` |
| `createClient` (RLS-respecting) | `src/lib/supabase-server.ts` |
| `createClient` (browser) | `src/lib/supabase-browser.ts` |
| `requireFinanceRole` | `src/lib/rbac.ts` |
| `formatPhone`, `cn` | `src/lib/utils.ts` |
| `calculateDiscount`, `calculateTax` | `src/lib/utils/money.ts` |

---

## Task 1: Create `src/lib/service-report.ts` fetcher utility

The Order Detail panel and the new "Create Invoice from Order" flow both need the latest non-deleted `service_reports` row for an order, and both need a signed URL for the customer signature (which lives in the private `signatures` bucket, per the design spec section 4.4).

Centralising both concerns in a single module avoids duplication and lets us swap to RPC-based fetches later without touching consumers.

**Files:**
- Create: `src/lib/service-report.ts`

### Steps

- [ ] **Step 1.1: Create the module**

```typescript
// src/lib/service-report.ts
import { createClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

export interface ServiceReportMaterial {
  addon_id?: string | null
  name: string
  qty: number
  unit_price: number
  total: number
}

export interface ServiceReport {
  report_id: string
  order_id: string
  technician_id: string
  photos_before: string[]
  photos_after: string[]
  materials: ServiceReportMaterial[]
  actual_total_price: number
  customer_signature_url: string | null
  customer_name_signed: string | null
  signed_at: string | null
  notes: string | null
  work_started_at: string | null
  work_completed_at: string | null
  submitted_at: string
  created_at: string
  updated_at: string
  technicians?: {
    technician_id: string
    technician_name: string
  } | null
}

/**
 * Fetch the latest non-deleted service report for an order.
 * Returns null if no report exists (e.g. teknisi has not submitted yet).
 */
export async function getServiceReport(
  orderId: string
): Promise<ServiceReport | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('service_reports')
    .select(
      `
      report_id,
      order_id,
      technician_id,
      photos_before,
      photos_after,
      materials,
      actual_total_price,
      customer_signature_url,
      customer_name_signed,
      signed_at,
      notes,
      work_started_at,
      work_completed_at,
      submitted_at,
      created_at,
      updated_at,
      technicians (
        technician_id,
        technician_name
      )
    `
    )
    .eq('order_id', orderId)
    .is('deleted_at', null)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    logger.error('Error fetching service report:', error)
    throw new Error('Gagal memuat laporan teknisi')
  }

  if (!data) return null

  return {
    ...data,
    photos_before: (data.photos_before as string[] | null) ?? [],
    photos_after: (data.photos_after as string[] | null) ?? [],
    materials: (data.materials as ServiceReportMaterial[] | null) ?? [],
  } as ServiceReport
}

/**
 * Generate a signed URL for the customer signature (private bucket).
 * Default expiry: 1 hour.
 *
 * Returns null when:
 *  - the report has no signature recorded
 *  - the signed URL fails to generate (logged, swallowed for the UI)
 */
export async function getSignedSignatureUrl(
  reportId: string,
  expiresInSeconds = 60 * 60
): Promise<string | null> {
  const supabase = await createClient()

  const { data: report, error: reportError } = await supabase
    .from('service_reports')
    .select('customer_signature_url')
    .eq('report_id', reportId)
    .is('deleted_at', null)
    .maybeSingle()

  if (reportError || !report?.customer_signature_url) {
    if (reportError) logger.error('Error reading signature path:', reportError)
    return null
  }

  // The stored value is the object key inside the `signatures` bucket
  // (e.g. `<orderId>/<reportId>.png`). When older records accidentally
  // stored a full URL, fall back to that value.
  const path = report.customer_signature_url
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }

  const { data, error } = await supabase.storage
    .from('signatures')
    .createSignedUrl(path, expiresInSeconds)

  if (error || !data?.signedUrl) {
    logger.error('Error creating signed signature URL:', error)
    return null
  }

  return data.signedUrl
}

/**
 * Convenience: fetch a report and a signed signature URL together.
 * Used by the "Create Invoice from Order" flow when we want the full
 * picture in one round-trip.
 */
export async function getServiceReportWithSignature(orderId: string): Promise<{
  report: ServiceReport | null
  signatureUrl: string | null
}> {
  const report = await getServiceReport(orderId)
  if (!report) return { report: null, signatureUrl: null }
  const signatureUrl = report.customer_signature_url
    ? await getSignedSignatureUrl(report.report_id)
    : null
  return { report, signatureUrl }
}
```

- [ ] **Step 1.2: Verify compile**

```bash
npm run type-check
```

Expected: PASS.

- [ ] **Step 1.3: Commit**

```bash
git add src/lib/service-report.ts
git commit -m "feat(reports): add getServiceReport + getSignedSignatureUrl utility"
```

---

## Task 2: Build report sub-components (photo gallery, materials table, signature card)

OrderReportTab gets long fast if everything lives inside one file. Splitting into three focused presentational components keeps the tab readable, makes them reusable in the invoice create page later, and lets each get its own loading skeleton.

**Files:**
- Create: `src/lib/format.ts`
- Create: `src/components/orders/report-photo-gallery.tsx`
- Create: `src/components/orders/report-materials-table.tsx`
- Create: `src/components/orders/report-signature-card.tsx`

### Steps

- [ ] **Step 2.0: Extract `formatCurrency` into a shared helper**

The codebase has `formatCurrency` re-defined inline in `src/lib/pdf-export.ts` and `src/app/dashboard/keuangan/invoices/[id]/page.tsx`. Phase 3 introduces several new currency-displaying components, so we centralise it now. Inline copies will be migrated opportunistically (not in scope for Phase 3 — leave them in place until they break).

Create `src/lib/format.ts`:

```typescript
/**
 * Format a number as Indonesian Rupiah currency.
 * Returns `Rp 0` for nullish or non-finite inputs.
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(0)
  }

  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

/**
 * Format an ISO timestamp to a human-readable Indonesian datetime.
 * Returns an em dash when the input is missing.
 */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d)
}
```

Verify:

```bash
npm run type-check
```

Expected: PASS.

- [ ] **Step 2.3: Create signature card**

`src/components/orders/report-signature-card.tsx`:

```tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import Image from 'next/image'
import { PenLine, ShieldCheck } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime } from '@/lib/format'

interface ReportSignatureCardProps {
  reportId: string
  customerNameSigned: string | null
  signedAt: string | null
  hasSignature: boolean
}

/**
 * Renders the customer's signature image. The signature lives in a private
 * Supabase Storage bucket — we fetch a signed URL from the API on mount
 * (1-hour expiry, refreshed via TanStack Query staleTime).
 */
export function ReportSignatureCard({
  reportId,
  customerNameSigned,
  signedAt,
  hasSignature,
}: ReportSignatureCardProps) {
  const { data: signatureUrl, isLoading } = useQuery({
    queryKey: ['service-report-signature', reportId],
    queryFn: async () => {
      const res = await fetch(`/api/service-reports/${reportId}/signature`)
      if (!res.ok) throw new Error('Gagal memuat signature')
      const json = await res.json()
      return (json?.data?.signedUrl as string | null) ?? null
    },
    enabled: hasSignature,
    staleTime: 50 * 60 * 1000, // 50 min — slightly less than 1h signed URL TTL
  })

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <PenLine className="h-4 w-4 text-muted-foreground" />
        Tanda Tangan Customer
      </div>

      {!hasSignature ? (
        <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          Belum ada tanda tangan customer.
        </p>
      ) : isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : !signatureUrl ? (
        <p className="rounded-md border border-dashed p-3 text-xs text-destructive">
          Gagal memuat signature. Coba refresh halaman.
        </p>
      ) : (
        <div className="space-y-2 rounded-md border p-3">
          <div className="relative h-32 w-full overflow-hidden rounded bg-muted/30">
            <Image
              src={signatureUrl}
              alt={`Tanda tangan ${customerNameSigned ?? 'customer'}`}
              fill
              sizes="(max-width: 640px) 100vw, 400px"
              className="object-contain"
              unoptimized
            />
          </div>
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 text-green-600" />
            <div className="space-y-0.5">
              <p>
                Ditandatangani oleh{' '}
                <span className="font-semibold text-foreground">
                  {customerNameSigned || '—'}
                </span>
              </p>
              <p>{formatDateTime(signedAt)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

The card hits a route handler we wire up next. The handler enforces RLS by using the cookie-bound `createClient`, so a TECHNICIAN viewing their own report or an ADMIN/FINANCE viewing any report both work; anonymous requests are rejected.

- [ ] **Step 2.4: Create signed-URL route handler**

Create `src/app/api/service-reports/[reportId]/signature/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSignedSignatureUrl } from '@/lib/service-report'
import { createClient } from '@/lib/supabase-server'

export async function GET(
  _req: NextRequest,
  { params }: { params: { reportId: string } }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // RLS on service_reports already gates SELECT; if the user can read the
  // report row, they may also see its signed URL. Otherwise we get null.
  const signedUrl = await getSignedSignatureUrl(params.reportId)

  return NextResponse.json({
    success: true,
    data: { signedUrl },
  })
}
```

- [ ] **Step 2.5: Verify**

```bash
npm run type-check && npm run lint
```

Expected: PASS.

- [ ] **Step 2.6: Commit**

```bash
git add src/lib/format.ts src/components/orders/report-photo-gallery.tsx src/components/orders/report-materials-table.tsx src/components/orders/report-signature-card.tsx src/app/api/service-reports
git commit -m "feat(reports): add photo gallery, materials table, signature card components"
```

---

## Task 3: Expand `OrderReportTab` with full report display

Replace the placeholder body with a full read-only report. Include:

- Photos before / after grids (Task 2 component)
- Materials table (Task 2 component)
- Actual price highlighted (vs. order's estimated price for context)
- Customer signature image via signed URL (Task 2 component)
- Notes (whitespace-preserved)
- Timestamps: `work_started_at`, `work_completed_at`, `submitted_at`
- Loading skeletons for all sections during initial fetch
- Empty state when no report yet (kept from current placeholder)

The component already uses TanStack Query — switch the query function from a direct supabase-js call to a thin client-side fetch against a new route handler so the server-side `getServiceReport` (with its richer typing) becomes the single source of truth.

**Files:**
- Modify: `src/components/orders/order-report-tab.tsx`
- Create: `src/app/api/service-reports/route.ts` (GET by `?orderId=`)

### Steps

- [ ] **Step 3.1: Create the report fetch route**

Create `src/app/api/service-reports/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServiceReport } from '@/lib/service-report'
import { createClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get('orderId')
  if (!orderId) {
    return NextResponse.json(
      { success: false, error: 'orderId query param required' },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const report = await getServiceReport(orderId)
  return NextResponse.json({ success: true, data: report })
}
```

- [ ] **Step 3.2: Replace `OrderReportTab` body**

Overwrite `src/components/orders/order-report-tab.tsx`:

```tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { FileText, Clock, CheckCircle2, Send } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ReportPhotoGallery } from '@/components/orders/report-photo-gallery'
import { ReportMaterialsTable } from '@/components/orders/report-materials-table'
import { ReportSignatureCard } from '@/components/orders/report-signature-card'
import { formatCurrency, formatDateTime } from '@/lib/format'
import type { ServiceReport } from '@/lib/service-report'

interface OrderReportTabProps {
  orderId: string
}

function ReportSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-32" />
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="aspect-square w-full" />
        <Skeleton className="aspect-square w-full" />
        <Skeleton className="aspect-square w-full" />
      </div>
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  )
}

export function OrderReportTab({ orderId }: OrderReportTabProps) {
  const { data: report, isLoading, error } = useQuery({
    queryKey: ['service-report', orderId],
    queryFn: async () => {
      const res = await fetch(`/api/service-reports?orderId=${encodeURIComponent(orderId)}`)
      if (!res.ok) throw new Error('Gagal memuat laporan')
      const json = await res.json()
      return (json?.data ?? null) as ServiceReport | null
    },
  })

  if (isLoading) return <ReportSkeleton />

  if (error) {
    return (
      <EmptyState
        icon={FileText}
        title="Gagal memuat laporan"
        description={error instanceof Error ? error.message : 'Terjadi kesalahan'}
      />
    )
  }

  if (!report) {
    return (
      <EmptyState
        icon={FileText}
        title="Belum ada laporan"
        description="Teknisi belum submit laporan untuk order ini. Laporan akan muncul setelah teknisi menyelesaikan pekerjaan."
      />
    )
  }

  return (
    <div className="space-y-5">
      {/* Pricing summary — visually prominent */}
      <Card className="border-primary/40 bg-primary/5">
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Total Aktual
            </p>
            <p className="text-2xl font-bold text-primary">
              {formatCurrency(report.actual_total_price)}
            </p>
          </div>
          {report.technicians?.technician_name && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Submitted by</p>
              <p className="text-sm font-medium">
                {report.technicians.technician_name}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Photo galleries */}
      <ReportPhotoGallery title="Foto Sebelum" photos={report.photos_before} />
      <ReportPhotoGallery title="Foto Sesudah" photos={report.photos_after} />

      <Separator />

      {/* Materials */}
      <ReportMaterialsTable materials={report.materials} />

      <Separator />

      {/* Signature */}
      <ReportSignatureCard
        reportId={report.report_id}
        customerNameSigned={report.customer_name_signed}
        signedAt={report.signed_at}
        hasSignature={Boolean(report.customer_signature_url)}
      />

      {/* Notes */}
      {report.notes && (
        <>
          <Separator />
          <div className="space-y-2">
            <p className="text-sm font-semibold">Catatan Teknisi</p>
            <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
              {report.notes}
            </p>
          </div>
        </>
      )}

      {/* Timeline */}
      <Separator />
      <div className="space-y-2">
        <p className="text-sm font-semibold">Timeline</p>
        <dl className="space-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" />
            <dt className="w-32">Mulai kerja</dt>
            <dd className="font-medium text-foreground">
              {formatDateTime(report.work_started_at)}
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <dt className="w-32">Selesai kerja</dt>
            <dd className="font-medium text-foreground">
              {formatDateTime(report.work_completed_at)}
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <Send className="h-3.5 w-3.5" />
            <dt className="w-32">Submitted</dt>
            <dd className="font-medium text-foreground">
              {formatDateTime(report.submitted_at)}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
```

- [ ] **Step 3.3: Verify**

```bash
npm run type-check && npm run lint
```

Expected: PASS.

- [ ] **Step 3.4: Manual smoke**

Open an order with a submitted report. Verify the Report tab shows photos, materials, total price, signature image, notes, and timestamps. Open an order without a report — verify empty state.

- [ ] **Step 3.5: Commit**

```bash
git add src/components/orders/order-report-tab.tsx src/app/api/service-reports/route.ts
git commit -m "feat(reports): expand OrderReportTab with photos, materials, signature, timeline"
```

---

## Task 4: Add `createInvoiceFromOrder` server action

Goal: from a completed order with a service report, build a draft invoice whose line items reflect what the technician actually delivered. The action does **not** persist `actual_total_price` as a magic override — instead, it computes invoice totals from line items the same way `createInvoice` already does. That keeps tax + discount math consistent with the rest of the invoice subsystem.

**Behavior:**

1. Verify order exists and is in a state that can be invoiced (`COMPLETED` canonical, includes legacy `DONE`).
2. Fetch latest non-deleted service report (required; if missing, throw a typed error so the UI can fall back to manual create).
3. Build line items:
   - Base service rows from `getOrderItemsForInvoice(orderId)` (existing helper) — quantity + estimated price per AC unit + service.
   - Material rows from `report.materials` — one ADDON line per material.
4. Insert invoice + items as DRAFT, returning the new `invoice_id`.
5. Sync order status `DONE → INVOICED` (the existing convention enforced inside `createInvoice`).

**Files:**
- Modify: `src/lib/actions/invoices.ts`

### Steps

- [ ] **Step 4.1: Add new typed error and action**

Append to `src/lib/actions/invoices.ts`:

```typescript
import { getServiceReport } from '@/lib/service-report'

export class ServiceReportMissingError extends Error {
  constructor(orderId: string) {
    super(`Service report belum ada untuk order ${orderId}`)
    this.name = 'ServiceReportMissingError'
  }
}

export interface CreateInvoiceFromOrderResult {
  invoice_id: string
  invoice_number: string
  total_amount: number
  source: 'SERVICE_REPORT'
}

/**
 * Auto-populate a draft invoice from a completed order's service report.
 *
 * Line items are composed from:
 *  - Base service rows (one per order_item) using estimated price.
 *  - Material rows (one per report.materials entry) as ADDON line items.
 *
 * Returns the new invoice's id so the UI can redirect to the detail page
 * for review/edit before sending.
 */
export async function createInvoiceFromOrder(
  orderId: string
): Promise<CreateInvoiceFromOrderResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  await requireFinanceRole(user)

  // Fetch order and verify state
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('order_id, customer_id, status')
    .eq('order_id', orderId)
    .maybeSingle()

  if (orderError || !order) {
    throw new Error('Order tidak ditemukan')
  }

  // Accept both COMPLETED (canonical) and DONE (legacy alias)
  const acceptableStatuses = ['COMPLETED', 'DONE']
  if (!acceptableStatuses.includes(order.status)) {
    throw new Error(
      `Order belum siap untuk invoice (status: ${order.status}). ` +
        `Tunggu teknisi submit laporan terlebih dahulu.`
    )
  }

  if (!order.customer_id) {
    throw new Error('Order tidak memiliki customer terhubung')
  }

  // Fetch service report — required for auto-populate
  const report = await getServiceReport(orderId)
  if (!report) {
    throw new ServiceReportMissingError(orderId)
  }

  // Fetch order items (base services per AC unit)
  const orderItems = await getOrderItemsForInvoice(orderId)

  // Build invoice line items
  const baseServiceItems: CreateInvoiceInput['items'] = orderItems.map((oi) => ({
    item_type: 'BASE_SERVICE',
    description: [
      oi.serviceName,
      oi.unitTypeName ? `— ${oi.unitTypeName}` : null,
      oi.capacityLabel ? `(${oi.capacityLabel})` : null,
      oi.msnCode ? `· MSN ${oi.msnCode}` : null,
    ]
      .filter(Boolean)
      .join(' '),
    quantity: oi.quantity,
    unit_price: oi.estimatedPrice,
    service_type: oi.serviceType,
  }))

  const materialItems: CreateInvoiceInput['items'] = report.materials.map((m) => ({
    item_type: 'ADDON',
    description: m.name,
    quantity: m.qty,
    unit_price: m.unit_price,
    addon_id: m.addon_id ?? undefined,
  }))

  const items = [...baseServiceItems, ...materialItems]
  if (items.length === 0) {
    throw new Error('Order tidak memiliki item yang bisa di-invoice')
  }

  // Resolve base service price for invoice header (sum of base lines)
  const baseServicePrice = baseServiceItems.reduce(
    (sum, it) => sum + it.quantity * it.unit_price,
    0
  )

  // Resolve invoice config defaults (due date)
  const config = await getInvoiceConfig()
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + (config?.default_due_days ?? 30))

  const primaryServiceType = orderItems[0]?.serviceType ?? 'SERVICE'
  const primaryServiceName = orderItems[0]?.serviceName ?? 'Service'

  const invoice = await createInvoice({
    order_id: orderId,
    customer_id: order.customer_id,
    invoice_type: 'FINAL',
    due_date: dueDate.toISOString().split('T')[0],
    service_type: primaryServiceType,
    service_name: primaryServiceName,
    base_service_price: baseServicePrice,
    items,
    notes:
      `Auto-populated dari service report ${report.report_id}.` +
      (report.notes ? `\n\nCatatan teknisi:\n${report.notes}` : ''),
    tax_percentage: config?.default_tax_percentage ?? 11,
  })

  return {
    invoice_id: invoice.invoice_id,
    invoice_number: invoice.invoice_number,
    total_amount: invoice.total_amount,
    source: 'SERVICE_REPORT',
  }
}
```

> **Why reuse `createInvoice` instead of inlining the insert?** It already handles invoice numbering, terms template, status sync (`DONE → INVOICED`), and item insertion with rollback. Reusing it keeps Phase 3 a thin orchestration layer over a battle-tested action.

- [ ] **Step 4.2: Verify**

```bash
npm run type-check && npm run lint
```

Expected: PASS.

- [ ] **Step 4.3: Commit**

```bash
git add src/lib/actions/invoices.ts
git commit -m "feat(invoices): add createInvoiceFromOrder action with service report population"
```

---

## Task 5: New "Create Invoice from Report" route

Two delivery options were considered:

| Option | Pros | Cons |
|--------|------|------|
| Add `?orderId=` to existing `/dashboard/keuangan/invoices/create` | Keeps single create page | Existing page is a 920-line wizard — pre-fill code becomes deeply intertwined with manual flow |
| New route `/dashboard/keuangan/invoices/create/from-order/[orderId]` | Isolated, simple, redirects on success | Slight URL duplication |

**Decision:** Go with the dedicated route. The page calls `createInvoiceFromOrder` server-side, then redirects to `/dashboard/keuangan/invoices/[invoiceId]` where the existing detail page already has full edit (revision) support. No need to duplicate the wizard — the detail page IS the editor for DRAFT invoices.

**Files:**
- Create: `src/app/dashboard/keuangan/invoices/create/from-order/[orderId]/page.tsx`

### Steps

- [ ] **Step 5.1: Create the route**

Create `src/app/dashboard/keuangan/invoices/create/from-order/[orderId]/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, FileText } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  createInvoiceFromOrder,
  ServiceReportMissingError,
} from '@/lib/actions/invoices'
import { logger } from '@/lib/logger'

interface PageProps {
  params: { orderId: string }
}

export default async function CreateInvoiceFromOrderPage({ params }: PageProps) {
  let result: Awaited<ReturnType<typeof createInvoiceFromOrder>> | null = null
  let errorMessage: string | null = null
  let isReportMissing = false

  try {
    result = await createInvoiceFromOrder(params.orderId)
  } catch (err) {
    if (err instanceof ServiceReportMissingError) {
      isReportMissing = true
      errorMessage = err.message
    } else {
      errorMessage = err instanceof Error ? err.message : 'Terjadi kesalahan'
      logger.error('createInvoiceFromOrder failed:', err)
    }
  }

  if (result) {
    // Hand off to the detail page where admin reviews + edits before sending.
    redirect(
      `/dashboard/keuangan/invoices/${result.invoice_id}?prefilled=service-report`
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" asChild>
          <Link href={`/dashboard/orders?orderId=${params.orderId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Kembali ke Order
          </Link>
        </Button>
      </div>

      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-900">
            <AlertTriangle className="h-5 w-5" />
            Tidak dapat auto-populate invoice
          </CardTitle>
          <CardDescription className="text-amber-800">
            {errorMessage ?? 'Terjadi kesalahan saat membuat invoice dari order ini.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isReportMissing && (
            <p className="text-sm text-amber-900">
              Order ini belum memiliki service report dari teknisi. Anda bisa:
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href={`/dashboard/keuangan/invoices/create?orderId=${params.orderId}`}>
                <FileText className="mr-2 h-4 w-4" />
                Buat Invoice Manual
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/dashboard/orders?orderId=${params.orderId}`}>
                Lihat Order
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 5.2: Wire the entry point**

The Order Detail panel's COMPLETED footer already links to `/dashboard/keuangan/invoices/create?orderId=...`. Update it to point at the new route — but keep manual-create as a fallback link the error page surfaces.

In `src/components/orders/order-detail-panel.tsx`, replace the COMPLETED footer button:

```tsx
{canonical === 'COMPLETED' && (
  <Button asChild className="flex-1">
    <Link href={`/dashboard/keuangan/invoices/create/from-order/${order.order_id}`}>
      Buat Invoice
    </Link>
  </Button>
)}
```

The OrderInvoiceTab's "Create Invoice" CTA in the Sheet uses the same target URL via `onCreateInvoice` — update that callback to point at `/dashboard/keuangan/invoices/create/from-order/${order.order_id}` as well so both entry points behave consistently.

- [ ] **Step 5.3: Add "Pre-filled" banner on detail page**

The detail page should show a one-time banner when arriving with `?prefilled=service-report` so the admin knows the line items came from the report and can be edited.

Edit `src/app/dashboard/keuangan/invoices/[id]/page.tsx`:

```tsx
import { useSearchParams } from 'next/navigation'
// ...inside the component:
const searchParams = useSearchParams()
const isPrefilledFromReport = searchParams?.get('prefilled') === 'service-report'

// Render at the top of the main column, near the existing communication banner:
{isPrefilledFromReport && (
  <Card className="border-blue-200 bg-blue-50/40">
    <CardContent className="pt-6">
      <div className="flex items-start gap-3">
        <FileText className="h-5 w-5 text-blue-700 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-blue-900">
            Invoice di-populate dari service report
          </p>
          <p className="text-sm text-blue-800">
            Item invoice diambil dari laporan teknisi (foto, material, harga). Anda
            dapat mengedit item, mengubah pajak/diskon, atau menambah item sebelum
            mengirim ke customer. Klik <strong>Edit / Revisi</strong> untuk mengubah.
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
)}
```

(`FileText` is already imported in that file via `lucide-react`.)

- [ ] **Step 5.4: Verify**

```bash
npm run type-check && npm run lint
```

Expected: PASS.

- [ ] **Step 5.5: Manual smoke**

1. Open an order with state COMPLETED that has a service report.
2. Click "Buat Invoice" in the detail panel footer.
3. Expect redirect to `/dashboard/keuangan/invoices/<new id>?prefilled=service-report`.
4. Verify the new invoice has line items: one BASE_SERVICE per order item + one ADDON per material.
5. Verify the blue "Pre-filled" banner appears.
6. Open an order with state COMPLETED but no service report.
7. Expect the amber "tidak dapat auto-populate" page with a "Buat Invoice Manual" fallback button.

- [ ] **Step 5.6: Commit**

```bash
git add src/app/dashboard/keuangan/invoices/create/from-order src/components/orders/order-detail-panel.tsx src/components/orders/order-invoice-tab.tsx src/app/dashboard/keuangan/invoices/[id]/page.tsx
git commit -m "feat(invoices): add /create/from-order/[id] route with service-report pre-fill"
```

---

## Task 6: Reassign UI — pre-select current technician in AssignModal

**Background:** The OrderDetailPanel already opens AssignModal in the ASSIGNED state via the existing "Reassign" button (Phase 1, file `src/components/orders/order-detail-panel.tsx`). What's missing is the UX detail: the modal opens with an empty technician dropdown, forcing the admin to manually find the current technician just to confirm or replace them.

The backend (`assignOrdersToTechnician` in `src/lib/actions/orders.ts`) already replaces the lead via UPSERT semantics — see lines 296-375. No backend change is needed.

**Plan:** Make AssignModal accept an optional `currentTechnicianId` prop and pre-select it. The OrderDetailPanel passes the lead technician's id when opening the modal in ASSIGNED state.

**Files:**
- Modify: `src/components/orders/assign-modal.tsx`
- Modify: `src/components/orders/order-detail-panel.tsx`

### Steps

- [ ] **Step 6.1: Add `currentTechnicianId` prop to AssignModal**

Edit `src/components/orders/assign-modal.tsx`:

```tsx
interface AssignModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderIds: string[]
  defaultDate?: string | null
  currentTechnicianId?: string | null
  currentHelperIds?: string[]
  onSuccess?: () => void
}
```

Update `defaultValues` and the `useEffect` reset:

```tsx
const form = useForm<FormValues>({
  resolver: zodResolver(schema),
  defaultValues: {
    technicianId: currentTechnicianId ?? '',
    helperIds: currentHelperIds ?? [],
    scheduledDate: defaultDate ? new Date(defaultDate) : new Date(),
  },
})

useEffect(() => {
  if (open) {
    form.reset({
      technicianId: currentTechnicianId ?? '',
      helperIds: currentHelperIds ?? [],
      scheduledDate: defaultDate ? new Date(defaultDate) : new Date(),
    })
  }
}, [open, defaultDate, currentTechnicianId, currentHelperIds, form])
```

Adjust the modal title to reflect intent — when `currentTechnicianId` is present, the dialog is "Reassign Teknisi" rather than "Assign Teknisi":

```tsx
<DialogHeader>
  <DialogTitle>
    {currentTechnicianId ? 'Reassign Teknisi' : 'Assign Teknisi'}
  </DialogTitle>
  <DialogDescription>
    {currentTechnicianId
      ? `Ganti teknisi lead untuk order ${orderIds[0]}. Helper akan dipertahankan jika tidak diubah.`
      : orderIds.length === 1
      ? `Assign teknisi untuk order ${orderIds[0]}`
      : `Assign teknisi untuk ${orderIds.length} order sekaligus`}
  </DialogDescription>
</DialogHeader>
```

And change the submit button label likewise:

```tsx
<Button type="submit" disabled={mutation.isPending}>
  {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  {currentTechnicianId ? 'Reassign' : 'Assign'}
</Button>
```

- [ ] **Step 6.2: Compute current lead/helpers in OrderDetailPanel**

Edit `src/components/orders/order-detail-panel.tsx` so the assign modal in the ASSIGNED footer is opened with the current lead pre-selected:

```tsx
// Near the top of the component, after `order` is resolved:
const currentLead =
  order?.order_technicians?.find((ot) => ot.role === 'lead')?.technician_id ?? null
const currentHelpers =
  order?.order_technicians
    ?.filter((ot) => ot.role === 'helper')
    .map((ot) => ot.technician_id) ?? []

// Track whether the modal is opened in reassign vs initial-assign mode:
const [assignMode, setAssignMode] = useState<'assign' | 'reassign'>('assign')
```

Update the ASSIGNED footer's Reassign button to set the mode:

```tsx
{canonical === 'ASSIGNED' && (
  <>
    <Button
      onClick={() => {
        setAssignMode('reassign')
        setAssignOpen(true)
      }}
      variant="outline"
      className="flex-1"
    >
      Reassign
    </Button>
    <Button onClick={() => setRescheduleOpen(true)} variant="outline">
      Reschedule
    </Button>
    <Button onClick={() => setCancelOpen(true)} variant="ghost">
      Batalkan
    </Button>
  </>
)}
```

Make the PENDING footer's Assign button reset mode to `assign`:

```tsx
{canonical === 'PENDING' && (
  <>
    <Button
      onClick={() => {
        setAssignMode('assign')
        setAssignOpen(true)
      }}
      className="flex-1"
    >
      Assign Teknisi
    </Button>
    <Button variant="outline" onClick={() => setCancelOpen(true)}>
      Batalkan
    </Button>
  </>
)}
```

Pass the right props to AssignModal at the bottom of the panel:

```tsx
<AssignModal
  open={assignOpen}
  onOpenChange={setAssignOpen}
  orderIds={orderId ? [orderId] : []}
  defaultDate={order?.scheduled_visit_date}
  currentTechnicianId={assignMode === 'reassign' ? currentLead : null}
  currentHelperIds={assignMode === 'reassign' ? currentHelpers : []}
/>
```

> **Note on `OrderDetailData`:** the `order_technicians` field shape is implicit via Phase 1's `getOrderById` join. If TypeScript complains, add a typed shape in `src/components/orders/order-detail-tab.tsx` (where `OrderDetailData` is exported) with `order_technicians?: Array<{ technician_id: string; role: 'lead' | 'helper' }>`.

- [ ] **Step 6.3: Verify**

```bash
npm run type-check && npm run lint
```

Expected: PASS.

- [ ] **Step 6.4: Manual smoke**

1. Open an ASSIGNED order. Click "Reassign" in the footer.
2. Modal opens with title "Reassign Teknisi". The lead technician is already selected.
3. Submit without changing anything — should be a no-op (optimistic UI updates, no error).
4. Pick a different technician. Submit. Verify order_technicians has the new lead and old lead is removed.
5. Open a PENDING order. Click "Assign Teknisi". Modal title is "Assign Teknisi" with empty selection.

- [ ] **Step 6.5: Commit**

```bash
git add src/components/orders/assign-modal.tsx src/components/orders/order-detail-panel.tsx src/components/orders/order-detail-tab.tsx
git commit -m "feat(orders): pre-select current technician when reassigning from detail panel"
```

---

## Task 7: Verify reschedule end-to-end (board drag + modal + toast)

This is a verification task more than a feature task — Phase 1 already shipped the drag-from-board-to-PENDING flow that opens RescheduleModal, which then calls `useReschedule` (which delegates to the `rescheduleOrder` server action created in Phase 1 Task 2). Confirm the chain works and add the missing user-feedback polish.

**Files:**
- Modify: `src/hooks/use-order-mutation.ts` (verify `useReschedule` toasts on success)
- Modify: `src/components/orders/reschedule-modal.tsx` (verify toast wiring)

### Steps

- [ ] **Step 7.1: Confirm `useReschedule` shows a success toast**

Open `src/hooks/use-order-mutation.ts` and verify `useReschedule` has both success and error toasts. If the success toast is missing, add it:

```typescript
export function useReschedule() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (params: {
      orderId: string
      reason: string
      newScheduledDate: string
    }) => {
      const result = await rescheduleOrder(params)
      if (!result.success) {
        throw new Error(result.error || 'Gagal reschedule order')
      }
      return result
    },
    onMutate: async ({ orderId }) => {
      await queryClient.cancelQueries({ queryKey: ['orders'] })
      const previous = queryClient.getQueryData(['orders'])
      // Optimistic: move card back to PENDING column
      queryClient.setQueryData<{ data?: Array<Record<string, unknown>> } | undefined>(
        ['orders'],
        (old) => {
          if (!old?.data) return old
          return {
            ...old,
            data: old.data.map((o) =>
              o.order_id === orderId
                ? { ...o, status: 'PENDING', assigned_technician_id: null }
                : o
            ),
          }
        }
      )
      return { previous }
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['orders'], ctx.previous)
      toast({
        variant: 'destructive',
        title: 'Gagal reschedule',
        description: err instanceof Error ? err.message : 'Terjadi kesalahan',
      })
    },
    onSuccess: () => {
      toast({
        title: 'Order rescheduled',
        description: 'Order kembali ke daftar Menunggu dan assignment teknisi dihapus',
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}
```

- [ ] **Step 7.2: Verify board drag → modal flow**

In `src/components/orders/orders-board-view.tsx` (Phase 1 file), confirm that dropping an ASSIGNED card onto the PENDING column triggers `setRescheduleOrderId(orderId)` and opens RescheduleModal. If the drag handler instead calls `useTransitionOrder` directly with a status of PENDING, change it to open the modal — Phase 1 Task 7 in the existing plan should already be doing this, but verify.

Expected behavior:
1. User drags an ASSIGNED card to PENDING.
2. RescheduleModal opens with `defaultDate` = the order's `scheduled_visit_date`.
3. User enters reason + new date, submits.
4. `useReschedule` is called. Optimistic update moves card to PENDING in board.
5. Success toast: "Order rescheduled".
6. On error, card snaps back to ASSIGNED (optimistic rollback) + destructive toast.

- [ ] **Step 7.3: Manual regression test**

Run through the flow:

1. Drag ASSIGNED → PENDING from the board.
2. Modal opens. Cancel.
3. Card stays in ASSIGNED column (no-op).
4. Drag again. Fill reason "Customer minta ganti tanggal". Pick a date 3 days from now.
5. Submit. Card moves to PENDING immediately. Success toast appears.
6. Refresh the page. Order is still PENDING with new date and no technicians.
7. Open the order's history tab. Verify entry: "PENDING ← ASSIGNED" with note `Reschedule: Customer minta ganti tanggal`.

- [ ] **Step 7.4: Commit (only if changes made)**

```bash
git add src/hooks/use-order-mutation.ts src/components/orders/orders-board-view.tsx
git commit -m "fix(orders): polish reschedule UX with success toast + optimistic board update"
```

If no changes were needed, skip the commit and note in the task tracker that Phase 1 already covered this.

---

## Task 8: Partial payment UI improvements on invoice detail page

The invoice detail page (`src/app/dashboard/keuangan/invoices/[id]/page.tsx`) already has:
- A "Payment Summary" sidebar card showing Total / Paid / Remaining
- A "Record Payment" button that opens an inline `<Dialog>` form
- A "Payment History" card listing past payments

What's lacking for partial-payment polish:
1. The sidebar's "Remaining" amount is small and lives in a sidebar — it should be **prominent** on the page, especially for partially-paid invoices.
2. The inline Dialog hand-rolls form state with five `useState` hooks — moves to `RecordPaymentModal` (Task 9) using react-hook-form + zod.
3. Payment History only shows date/method/reference/amount but not a per-row balance after payment — this is useful when reviewing partial payments.
4. Validation: amount must be > 0 and ≤ remaining balance.

Tasks 8 and 9 work together: Task 9 builds the modal; Task 8 wires it in and adds the prominence/banner improvements.

**Files:**
- Modify: `src/app/dashboard/keuangan/invoices/[id]/page.tsx`

### Steps

- [ ] **Step 8.1: Add a prominent "Remaining Balance" banner for partially paid invoices**

Above the "Invoice Details" card on the main column, render a coloured banner when the invoice has been partially paid:

```tsx
{invoice.payment_status === 'PARTIAL' && remainingAmount > 0 && (
  <Card className="border-amber-300 bg-amber-50/60">
    <CardContent className="flex items-center justify-between p-4">
      <div className="flex items-center gap-3">
        <AlertCircle className="h-5 w-5 text-amber-700" />
        <div>
          <p className="text-xs uppercase tracking-wide text-amber-800">
            Sisa Tagihan
          </p>
          <p className="text-2xl font-bold text-amber-900">
            {formatCurrency(remainingAmount)}
          </p>
          <p className="text-xs text-amber-800">
            Sudah dibayar {formatCurrency(invoice.paid_amount)} dari{' '}
            {formatCurrency(invoice.total_amount)}
          </p>
        </div>
      </div>
      <Button
        onClick={() => setIsPaymentDialogOpen(true)}
        className="bg-amber-600 hover:bg-amber-700"
      >
        <DollarSign className="mr-2 h-4 w-4" />
        Catat Pembayaran
      </Button>
    </CardContent>
  </Card>
)}
```

Add `AlertCircle` to the existing `lucide-react` import line.

- [ ] **Step 8.2: Replace the inline payment Dialog with `<RecordPaymentModal />`**

(After Task 9 has shipped the modal.)

Remove these state hooks and handlers from the page:

```tsx
// REMOVE:
const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
const [paymentMethod, setPaymentMethod] = useState('TRANSFER')
const [paymentAmount, setPaymentAmount] = useState('')
const [paymentReference, setPaymentReference] = useState('')
const [paymentNotes, setPaymentNotes] = useState('')

// REMOVE:
const resetPaymentForm = () => {
  setPaymentDate(new Date().toISOString().split('T')[0])
  setPaymentMethod('TRANSFER')
  setPaymentAmount('')
  setPaymentReference('')
  setPaymentNotes('')
}

// REMOVE: the entire <Dialog> at the bottom labelled "Payment Dialog"
```

Keep `handleRecordPayment` only if the page still needs it for retries — but Task 9's `RecordPaymentModal` calls `useRecordPayment` directly, so this handler can be removed too.

Replace the bottom dialog with:

```tsx
<RecordPaymentModal
  open={isPaymentDialogOpen}
  onOpenChange={setIsPaymentDialogOpen}
  invoice={invoice}
  onSuccess={loadInvoice}
/>
```

And update the `Record Payment` button click handlers (sidebar + new banner) to:

```tsx
<Button
  className="w-full"
  onClick={() => setIsPaymentDialogOpen(true)}
>
  <DollarSign className="mr-2 h-4 w-4" />
  Record Payment
</Button>
```

(Remove `setPaymentAmount(remainingAmount.toString())` — the modal handles its own pre-fill.)

- [ ] **Step 8.3: Improve payment history with running balance**

Replace the existing Payment History table with one that includes a running balance column:

```tsx
{payments.length > 0 && (
  <Card>
    <CardHeader>
      <CardTitle>Riwayat Pembayaran</CardTitle>
      <CardDescription>
        {payments.length} pembayaran tercatat
      </CardDescription>
    </CardHeader>
    <CardContent>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tanggal</TableHead>
            <TableHead>Metode</TableHead>
            <TableHead>Referensi</TableHead>
            <TableHead className="text-right">Jumlah</TableHead>
            <TableHead className="text-right">Sisa Setelah</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(() => {
            // Sort oldest first to compute running balance, then reverse for display
            const sorted = [...payments].sort(
              (a, b) =>
                new Date(a.payment_date).getTime() -
                new Date(b.payment_date).getTime()
            )
            let running = invoice.total_amount
            const rows = sorted.map((p) => {
              running -= p.amount
              return { ...p, balanceAfter: running }
            })
            return rows.reverse().map((p) => (
              <TableRow key={p.payment_id}>
                <TableCell>
                  {format(new Date(p.payment_date), 'dd MMM yyyy', { locale: localeId })}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{p.payment_method}</Badge>
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {p.reference_number || '-'}
                </TableCell>
                <TableCell className="text-right font-semibold text-green-600">
                  {formatCurrency(p.amount)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatCurrency(p.balanceAfter)}
                </TableCell>
              </TableRow>
            ))
          })()}
        </TableBody>
      </Table>
    </CardContent>
  </Card>
)}
```

- [ ] **Step 8.4: Verify**

```bash
npm run type-check && npm run lint
```

Expected: PASS.

- [ ] **Step 8.5: Commit**

```bash
git add src/app/dashboard/keuangan/invoices/[id]/page.tsx
git commit -m "feat(invoices): prominent remaining-balance banner + running balance in payment history"
```

---

## Task 9: Build `RecordPaymentModal` (RHF + zod)

Replace the hand-rolled inline dialog with a self-contained modal that owns its own form state via `react-hook-form` + `zod`. Validation lives in the schema (amount > 0, amount ≤ remaining), and the modal calls `useRecordPayment` from `src/hooks/use-invoice-mutation.ts` (Phase 0).

**Files:**
- Create: `src/components/invoices/record-payment-modal.tsx`

### Steps

- [ ] **Step 9.1: Create the modal**

Create `src/components/invoices/record-payment-modal.tsx`:

```tsx
'use client'

import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useRecordPayment } from '@/hooks/use-invoice-mutation'
import { formatCurrency } from '@/lib/format'
import type { Invoice } from '@/lib/actions/invoices'

interface RecordPaymentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: Pick<
    Invoice,
    'invoice_id' | 'invoice_number' | 'total_amount' | 'paid_amount'
  >
  onSuccess?: () => void
}

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'TRANSFER', label: 'Transfer' },
  { value: 'CHECK', label: 'Check' },
  { value: 'CREDIT_CARD', label: 'Credit Card' },
  { value: 'DEBIT_CARD', label: 'Debit Card' },
  { value: 'QRIS', label: 'QRIS' },
  { value: 'OTHER', label: 'Other' },
] as const

export function RecordPaymentModal({
  open,
  onOpenChange,
  invoice,
  onSuccess,
}: RecordPaymentModalProps) {
  const remaining = useMemo(
    () => Math.max(0, invoice.total_amount - invoice.paid_amount),
    [invoice.total_amount, invoice.paid_amount]
  )

  // Build schema each render so the `<= remaining` constraint reflects current state.
  const schema = useMemo(
    () =>
      z.object({
        amount: z
          .number({ invalid_type_error: 'Jumlah wajib diisi' })
          .positive('Jumlah harus lebih dari 0')
          .max(remaining, `Jumlah tidak boleh melebihi sisa tagihan ${formatCurrency(remaining)}`),
        payment_method: z.enum([
          'CASH',
          'TRANSFER',
          'CHECK',
          'CREDIT_CARD',
          'DEBIT_CARD',
          'QRIS',
          'OTHER',
        ]),
        payment_date: z.string().min(1, 'Tanggal wajib diisi'),
        reference_number: z.string().optional(),
        notes: z.string().optional(),
      }),
    [remaining]
  )

  type FormValues = z.infer<typeof schema>

  const mutation = useRecordPayment()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: remaining,
      payment_method: 'TRANSFER',
      payment_date: new Date().toISOString().split('T')[0],
      reference_number: '',
      notes: '',
    },
  })

  // Re-pre-fill on open because remaining can change between opens.
  useEffect(() => {
    if (open) {
      form.reset({
        amount: remaining,
        payment_method: 'TRANSFER',
        payment_date: new Date().toISOString().split('T')[0],
        reference_number: '',
        notes: '',
      })
    }
  }, [open, remaining, form])

  async function onSubmit(values: FormValues) {
    await mutation.mutateAsync({
      invoiceId: invoice.invoice_id,
      payment: {
        amount: values.amount,
        payment_method: values.payment_method,
        payment_date: values.payment_date,
        reference_number: values.reference_number || undefined,
        notes: values.notes || undefined,
      },
    })
    onOpenChange(false)
    onSuccess?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Catat Pembayaran</DialogTitle>
          <DialogDescription>
            Mencatat pembayaran untuk invoice {invoice.invoice_number}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Invoice</span>
            <span className="font-semibold">{formatCurrency(invoice.total_amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Sudah Dibayar</span>
            <span className="font-semibold text-green-700">
              {formatCurrency(invoice.paid_amount)}
            </span>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between">
            <span className="font-semibold">Sisa Tagihan</span>
            <span className="font-bold text-amber-700">{formatCurrency(remaining)}</span>
          </div>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">
              Jumlah Pembayaran <span className="text-destructive">*</span>
            </Label>
            <Input
              id="amount"
              type="number"
              min="0"
              step="0.01"
              {...form.register('amount', { valueAsNumber: true })}
              placeholder="0"
            />
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => form.setValue('amount', remaining, { shouldValidate: true })}
              >
                Bayar penuh ({formatCurrency(remaining)})
              </button>
              {form.formState.errors.amount && (
                <p className="text-destructive">
                  {form.formState.errors.amount.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="payment_method">
                Metode <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.watch('payment_method')}
                onValueChange={(v) =>
                  form.setValue('payment_method', v as FormValues['payment_method'], {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger id="payment_method">
                  <SelectValue placeholder="Pilih metode" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_date">
                Tanggal <span className="text-destructive">*</span>
              </Label>
              <Input
                id="payment_date"
                type="date"
                {...form.register('payment_date')}
              />
              {form.formState.errors.payment_date && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.payment_date.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference_number">Nomor Referensi</Label>
            <Input
              id="reference_number"
              {...form.register('reference_number')}
              placeholder="Misal: nomor transfer, nomor cek"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Catatan</Label>
            <Textarea
              id="notes"
              {...form.register('notes')}
              placeholder="Catatan opsional"
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Catat Pembayaran
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 9.2: Wire it into the invoice detail page**

Add the import:

```tsx
import { RecordPaymentModal } from '@/components/invoices/record-payment-modal'
```

Replace the existing Payment Dialog (the entire `<Dialog open={isPaymentDialogOpen}>` block at the bottom) with:

```tsx
<RecordPaymentModal
  open={isPaymentDialogOpen}
  onOpenChange={setIsPaymentDialogOpen}
  invoice={invoice}
  onSuccess={loadInvoice}
/>
```

(See Task 8 Step 8.2 for the full state cleanup that this enables.)

- [ ] **Step 9.3: Verify**

```bash
npm run type-check && npm run lint
```

Expected: PASS.

- [ ] **Step 9.4: Manual smoke**

1. Open a PARTIAL_PAID invoice. Sidebar shows correct remaining. Top banner (Task 8) shows remaining prominently.
2. Click "Record Payment". Modal opens with:
   - Invoice info card showing total / paid / remaining
   - Amount field pre-filled with remaining
   - Method = TRANSFER, Date = today
3. Try to submit with amount = 0 — error "Jumlah harus lebih dari 0".
4. Try amount = remaining + 100 — error "Jumlah tidak boleh melebihi sisa tagihan ...".
5. Click "Bayar penuh" link — amount snaps to remaining.
6. Submit. Success toast. Invoice reloads. Status → PAID. Banner disappears.
7. Open a fully paid invoice. "Record Payment" button no longer renders (existing condition `payment_status !== 'PAID'`).

- [ ] **Step 9.5: Commit**

```bash
git add src/components/invoices/record-payment-modal.tsx src/app/dashboard/keuangan/invoices/[id]/page.tsx
git commit -m "feat(invoices): add RecordPaymentModal with RHF + zod and amount-bound validation"
```

---

## Task 10: Final verification

**Files:**
- None (commands only)

### Steps

- [ ] **Step 10.1: Run type-check across the whole project**

```bash
npm run type-check
```

Expected: PASS with zero errors. Address any type errors before committing.

- [ ] **Step 10.2: Run lint**

```bash
npm run lint
```

Expected: PASS. Auto-fix where possible:

```bash
npm run lint:fix
```

- [ ] **Step 10.3: Run build (catches compile errors that type-check misses, e.g. server/client boundary issues)**

```bash
npm run build
```

Expected: build completes. If it fails on the new `from-order/[orderId]/page.tsx` due to the action being called at the top level, double-check it is marked as a Server Component (no `'use client'` directive at top).

- [ ] **Step 10.4: Manual end-to-end smoke**

Walk the full happy path:

1. As ADMIN: open an order in `COMPLETED` state with a service report.
2. Open the slide-over panel. Click the **Report** tab.
3. Verify all sections render: pricing card, photos before/after grid, materials table, signature image, notes, timeline.
4. Click on a photo — fullscreen Dialog opens.
5. Close the photo. Switch to the **Detail** tab. Footer shows "Buat Invoice".
6. Click "Buat Invoice" → redirected to `/dashboard/keuangan/invoices/<id>?prefilled=service-report`.
7. Blue "Pre-filled" banner is visible. Line items match base services + materials.
8. Click "Send to Email" → sets invoice to SENT.
9. Click "Record Payment". Modal opens. Pay 50% of total. Submit.
10. Status → PARTIAL_PAID. Amber sidebar banner shows remaining. Payment history shows the payment with "Sisa Setelah" column.
11. Click "Record Payment" again. Pre-filled with remaining. Submit. Status → PAID. Order status (in board) → PAID.

- [ ] **Step 10.5: Verify negative paths**

1. Order in `IN_PROGRESS` (no report yet) → Report tab shows empty state.
2. Try POST `/api/service-reports?orderId=X` while logged out → 401.
3. Open invoice `from-order/[orderId]` for an order without a report → amber error page with manual-create fallback.
4. Try to drag a PAID order on the board → terminal column, drag should be blocked (Phase 1 invariant).

- [ ] **Step 10.6: No commit needed for verification.**

---

## Self-Review

### Type / function consistency table

| Symbol | Source of truth | Consumers (Phase 3) | Notes |
|--------|-----------------|---------------------|-------|
| `ServiceReport` | `src/lib/service-report.ts` | OrderReportTab fetcher, createInvoiceFromOrder | Mirrors `service_reports` table; soft-delete excluded |
| `ServiceReportMaterial` | `src/lib/service-report.ts` | ReportMaterialsTable, createInvoiceFromOrder | Schema matches the JSONB column documented in spec section 4.2 |
| `getServiceReport(orderId)` | `src/lib/service-report.ts` | `GET /api/service-reports?orderId=` route handler, server-side `createInvoiceFromOrder` | Returns latest non-deleted report or `null` |
| `getSignedSignatureUrl(reportId)` | `src/lib/service-report.ts` | `GET /api/service-reports/[reportId]/signature` route handler | 1-hour signed URL by default; null on storage error |
| `createInvoiceFromOrder(orderId)` | `src/lib/actions/invoices.ts` | `from-order/[orderId]/page.tsx` | Throws `ServiceReportMissingError` for fall-back UX |
| `ServiceReportMissingError` | `src/lib/actions/invoices.ts` | `from-order/[orderId]/page.tsx` | Lets the page distinguish missing-report from other errors |
| `formatCurrency` | `src/lib/format.ts` | ReportMaterialsTable, RecordPaymentModal, OrderReportTab | New shared helper; legacy inline copies in `pdf-export.ts` and invoice detail page can migrate later |
| `formatDateTime` | `src/lib/format.ts` | OrderReportTab, ReportSignatureCard | Indonesian locale, falls back to `—` |
| `RecordPaymentModal` | `src/components/invoices/record-payment-modal.tsx` | Invoice detail page | Owns its own RHF + zod; calls `useRecordPayment` |
| `useRecordPayment` | `src/hooks/use-invoice-mutation.ts` (Phase 0) | RecordPaymentModal | Optimistic + invalidates `invoices`, `invoice/<id>`, `orders` |
| `AssignModal` (`currentTechnicianId`) | `src/components/orders/assign-modal.tsx` | OrderDetailPanel reassign flow | Optional; absent = initial-assign behavior unchanged |

### Spec coverage check

| Spec requirement (section 9 Phase 3) | Task | Status |
|--------------------------------------|------|--------|
| "Create Invoice from Order" auto-populate from `service_reports` | Tasks 4 + 5 | Covered: `createInvoiceFromOrder` action + `from-order/[id]` route |
| Line items: service + materials, actual price | Task 4 | Covered: base service rows from `getOrderItemsForInvoice`, ADDON rows from report materials, totals computed by existing `createInvoice` math |
| Optional: include foto sebagai attachment di PDF | — | **Out of scope for Phase 3.** Defer to Phase 4 polish (PDF improvements). The OrderReportTab now displays photos in-app, which already covers the admin review use case |
| Order Detail Panel — Technician Report tab (read-only view) | Tasks 1-3 | Covered: photo gallery, materials, signature card, notes, timestamps |
| Reschedule UI dari Order Board (modal dengan reason) | Task 7 | Covered: verification + UX polish (toasts) — bulk of work was already in Phase 1 |
| Reassign UI (action button on detail panel) | Task 6 | Covered: pre-select current technician, "Reassign" title + button label |
| Partial payment UI improvements | Task 8 | Covered: prominent remaining banner, running balance in history |
| Invoice PDF: improve layout, currency formatting | — | **Deferred to Phase 4.** Phase 3 introduces shared `formatCurrency` which the PDF export will adopt later |

### Risk register specific to Phase 3

| Risk | Mitigation |
|------|------------|
| Signed signature URL expires while admin is mid-review | TanStack Query `staleTime` of 50 minutes (under 1h TTL); refetch when expired |
| `next/image` rejects Supabase Storage URLs not whitelisted in `next.config.js` | Use `unoptimized` prop on report photos and signatures; revisit in Phase 4 polish |
| `createInvoiceFromOrder` math drifts from `createInvoice` | Phase 3 reuses `createInvoice` directly; no parallel math path |
| Admin edits the auto-populated invoice and expects materials to flow back to report | **Out of scope.** Invoice is the financial document; report is the operational one. Editing the invoice does not modify the report — surface this in the blue "Pre-filled" banner copy ("dapat mengedit item") |
| Partial payment modal uses stale remaining after a quick second click | Modal `useEffect` resets defaults on each open using current `invoice.paid_amount`; mutation invalidates queries so parent reloads |
| Reassign keeps helpers but admin expected to clear them | The modal title clarifies "Helper akan dipertahankan jika tidak diubah"; the helper multi-select still appears with current helpers selected so admin can deselect |

### Out of scope (deliberately deferred)

- PDF photo embedding (Phase 4)
- Migrating `formatCurrency` callsites in `pdf-export.ts` and the existing invoice detail page (opportunistic, not blocking)
- Realtime subscription for service report INSERTs into the Report tab (TanStack Query refetch on demand is sufficient for v1; Phase 4 may add `subscribeServiceReports`)
- Editing service reports after submission (auto-approve = customer signature is the approval gate, per spec section 11)
- Soft delete UI for service reports (administrative concern, not customer-facing)

### Definition of Done

- [ ] All 10 tasks complete with their commits.
- [ ] `npm run type-check` PASS.
- [ ] `npm run lint` PASS.
- [ ] `npm run build` PASS.
- [ ] Happy-path manual smoke from Task 10 Step 10.4 walks end-to-end without error.
- [ ] Negative paths from Task 10 Step 10.5 behave as specified.
- [ ] No regressions in Phase 1 board drag-drop or Phase 2 technician submit-report flow (spot-check both).

`src/components/orders/report-photo-gallery.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Camera, ImageOff } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface ReportPhotoGalleryProps {
  title: string
  photos: string[]
  className?: string
}

export function ReportPhotoGallery({ title, photos, className }: ReportPhotoGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const isOpen = activeIndex !== null
  const activePhoto = activeIndex !== null ? photos[activeIndex] : null

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Camera className="h-4 w-4 text-muted-foreground" />
        {title}
        <span className="text-xs font-normal text-muted-foreground">
          ({photos.length})
        </span>
      </div>

      {photos.length === 0 ? (
        <div className="flex h-24 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
          <ImageOff className="mr-2 h-4 w-4" />
          Tidak ada foto
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((url, idx) => (
            <button
              key={url + idx}
              type="button"
              onClick={() => setActiveIndex(idx)}
              className="relative aspect-square overflow-hidden rounded-md border bg-muted transition hover:brightness-95"
              aria-label={`${title} ${idx + 1}`}
            >
              <Image
                src={url}
                alt={`${title} ${idx + 1}`}
                fill
                sizes="(max-width: 640px) 33vw, 200px"
                className="object-cover"
                unoptimized
              />
            </button>
          ))}
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={(open) => !open && setActiveIndex(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {title} {activeIndex !== null && `— ${activeIndex + 1}/${photos.length}`}
            </DialogTitle>
          </DialogHeader>
          {activePhoto && (
            <div className="relative h-[70vh] w-full overflow-hidden rounded-md bg-black">
              <Image
                src={activePhoto}
                alt={title}
                fill
                sizes="100vw"
                className="object-contain"
                unoptimized
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

> **Note on `next/image` + Supabase Storage:** `unoptimized` is used to skip the Next.js image optimizer; signed URLs from Supabase Storage are short-lived and the public bucket URLs do not benefit much from optimization. If `next.config.js` already whitelists the Supabase domain, the `unoptimized` flag may be removed in Phase 4 polish.

- [ ] **Step 2.2: Create materials table**

`src/components/orders/report-materials-table.tsx`:

```tsx
'use client'

import { Package } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency } from '@/lib/format'
import type { ServiceReportMaterial } from '@/lib/service-report'

interface ReportMaterialsTableProps {
  materials: ServiceReportMaterial[]
}

export function ReportMaterialsTable({ materials }: ReportMaterialsTableProps) {
  const total = materials.reduce((sum, m) => sum + (m.total ?? m.qty * m.unit_price), 0)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Package className="h-4 w-4 text-muted-foreground" />
        Material yang dipakai
        <span className="text-xs font-normal text-muted-foreground">
          ({materials.length})
        </span>
      </div>

      {materials.length === 0 ? (
        <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          Tidak ada material tambahan.
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead className="w-16 text-right">Qty</TableHead>
                <TableHead className="w-32 text-right">Harga</TableHead>
                <TableHead className="w-32 text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materials.map((material, idx) => (
                <TableRow key={(material.addon_id ?? material.name) + idx}>
                  <TableCell className="font-medium">{material.name}</TableCell>
                  <TableCell className="text-right">{material.qty}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(material.unit_price)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(material.total ?? material.qty * material.unit_price)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={3} className="text-right font-semibold">
                  Total Material
                </TableCell>
                <TableCell className="text-right font-bold">
                  {formatCurrency(total)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
```

