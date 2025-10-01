You are GitHub Copilot. Generate a production-ready Admin Panel web app for a Technician Service ERP.

## 0) Tech stack & conventions
- Framework: Next.js 14 (App Router, `src/` dir), TypeScript.
- Styling: Tailwind CSS + shadcn/ui components + Lucide icons.
- State/Data fetching: TanStack Query (client) + async server actions (where needed).
- Forms/validation: React Hook Form + Zod.
- Charts: Recharts.
- Tables: TanStack Table with server-side pagination, sorting, filters.
- Auth & DB: Supabase (`@supabase/supabase-js` + `@supabase/auth-helpers-nextjs`).
- Realtime: Supabase Realtime (channels) for `orders`, `payments`, `service_records`.
- Dates: date-fns.
- Lint/format: eslint + prettier.
- Colors/theme: clean **white** base with **blue** primary (`#1e40af` / `blue-800`) and accents (`blue-600/500`). Light theme only.
- UX tone: enterprise, compact density, accessible (aria labels), keyboard friendly.

## 1) Data model (use existing Supabase tables)
Use these exact table/column names (snake_case) already present:

- `user_management(user_id, full_name, email, role, is_active, last_login, created_at, updated_at)`
  - `role` values: `SUPERADMIN`, `ADMIN`, `TECHNICIAN`, `FINANCE`
  - `is_active` boolean: TRUE = user can login, FALSE = user blocked
- `technicians(technician_id, technician_name, company, contact_number, email, created_at, updated_at)`
- `customers(customer_id, customer_name, primary_contact_person, email, phone_number, billing_address, notes, created_at, updated_at)`
- `locations(location_id, customer_id, building_name, floor, room_number, description, created_at, updated_at)`
- `ac_units(ac_unit_id, brand, model_number, serial_number, ac_type, capacity_btu, installation_date, location_id, status, last_service_date, created_at, updated_at)`
- `orders(order_id, customer_id, location_id, order_date, order_type, description, status, created_at, updated_at)`
  - `status` enum flow (transition matrix below)
- `service_records(service_id, ac_unit_id, technician_id, order_id, service_date, service_type, description_of_work, cost, next_service_due, created_at, updated_at)`
- `payments(payment_id, service_id, customer_id, payment_date, amount_paid, payment_method, transaction_id, status, created_at, updated_at)`

Add 2 new tables for configuration (generate SQL migrations and seed UI):
- `service_pricing(id uuid pk, service_type text, base_price numeric, unit text, is_active bool default true, created_at, updated_at)`
- `service_sla(id uuid pk, service_type text, response_time_minutes int, resolution_time_minutes int, created_at, updated_at)`

Status transition matrix (enforce in UI, validate in server action):
NEW→ACCEPTED/CANCELLED
ACCEPTED→ASSIGNED/CANCELLED
ASSIGNED→OTW/CANCELLED
OTW→ARRIVED/CANCELLED
ARRIVED→IN_PROGRESS/CANCELLED
IN_PROGRESS→DONE/TO_WORKSHOP/CANCELLED
DONE→INVOICED/CANCELLED
TO_WORKSHOP→IN_WORKSHOP/CANCELLED
IN_WORKSHOP→READY_TO_RETURN/CANCELLED
READY_TO_RETURN→DELIVERED/CANCELLED
DELIVERED→INVOICED/CANCELLED
INVOICED→PAID/CANCELLED
PAID→CLOSED

markdown
Copy code

## 2) Auth, roles, RLS usage
- Use Supabase Auth email+password.
- After login, read `user_management` by `email` to resolve app-role.
- Gate routes:
  - **SUPERADMIN**: full access including User Management for any role.
  - **ADMIN**: no access to SUPERADMIN/ADMIN rows in User Management; can manage `TECHNICIAN` & `FINANCE` users, CRUD masters, assign orders, dashboards.
  - **TECHNICIAN/FINANCE**: not part of this admin panel (future).
- Implement middleware to redirect unauthenticated users to `/login`.
- In queries that hit `user_management`, if app role = ADMIN, filter `role IN ('TECHNICIAN','FINANCE')`.
- NOTE: do not expose `service_role_key` to browser—only in server actions / route handlers.

## 3) Layout & theme
- Left **sidebar** fixed; header top with breadcrumbs + user menu.
- Sidebar sections (icons + labels):
  - Dashboard
  - Konfigurasi
    - Harga Service
    - SLA Service
  - Manajemen
    - User
    - AC Units
    - Teknisi
    - Lokasi Pelanggan
  - Operasional
    - Assign Order
    - Monitoring Ongoing
    - Monitoring History
    - Accept Order (post-payment)
  - Keamanan
    - Profile
- Content area: max-width fluid; use cards with subtle borders, white surfaces, blue accents.
- Provide page-level search bar + filter chip groups.

## 4) Pages & features (build all)
### /login
- Two-field form (email, password). On success, fetch `user_management` row by email to get `role`. Store role in session (cookies).
- Redirect SUPERADMIN/ADMIN to `/dashboard`.

### /dashboard
- KPI cards (clickable → deep link):
  - Total Orders (date range)
  - Ongoing Orders (statuses before INVOICED/CANCELLED/CLOSED)
  - Cancelled Orders
  - Completed Orders (DONE/DELIVERED/PAID/CLOSED)
- Charts:
  - Line chart: orders per day (range)
  - Pie chart: orders by status or order_type
- Data source: aggregate server action using Supabase SQL; subscribe realtime to `orders` and `payments` to update counts live.

### /konfigurasi/harga-service  (CRUD)
- Table with `service_pricing` (search + filters + inline edit).
- Form drawer: create/edit.
- Validation with Zod.
- Realtime update via channel on `service_pricing`.

### /konfigurasi/sla-service  (CRUD)
- Table with `service_sla` + form drawer.
- Use same patterns.

### /manajemen/user  (CRUD, role-aware)
- SUPERADMIN: full CRUD on `user_management`.
- ADMIN: can create/update users but visible options limited to roles `TECHNICIAN` and `FINANCE`. Hide SUPERADMIN/ADMIN rows.
- Columns: full_name, email, role, last_login; actions: edit, reset password (trigger Supabase magic link).

### /manajemen/ac-units  (CRUD)
- Table with search by `serial_number`/`brand` + filters by `status`.
- Drawer shows details + service history fetched from `service_records` for that unit.

### /manajemen/teknisi  (CRUD)
- Table + capacity view (count of assigned orders today). Show contact details.

### /manajemen/lokasi  (CRUD)
- Join with customers; quick create location under a customer.

### /operasional/assign-order
- Left: orders in statuses `NEW/ACCEPTED` list with search/filter (date range, customer, area).
- Right: technician list (availability today = count of service_records today).
- Action: “Assign” opens form to choose technician & schedule. On save → status transitions validated (ACCEPTED→ASSIGNED). Emit realtime.

### /operasional/monitoring-ongoing
- Cards: Total, Ongoing, Cancelled, Completed (respect date range).
- Big table of orders with sticky filters: date range, status multi-select, customer, technician.
- Row action: update status (manual) following transition matrix; show only valid next states.

### /operasional/monitoring-history
- Same as ongoing but default filter to completed/closed range.

### /operasional/accept-order
- For services with `payments.status='PAID'` and related order in `DONE/DELIVERED`: button “Accept” moves to next status (`INVOICED` or `CLOSED` according to flow).
- Ensure `service_id` linkage to `payments`.

### /profile
- Form to edit `full_name`, `email` (with reauth), and update password.
- Update `user_management` + Supabase Auth profile.

## 5) Global features
- **Search bars**: debounced text search; server-side SQL `ilike`.
- **Filters**: date range (two pickers), status chips, select customer/technician.
- **Realtime**: subscribe to `orders`, `payments`, `service_records` channels and invalidate TanStack Query caches.
- **Toasts** for success/error, confirm dialogs for destructive actions.
- **Empty states** with CTA.

## 6) API/server actions (Next.js)
Create server actions/route handlers in `src/app/api/*` that:
- Wrap Supabase server client (service role) for operations that require elevated perms (e.g., cross-role user queries, status transition validation).
- Validate transitions:
  ```ts
  const validNext = {
    NEW: ["ACCEPTED","CANCELLED"],
    ACCEPTED: ["ASSIGNED","CANCELLED"],
    ASSIGNED: ["OTW","CANCELLED"],
    OTW: ["ARRIVED","CANCELLED"],
    ARRIVED: ["IN_PROGRESS","CANCELLED"],
    IN_PROGRESS: ["DONE","TO_WORKSHOP","CANCELLED"],
    DONE: ["INVOICED","CANCELLED"],
    TO_WORKSHOP: ["IN_WORKSHOP","CANCELLED"],
    IN_WORKSHOP: ["READY_TO_RETURN","CANCELLED"],
    READY_TO_RETURN: ["DELIVERED","CANCELLED"],
    DELIVERED: ["INVOICED","CANCELLED"],
    INVOICED: ["PAID","CANCELLED"],
    PAID: ["CLOSED"]
  };
Expose endpoints:

POST /api/orders/assign → assign technician & update status.

POST /api/orders/update-status → guarded by matrix.

GET /api/dashboard/kpi?from=...&to=...

GET /api/orders?filters=... (server-side pagination).

CRUD endpoints for service_pricing, service_sla, user_management (role-aware).

7) UI components (shadcn)
Generate and use: Button, Card, Input, Label, Select, Badge, Dialog, Drawer, DropdownMenu, Table, Tabs, Tooltip, Toast, DateRangePicker (build from Popover + Calendar), Skeleton, Separator.

Build DataTable generic wrapper for TanStack Table with:

server pagination (page, pageSize)

multi-column sorting

column filters (text/select)

toolbar (search input, filter chips, export CSV)

KpiCard component props: title, value, icon, href, tone ('default'|'warning'|'success').

8) Project structure
bash
Copy code
src/
  app/
    (auth)/login/page.tsx
    dashboard/page.tsx
    konfigurasi/harga-service/page.tsx
    konfigurasi/sla-service/page.tsx
    manajemen/user/page.tsx
    manajemen/ac-units/page.tsx
    manajemen/teknisi/page.tsx
    manajemen/lokasi/page.tsx
    operasional/assign-order/page.tsx
    operasional/monitoring-ongoing/page.tsx
    operasional/monitoring-history/page.tsx
    operasional/accept-order/page.tsx
    profile/page.tsx
    api/(...handlers as above)
    layout.tsx
    globals.css
    middleware.ts   # auth gate
  components/
    kpi-card.tsx
    data-table.tsx
    search-bar.tsx
    status-badge.tsx
    order-status-stepper.tsx
    navbar.tsx
    sidebar.tsx
  lib/
    supabase-browser.ts
    supabase-server.ts
    auth.ts
    rbac.ts
    realtime.ts
  styles/
    theme.css
9) Theming (Tailwind)
Extend theme with primary blue shades. Use subtle borders (border-slate-200), background bg-white, text slate-800.

Add class helpers (e.g., cn).

Cards use slight shadows and rounded-2xl.

10) Realtime wiring (example)
Create lib/realtime.ts:

ts
Copy code
import { createClient } from "@supabase/supabase-js";
export const realtimeClient = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export function subscribeOrders(cb:(payload:any)=>void){
  const supa = realtimeClient();
  return supa.channel("orders-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, cb)
    .subscribe();
}
Use in client pages to invalidate TanStack Query caches on change.

11) Role guard
In lib/rbac.ts expose helpers:

isSuperAdmin(session), isAdmin(session).

In middleware.ts, restrict by pathname:

/manajemen/user → superadmin only; admins see only TECHNICIAN/FINANCE rows inside UI.

Other admin routes allowed for SUPERADMIN & ADMIN.

12) Docker & Compose
Create next.config.js with { output: 'standalone' }.
Dockerfile (multi-stage): build → run on port 3000 (Node 20 alpine).
docker-compose.yml example service:

VIRTUAL_HOST, LETSENCRYPT_HOST, VIRTUAL_PORT=3000 for jwilder/nginx-proxy.

env_file: .env.

13) Env vars (.env)
ini
Copy code
NEXT_PUBLIC_SUPABASE_URL=<your url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>   # server only
NODE_ENV=production
14) Acceptance criteria
All pages render with white/blue theme and sidebar layout.

Auth works; SUPERADMIN vs ADMIN gate enforced.

Config pages persist to Supabase with validation + realtime reflect.

Dashboard shows KPI (cards + line + pie) and cards link to their pages.

CRUD works for User/AC/Technician/Location with search & filters.

Assign Order page updates orders and creates/upserts service_records if needed.

Monitoring pages show cards (Total/Ongoing/Cancelled/Completed) based on chosen date range + realtime updates.

Accept Order page moves status to next step when related payments.status='PAID'.

Profile page updates name/email/password (Supabase Auth + user_management).

Global search inputs & filter chips exist on management and monitoring pages.

All long lists are server-paginated, sortable, filterable.

Docker image builds and runs node server.js on port 3000.

No secrets leaked to client; service role is used only in server routes.

15) Deliverables Copilot should generate immediately
Package.json with all deps.

Tailwind config + shadcn init (use default but blue primary).

Reusable UI components listed above.

All pages & API handlers skeletons with working examples for:

KPI fetch, orders table (server paginated), assign endpoint, status update endpoint.

Dockerfile + docker-compose.yml template.

README with setup and npx shadcn@latest init steps if needed.

IMPORTANT:

Do not ask clarifying questions. Make reasonable defaults.

Implement optimistic UI where safe; otherwise use TanStack Query invalidation on mutation success.

Use TypeScript strict mode, ESLint clean.

Keep code modular and production-grade.