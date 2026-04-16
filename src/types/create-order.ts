// Types for Create Order feature with order_items structure

// Import base types
export type ServiceTypeEnum = 
  | 'INSTALLATION' 
  | 'MAINTENANCE' 
  | 'REPAIR' 
  | 'CLEANING'; // Legacy enum format for backward compatibility

export type OrderStatus = 
  | 'NEW' 
  | 'ACCEPTED' 
  | 'ASSIGNED'
  | 'EN ROUTE'
  | 'ARRIVED'
  | 'IN_PROGRESS'
  | 'DONE'
  | 'RESCHEDULE'
  | 'INVOICED'
  | 'PAID'
  | 'CLOSED'
  | 'CANCELLED';

export type OrderItem = {
  order_item_id: string;
  order_id: string;
  location_id: string;
  ac_unit_id: string | null; // NULL = new AC (details filled by technician)
  unit_type_id?: string;
  capacity_id?: string;
  brand_id?: string;
  service_type_id?: string;
  catalog_id?: string;
  msn_code?: string;
  service_type: string;
  quantity: number; // for new AC units
  description: string | null;
  estimated_price: number;
  actual_price: number | null;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
};

export type CreateOrderItemInput = {
  location_id: string;
  ac_unit_id?: string | null;
  unit_type_id?: string;
  capacity_id?: string;
  brand_id?: string;
  service_type_id?: string;
  catalog_id?: string;
  msn_code?: string;
  service_type: string;
  quantity?: number;
  description?: string;
  estimated_price?: number;
  
  // Data for new AC units that haven't been registered yet
  new_ac_data?: {
    brand: string;
    model_number: string;
    capacity_btu?: number | null; // NULL if waiting for technician to fill
  };
};

export type CreateOrderInput = {
  customer_id: string;
  order_type?: string; // Legacy field - can be dominant service or 'MULTI_SERVICE'
  scheduled_visit_date: string;
  req_visit_date?: string; // Legacy field - same as scheduled_visit_date
  assigned_technician_id?: string | null;
  helper_technician_ids?: string[]; // Optional helper technicians
  notes?: string;
  items: CreateOrderItemInput[];
};

// Form state for Create Order page
export type LocationFormData = {
  location_id?: string; // undefined = new location
  full_address?: string;
  house_number?: string; // Support alphanumeric (e.g., "12A", "5B")
  city?: string;
  landmarks?: string;
  
  // Existing AC units
  existing_acs: Array<{
    ac_unit_id: string;
    brand: string;
    model_number: string;
    serial_number: string;
    unit_type_id?: string; // Loaded from DB if available
    capacity_id?: string;
    selected_services: Array<{
      catalog_id: string;
      msn_code: string;
      service_type: string;
      service_type_id: string;
      price: number;
      unit_type_id: string;
      capacity_id: string;
    }>;
    notes: string;
    is_selected?: boolean; // Track if AC is checked in dropdown (independent of services)
  }>;
  
  // New AC units (individual units with their own services)
  new_ac_units: Array<{
    temp_id: string; // temporary ID for form tracking
    unit_type_id: string;
    capacity_id: string;
    brand_id: string;
    selected_services: Array<{
      catalog_id: string;
      msn_code: string;
      service_type: string;
      service_type_id: string;
      price: number;
      unit_type_id: string;
      capacity_id: string;
    }>;
    notes: string;
    notes_room?: string; // Room/Location name
  }>;
};

export type OrderFormState = {
  // Step 1: Customer
  phone: string;
  customer: {
    customer_id: string;
    customer_name: string;
    phone_number: string;
    email: string | null;
    billing_address?: string | null;
  } | null;
  isNewCustomer: boolean;
  newCustomerName: string;
  newCustomerEmail: string;
  
  // Step 2: Locations & AC
  locations: LocationFormData[];
  
  // Step 3: Schedule
  scheduled_date: Date | null;
  technician_id: string | null;
  notes: string;
  
  // UI State
  isPhoneVerified: boolean;
  isLoadingCustomer: boolean;
  estimatedTotal: number;
};

export type CustomerSearchResult = {
  customer_id: string;
  customer_name: string;
  phone_number: string;
  primary_contact_person: string;
  email: string | null;
  billing_address?: string | null;
  locations?: Array<{
    location_id: string;
    full_address: string;
    house_number: string; // Support alphanumeric
    city: string;
    landmarks: string | null;
    ac_units?: Array<{
      ac_unit_id: string;
      brand: string;
      model_number: string;
      serial_number: string | null;
      ac_type: string | null;
      capacity_btu: number | null;
      status: string;
    }>;
  }>;
};

export type ServicePricing = {
  pricing_id: string;
  service_type: string;
  service_name: string;
  base_price: number;
  description: string | null;
};

export type ServiceCatalogEntry = {
  catalog_id: string;
  msn_code: string;
  unit_type_id: string;
  capacity_id: string;
  service_type_id: string;
  service_name: string;
  base_price: number;
  unit_types?: { name: string };
  capacity_ranges?: { capacity_label: string };
  service_types?: { name: string, code: string };
};
