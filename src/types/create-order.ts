// Backward-compatible re-exports.
// All types moved to src/types/orders.ts — canonical OrderStatus lives in src/lib/order-status.ts.

export type {
  OrderStatus,
  LegacyOrderStatus,
  AnyOrderStatus,
  OrderItem,
  CreateOrderItemInput,
  CreateOrderInput,
  LocationFormData,
  OrderFormState,
  CustomerSearchResult,
  ServiceCatalogEntry,
  ServiceTypeEnum,
} from './orders'
