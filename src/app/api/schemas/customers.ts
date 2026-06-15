import { z } from 'zod'

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

export type GetCustomersQuery = z.infer<typeof GetCustomersQuerySchema>
export type SearchCustomer = z.infer<typeof SearchCustomerSchema>
export type CreateCustomer = z.infer<typeof CreateCustomerSchema>
export type UpdateCustomer = z.infer<typeof UpdateCustomerSchema>
