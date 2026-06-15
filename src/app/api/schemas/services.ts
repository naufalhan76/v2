import { z } from 'zod'

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

export type CompleteService = z.infer<typeof CompleteServiceSchema>
export type GetServiceRecordsQuery = z.infer<typeof GetServiceRecordsQuerySchema>
