import { z } from 'zod'

export const CreateAcUnitSchema = z.object({
  locationId: z.string().uuid(),
  brand: z.string().min(1),
  modelNumber: z.string().optional(),
  serialNumber: z.string().optional(),
  acType: z.string().optional(),
  capacityBtu: z.number().positive().optional(),
  installationDate: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'RETIRED']).optional(),
})

export const UpdateAcUnitSchema = CreateAcUnitSchema.extend({
  acUnitId: z.string().uuid(),
})

export type CreateAcUnit = z.infer<typeof CreateAcUnitSchema>
export type UpdateAcUnit = z.infer<typeof UpdateAcUnitSchema>
