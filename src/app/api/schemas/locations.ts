import { z } from 'zod'

const lat = z.number().min(-90).max(90).nullable().optional()
const lng = z.number().min(-180).max(180).nullable().optional()

export const CreateLocationSchema = z.object({
  customerId: z.string().uuid(),
  fullAddress: z.string().min(1),
  houseNumber: z.string().optional(),
  city: z.string().optional(),
  landmarks: z.string().optional(),
  lat,
  lng,
})

export const UpdateLocationSchema = CreateLocationSchema.extend({
  locationId: z.string().uuid(),
})

export type CreateLocation = z.infer<typeof CreateLocationSchema>
export type UpdateLocation = z.infer<typeof UpdateLocationSchema>
