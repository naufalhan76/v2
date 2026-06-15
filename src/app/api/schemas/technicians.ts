import { z } from 'zod'

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

export type GetTechniciansQuery = z.infer<typeof GetTechniciansQuerySchema>
export type CreateTechnician = z.infer<typeof CreateTechnicianSchema>
export type UpdateTechnician = z.infer<typeof UpdateTechnicianSchema>
