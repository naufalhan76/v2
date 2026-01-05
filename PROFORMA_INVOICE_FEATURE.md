# Proforma Invoice Feature

## Overview

Feature untuk membuat **Proforma Invoice** (invoice awal/perkiraan) dan **Final Invoice** (invoice resmi) berdasarkan status order.

---

## Database Changes

### Migration: `008_add_invoice_type.sql`

**Schema Change:**
```sql
ALTER TABLE invoices
ADD COLUMN invoice_type TEXT DEFAULT 'FINAL' 
CHECK (invoice_type IN ('PROFORMA', 'FINAL'));
```

**Indexes Added:**
- `idx_invoices_invoice_type` - Fast filtering by type
- `idx_invoices_type_status` - Combined queries (type + status)

**Rollback:** `008_rollback_add_invoice_type.sql`

---

## Business Logic

### Invoice Type Determination

| Order Status | Invoice Type | Use Case |
|--------------|-------------|----------|
| `ASSIGNED`, `OTW`, `ARRIVED`, `IN_PROGRESS` | `PROFORMA` | Generate perkiraan biaya untuk customer kapan saja selama pekerjaan ongoing |
| `DONE` | `FINAL` | Generate invoice resmi setelah pekerjaan selesai |

**Implementation: Option C - Maximum Flexibility**
- Invoice dapat dibuat kapan saja setelah order di-assign
- Tidak terbatas pada status ASSIGNED saja
- Mendukung flow bisnis yang dinamis

### Workflow

```
1. Order ASSIGNED/OTW/ARRIVED/IN_PROGRESS
   └─> Create Invoice → PROFORMA
       ├─ Status: DRAFT
       ├─ Can be edited (items, amount, discount)
       ├─ Can be sent to customer
       ├─ Can be DELETED if still DRAFT
       └─ Payment tracking active

2. Order DONE
   └─> Create Invoice → FINAL
       ├─ Status: DRAFT
       ├─ Can be edited before SENT
       ├─ Can be DELETED if still DRAFT
       ├─ Lock delete after SENT (use CANCEL instead)
       └─ Standard invoice flow
```

### Delete vs Cancel Rules

**DELETE (Allowed):**
- ✅ Status: `DRAFT` only
- ✅ No payment records
- ✅ No communication logs (not sent yet)
- ✅ Use case: Fix mistakes before sending

**CANCEL (Use Instead):**
- ❌ Status: `SENT`, `PAID`, `OVERDUE`
- ❌ Has payment records
- ❌ Already communicated to customer
- ✅ Keeps audit trail
- ✅ Customer can see invoice was cancelled

**Protection Logic:**
```typescript
if (status !== 'DRAFT') {
  throw Error('Gunakan CANCEL untuk invoice yang sudah dikirim')
}
if (has_payments) {
  throw Error('Invoice tidak dapat dihapus karena sudah ada pembayaran')
}
if (has_communications) {
  throw Error('Invoice sudah dikirim, gunakan CANCEL')
}
```

### Status Flow (Both Types)

```
DRAFT → SENT → PAID
  │       │      
  │       └──> OVERDUE (if due date passed)
  │
  └──> CANCELLED
```

### Payment Tracking

**Same for both PROFORMA and FINAL:**
- Track via `payment_records` table
- Auto-update `paid_amount` and `payment_status`
- Payment Status: `UNPAID` → `PARTIAL` → `PAID`

---

## Code Changes

### 1. TypeScript Interfaces

**File:** `src/lib/actions/invoices.ts`

```typescript
export interface Invoice {
  // ... existing fields
  invoice_type: 'PROFORMA' | 'FINAL'  // NEW
  // ... rest of fields
}

export interface CreateInvoiceInput {
  // ... existing fields
  invoice_type: 'PROFORMA' | 'FINAL'  // NEW (required)
  // ... rest of fields
}
```

### 2. Create Invoice Function

**File:** `src/lib/actions/invoices.ts`

```typescript
export async function createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
  // ... existing logic
  
  const { data: invoice } = await supabase
    .from('invoices')
    .insert({
      // ... existing fields
      invoice_type: input.invoice_type,  // NEW
      // ... rest of fields
    })
}
```

### 3. Invoice Creation Page

**File:** `src/app/dashboard/keuangan/invoices/create/page.tsx`

**Changes:**
- Load orders with status `ASSIGNED`, `OTW`, `ARRIVED`, `IN_PROGRESS`, **and** `DONE` (Option C)
- Auto-determine `invoice_type` based on order status
- Show badge indicator for invoice type
- Update success message to show invoice type

```typescript
const loadCompletedOrders = async () => {
  // Maximum flexibility - load all ongoing and done orders
  const [assignedResult, otwResult, arrivedResult, inProgressResult, doneResult] = await Promise.all([
    getOrders({ status: 'ASSIGNED', limit: 100 }),
    getOrders({ status: 'OTW', limit: 100 }),
    getOrders({ status: 'ARRIVED', limit: 100 }),
    getOrders({ status: 'IN_PROGRESS', limit: 100 }),
    getOrders({ status: 'DONE', limit: 100 })
  ])
  const combinedOrders = [...(assignedResult.data || []), ...(otwResult.data || []), ...]
  setOrders(combinedOrders)
}

// Determine invoice type
const invoiceType = selectedOrder.status === 'DONE' ? 'FINAL' : 'PROFORMA'

await createInvoice({
  // ... other fields
  invoice_type: invoiceType,
})
```

### 4. Invoice List Page

**File:** `src/app/dashboard/keuangan/invoices/page.tsx`

**Changes:**
- Add "Type" column to table
- Show badge with invoice type (PROFORMA = secondary, FINAL = default)

```tsx
<TableHead>Type</TableHead>
// ...
<TableCell>
  <Badge variant={invoice.invoice_type === 'FINAL' ? 'default' : 'secondary'}>
    {invoice.invoice_type}
  </Badge>
</TableCell>
```

### 5. Invoice Detail Page

**File:** `src/app/dashboard/keuangan/invoices/[id]/page.tsx`

**Changes:**
- Show invoice type badge in header
- Update page subtitle based on type

```tsx
<div className="flex items-center gap-3">
  <h1>{invoice.invoice_number}</h1>
  <Badge variant={invoice.invoice_type === 'FINAL' ? 'default' : 'secondary'}>
    {invoice.invoice_type}
  </Badge>
</div>
<p className="text-muted-foreground">
  {invoice.invoice_type === 'PROFORMA' ? 'Invoice Proforma' : 'Invoice Final'}
</p>
```

---

## Usage Guide

### Creating Proforma Invoice

1. Navigate to **Keuangan → Invoices → Buat Invoice**
2. Select order with status **ASSIGNED, OTW, ARRIVED, or IN_PROGRESS**
3. System automatically sets `invoice_type = PROFORMA`
4. Add services and add-ons
5. Set discount and notes
6. Create invoice
7. Invoice status: **DRAFT** (can be deleted if mistake)
8. Review invoice, then send to customer via Email or WhatsApp

### Creating Final Invoice

1. Navigate to **Keuangan → Invoices → Buat Invoice**
2. Select order with status **DONE**
3. System automatically sets `invoice_type = FINAL`
4. Add services and add-ons
5. Set discount and notes
6. Create invoice
7. Invoice status: **DRAFT** (can be deleted if mistake)
8. Send to customer

### Deleting Invoice (DRAFT Only)

**When you CAN delete:**
- Invoice is still **DRAFT** status
- No payments recorded
- Not sent to customer yet

**Steps:**
1. Open invoice detail page
2. Click **"Hapus"** button (red button, only visible for DRAFT)
3. Confirm deletion
4. Invoice permanently removed

**When you CANNOT delete:**
- Invoice status is **SENT, PAID, or OVERDUE**
- Has payment records
- Already sent via Email/WhatsApp

**Alternative: Use CANCEL instead**
1. Open invoice detail page
2. Click **"Cancel Invoice"** button (orange button)
3. Invoice status changes to **CANCELLED**
4. Audit trail preserved
5. Create new invoice if needed

### Handling Mistakes

**Scenario 1: Mistake in DRAFT invoice**
```
1. Delete invoice (allowed)
2. Create new invoice with correct data
```

**Scenario 2: Mistake after sending**
```
1. Cannot delete (already SENT)
2. Cancel invoice → Status: CANCELLED
3. Create new invoice
4. Send new invoice to customer
```

**Scenario 3: Customer already paid**
```
1. Cannot delete or cancel
2. Record remaining payment or
3. Issue credit note/adjustment
```

---

## Testing Checklist

- [ ] Migration runs successfully
- [ ] Rollback works correctly
- [ ] Can create PROFORMA invoice from ASSIGNED order
- [ ] Can create PROFORMA invoice from OTW/ARRIVED/IN_PROGRESS orders
- [ ] Can create FINAL invoice from DONE order
- [ ] Invoice type shows correctly in list page
- [ ] Invoice type shows correctly in detail page
- [ ] **Can DELETE invoice when status = DRAFT**
- [ ] **Cannot DELETE invoice when status = SENT** (shows error message)
- [ ] **Cannot DELETE invoice with payments** (shows error message)
- [ ] **Cannot DELETE invoice already sent** (shows error message)
- [ ] **CANCEL button appears for non-DRAFT invoices**
- [ ] **CANCEL changes status to CANCELLED**
- [ ] Payment recording works for both types
- [ ] PDF export includes invoice type
- [ ] Email sending works for both types
- [ ] WhatsApp message generation works for both types

---

## Future Enhancements

**Possible additions:**
1. **Convert PROFORMA to FINAL**
   - Add button to convert when order status changes to DONE
   - Keep invoice_id, update invoice_type only

2. **Edit Restrictions**
   - Lock item editing for SENT invoices
   - Allow editing for DRAFT invoices only

3. **Different Invoice Number Prefix**
   - PROFORMA: `PRO/YYYY/MM/XXXX`
   - FINAL: `INV/YYYY/MM/XXXX`

4. **Reporting**
   - Separate stats for PROFORMA vs FINAL
   - Conversion rate tracking

---

## Notes

- All existing invoices defaulted to `FINAL` type during migration
- Payment tracking is identical for both types (no special handling)
- Invoice status flow remains the same regardless of type
- No breaking changes to existing functionality
