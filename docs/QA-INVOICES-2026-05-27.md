# QA Report: Invoice + Payment Functions
## MSN ERP V2 — 2026-05-27

**Auditor:** OpenCode static + DB analysis
**Scope:** src/lib/actions/invoices.ts, invoice-config.ts, invoice-communications.ts, invoice-status.ts, invoice-utils.ts, invoice-errors.ts, service-report.ts, hooks/use-invoice-mutation.ts, lib/pdf-export.ts
**DB:** postgresql://...supabase.com/postgres (empty dataset — no live invoices)

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 4 |
| HIGH | 6 |
| MEDIUM | 7 |
| LOW | 5 |
| INFO | 3 |
| **Total** | **25** |

---

## CRITICAL

### [CRITICAL] recordPayment — no guard against zero or negative amount
File: src/lib/actions/invoices.ts:1363
Test scenario: Call recordPayment with amount=0 or amount=-500
Expected: Reject with validation error before inserting payment record
Actual: No amount validation in recordPayment(). Zero/negative amounts are accepted, inserted into payment_records, and used to update paid_amount. DB has no CHECK constraint on payment_records.amount either.
Fix: Add `if (payment.amount <= 0) throw new Error('Jumlah pembayaran harus lebih dari 0')` before the insert. Add DB-level CHECK: `ALTER TABLE payment_records ADD CONSTRAINT chk_payment_amount_positive CHECK (amount > 0);`

### [CRITICAL] recordPayment — overpayment not blocked
File: src/lib/actions/invoices.ts:1393
Test scenario: Invoice total_amount=100000. Record payment of 200000.
Expected: Reject or cap at remaining balance
Actual: newPaidAmount = paid_amount + payment.amount is computed and written unconditionally. An overpayment sets paid_amount > total_amount, payment_status='PAID', and syncs order to PAID — with no warning or cap.
Fix: Add guard: `if (payment.amount > (invoice.total_amount - invoice.paid_amount)) throw new Error('Jumlah pembayaran melebihi sisa tagihan')`

### [CRITICAL] generate_invoice_number RPC missing from DB
File: src/lib/actions/invoices.ts:470
Test scenario: Any action that calls generateInvoiceNumber() (createInvoice, createBlankInvoice, createProformaInvoice, createInvoiceFromOrder)
Expected: RPC generate_invoice_number exists and returns a unique invoice number
Actual: SELECT proname FROM pg_proc WHERE proname = 'generate_invoice_number' returns 0 rows. The RPC does not exist in the DB. The fallback (random 4-digit suffix) is non-sequential, non-unique under concurrent load, and does not use the configured invoice_prefix from invoice_configuration.
Fix: Create the RPC in a migration. Example: use a sequence-backed function that reads invoice_prefix from invoice_configuration and formats INV/YYYY/MM/NNNN.

### [CRITICAL] createInvoice — order status check uses 'DONE' but canonical state is 'COMPLETED'
File: src/lib/actions/invoices.ts:754
Test scenario: Order in status 'COMPLETED' (canonical post-technician-submit state)
Expected: createInvoice() accepts COMPLETED orders
Actual: Line 754 checks `if (order.status !== 'DONE')` — only 'DONE' is accepted. createInvoiceFromOrder() correctly accepts both COMPLETED and DONE (line 1794), but the lower-level createInvoice() used by the UI form rejects COMPLETED orders with "Order belum memenuhi syarat untuk pembuatan invoice".
Fix: Change line 754 to: `if (!['DONE','COMPLETED'].includes(order.status))`


---

## HIGH

### [HIGH] recordPayment — invoice status regression when paying a DRAFT invoice
File: src/lib/actions/invoices.ts:1396
Test scenario: Record a partial payment against a DRAFT invoice (never sent)
Expected: Status transitions should only apply to SENT/PARTIAL_PAID invoices; DRAFT should be guarded
Actual: newStatus is set to 'SENT' for partial payments and 'PAID' for full payments regardless of current invoice status. A DRAFT invoice that receives a payment is silently promoted to SENT or PAID, bypassing the send step entirely. No check on current invoice status before updating.
Fix: Fetch current invoice status before updating. Only allow payment recording on invoices with status in ['SENT','PARTIAL_PAID']. Throw if status is DRAFT, CANCELLED, or PAID.

### [HIGH] deleteInvoice — hard delete, not soft delete; violates project soft-delete convention
File: src/lib/actions/invoices.ts:1342
Test scenario: Delete a DRAFT invoice
Expected: Per CLAUDE.md "records are never hard-deleted" — soft delete via deleted_at timestamp
Actual: `supabase.from('invoices').delete().eq('invoice_id', invoiceId)` performs a hard DELETE. The invoices table has no deleted_at column. This is inconsistent with the project-wide soft-delete convention and makes audit trails impossible.
Fix: Add deleted_at column to invoices table. Change deleteInvoice() to `.update({ deleted_at: new Date().toISOString() })`. Add `WHERE deleted_at IS NULL` to all read queries.

### [HIGH] updateInvoiceStatus — no state machine enforcement; allows arbitrary status jumps
File: src/lib/actions/invoices.ts:1456
Test scenario: Call updateInvoiceStatus(id, 'PAID') on a DRAFT invoice directly
Expected: Reject invalid transitions (DRAFT cannot jump to PAID without payment records)
Actual: updateInvoiceStatus() accepts any of the 6 status values and writes it unconditionally with no transition validation. A DRAFT invoice can be set to PAID without any payment_records, leaving paid_amount=0 and payment_status='UNPAID' while status='PAID'.
Fix: Implement a transition map (similar to OrderStatusTransitionMap in schemas/index.ts). Validate current→new transition before updating.

### [HIGH] calculateInvoiceTotals — addons_subtotal always equals subtotal (wrong)
File: src/lib/actions/invoices.ts:302
Test scenario: Invoice with both BASE_SERVICE and ADDON items
Expected: addons_subtotal = sum of ADDON items only; subtotal = base + addons
Actual: In calculateInvoiceTotals(), `addons_subtotal` is set to `safeSubtotal` (the full subtotal), not the addons-only portion. This means addons_subtotal always equals subtotal, making the field meaningless and incorrect for any invoice with mixed item types.
Fix: Pass addons subtotal separately into calculateInvoiceTotals() or compute it from items before calling the function. The correct value is `items.filter(i => i.item_type === 'ADDON').reduce((s,i) => s + i.total_price, 0)`.

### [HIGH] reviseInvoice — double auth check; updateInvoice re-authenticates independently
File: src/lib/actions/invoices.ts:1272
Test scenario: Call reviseInvoice() — observe two separate requireFinanceRole() calls
Expected: Single auth check at the top of reviseInvoice()
Actual: reviseInvoice() calls requireFinanceRole() at line 1281, then calls updateInvoice() which calls requireFinanceRole() again at line 1061, then calls reviseInvoiceItems() which calls requireFinanceRole() again at line 1153. Three auth checks per revision. More critically, updateInvoice() and reviseInvoiceItems() each create their own supabase client — meaning the revision is not atomic and a race condition between the two updates is possible.
Fix: Extract a shared internal helper that skips auth (already-authenticated path). Wrap both operations in a single DB transaction via an RPC for true atomicity.

### [HIGH] getInvoices — OVERDUE filter is client-side only; count is wrong
File: src/lib/actions/invoices.ts:580
Test scenario: Filter invoices by status='OVERDUE' with pagination
Expected: total count reflects actual overdue invoices; pagination works correctly
Actual: When status='OVERDUE', the DB query fetches ALL non-PAID/non-CANCELLED invoices (no server-side filter), then filters client-side after the range() call. The returned `total` is the DB count of all invoices (not overdue ones), so pagination metadata is wrong. On page 2+ the client-side filter may return 0 results even though overdue invoices exist on earlier pages.
Fix: Either add a computed column/view for overdue status in the DB, or fetch all matching rows without range() when filtering OVERDUE, then paginate in memory. At minimum, return the correct filtered count.


---

## MEDIUM

### [MEDIUM] createInvoice — no duplicate invoice guard per order
File: src/lib/actions/invoices.ts:700
Test scenario: Call createInvoice() twice for the same order_id with invoice_type='FINAL'
Expected: Second call rejected — order already has a FINAL invoice
Actual: No uniqueness check before insert. Two FINAL invoices can be created for the same order. DB has no unique constraint on (order_id, invoice_type) for non-CANCELLED invoices. The order status sync (DONE->INVOICED) runs twice harmlessly, but two active FINAL invoices exist.
Fix: Before insert, check: `SELECT invoice_id FROM invoices WHERE order_id=$1 AND invoice_type='FINAL' AND status != 'CANCELLED'`. If found, throw duplicate error. Add partial unique index: `CREATE UNIQUE INDEX uq_invoices_order_final ON invoices(order_id) WHERE invoice_type='FINAL' AND status != 'CANCELLED';`

### [MEDIUM] createInvoice — tax calculation does not use calculateTax/calculateDiscount helpers
File: src/lib/actions/invoices.ts:718
Test scenario: Invoice with discount_amount=50000, subtotal=100000, tax_percentage=11
Expected: Tax computed on (subtotal - discount) = 50000 * 11% = 5500
Actual: Line 721: `taxAmount = ((subtotal - discountAmount) * taxPercentage) / 100` — this is correct math but bypasses the shared calculateDiscount() and calculateTax() helpers in src/lib/utils/money.ts that apply rounding (roundToTwo). Floating-point drift is possible for large amounts. Also, discount_percentage is accepted as input but never applied — only discount_amount is used (line 718-719).
Fix: Replace inline math with `calculateDiscount()` and `calculateTax()` from money.ts. Handle discount_percentage the same way calculateInvoiceTotals() does.

### [MEDIUM] createProformaInvoice — tax calculation does not apply discount
File: src/lib/actions/invoices.ts:1668
Test scenario: Proforma invoice with discount applied
Expected: Tax = (subtotal - discount) * tax_percentage / 100
Actual: Line 1668: `taxAmount = (subtotal * taxPercentage) / 100` — discount is not subtracted before computing tax. This inflates tax on discounted proforma invoices. Inconsistent with calculateInvoiceTotals() which correctly uses taxableBase = subtotal - discountAmount.
Fix: Change to: `const taxableBase = Math.max(0, subtotal - discountAmount); const taxAmount = calculateTax(taxableBase, taxPercentage);`

### [MEDIUM] logInvoiceCommunication — status transition race condition
File: src/lib/actions/invoice-communications.ts:51
Test scenario: Two concurrent email sends on a DRAFT invoice
Expected: Status updated to SENT exactly once
Actual: logInvoiceCommunication() fetches invoice status then calls updateInvoiceStatus() in two separate round-trips with no locking. Two concurrent calls both see status='DRAFT' and both call updateInvoiceStatus('SENT'). Not harmful here (idempotent result) but the pattern is fragile. More critically, updateInvoiceStatus() has no transition guard (see HIGH finding above), so a failed send that still logs a communication record will incorrectly promote a DRAFT to SENT.
Fix: Use a single UPDATE with WHERE status='DRAFT' condition to make the transition atomic. Log communication only after confirmed status update.

### [MEDIUM] pdf-export.ts — footer always shows "Halaman 1" on all pages
File: src/lib/pdf-export.ts:478
Test scenario: Invoice with many line items that span multiple pages
Expected: Footer shows correct page number on each page (e.g. "Halaman 2", "Halaman 3")
Actual: Footer is only drawn once at the end of the function with hardcoded `pdf.text('Halaman 1', ...)`. When addPage() is called for long item lists, the new pages have no footer, and the last page still shows "Halaman 1".
Fix: Use jsPDF's `pdf.internal.getNumberOfPages()` in a post-render loop to add footers to all pages with correct page numbers.

### [MEDIUM] pdf-export.ts — balanceDue can be negative (overpayment display)
File: src/lib/pdf-export.ts:36
Test scenario: Invoice where payments sum exceeds total_amount (overpayment scenario)
Expected: Show "LUNAS" or clamp to 0
Actual: `balanceDue = totalAmount - amountPaid` can be negative. The PDF then renders a negative "Sisa Tagihan" value (e.g. "-Rp 50.000") which is confusing and incorrect for customers.
Fix: `const balanceDue = Math.max(0, totalAmount - amountPaid)`

### [MEDIUM] getInvoiceStats — totalRevenue uses payment_status='PAID' but status and payment_status can diverge
File: src/lib/actions/invoices.ts:1539
Test scenario: Invoice with status='PAID' but payment_status='PARTIAL' (possible via updateInvoiceStatus direct call)
Expected: Revenue calculation consistent with actual payment state
Actual: totalRevenue sums total_amount for invoices where payment_status='PAID'. unpaidAmount uses payment_status != 'PAID'. Since updateInvoiceStatus() can set status='PAID' without updating payment_status, these two fields can diverge, causing revenue to be understated and unpaid to be overstated.
Fix: Enforce payment_status sync in updateInvoiceStatus() when setting status='PAID'. Or compute stats from payment_records directly.


---

## LOW

### [LOW] invoice-utils.ts — getInvoiceSource fallback ignores source column value 'BLANK' when order_id is also set
File: src/lib/invoice-utils.ts:13
Test scenario: Invoice row with source='BLANK' AND order_id IS NOT NULL (edge case from migration)
Expected: Returns 'BLANK' (source column is authoritative)
Actual: `return invoice.source ?? (invoice.order_id ? 'ORDER_LINKED' : 'BLANK')` — if source is null/undefined and order_id is set, returns 'ORDER_LINKED'. This is correct for new rows. However the fallback does not handle the case where source='BLANK' is explicitly set but order_id is also non-null (which the DB allows). The function correctly returns invoice.source in that case since it is not null. Low risk but the comment should clarify precedence.
Fix: Add a comment clarifying that source column always takes precedence. No code change needed unless null source rows exist.

### [LOW] isOverdue — uses string comparison for dates (locale-sensitive risk)
File: src/lib/invoice-status.ts:12
Test scenario: Server running in non-UTC timezone
Expected: Overdue computed correctly regardless of server timezone
Actual: `inv.due_date < today` compares two YYYY-MM-DD strings lexicographically. This works correctly for ISO date strings. However `new Date().toISOString().split('T')[0]` returns UTC date, while due_date is stored as a PostgreSQL date (also UTC). If the server clock is in a timezone ahead of UTC (e.g. WIB UTC+7), an invoice due today in WIB may appear overdue at midnight UTC. Low risk for Indonesian deployment but worth noting.
Fix: Use `new Date(new Date().toLocaleString('en-CA', { timeZone: 'Asia/Jakarta' })).toISOString().split('T')[0]` for consistent WIB-based overdue calculation.

### [LOW] use-invoice-mutation.ts — useCreateInvoice missing cache invalidation for specific invoice
File: src/hooks/use-invoice-mutation.ts:34
Test scenario: Create invoice then navigate to invoice detail page
Expected: Detail page shows fresh data
Actual: onSettled only invalidates ['invoices'] and ['orders'] query keys. Does not invalidate ['invoice', invoiceId] since the new invoice ID is not available in onSettled context. Minor — the list will refresh but a cached detail view of a related order may be stale.
Fix: Return the new invoice from mutationFn and invalidate ['invoice', result.invoice_id] in onSuccess.

### [LOW] createBlankInvoice — discount_percentage and discount_amount both accepted; priority undocumented
File: src/lib/actions/invoices.ts:938
Test scenario: Submit blank invoice with both discount_amount=10000 and discount_percentage=10
Expected: Clear precedence rule documented and enforced
Actual: `hasFixedDiscount = discountAmountInput > 0` — fixed amount takes priority over percentage silently. This matches calculateInvoiceTotals() behavior but is not communicated to the caller or validated in the Zod schema. A caller providing both fields gets no warning.
Fix: Add a Zod .refine() to CreateBlankInvoiceSchema: cannot provide both discount_amount > 0 and discount_percentage > 0 simultaneously. Or document the precedence clearly in the schema comment.

### [LOW] pdf-export.ts — missing @types/date-fns causes TypeScript errors in CI
File: src/lib/pdf-export.ts:2
Test scenario: npm run type-check
Expected: No errors in invoice-related files
Actual: TS7016 errors for date-fns and date-fns/locale across pdf-export.ts and many other files. date-fns v3+ ships its own types but the installed version appears to be missing them or tsconfig moduleResolution is incompatible.
Fix: Run `npm install --save-dev @types/date-fns` or upgrade date-fns to v3 and set `"moduleResolution": "bundler"` in tsconfig.json.


---

## INFO

### [INFO] canReviseInvoice — PARTIAL_PAID invoices cannot be revised
File: src/lib/invoice-utils.ts:9
Test scenario: Try to revise an invoice in PARTIAL_PAID status
Expected: Revision allowed (customer may need corrected invoice after partial payment)
Actual: REVISABLE_STATUSES = ['DRAFT', 'SENT'] only. PARTIAL_PAID invoices cannot be revised via updateInvoice() or reviseInvoiceItems(). This is a deliberate design choice but may frustrate finance staff who need to correct line items after a partial payment has been recorded.
Fix: Consider adding 'PARTIAL_PAID' to REVISABLE_STATUSES, or provide a separate "amend" flow that creates a credit note. Document the decision.

### [INFO] sendInvoiceViaEmail — no dedicated server action; relies on logInvoiceCommunication only
File: src/lib/actions/invoice-communications.ts
Test scenario: Check for sendInvoiceViaEmail function
Expected: Dedicated server action that calls Resend API, handles missing API key, validates email format
Actual: No sendInvoiceViaEmail server action exists in the audited files. Email sending appears to be handled client-side or via a separate API route not in scope. logInvoiceCommunication() only logs — it does not send. If RESEND_API_KEY is missing, the send silently fails at the API route level with no feedback to the server action layer.
Fix: Implement a sendInvoiceViaEmail server action that: (1) validates RESEND_API_KEY presence, (2) validates recipient email format, (3) calls Resend, (4) calls logInvoiceCommunication on success, (5) returns structured error on failure.

### [INFO] createInvoiceFromOrder — materials with unit_price=0 are included as ADDON line items
File: src/lib/actions/invoices.ts:1831
Test scenario: Service report with materials that have unit_price=0 (e.g. consumables included in service)
Expected: Zero-price materials either excluded or flagged
Actual: Materials with unit_price=0 are included as ADDON line items with total_price=0. This is not a bug per se — zero-price items are valid — but it creates noise in the invoice and may confuse customers. The Zod schema (InvoiceItemPriceSchema) uses .nonnegative() which allows 0, consistent with this behavior.
Fix: Optionally filter out zero-price materials, or add a note in the item description indicating "included in service". Document the intended behavior.

---

## DB Schema Gaps Found

| Gap | Table | Impact |
|-----|-------|--------|
| No CHECK constraint on payment_records.amount > 0 | payment_records | Allows zero/negative payments at DB level |
| No partial unique index on (order_id) WHERE invoice_type='FINAL' AND status!='CANCELLED' | invoices | Allows duplicate FINAL invoices per order |
| No deleted_at column | invoices | Hard deletes violate soft-delete convention |
| generate_invoice_number RPC missing | DB functions | Fallback uses random suffix — not sequential |
| No CHECK on invoices.status valid values | invoices | Any string accepted as status |
| No CHECK on invoices.payment_status valid values | invoices | Any string accepted as payment_status |

---

## Test Scenario Results (Static + DB Analysis)

| Scenario | Result |
|----------|--------|
| createInvoice — order with no items | PASS: returns empty invoice (items insert skipped, rollback triggered) |
| createInvoice — order already invoiced | FAIL: no duplicate guard |
| createInvoice — COMPLETED order status | FAIL: only DONE accepted |
| createInvoice — negative discount_amount | PASS: calculateDiscount clamps to 0 via Math.max |
| createInvoice — negative tax_percentage | PASS: calculateTax clamps via Math.max(0, taxRate) |
| createBlankInvoice — no customer_id, no name | FAIL: Zod requires customer_name min(1) — correctly rejected |
| createBlankInvoice — both discount fields | FAIL: no Zod refine, silent precedence |
| createProformaInvoice — order with no items | PASS: returns error 'Order tidak memiliki item' |
| createProformaInvoice — tax on discounted amount | FAIL: discount not subtracted before tax |
| recordPayment — amount=0 | FAIL: no guard, accepted |
| recordPayment — amount > remaining | FAIL: no guard, overpayment accepted |
| recordPayment — multiple partials summing correctly | PASS: additive paid_amount logic is correct |
| recordPayment — PARTIAL_PAID status set correctly | PASS: newPaidAmount > 0 sets PARTIAL |
| updateInvoice — PAID invoice revision | PASS: canReviseInvoice('PAID') returns false |
| updateInvoice — CANCELLED invoice revision | PASS: canReviseInvoice('CANCELLED') returns false |
| deleteInvoice — invoice with payments | PASS: payment check blocks delete |
| deleteInvoice — invoice with communications | PASS: communication check blocks delete |
| deleteInvoice — non-DRAFT invoice | PASS: status check blocks delete |
| cancelInvoice (updateInvoiceStatus CANCELLED) — PAID invoice | FAIL: no guard, PAID can be set to CANCELLED |
| getInvoices — OVERDUE filter pagination | FAIL: count is wrong (full table count returned) |
| getInvoices — page=0 | PASS: page defaults to 1 via filters?.page || 1 |
| isOverdue — due today | PASS: strict less-than means today is not overdue |
| canReviseInvoice — all statuses | PASS for DRAFT/SENT; correctly blocks PAID/CANCELLED/PARTIAL_PAID |
| getInvoiceSource — ORDER_LINKED vs BLANK | PASS: source column takes precedence |
| PDF — long descriptions | PASS: splitTextToSize used |
| PDF — multi-page footer | FAIL: hardcoded "Halaman 1" on all pages |
| PDF — negative balance due | FAIL: no Math.max(0,...) clamp |

---

## Recommended Fix Priority

1. **Immediate (before next release):**
   - Add `amount > 0` guard in recordPayment + DB CHECK constraint
   - Add overpayment guard in recordPayment
   - Create generate_invoice_number DB RPC
   - Fix createInvoice order status check to accept COMPLETED

2. **Short-term (next sprint):**
   - Add duplicate FINAL invoice guard + partial unique index
   - Add state machine to updateInvoiceStatus
   - Fix addons_subtotal calculation in calculateInvoiceTotals
   - Fix proforma tax calculation (apply discount before tax)
   - Fix OVERDUE pagination count

3. **Medium-term:**
   - Soft-delete for invoices (add deleted_at column)
   - Atomic reviseInvoice via DB RPC
   - Fix PDF multi-page footer
   - Fix date-fns TypeScript errors

