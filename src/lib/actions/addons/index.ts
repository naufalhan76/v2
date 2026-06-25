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
} from './addons-queries'

export {
  // Mutations
  createAddon,
  updateAddon,
  deleteAddon,
  toggleAddonStatus,
  bulkUpdateAddons,
} from './addons-mutations'
