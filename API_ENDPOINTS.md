# REST API Endpoints Reference

**Base URL:** `https://admin.yaleya.biz.id`

## ✅ Implemented Endpoints

### Orders Management

#### `GET /api/orders`
List all orders with filtering and pagination.

**Query Parameters:**
- `page` (number, default: 1) - Page number
- `limit` (number, default: 20) - Items per page
- `status` (string, optional) - Filter by single status
- `statusIn` (string, optional) - Filter by multiple statuses (comma-separated)
- `customerId` (UUID, optional) - Filter by customer
- `dateFrom` (ISO datetime, optional) - Filter from date
- `dateTo` (ISO datetime, optional) - Filter to date

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "order_id": "uuid",
      "customer_id": "uuid",
      "status": "NEW",
      "order_date": "2024-01-15",
      ...
    }
  ],
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

---

#### `POST /api/orders/create`
Create a new order.

**Request Body:**
```json
{
  "customerId": "uuid",
  "locationId": "uuid",
  "orderType": "MAINTENANCE|REPAIR|INSTALLATION",
  "description": "Order description (optional)",
  "items": [
    {
      "serviceType": "CLEANING|REPAIR|INSTALL",
      "quantity": 1,
      "estimatedPrice": 500000
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "order_id": "uuid",
    "customer_id": "uuid",
    "status": "NEW",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

---

#### `POST /api/orders/[id]/status`
Update order status with validation.

**URL Parameter:**
- `id` - Order ID (supports custom format like `REQ/2026-01/036148`, must be URL-encoded)

**Request Body:**
```json
{
  "newStatus": "ACCEPTED|ASSIGNED|EN ROUTE|ARRIVED|IN_PROGRESS|DONE|RESCHEDULE|INVOICED|PAID|CLOSED|CANCELLED",
  "req_visit_date": "2026-01-15T09:00:00Z"  // Required when newStatus = "RESCHEDULE"
}
```

**Special Behavior for RESCHEDULE:**
- `req_visit_date` field becomes **required**
- Automatically deletes all technician assignments (`order_technicians` table)
- Automatically resets `assigned_technician_id` to NULL
- All operations executed in a single transaction

**Response:**
```json
{
  "success": true,
  "data": {
    "order_id": "uuid",
    "status": "RESCHEDULE",
    "req_visit_date": "2026-01-15T09:00:00Z",
    "assigned_technician_id": null,
    "updated_at": "2024-01-15T10:35:00Z"
  }
}
```

---

### Customer Management

#### `GET /api/customers`
List customers with search and pagination.

**Query Parameters:**
- `search` (string, optional) - Search in customer name, phone, email, address
- `page` (number, default: 1) - Page number
- `limit` (number, default: 20) - Items per page

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "customer_id": "uuid",
      "customer_name": "PT Jakarta Service",
      "phone_number": "08123456789",
      "email": "contact@jakarta.com",
      "locations": [
        {
          "location_id": "uuid",
          "full_address": "Jl. Merdeka 123",
          "city": "Jakarta"
        }
      ]
    }
  ],
  "pagination": {
    "total": 50,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

---

#### `POST /api/customers`
Create a new customer.

**Request Body:**
```json
{
  "customerName": "PT Jakarta Service",
  "phoneNumber": "08123456789",
  "email": "contact@jakarta.com",
  "primaryContactPerson": "Budi Santoso",
  "billingAddress": "Jl. Merdeka 123, Jakarta",
  "notes": "Preferred contractor"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "customer_id": "uuid",
    "customer_name": "PT Jakarta Service",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

---

### Dashboard Analytics

#### `GET /api/dashboard/kpi`
Fetch dashboard KPI metrics.

**Query Parameters:**
- `dateFrom` (ISO datetime, optional) - From date
- `dateTo` (ISO datetime, optional) - To date
- `customerId` (UUID, optional) - Filter by customer
- `technicianId` (UUID, optional) - Filter by technician

**Response:**
```json
{
  "success": true,
  "data": {
    "totalOrders": 150,
    "pendingOrders": 25,
    "completedOrders": 100,
    "cancelledOrders": 5,
    "totalCustomers": 30,
    "totalTechnicians": 15,
    "totalRevenue": 50000000,
    "unpaidTransactions": 5000000
  }
}
```

---

### Technician Management

#### `GET /api/technicians`
List technicians with search and pagination.

**Query Parameters:**
- `search` (string, optional) - Search in name and contact
- `page` (number, default: 1) - Page number
- `limit` (number, default: 20) - Items per page

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "technician_id": "uuid",
      "technician_name": "Tono Priyanto",
      "company": "PT Jaya Service",
      "contact_number": "08987654321",
      "email": "tono@jaya.com",
      "total_orders": 25
    }
  ],
  "pagination": {
    "total": 15,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

### Service Records

#### `POST /api/service-records/[id]/complete`
Mark a service record as completed.

**Request Body:**
```json
{
  "descriptionOfWork": "Cleared filter, recharged refrigerant, tested cooling",
  "cost": 250000,
  "nextServiceDue": "2024-04-15T00:00:00Z",
  "status": "COMPLETED"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "serviceId": "uuid",
    "status": "COMPLETED",
    "completedAt": "2024-01-15T15:00:00Z"
  }
}
```

---

## Error Responses

### Validation Error (400)
```json
{
  "success": false,
  "error": "Validation failed: customerId must be a UUID",
  "message": "[{\"field\": \"customerId\", \"message\": \"Invalid UUID\"}]"
}
```

### Authentication Error (401)
```json
{
  "success": false,
  "error": "Unauthorized: Missing or invalid authentication"
}
```

### Not Found Error (404)
```json
{
  "success": false,
  "error": "Order not found"
}
```

### Conflict Error (409)
```json
{
  "success": false,
  "error": "Duplicate entry: Resource already exists"
}
```

### Server Error (500)
```json
{
  "success": false,
  "error": "An unexpected error occurred"
}
```

---

## Common HTTP Status Codes

| Status | Meaning | When Used |
|--------|---------|-----------|
| 200 | OK | Successful GET request |
| 201 | Created | Resource successfully created |
| 400 | Bad Request | Validation error, malformed request |
| 401 | Unauthorized | Missing/invalid authentication token |
| 403 | Forbidden | User lacks permission |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate entry, unique constraint violation |
| 500 | Internal Error | Server-side error |

---

## Next Phases (Planned)

### Phase 2
- **Locations**: POST, GET, PUT endpoints
- **AC Units**: POST, GET, PUT endpoints
- **Service Records**: GET list, GET detail
- **Technician Detail**: Availability, assignment history

### Phase 3
- **Invoicing**: Create, list, detail endpoints
- **Service Pricing**: CRUD operations
- **User Management**: Admin endpoints (role-aware)

### Phase 4
- **Rate Limiting**: Per-user/per-IP rate limits
- **Caching**: Response caching for read operations
- **WebSocket**: Real-time updates for orders, service records
- **API Documentation**: OpenAPI/Swagger specification
- **API Keys**: External service integration management

---

## Implementation Notes

- All endpoints require Bearer token authentication
- Timestamps are in ISO 8601 format with UTC timezone
- UUIDs must be valid RFC 4122 format
- Date filters are inclusive (≥ dateFrom, ≤ dateTo)
- Search is case-insensitive and uses partial matching
- Pagination is 1-indexed (first page is 1, not 0)
- Deleted resources are soft-deleted (not removed from DB)
- All monetary values are in Indonesian Rupiah (IDR)

---

## File Structure

```
src/app/api/
├── schemas/
│   └── index.ts                    # Zod validation schemas
├── middleware/
│   ├── auth.ts                     # JWT verification
│   └── logging.ts                  # Request/response logging
├── utils.ts                        # Response helpers, error handling
├── orders/
│   ├── route.ts                    # GET /api/orders, POST /api/orders/create
│   └── [id]/
│       └── status/
│           └── route.ts            # POST /api/orders/[id]/status
├── customers/
│   └── route.ts                    # GET/POST /api/customers
├── dashboard/
│   └── kpi/
│       └── route.ts                # GET /api/dashboard/kpi
├── technicians/
│   └── route.ts                    # GET /api/technicians
└── service-records/
    └── [id]/
        └── complete/
            └── route.ts            # POST /api/service-records/[id]/complete
```
