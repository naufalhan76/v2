# REST API Implementation Guide

**Base URL:** `https://admin.yaleya.biz.id`

## Overview

This document outlines the REST API layer being implemented to refactor existing server actions into REST endpoints. The API provides AppSheet integration capability and standardizes data access patterns.

## Architecture

```
AppSheet/External Systems
         ↓
    REST API Layer (Next.js /api routes)
         ↓
Server Actions (Business Logic)
         ↓
Supabase (Data Layer)
```

## Implementation Status

### ✅ Completed (Phase 1)

#### Infrastructure
- **Zod Schemas** (`src/app/api/schemas/index.ts`)
  - Order validation schemas
  - Customer/Location validation
  - AC Unit validation
  - Service record validation
  - Dashboard KPI validation

- **Utilities** (`src/app/api/utils.ts`)
  - API response helpers (successResponse, errorResponse)
  - HTTP response helpers (jsonSuccess, jsonError)
  - Error handling (ApiError, handleApiError)
  - Validation error handling

- **Middleware**
  - Auth middleware (`src/app/api/middleware/auth.ts`)
    - JWT token verification from Authorization header
    - User extraction and validation
    - Role checking capability
  
  - Logging middleware (`src/app/api/middleware/logging.ts`)
    - Request/response logging with timing
    - Audit trail creation
    - Duration measurement

#### API Endpoints (Phase 1)

**Orders**
- `GET /api/orders` - List orders with filters and pagination
- `POST /api/orders/create` - Create new order
- `POST /api/orders/[id]/status` - Update order status with validation

**Customers**
- `GET /api/customers` - List customers with search
- `POST /api/customers` - Create new customer

**Dashboard**
- `GET /api/dashboard/kpi` - Fetch KPI data (total orders, ongoing, completed, etc.)

**Technicians**
- `GET /api/technicians` - List technicians with search

**Service Records**
- `POST /api/service-records/[id]/complete` - Mark service as completed

## Usage Examples

### Authentication

All endpoints require Bearer token in Authorization header:

```
Authorization: Bearer <JWT_TOKEN>
```

Get token from Supabase Auth:
```typescript
const { data: { session }, error } = await supabase.auth.getSession()
const token = session?.access_token
```

### Get Orders

```bash
GET /api/orders?page=1&limit=20&status=NEW&dateFrom=2024-01-01
Authorization: Bearer YOUR_TOKEN

Response:
{
  "success": true,
  "data": [...],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

### Create Customer

```bash
POST /api/customers
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "customerName": "PT Jakarta Service",
  "phoneNumber": "08123456789",
  "email": "contact@jakarta.com",
  "primaryContactPerson": "Budi",
  "billingAddress": "Jl. Merdeka 123, Jakarta",
  "notes": "Preferred contractor"
}

Response:
{
  "success": true,
  "data": {
    "customer_id": "uuid",
    "customer_name": "PT Jakarta Service",
    ...
  }
}
```

### Update Order Status

```bash
POST https://admin.yaleya.biz.id/api/orders/REQ%2F2026-01%2F036148/status
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "newStatus": "EN ROUTE"
}

Response:
{
  "success": true,
  "data": {
    "order_id": "REQ/2026-01/036148",
    "status": "EN ROUTE",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

**Note:** Order IDs with slashes must be URL-encoded (e.g., `REQ/2026-01/036148` becomes `REQ%2F2026-01%2F036148`)

### Get Dashboard KPI

```bash
GET /api/dashboard/kpi?dateFrom=2024-01-01&dateTo=2024-01-31
Authorization: Bearer YOUR_TOKEN

Response:
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

## Error Handling

### Response Codes

- **200 OK** - Successful GET/POST
- **201 Created** - Resource created
- **400 Bad Request** - Validation error or invalid request
- **401 Unauthorized** - Missing/invalid authentication
- **403 Forbidden** - Insufficient permissions
- **404 Not Found** - Resource not found
- **409 Conflict** - Duplicate entry (unique constraint)
- **500 Internal Server Error** - Server error

### Error Response Format

```json
{
  "success": false,
  "error": "Validation failed: customerId must be a UUID",
  "message": "[{\"field\": \"customerId\", \"message\": \"Invalid UUID\"}]"
}
```

## Status Transition Validation

Order status transitions are automatically validated:

```
NEW → [ACCEPTED, CANCELLED]
ACCEPTED → [ASSIGNED, CANCELLED]
ASSIGNED → [OTW, CANCELLED]
OTW → [ARRIVED, CANCELLED]
ARRIVED → [IN_PROGRESS, CANCELLED]
IN_PROGRESS → [DONE, TO_WORKSHOP, CANCELLED]
DONE → [INVOICED, CANCELLED]
TO_WORKSHOP → [IN_WORKSHOP, CANCELLED]
IN_WORKSHOP → [READY_TO_RETURN, CANCELLED]
READY_TO_RETURN → [DELIVERED, CANCELLED]
DELIVERED → [INVOICED, CANCELLED]
INVOICED → [PAID, CANCELLED]
PAID → [CLOSED]
```

## Logging & Audit Trail

All API requests are logged with:
- Timestamp
- HTTP method and path
- User ID (if authenticated)
- Request/response status
- Request duration (milliseconds)
- For sensitive operations: detailed audit logs with changes

Example log:
```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "method": "POST",
  "url": "POST /api/orders/550e8400-e29b-41d4-a716-446655440000/status",
  "path": "/api/orders/550e8400-e29b-41d4-a716-446655440000/status",
  "userId": "user-123",
  "status": 200,
  "duration": "125ms"
}
```

## Next Phases

### Phase 2 (Planned)
- **Locations API**
  - `POST /api/locations` - Create location
  - `GET /api/locations` - List locations
  - `PUT /api/locations/[id]` - Update location

- **AC Units API**
  - `POST /api/ac-units` - Create AC unit
  - `GET /api/ac-units` - List AC units
  - `PUT /api/ac-units/[id]` - Update AC unit

- **Service Records API**
  - `GET /api/service-records` - List service records
  - `GET /api/service-records/[id]` - Get service record detail

- **Technician Management**
  - `POST /api/technicians` - Create technician
  - `PUT /api/technicians/[id]` - Update technician
  - `GET /api/technicians/[id]/availability` - Check availability

### Phase 3 (Planned)
- **Invoicing API**
  - `POST /api/invoices` - Generate invoice
  - `GET /api/invoices` - List invoices
  - `GET /api/invoices/[id]` - Get invoice detail

- **Service Pricing API**
  - `GET /api/service-pricing` - List pricing
  - `POST /api/service-pricing` - Create pricing
  - `PUT /api/service-pricing/[id]` - Update pricing

- **User Management API** (Admin)
  - `GET /api/users` - List users (role-aware)
  - `POST /api/users` - Create user
  - `PUT /api/users/[id]` - Update user
  - `DELETE /api/users/[id]` - Delete user

### Phase 4 (Planned)
- Rate limiting middleware
- Request caching strategy
- WebSocket subscriptions for realtime updates
- OpenAPI/Swagger documentation
- API key management for external integrations

## Security Considerations

1. **Authentication**: All endpoints require Bearer token
2. **Authorization**: Token verified via Supabase Auth
3. **Validation**: All inputs validated with Zod schemas
4. **Row-Level Security**: Supabase RLS policies enforced
5. **Error Messages**: Generic error messages returned to client
6. **Audit Logging**: All changes logged for compliance
7. **Rate Limiting**: To be implemented in Phase 4

## Development Notes

### Adding a New Endpoint

1. **Define Schema** in `src/app/api/schemas/index.ts`:
   ```typescript
   export const MyActionSchema = z.object({
     field1: z.string().min(1),
     field2: z.number().positive(),
   })
   ```

2. **Create Route Handler** in `src/app/api/resource/route.ts`:
   ```typescript
   import { NextRequest } from 'next/server'
   import { myAction } from '@/lib/actions/resource'
   import { MyActionSchema } from '@/app/api/schemas'
   import { jsonSuccess, jsonError, handleApiError } from '@/app/api/utils'
   import { requireAuth } from '@/app/api/middleware/auth'

   export async function POST(request: NextRequest) {
     const user = await requireAuth(request)
     if (!user) return jsonError('Unauthorized', 401)

     const body = await request.json()
     const validation = MyActionSchema.safeParse(body)
     if (!validation.success) return handleValidationError(validation.error)

     const result = await myAction(validation.data)
     return jsonSuccess(result.data, 201)
   }
   ```

3. **Test with cURL**:
   ```bash
   curl -X POST http://localhost:3000/api/resource \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"field1": "value", "field2": 123}'
   ```

### Testing

Use Insomnia, Postman, or curl to test endpoints:

```bash
# Get token
TOKEN=$(curl -s http://localhost:3000/api/auth/token | jq -r '.token')

# Test endpoint
curl -X GET http://localhost:3000/api/orders \
  -H "Authorization: Bearer $TOKEN"
```

## References

- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Zod Schema Validation](https://zod.dev)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [REST API Best Practices](https://restfulapi.net)
