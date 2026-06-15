import { z } from 'zod'

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

export type CreateLocation = z.infer<typeof CreateLocationSchema>
export type UpdateLocation = z.infer<typeof UpdateLocationSchema>
