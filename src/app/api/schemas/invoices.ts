import { z } from 'zod'

const MAX_INVOICE_ITEMS = 100
const MAX_INVOICE_ITEM_QUANTITY = 10000
const MAX_INVOICE_ITEM_PRICE = 1_000_000_000

const InvoiceItemQuantitySchema = z.coerce
  .number()
  .positive('Kuantitas harus lebih dari 0')
  .max(MAX_INVOICE_ITEM_QUANTITY, `Kuantitas maksimal ${MAX_INVOICE_ITEM_QUANTITY}`)

const InvoiceItemPriceSchema = z.coerce
  .number()
  .nonnegative('Harga satuan tidak boleh negatif')
  .max(MAX_INVOICE_ITEM_PRICE, `Harga satuan maksimal ${MAX_INVOICE_ITEM_PRICE}`)

/**
 * Blank invoice line item.
 * `item_type` mirrors the existing invoice_items.item_type values used by
 * createInvoice(): 'BASE_SERVICE' or 'ADDON'. Both are accepted so blank
 * invoices stay compatible with downstream rendering (PDF, email template).
 */
export const BlankInvoiceLineItemSchema = z.object({
  item_type: z.enum(['BASE_SERVICE', 'ADDON']).default('BASE_SERVICE'),
  description: z.string().min(1, 'Deskripsi item wajib diisi'),
  quantity: InvoiceItemQuantitySchema,
  unit_price: InvoiceItemPriceSchema,
})

/**
 * Input for createBlankInvoice() server action.
 *
 * Blank invoices are NOT linked to an order:
 *   - `order_id` is omitted entirely.
 *   - `customer_id` is optional. When omitted, the invoice stores a manual
 *     name/phone/email/address snapshot via the override fields.
 *   - At least one line item is required.
 *   - Existing invoice numbering, prefix, and due-day defaults are reused via
 *     getInvoiceConfig() / generate_invoice_number().
 */
export const CreateBlankInvoiceSchema = z.object({
  invoice_type: z.enum(['PROFORMA', 'FINAL']).default('FINAL'),

  // Customer — either link to an existing record OR provide a manual name.
  customer_id: z.string().trim().min(1).optional()
    .or(z.literal('').transform(() => undefined)),
  customer_name: z.string().trim().min(1, 'Nama pelanggan wajib diisi').max(255),
  customer_phone: z.string().trim().max(50).optional(),
  customer_email: z.string().trim().email('Format email tidak valid').optional()
    .or(z.literal('').transform(() => undefined)),
  customer_address: z.string().trim().max(2000).optional(),

  // Dates. due_date is required (per task spec). invoice_date defaults to today.
  invoice_date: z.string().optional(), // YYYY-MM-DD; server defaults to today
  due_date: z.string().min(1, 'Tanggal jatuh tempo wajib diisi'), // YYYY-MM-DD

  // Line items — at least one required
  items: z.array(BlankInvoiceLineItemSchema).min(1, 'Minimal satu item invoice').max(MAX_INVOICE_ITEMS, `Maksimal ${MAX_INVOICE_ITEMS} item invoice`),

  // Optional adjustments
  discount_amount: z.coerce.number().nonnegative().optional(),
  discount_percentage: z.coerce.number().min(0).max(100).optional(),
  tax_percentage: z.coerce.number().min(0).max(100).optional(),

  // Free-form fields
  notes: z.string().max(5000).optional(),
  terms_conditions: z.string().max(10000).optional(),

  // Optional payment account snapshot (mirrors existing invoice fields)
  payment_account_id: z.string().optional(),
  payment_account_label: z.string().optional(),
  payment_bank_name: z.string().optional(),
  payment_account_number: z.string().optional(),
  payment_account_name: z.string().optional(),
})

export const ReviseInvoiceHeaderSchema = z.object({
  customer_id: z.string().trim().min(1).nullable().optional()
    .or(z.literal('').transform(() => null)),
  customer_name_override: z.string().trim().min(1).max(255).nullable().optional(),
  customer_phone_override: z.string().trim().max(50).nullable().optional(),
  customer_email_override: z.string().trim().email('Format email tidak valid').nullable().optional()
    .or(z.literal('').transform(() => null)),
  customer_address_override: z.string().trim().max(2000).nullable().optional(),
  due_date: z.string().min(1, 'Tanggal jatuh tempo wajib diisi').optional(),
  notes: z.string().max(5000).nullable().optional(),
  terms_conditions: z.string().max(10000).nullable().optional(),
  discount_amount: z.coerce.number().nonnegative().optional(),
  discount_percentage: z.coerce.number().min(0).max(100).optional(),
  tax_percentage: z.coerce.number().min(0).max(100).optional(),
  payment_account_id: z.string().nullable().optional(),
  payment_account_label: z.string().nullable().optional(),
  payment_bank_name: z.string().nullable().optional(),
  payment_account_number: z.string().nullable().optional(),
  payment_account_name: z.string().nullable().optional(),
}).strict()

export const ReviseInvoiceLineItemSchema = BlankInvoiceLineItemSchema.extend({
  item_id: z.string().uuid().optional(),
  service_type: z.string().nullable().optional(),
  addon_id: z.string().nullable().optional(),
  order_addon_id: z.string().nullable().optional(),
  line_order: z.coerce.number().int().nonnegative().optional(),
})

export const ReviseInvoiceSchema = z.object({
  header: ReviseInvoiceHeaderSchema.default({}),
  items: z.array(ReviseInvoiceLineItemSchema).min(1, 'Minimal satu item invoice').max(MAX_INVOICE_ITEMS, `Maksimal ${MAX_INVOICE_ITEMS} item invoice`),
})

export type CreateBlankInvoiceInput = z.infer<typeof CreateBlankInvoiceSchema>
export type BlankInvoiceLineItem = z.infer<typeof BlankInvoiceLineItemSchema>
export type ReviseInvoiceHeader = z.infer<typeof ReviseInvoiceHeaderSchema>
export type ReviseInvoiceLineItem = z.infer<typeof ReviseInvoiceLineItemSchema>
export type ReviseInvoiceInput = z.infer<typeof ReviseInvoiceSchema>
