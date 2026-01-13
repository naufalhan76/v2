# Invoice Multi-Feature Update

## Feature 1: Prevent Duplicate Invoice per Order ✅

### Implementation:
1. **Create Invoice Page** - Filter orders yang belum punya invoice
   - File: `src/app/dashboard/keuangan/invoices/create/page.tsx`
   - Fungsi `checkOrderHasInvoice()` untuk cek apakah order sudah punya invoice
   - Filter orders di `loadCompletedOrders()` untuk hanya tampilkan order tanpa invoice

2. **API Endpoint** - Check invoice by order ID
   - File: `src/app/api/invoices/route.ts`
   - GET `/api/invoices?orderId={id}` - Return invoices untuk specific order
   - Return empty array jika order belum punya invoice

### Usage:
- Saat user buka create invoice page, hanya orders tanpa invoice yang ditampilkan
- Setelah invoice dibuat untuk suatu order, order tersebut tidak muncul lagi di list

### Validation:
- Frontend: Filter otomatis di list
- Backend: Bisa tambah unique constraint di database jika mau extra protection

---

## Feature 2: Multiple Payment Accounts (Per-Invoice Selection) ✅

### Implementation:

1. **Bank Accounts Component**
   - File: `src/app/dashboard/konfigurasi/invoice-config/bank-accounts-section.tsx`
   - Support CRUD operations untuk multiple bank accounts
   - Auto-generate label: "Payment Account 1", "Payment Account 2", dst
   - Custom label (opsional): User bisa kasih nama sendiri
   - Interface: `BankAccount` dengan fields:
     - `id`: Unique identifier
     - `account_label`: Display name (e.g., "Payment Account 1", "Bank BCA", dll)
     - `bank`: Bank name (e.g., "Bank Mandiri", "Bank BCA")
     - `account_number`: Nomor rekening
     - `account_name`: Nama pemilik rekening

2. **Invoice Config Page**
   - File: `src/app/dashboard/konfigurasi/invoice-config/page.tsx`
   - Menggunakan `BankAccountsSection` component
   - State management untuk array of bank accounts
   - Save multiple accounts ke database as JSON array

3. **Invoice Create Page**
   - File: `src/app/dashboard/keuangan/invoices/create/page.tsx`
   - Added dropdown "Payment Account" di Step 4 (Review)
   - Load available payment accounts dari invoice config
   - Dropdown shows: **account_label** + bank details
   - User MUST select one payment account before creating invoice

4. **Invoice Actions**
   - File: `src/lib/actions/invoices.ts`
   - Updated `CreateInvoiceInput` interface to include payment account fields
   - Save selected payment account info to invoice record

5. **Database Migration**
   - File: `migrations/009_add_payment_account_to_invoices.sql`
   - Added columns to `invoices` table:
     - `payment_account_id`: Reference ID
     - `payment_account_label`: Display label
     - `payment_bank_name`: Bank name
     - `payment_account_number`: Account number
     - `payment_account_name`: Account holder name

### How It Works:

#### Step 1: Config Payment Accounts
1. Admin masuk ke `/dashboard/konfigurasi/invoice-config`
2. Di section "Rekening Bank", bisa add multiple accounts:
   - Label (auto: "Payment Account 1" atau custom)
   - Bank name
   - Account number
   - Account holder name
3. Bisa edit dan delete accounts kapan saja

#### Step 2: Create Invoice with Selected Account
1. Admin buka `/dashboard/keuangan/invoices/create`
2. Pilih order (Step 1)
3. Confirm services (Step 2 & 3)
4. **Di Step 4 (Review)**, pilih payment account dari dropdown:
   ```
   Payment Account 1
   Bank Mandiri - 1234567890
   ```
5. Selected account akan disimpan di invoice record

#### Step 3: Invoice Display
- Saat invoice ditampilkan/di-export PDF, cuma show payment account yang dipilih
- Customer cuma lihat 1 payment account untuk bayar
- Admin punya flexibility pilih account mana untuk tiap invoice

### Database Structure:
```json
// invoice_configuration.bank_accounts (JSON array)
[
  {
    "id": "1704067200000",
    "account_label": "Payment Account 1",
    "bank": "Bank Mandiri",
    "account_number": "1234567890",
    "account_name": "PT. AC Service Indonesia"
  },
  {
    "id": "1704153600000",
    "account_label": "Bank BCA Utama",
    "bank": "Bank BCA",
    "account_number": "9876543210",
    "account_name": "PT. AC Service Indonesia"
  }
]
```

### Use Cases:
- **Customer A** → Invoice dengan Payment Account 1 (Bank Mandiri)
- **Customer B** → Invoice dengan Payment Account 2 (Bank BCA)
- **Proforma** → Pakai Payment Account 1
- **Final Invoice** → Pakai Payment Account 2

---

## Next Steps (Optional Enhancements):

### For Invoice Duplication Check:
1. Add database constraint (optional but recommended):
```sql
ALTER TABLE invoices ADD CONSTRAINT unique_order_invoice UNIQUE (order_id);
```

2. Add validation di backend `createInvoice()` function:
```typescript
// Check if order already has invoice
const { data: existingInvoice } = await supabase
  .from('invoices')
  .select('invoice_id')
  .eq('order_id', input.order_id)
  .single()

if (existingInvoice) {
  throw new Error('Order sudah memiliki invoice')
}
```

### For Payment Accounts:
1. ✅ **DONE**: Database migration to add payment account columns
2. TODO: Update PDF export (`src/lib/pdf-export.ts`) to display selected payment account
3. TODO: Update invoice detail page to show payment account info
4. TODO: Add QR code generation for each payment account (optional)

---

## Testing Checklist:

### Feature 1 - Invoice Duplication:
- [ ] Run migration `009_add_payment_account_to_invoices.sql` di Supabase
- [ ] Open create invoice page - verify only orders without invoice shown
- [ ] Create invoice for an order
- [ ] Refresh page - verify that order no longer appears in list
- [ ] Try to create duplicate invoice via API (should fail if backend validation added)

### Feature 2 - Multiple Payment Accounts:
- [ ] Run migration `009_add_payment_account_to_invoices.sql` di Supabase
- [ ] Open invoice config page (`/dashboard/konfigurasi/invoice-config`)
- [ ] Add first payment account (auto-label: "Payment Account 1")
- [ ] Add second payment account with custom label
- [ ] Edit payment account information
- [ ] Delete payment account
- [ ] Save config and verify data persisted
- [ ] Refresh page and verify accounts loaded correctly
- [ ] Open create invoice page
- [ ] Verify dropdown shows all payment accounts
- [ ] Create invoice with selected payment account
- [ ] Verify invoice record has payment account info
- [ ] Check invoice display/PDF shows correct payment account

---

## Migration Steps:

1. **Login to Supabase Dashboard**
2. **Go to SQL Editor**
3. **Run Migration Script**:
   ```sql
   -- Copy content from migrations/009_add_payment_account_to_invoices.sql
   ```
4. **Verify columns added**:
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'invoices' 
   AND column_name LIKE 'payment_%';
   ```

---

## Summary:

✅ **Feature 1**: One invoice per order - Implemented with auto-filtering
✅ **Feature 2**: Multiple payment accounts - Flexible per-invoice selection

**Key Points:**
- Admin bisa manage multiple payment accounts di config
- Setiap invoice HARUS pilih satu payment account
- Payment account info disimpan di invoice record
- Customer cuma lihat 1 payment account yang dipilih
- Flexibility untuk assign different accounts untuk different customers/invoices
