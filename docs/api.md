# REST API Reference — MSN ERP V2

> **Source of truth**: every route in `src/app/api/**/route.ts`. Each endpoint file
> carries its own JSDoc with full request/response details; this document is a
> concise map.

## Base URL

| Environment | URL |
|---|---|
| Local dev | `http://localhost:3000` |
| Local Docker | `http://127.0.0.1:3001` |
| Staging (Cloudflare tunnel) | `https://v2.nufnh.my.id` |
| Production | TBD |

All paths are relative to the base URL. Example: `GET {base}/api/orders`.

## Authentication

All endpoints require authentication **except** `/api/auth/login` and
`/api/technician/push/public-key`. Two methods are accepted:

1. **Bearer token** — `Authorization: Bearer <access_token>` (JWT from Supabase)
2. **Cookie session** — HTTP-only cookies set by the Supabase SSR client
   (used by browser and Playwright `page.request`)

Most admin routes verify auth via `requireAuth(request)` which checks the
`Authorization` header first, then falls back to the cookie session. Technician
routes use `authenticateTechnician(request)` which additionally resolves
`technicianId` from the `user_management` → `technicians` chain.

## RBAC

| Role | Access scope |
|---|---|
| `SUPERADMIN` | Full access to all endpoints |
| `ADMIN` | Orders, customers, AC units, invoices, technicians, dashboard, admin |
| `FINANCE` | Read invoices; `PATCH /api/orders/[id]` only with `status: INVOICED\|PAID` |
| `TECHNICIAN` | Blocked from all admin endpoints; uses `/api/technician/*` only |

Role is read from `user_management.role` for the authenticated user. Endpoints
that require a specific role return `403 Forbidden` when the caller does not
match.

## Response format

Every response is JSON with a top-level envelope:

### Success
```json
{
  "success": true,
  "data": { /* endpoint-specific */ },
  "pagination": { "total": 150, "page": 1, "limit": 20, "totalPages": 8 } // optional
}
```

### Error
```json
{ "success": false, "error": "Human-readable message" }
```

| Status | Meaning |
|---|---|
| `200` | OK |
| `201` | Created |
| `400` | Validation error / bad input |
| `401` | Missing or invalid authentication |
| `403` | Authenticated but role not allowed |
| `404` | Resource not found |
| `409` | Concurrent modification (state changed since read) |
| `422` | Business rule violation (e.g. invalid state transition) |
| `500` | Unexpected server error |
| `501` | Endpoint not yet implemented |

## Endpoint summary

| Method | Path | Auth | Role | Notes |
|---|---|---|---|---|
| POST | `/api/auth/login` | none | any | Get JWT |
| POST | `/api/auth/api-key` | n/a | n/a | **501** Not implemented |
| GET | `/api/orders` | required | admin | List + filter + paginate |
| POST | `/api/orders/create` | required | admin | Create order + items |
| PATCH | `/api/orders/[id]` | required | admin/finance | Unified mutation: cancel/assign/reschedule/status |
| POST | `/api/orders/[id]/status` | required | admin | Legacy status update |
| GET | `/api/customers` | required | admin | List + search |
| POST | `/api/customers` | required | admin | Create |
| PUT | `/api/customers/[id]` | required | superadmin/admin | Update |
| DELETE | `/api/customers/[id]` | required | superadmin/admin | Hard delete |
| GET | `/api/ac-units` | required | admin | List + filter by location |
| POST | `/api/ac-units` | required | admin | Create |
| GET | `/api/ac-units/[id]` | required | admin | Get one |
| PUT | `/api/ac-units/[id]` | required | admin | Update |
| DELETE | `/api/ac-units/[id]` | required | admin | Hard delete |
| GET | `/api/invoices` | required | finance+ | List; `?orderId=...` filters to one order |
| POST | `/api/invoices/send-email` | required | finance+ | Send invoice email via Resend |
| POST | `/api/service-records/[id]/complete` | required | technician | **501** — use `/api/technician/jobs/[...id]/report` |
| GET | `/api/service-reports` | required | admin/tech | `?orderId=...` required |
| GET | `/api/service-reports/[reportId]/signature` | required | admin/tech | Returns signed URL for stored signature |
| GET | `/api/technicians` | required | admin | List + search |
| GET | `/api/technician/jobs/today` | required | technician | Today's ASSIGNED/EN_ROUTE/IN_PROGRESS |
| GET | `/api/technician/jobs/[...id]` | required | technician | Order detail; custom order IDs like `REQ/2026-01/036148` are URL-encoded |
| POST | `/api/technician/jobs/[...id]/transition` | required | technician (lead) | Status transition w/ idempotency, GPS, arrival photos |
| POST | `/api/technician/jobs/[...id]/report` | required | technician (lead) | Submit service report via RPC |
| GET | `/api/technician/history` | required | technician | Past jobs, paginated |
| GET | `/api/technician/push/public-key` | **none** | any | VAPID public key (intentionally public) |
| POST | `/api/technician/push/subscribe` | required | technician | Upsert push subscription |
| DELETE | `/api/technician/push/unsubscribe` | required | technician | Remove push subscription |
| GET | `/api/dashboard/kpi` | required | admin | KPI counts + revenue |
| POST | `/api/admin/reminders/run` | required | superadmin/admin **or** `CRON_SECRET` | Generate reminders for due AC units |

---

## Authentication

### `POST /api/auth/login`

Exchange email + password for a Supabase JWT.

**Request body**
```json
{ "email": "admin@example.com", "password": "••••••••" }
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOi...",
    "user": { "id": "uuid", "email": "admin@example.com", "created_at": "..." }
  }
}
```

**Errors**: `400` validation, `401` invalid credentials.

### `POST /api/auth/api-key`

Returns `501 Not Implemented`. Reserved for future API key auth.

---

## Orders

### `GET /api/orders`

List orders with optional filters and pagination. Returns canonical
`status` and includes joined customer, items, assignments, reports.

**Query parameters**

| Name | Type | Default | Notes |
|---|---|---|---|
| `status` | string | – | Single status filter |
| `statusIn` | string (csv) | – | Multiple statuses, comma-separated |
| `customerId` | uuid | – | |
| `technician_id` | uuid | – | |
| `dateFrom` | ISO datetime | – | |
| `dateTo` | ISO datetime | – | |
| `page` | int | `1` | |
| `limit` | int | `20` | |

**Response 200**
```json
{ "success": true, "data": [ ... ], "pagination": { ... } }
```

### `POST /api/orders/create`

Create an order. Caller is the **admin client** (RLS bypassed for the create).
Order items are inserted in a follow-up call — a failure there returns `500`
with the order already created.

**Request body**
```json
{
  "customerId": "uuid",
  "locationId": "uuid",
  "orderType": "MAINTENANCE",
  "description": "optional",
  "items": [
    { "serviceType": "CLEANING", "quantity": 1, "estimatedPrice": 500000 }
  ]
}
```

**Response 201**: `{ success: true, data: { order_id, status, ... } }`

### `PATCH /api/orders/[id]`

**Unified order mutation** endpoint. The server dispatches based on the
combination of fields in the body. The path `id` can be a UUID or a custom
order ID (e.g. `REQ/2026-01/036148`) — must be URL-encoded.

**Dispatch rules**

| Body | Action |
|---|---|
| `status: "CANCELLED"` | `cancelOrder(reason)` |
| `status: "ASSIGNED"` + `assigned_technician_id` | `assignOrdersToTechnician` |
| `status: "PENDING"` + `scheduled_visit_date` | `rescheduleOrder` |
| `status: <other>` | `updateOrderStatus` |

**RBAC**

- `TECHNICIAN` → `403`
- `FINANCE` → may only set `status: "INVOICED" | "PAID"`, otherwise `403`
- `ADMIN` / `SUPERADMIN` → all operations

**Request body**
```json
{
  "status": "ASSIGNED",
  "assigned_technician_id": "uuid",
  "scheduled_visit_date": "2026-06-10",
  "req_visit_date": "2026-06-10T09:00:00Z",
  "cancellation_reason": "optional"
}
```

**Errors**: `400` no actionable fields, `403` role blocked, `409` concurrent
modification, `422` invalid state transition.

### `POST /api/orders/[id]/status`

Legacy endpoint. Calls `updateOrderStatus` directly. New integrations should
prefer `PATCH /api/orders/[id]`.

**Request body**
```json
{ "newStatus": "EN_ROUTE", "req_visit_date": "2026-06-10T09:00:00Z" }
```

---

## Customers

### `GET /api/customers`

**Query**: `search?`, `page?`, `limit?`. Searches `customer_name`,
`primary_contact_person`, `phone_number`, `email`, `billing_address`. Returns
each customer with their `locations` array embedded.

### `POST /api/customers`

**Request body**
```json
{
  "customerName": "PT Jakarta Service",
  "primaryContactPerson": "Budi Santoso",
  "phoneNumber": "08123456789",
  "email": "contact@jakarta.com",
  "billingAddress": "Jl. Merdeka 123, Jakarta",
  "notes": "optional"
}
```

### `PUT /api/customers/[id]`

**RBAC**: `SUPERADMIN` or `ADMIN`. **Request body** (all fields optional):
`customer_name`, `primary_contact_person`, `phone_number`, `email`,
`billing_address`, `notes`.

### `DELETE /api/customers/[id]`

**RBAC**: `SUPERADMIN` or `ADMIN`. Hard delete via `customers.customer_id`.
Returns `400` on FK constraint or `404` if not found.

---

## AC Units

### `GET /api/ac-units`

**Query**: `page?`, `limit?`, `search?` (brand/model), `location_id?`.

### `POST /api/ac-units`

**Request body**
```json
{
  "location_id": "uuid",
  "brand": "Daikin",
  "model_number": "FTXV35M",
  "serial_number": "SN123456",
  "ac_type": "WALL_MOUNTED",
  "capacity_btu": 12000,
  "installation_date": "2023-01-15T00:00:00Z",
  "status": "ACTIVE"
}
```

### `GET /api/ac-units/[id]`

`id` is the `ac_unit_id` (e.g. `AC-001`). `404` if not found.

### `PUT /api/ac-units/[id]`

**Request body** (all fields optional): `brand`, `model_number`,
`serial_number`, `ac_type`, `capacity_btu`, `installation_date`, `status`.

### `DELETE /api/ac-units/[id]`

Hard delete. `404` if not found.

---

## Invoices

### `GET /api/invoices`

**RBAC**: `FINANCE`, `ADMIN`, `SUPERADMIN`.

**Query**: `orderId?` — when provided, returns only invoices for that order;
otherwise returns all invoices ordered by `created_at DESC`. Each invoice is
augmented with a computed `source` field (`FINAL` / `PROFORMA` / `OTHER`)
from `getInvoiceSource()`.

**Response 200**
```json
{ "data": [ { "invoice_id": "uuid", "invoice_number": "INV/2026/...", "status": "SENT", "source": "FINAL", ... } ] }
```

### `POST /api/invoices/send-email`

**RBAC**: `FINANCE`, `ADMIN`, `SUPERADMIN`. **Requires** `RESEND_API_KEY` in
env. Renders a full HTML invoice email with bank account info from
`invoice_configuration`, calculates remaining balance from `payment_records`,
and sends via Resend. Validates that the company email domain is verified
(falls back to `noreply@yaleya.biz.id` for common providers like gmail/yahoo).

**Request body**
```json
{ "invoiceId": "uuid" }
```

**Response 200**
```json
{ "success": true, "message": "Email sent successfully", "emailId": "resend-..." }
```

**Errors**: `400` invoice id missing / customer email missing, `404` invoice
not found, `500` Resend error.

Side effect: a row is written to `invoice_communications` (type `EMAIL`).

---

## Service records & reports

### `POST /api/service-records/[id]/complete`

Returns `501 Not Implemented`. Use
`POST /api/technician/jobs/{orderId}/report` instead.

### `GET /api/service-reports?orderId=...`

**Auth**: any authenticated user (RLS scopes which reports are visible).

**Query**: `orderId` (**required**).

**Response 200**
```json
{ "success": true, "data": { /* report + items + photos + signature */ } }
```

### `GET /api/service-reports/[reportId]/signature`

Returns a short-lived signed URL for the stored signature image
(supabase storage). RLS on `service_reports` gates which `reportId` the
caller may read; if the row is not visible the `signedUrl` will be `null`.

**Response 200**
```json
{ "success": true, "data": { "signedUrl": "https://..." } }
```

---

## Technicians (admin)

### `GET /api/technicians`

**Query**: `search?`, `page?`, `limit?`. Returns technicians with their
`total_orders` count.

---

## Technician app

All endpoints in this section require `authenticateTechnician(request)` which
returns `401` if the user is not a technician and `403` if they are not
assigned to the requested order.

### `GET /api/technician/jobs/today`

Returns today's assigned jobs in `ASSIGNED`, `EN_ROUTE`, `IN_PROGRESS`.

**Query**: `date?` (`YYYY-MM-DD`, defaults to server UTC date). To avoid
UTC/local midnight mismatches, prefer passing the client-local date.

**Response 200**: `data` includes joined `customers`, `order_items` (with
nested `locations` and `ac_units`).

### `GET /api/technician/jobs/[...id]`

The `[...id]` catch-all preserves custom order IDs that contain slashes
(e.g. `REQ/2026-01/036148`). The route URL-encodes each segment and joins
them back with `/` server-side.

**Response 200** includes `canonical_status` (normalized for the client)
and `has_report` / `report_id` flags so the PWA can decide whether to
show the report form.

### `POST /api/technician/jobs/[...id]/transition`

**RBAC**: lead technician only (other helpers on the order get `403`).

State transition with idempotency, GPS capture, and arrival photo
requirements.

**Request body**
```json
{
  "to_status": "IN_PROGRESS",
  "idempotency_key": "client-uuid",
  "gps": { "lat": -6.2, "lng": 106.8, "accuracy_m": 12.5, "captured_at": "..." },
  "arrival_photos": ["storage-path-1", "storage-path-2"]
}
```

**Special rules**

- `to_status: "IN_PROGRESS"` requires `arrival_photos` (1–3)
- `idempotency_key` makes the call safe to retry: replays return the
  previously committed status
- If a concurrent transition wins, returns `409 Conflict`
- Invalid transitions (e.g. `COMPLETED → ASSIGNED`) return `422`

**Response 200**
```json
{ "success": true, "data": { "order_id": "...", "previous_status": "EN_ROUTE", "new_status": "IN_PROGRESS" } }
```

### `POST /api/technician/jobs/[...id]/report`

**RBAC**: lead technician only. Submits the full service report via the
`technician_submit_report_v2` RPC.

**Request body**: validated against `TechnicianReportSchema` — includes
items, materials, before/after photos, signature, `idempotency_key`. See
`src/app/api/schemas/technician.ts` for the exact shape.

**Response 200**
```json
{ "success": true, "data": { "report_id": "uuid", "status": "COMPLETED" } }
```

**Errors**: `422` (RPC `P0001`) when the order is not in `IN_PROGRESS` or
the payload violates business rules; `409` on idempotency replay.

### `GET /api/technician/history`

**Query**: `page?` (default 1), `limit?` (default 10, max 50),
`status?` (csv, e.g. `COMPLETED,PAID,CANCELLED`).

**Response 200** includes `data[]` with `canonical_status` and
`pagination`.

### `GET /api/technician/push/public-key`

**No auth required** — the VAPID public key is meant to be public; gating
it would not add real security. Used by the service worker on
`pushsubscriptionchange`.

**Response 200**
```json
{ "publicKey": "BFvHf0gtjv..." }
```

### `POST /api/technician/push/subscribe`

Upserts on `(user_id, endpoint)` so re-subscribing is idempotent.

**Request body**
```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/...",
  "keys": { "p256dh": "...", "auth": "..." },
  "userAgent": "optional"
}
```

### `DELETE /api/technician/push/unsubscribe`

**Request body**
```json
{ "endpoint": "https://fcm.googleapis.com/fcm/send/..." }
```

Idempotent — deleting a missing row returns success.

---

## Dashboard

### `GET /api/dashboard/kpi`

**RBAC**: `ADMIN`, `SUPERADMIN`. Computed in `getDashboardKpis()`.

**Query**: `dateFrom?`, `dateTo?`, `customerId?`, `technicianId?`.

**Response 200**
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

## Admin

### `POST /api/admin/reminders/run`

Generates reminder rows for AC units that are due for service, warranty
expiry, etc. Intended for both manual admin invocation and scheduled cron.

**Auth** (one of):
- `Authorization: Bearer <CRON_SECRET>` — only when `CRON_SECRET` env is set
  (constant-time compared)
- Authenticated `SUPERADMIN` or `ADMIN` session (cookie or Bearer JWT)

**Request body**: none.

**Response 200**
```json
{ "success": true, "data": { "generated_count": 12, "skipped_count": 3 } }
```

**Errors**: `403` unauthorized, `500` reminder generation failed.

Wire this into cron with:

```bash
curl -X POST https://v2.nufnh.my.id/api/admin/reminders/run \
  -H "Authorization: Bearer $CRON_SECRET"
```

See `docs/CRON-SETUP.md` for the full schedule and `docs/REMINDER-SYSTEM.md`
for the data flow.
