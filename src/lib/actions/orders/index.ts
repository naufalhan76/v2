// Barrel re-export for backward compatibility.
// NOTE: Do NOT add 'use server' here — this file only re-exports.

// Orders queries (read operations)
export { getOrders, getOrderById } from '../orders-queries'

// Orders mutations — status (updateOrderStatus, cancelOrder, deleteOrder)
export {
  updateOrderStatus,
  cancelOrder,
  deleteOrder,
} from '../orders-mutations-status'

// Orders mutations — assign (assignOrdersToTechnician, add/remove helper)
export {
  assignOrdersToTechnician,
  addHelperTechnician,
  removeHelperTechnician,
} from '../orders-mutations-assign'

// Orders mutations — schedule (createOrder, rescheduleOrder)
export {
  createOrder,
  rescheduleOrder,
} from '../orders-mutations-schedule'

// Create-order search (searchCustomers, searchCustomerByPhone, getCustomerWithLocationsById)
export {
  searchCustomers,
  searchCustomerByPhone,
  getCustomerWithLocationsById,
} from '../create-order-search'

// Create-order config (technicians, master data, service types)
export {
  getTechnicians,
  getOrderConfigMasterData,
  getServiceTypesForCatalog,
} from '../create-order-config'

// Create-order mutations (createCustomer, createOrderWithItems, createLocation)
export {
  createCustomer,
  createOrderWithItems,
  createLocation,
} from '../create-order-mutations'
