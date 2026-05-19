import { z } from 'zod'

// ============================================================================
// COMMON SCHEMAS
// ============================================================================

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().default(20),
})

export const DateRangeSchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
})

export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  pagination: z.object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    totalPages: z.number(),
  }).optional(),
})

// ============================================================================
// ORDER SCHEMAS
// ============================================================================

export const OrderStatusEnum = z.enum([
  'NEW',
  'ACCEPTED',
  'ASSIGNED',
  'EN ROUTE',
  'ARRIVED',
  'IN_PROGRESS',
  'DONE',
  'RESCHEDULE',
  'TO_WORKSHOP',
  'IN_WORKSHOP',
  'READY_TO_RETURN',
  'DELIVERED',
  'INVOICED',
  'PAID',
  'CLOSED',
  'CANCELLED',
])

export const OrderStatusTransitionMap: Record<string, string[]> = {
  NEW: ['ACCEPTED', 'RESCHEDULE', 'CANCELLED'],
  ACCEPTED: ['ASSIGNED', 'RESCHEDULE', 'CANCELLED'],
  ASSIGNED: ['EN ROUTE', 'RESCHEDULE', 'CANCELLED'],
  'EN ROUTE': ['ARRIVED', 'DONE', 'RESCHEDULE', 'CANCELLED'],
  ARRIVED: ['IN_PROGRESS', 'RESCHEDULE', 'CANCELLED'],
  IN_PROGRESS: ['IN_PROGRESS', 'DONE', 'RESCHEDULE', 'CANCELLED'],
  DONE: ['RESCHEDULE', 'INVOICED', 'CANCELLED'],
  RESCHEDULE: ['NEW', 'ASSIGNED', 'CANCELLED'],
  TO_WORKSHOP: ['IN_WORKSHOP', 'CANCELLED'],
  IN_WORKSHOP: ['READY_TO_RETURN', 'CANCELLED'],
  READY_TO_RETURN: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['INVOICED', 'CANCELLED'],
  INVOICED: ['PAID', 'CANCELLED'],
  PAID: ['CLOSED'],
  CLOSED: ['RESCHEDULE'],
  CANCELLED: ['RESCHEDULE'],
}

export const GetOrdersQuerySchema = z.object({
  status: z.string().optional(),
  statusIn: z.string().optional(),
  customerId: z.string().uuid().optional(),
  technician_id: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().default(20),
})

export const GetOrderByIdParamSchema = z.object({
  id: z.string().min(1), // Support custom order ID format like REQ/2026-01/036148
})

export const UpdateOrderStatusSchema = z.object({
  orderId: z.string().min(1), // Support custom order ID format like REQ/2026-01/036148
  newStatus: OrderStatusEnum,
  req_visit_date: z.string().datetime().optional(), // Required when status = RESCHEDULE
}).refine(
  (data) => {
    // If status is RESCHEDULE, req_visit_date must be provided
    if (data.newStatus === 'RESCHEDULE' && !data.req_visit_date) {
      return false
    }
    return true
  },
  {
    message: 'req_visit_date is required when status is RESCHEDULE',
    path: ['req_visit_date'],
  }
)

export const AssignTechnicianSchema = z.object({
  orderId: z.string().uuid(),
  technicianId: z.string().uuid(),
  scheduledDate: z.string().datetime().optional(),
})

export const CreateOrderSchema = z.object({
  customerId: z.string().uuid(),
  locationId: z.string().uuid(),
  orderType: z.string(),
  description: z.string().optional(),
  items: z.array(z.object({
    serviceType: z.string(),
    quantity: z.number().positive().optional(),
    estimatedPrice: z.number().positive().optional(),
  })).optional(),
})

// ============================================================================
// CUSTOMER SCHEMAS
// ============================================================================

export const GetCustomersQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().default(20),
})

export const SearchCustomerSchema = z.object({
  query: z.string().min(1),
})

export const CreateCustomerSchema = z.object({
  customerName: z.string().min(1),
  primaryContactPerson: z.string().optional(),
  email: z.string().email().optional(),
  phoneNumber: z.string().min(1),
  billingAddress: z.string().optional(),
  notes: z.string().optional(),
})

export const UpdateCustomerSchema = CreateCustomerSchema.extend({
  customerId: z.string().uuid(),
})

// ============================================================================
// LOCATION SCHEMAS
// ============================================================================

export const CreateLocationSchema = z.object({
  customerId: z.string().uuid(),
  fullAddress: z.string().min(1),
  houseNumber: z.string().optional(),
  city: z.string().optional(),
  landmarks: z.string().optional(),
})

export const UpdateLocationSchema = CreateLocationSchema.extend({
  locationId: z.string().uuid(),
})

// ============================================================================
// AC UNIT SCHEMAS
// ============================================================================

export const CreateAcUnitSchema = z.object({
  locationId: z.string().uuid(),
  brand: z.string().min(1),
  modelNumber: z.string().optional(),
  serialNumber: z.string().optional(),
  acType: z.string().optional(),
  capacityBtu: z.number().positive().optional(),
  installationDate: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE']).optional(),
})

export const UpdateAcUnitSchema = CreateAcUnitSchema.extend({
  acUnitId: z.string().uuid(),
})

// ============================================================================
// SERVICE RECORD SCHEMAS
// ============================================================================

export const CompleteServiceSchema = z.object({
  serviceId: z.string().uuid(),
  descriptionOfWork: z.string().optional(),
  cost: z.number().positive().optional(),
  nextServiceDue: z.string().datetime().optional(),
  status: z.enum(['COMPLETED', 'PENDING']).optional(),
})

export const GetServiceRecordsQuerySchema = z.object({
  acUnitId: z.string().uuid().optional(),
  technicianId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().default(20),
})

// ============================================================================
// DASHBOARD SCHEMAS
// ============================================================================

export const GetDashboardKpiQuerySchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  customerId: z.string().uuid().optional(),
  technicianId: z.string().uuid().optional(),
})

// ============================================================================
// INVOICE SCHEMAS
// ============================================================================

/**
 * Blank invoice line item.
 * `item_type` mirrors the existing invoice_items.item_type values used by
 * createInvoice(): 'BASE_SERVICE' or 'ADDON'. Both are accepted so blank
 * invoices stay compatible with downstream rendering (PDF, email template).
 */
export const BlankInvoiceLineItemSchema = z.object({
  item_type: z.enum(['BASE_SERVICE', 'ADDON']).default('BASE_SERVICE'),
  description: z.string().min(1, 'Deskripsi item wajib diisi'),
  quantity: z.coerce.number().positive('Kuantitas harus lebih dari 0'),
  unit_price: z.coerce.number().nonnegative('Harga satuan tidak boleh negatif'),
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
  customer_id: z.string().uuid().optional(),
  customer_name: z.string().trim().min(1, 'Nama pelanggan wajib diisi').max(255),
  customer_phone: z.string().trim().max(50).optional(),
  customer_email: z.string().trim().email('Format email tidak valid').optional()
    .or(z.literal('').transform(() => undefined)),
  customer_address: z.string().trim().max(2000).optional(),

  // Dates. due_date is required (per task spec). invoice_date defaults to today.
  invoice_date: z.string().optional(), // YYYY-MM-DD; server defaults to today
  due_date: z.string().min(1, 'Tanggal jatuh tempo wajib diisi'), // YYYY-MM-DD

  // Line items — at least one required
  items: z.array(BlankInvoiceLineItemSchema).min(1, 'Minimal satu item invoice'),

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

export type CreateBlankInvoiceInput = z.infer<typeof CreateBlankInvoiceSchema>
export type BlankInvoiceLineItem = z.infer<typeof BlankInvoiceLineItemSchema>

// ============================================================================
// TECHNICIAN SCHEMAS
// ============================================================================

export const GetTechniciansQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().default(20),
})

export const CreateTechnicianSchema = z.object({
  technicianName: z.string().min(1),
  company: z.string().optional(),
  contactNumber: z.string().min(1),
  email: z.string().email().optional(),
})

export const UpdateTechnicianSchema = CreateTechnicianSchema.extend({
  technicianId: z.string().uuid(),
})

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type GetOrdersQuery = z.infer<typeof GetOrdersQuerySchema>
export type GetOrderByIdParam = z.infer<typeof GetOrderByIdParamSchema>
export type UpdateOrderStatus = z.infer<typeof UpdateOrderStatusSchema>
export type AssignTechnician = z.infer<typeof AssignTechnicianSchema>
export type CreateOrder = z.infer<typeof CreateOrderSchema>

export type GetCustomersQuery = z.infer<typeof GetCustomersQuerySchema>
export type SearchCustomer = z.infer<typeof SearchCustomerSchema>
export type CreateCustomer = z.infer<typeof CreateCustomerSchema>
export type UpdateCustomer = z.infer<typeof UpdateCustomerSchema>

export type CreateLocation = z.infer<typeof CreateLocationSchema>
export type UpdateLocation = z.infer<typeof UpdateLocationSchema>

export type CreateAcUnit = z.infer<typeof CreateAcUnitSchema>
export type UpdateAcUnit = z.infer<typeof UpdateAcUnitSchema>

export type CompleteService = z.infer<typeof CompleteServiceSchema>
export type GetServiceRecordsQuery = z.infer<typeof GetServiceRecordsQuerySchema>

export type GetDashboardKpiQuery = z.infer<typeof GetDashboardKpiQuerySchema>

export type GetTechniciansQuery = z.infer<typeof GetTechniciansQuerySchema>
export type CreateTechnician = z.infer<typeof CreateTechnicianSchema>
export type UpdateTechnician = z.infer<typeof UpdateTechnicianSchema>
