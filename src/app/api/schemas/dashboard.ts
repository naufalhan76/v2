import { z } from 'zod'

export const GetDashboardKpiQuerySchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  customerId: z.string().uuid().optional(),
  technicianId: z.string().uuid().optional(),
})

export type GetDashboardKpiQuery = z.infer<typeof GetDashboardKpiQuerySchema>
