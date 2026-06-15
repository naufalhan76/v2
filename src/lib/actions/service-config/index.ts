// Barrel index for service-config actions (NO 'use server' - barrel re-exports from server action modules)
export {
  // Queries
  getServiceTypes,
  getUnitTypes,
  getCapacityRanges,
  getAcBrands,
  getServiceCatalog,
} from './service-config-queries'

export {
  // Service Types mutations
  createServiceType,
  updateServiceType,
  deleteServiceType,
  // Unit Types mutations
  createUnitType,
  updateUnitType,
  deleteUnitType,
  // Capacity Ranges mutations
  createCapacityRange,
  updateCapacityRange,
  deleteCapacityRange,
  // AC Brands mutations
  createAcBrand,
  updateAcBrand,
  deleteAcBrand,
  // Service Catalog mutations
  createServiceCatalogEntry,
  updateServiceCatalogEntry,
  deleteServiceCatalogEntry,
  // Bulk imports
  bulkImportServiceCatalog,
  bulkImportUnitTypes,
  bulkImportCapacityRanges,
  bulkImportAcBrands,
  bulkImportServiceTypes,
  bulkUpdateServiceCatalog,
} from './service-config-mutations'
