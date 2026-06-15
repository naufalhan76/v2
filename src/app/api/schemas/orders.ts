import { z } from 'zod'

export const OrderStatusEnum = z.enum([
  'PENDING',
  'ASSIGNED',
  'EN_ROUTE',
  'IN_PROGRESS',
  'COMPLETED',
  'INVOICED',
  'PAID',
  'CANCELLED',
])

export const OrderStatusTransitionMap: Record<string, string[]> = {
  PENDING: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['EN_ROUTE', 'CANCELLED'],
  EN_ROUTE: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: ['INVOICED', 'CANCELLED'],
  INVOICED: ['PAID', 'CANCELLED'],
  PAID: [],
  CANCELLED: [],
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
  orderId: z.string().min(1),
  newStatus: OrderStatusEnum,
  req_visit_date: z.string().datetime().optional(),
})

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

export type GetOrdersQuery = z.infer<typeof GetOrdersQuerySchema>
export type GetOrderByIdParam = z.infer<typeof GetOrderByIdParamSchema>
export type UpdateOrderStatus = z.infer<typeof UpdateOrderStatusSchema>
export type AssignTechnician = z.infer<typeof AssignTechnicianSchema>
export type CreateOrder = z.infer<typeof CreateOrderSchema>
