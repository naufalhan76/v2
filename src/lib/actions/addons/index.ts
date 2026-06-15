// Barrel index for addons actions (NO 'use server' - barrel re-exports from server action modules)
export {
  // Types
  type Addon,
  type CreateAddonInput,
  type UpdateAddonInput,
  type GetAddonsFilters,
  // Queries
  getAddons,
  getAddonById,
  getAddonsByCategory,
  getActiveAddons,
  getLowStockAddons,
} from './addons-queries'

export {
  // Mutations
  createAddon,
  updateAddon,
  deleteAddon,
  toggleAddonStatus,
  updateStock,
  bulkUpdateStock,
  bulkUpdateAddons,
} from './addons-mutations'
