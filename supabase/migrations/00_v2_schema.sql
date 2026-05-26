-- =============================================================================
-- MSN ERP V2 — Full Schema for Staging
-- Built from V1 prod schema + V2 design simplifications
-- =============================================================================

-- =============================================================================
-- ENUMS
-- =============================================================================

-- 8 canonical order states (V2 design — drops NEW, ACCEPTED, EN ROUTE, ARRIVED,
-- DONE, RESCHEDULE, CLOSED). Status mapper in app code handles legacy display.
CREATE TYPE order_status AS ENUM (
  'PENDING',
  'ASSIGNED',
  'EN_ROUTE',
  'IN_PROGRESS',
  'COMPLETED',
  'INVOICED',
  'PAID',
  'CANCELLED'
);

-- Service types — all 9 from V1 kept (still valid)
CREATE TYPE service_type AS ENUM (
  'CLEANING',
  'REFILL_FREON',
  'REPAIR',
  'INSTALLATION',
  'INSPECTION',
  'MULTI_SERVICE',
  'CHECKING',
  'UNINSTALL',
  'MAINTENANCE'
);

-- 4 roles for V2 (drops DISPATCHER from V1; merged into ADMIN)
CREATE TYPE role_type AS ENUM (
  'SUPERADMIN',
  'ADMIN',
  'FINANCE',
  'TECHNICIAN'
);

-- AC unit lifecycle (drops WORKSHOP, PENDING since V2 has no workshop flow)
CREATE TYPE ac_status AS ENUM (
  'ACTIVE',
  'INACTIVE',
  'RETIRED'
);

CREATE TYPE payment_method AS ENUM (
  'CASH',
  'TRANSFER',
  'EWALLET',
  'CARD'
);

CREATE TYPE payment_status AS ENUM (
  'UNPAID',
  'PARTIAL',
  'PAID',
  'FAILED',
  'REFUNDED'
);

-- =============================================================================
-- REFERENCE / MASTER TABLES (no FKs to other app tables)
-- =============================================================================

CREATE TABLE public.ac_brands (
  brand_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.unit_types (
  unit_type_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,
  description   TEXT,
  display_order INT DEFAULT 0,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.capacity_ranges (
  capacity_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_type_id    UUID NOT NULL REFERENCES public.unit_types(unit_type_id),
  capacity_label  TEXT NOT NULL,
  display_order   INT DEFAULT 0,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.service_types (
  service_type_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code             TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  description      TEXT,
  display_order    INT DEFAULT 0,
  is_active        BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.service_catalog (
  catalog_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  msn_code          TEXT NOT NULL UNIQUE,
  unit_type_id      UUID NOT NULL REFERENCES public.unit_types(unit_type_id),
  capacity_id       UUID NOT NULL REFERENCES public.capacity_ranges(capacity_id),
  service_type_id   UUID NOT NULL REFERENCES public.service_types(service_type_id),
  service_name      TEXT NOT NULL,
  base_price        NUMERIC NOT NULL,
  includes          TEXT[],
  description       TEXT,
  duration_minutes  INT,
  is_active         BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.service_pricing (
  pricing_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type      service_type NOT NULL UNIQUE,
  service_name      TEXT NOT NULL,
  base_price        NUMERIC NOT NULL,
  includes          TEXT,
  description       TEXT,
  duration_minutes  INT DEFAULT 60,
  is_active         BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.addon_catalog (
  addon_id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category                  TEXT NOT NULL,
  item_name                 TEXT NOT NULL,
  item_code                 TEXT UNIQUE,
  description               TEXT,
  unit_of_measure           TEXT DEFAULT 'pcs',
  unit_price                NUMERIC NOT NULL,
  stock_quantity            NUMERIC DEFAULT 0,
  minimum_stock             NUMERIC DEFAULT 0,
  applicable_service_types  TEXT,
  is_active                 BOOLEAN DEFAULT TRUE,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- PEOPLE / ORG TABLES
-- =============================================================================

CREATE TABLE public.user_management (
  user_id       TEXT PRIMARY KEY DEFAULT ('MSN' || to_char(floor(random() * 10000), 'FM0000')),
  full_name     VARCHAR,
  email         VARCHAR,
  role          role_type,
  is_active     BOOLEAN DEFAULT TRUE,
  photo_url     TEXT,
  auth_user_id  UUID UNIQUE REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.technicians (
  technician_id    TEXT PRIMARY KEY DEFAULT ('TECH' || to_char(floor(random() * 10000), 'FM0000')),
  technician_name  VARCHAR NOT NULL,
  company          VARCHAR,
  contact_number   VARCHAR,
  email            VARCHAR,
  -- V2 addition: link to auth user for /technician routes (RLS uses this)
  auth_user_id     UUID UNIQUE REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.customers (
  customer_id              TEXT PRIMARY KEY DEFAULT ('CS-' || to_char(floor(random() * 10000), 'FM0000')),
  customer_name            VARCHAR,
  primary_contact_person   VARCHAR,
  email                    VARCHAR,
  phone_number             VARCHAR,
  billing_address          TEXT,
  notes                    TEXT,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.locations (
  location_id   TEXT PRIMARY KEY DEFAULT ('LOC-' || to_char(floor(random() * 10000), 'FM0000')),
  customer_id   TEXT REFERENCES public.customers(customer_id),
  full_address  VARCHAR,
  house_number  VARCHAR,
  city          VARCHAR,
  landmarks     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.ac_units (
  ac_unit_id          TEXT PRIMARY KEY DEFAULT ('AC' || to_char(floor(random() * 10000), 'FM0000')),
  location_id         TEXT REFERENCES public.locations(location_id),
  brand               VARCHAR,
  brand_id            UUID REFERENCES public.ac_brands(brand_id),
  unit_type_id        UUID REFERENCES public.unit_types(unit_type_id),
  capacity_id         UUID REFERENCES public.capacity_ranges(capacity_id),
  model_number        VARCHAR,
  serial_number       VARCHAR UNIQUE,
  ac_type             VARCHAR,
  capacity_btu        INT,
  installation_date   DATE,
  status              ac_status DEFAULT 'ACTIVE',
  last_service_date   DATE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- ORDERS
-- =============================================================================

CREATE TABLE public.orders (
  order_id                TEXT PRIMARY KEY DEFAULT ('REQ/' || to_char(NOW(), 'YYYY-MM') || '/' || to_char(floor(random() * 1000000), 'FM000000')),
  customer_id             TEXT REFERENCES public.customers(customer_id),
  location_id             TEXT REFERENCES public.locations(location_id),
  order_date              DATE NOT NULL DEFAULT CURRENT_DATE,
  order_type              service_type,
  description             TEXT,
  status                  order_status NOT NULL DEFAULT 'PENDING',
  req_visit_date          DATE,
  scheduled_visit_date    DATE,
  assigned_technician_id  TEXT REFERENCES public.technicians(technician_id),
  created_by              UUID REFERENCES auth.users(id),
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_customer ON public.orders(customer_id);
CREATE INDEX idx_orders_scheduled ON public.orders(scheduled_visit_date) WHERE status NOT IN ('PAID', 'CANCELLED');

CREATE TABLE public.order_items (
  order_item_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          TEXT NOT NULL REFERENCES public.orders(order_id) ON DELETE CASCADE,
  location_id       TEXT NOT NULL REFERENCES public.locations(location_id),
  ac_unit_id        TEXT REFERENCES public.ac_units(ac_unit_id),
  service_type      service_type NOT NULL,
  service_type_id   UUID REFERENCES public.service_types(service_type_id),
  catalog_id        UUID REFERENCES public.service_catalog(catalog_id),
  unit_type_id      UUID REFERENCES public.unit_types(unit_type_id),
  capacity_id       UUID REFERENCES public.capacity_ranges(capacity_id),
  brand_id          UUID REFERENCES public.ac_brands(brand_id),
  msn_code          TEXT,
  quantity          INT DEFAULT 1 CHECK (quantity > 0),
  description       TEXT,
  estimated_price   NUMERIC DEFAULT 0,
  actual_price      NUMERIC,
  status            order_status DEFAULT 'PENDING',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_order_items_order ON public.order_items(order_id);

CREATE TABLE public.order_addons (
  order_addon_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        TEXT NOT NULL REFERENCES public.orders(order_id) ON DELETE CASCADE,
  addon_id        UUID REFERENCES public.addon_catalog(addon_id),
  quantity        NUMERIC NOT NULL DEFAULT 1,
  unit_price      NUMERIC NOT NULL,
  total_price     NUMERIC NOT NULL,
  notes           TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.order_technicians (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        TEXT NOT NULL REFERENCES public.orders(order_id) ON DELETE CASCADE,
  technician_id   TEXT NOT NULL REFERENCES public.technicians(technician_id),
  role            VARCHAR NOT NULL CHECK (role IN ('lead', 'helper')),
  assigned_at     TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_order_technicians_order ON public.order_technicians(order_id);
CREATE INDEX idx_order_technicians_tech ON public.order_technicians(technician_id);

CREATE TABLE public.order_status_transitions (
  transition_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         TEXT REFERENCES public.orders(order_id) ON DELETE CASCADE,
  from_status      order_status NOT NULL,
  to_status        order_status NOT NULL,
  notes            TEXT,
  transition_date  TIMESTAMPTZ DEFAULT NOW(),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_order_transitions_order ON public.order_status_transitions(order_id, transition_date DESC);

-- =============================================================================
-- SERVICE REPORTS (V2 NEW — replaces service_records for technician laporan)
-- =============================================================================

CREATE TABLE public.service_reports (
  report_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                TEXT NOT NULL REFERENCES public.orders(order_id),
  technician_id           TEXT NOT NULL REFERENCES public.technicians(technician_id),

  photos_before           TEXT[] DEFAULT '{}',
  photos_after            TEXT[] DEFAULT '{}',
  materials               JSONB DEFAULT '[]',
  actual_total_price      NUMERIC(12, 2) NOT NULL,
  customer_signature_url  TEXT,
  customer_name_signed    TEXT,
  signed_at               TIMESTAMPTZ,
  notes                   TEXT,
  work_started_at         TIMESTAMPTZ,
  work_completed_at       TIMESTAMPTZ,
  submitted_at            TIMESTAMPTZ DEFAULT NOW(),
  deleted_at              TIMESTAMPTZ,

  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_service_reports_order ON public.service_reports(order_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_service_reports_technician ON public.service_reports(technician_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_service_reports_submitted ON public.service_reports(submitted_at DESC) WHERE deleted_at IS NULL;

-- Legacy table (kept for V1 compat — V2 uses service_reports instead)
CREATE TABLE public.service_records (
  service_id          TEXT PRIMARY KEY,
  ac_unit_id          TEXT REFERENCES public.ac_units(ac_unit_id),
  technician_id       TEXT REFERENCES public.technicians(technician_id),
  order_id            TEXT REFERENCES public.orders(order_id),
  order_item_id       UUID REFERENCES public.order_items(order_item_id),
  service_date        DATE,
  service_type        service_type,
  cost                NUMERIC,
  next_service_due    DATE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.service_reminders (
  reminder_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id       TEXT NOT NULL REFERENCES public.service_records(service_id),
  order_id         TEXT NOT NULL REFERENCES public.orders(order_id),
  reminder_type    TEXT DEFAULT 'WHATSAPP',
  recipient_phone  TEXT,
  message          TEXT,
  sent_by          UUID REFERENCES public.user_management(auth_user_id),
  sent_at          TIMESTAMPTZ DEFAULT NOW(),
  status           TEXT DEFAULT 'sent',
  external_id      TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INVOICES & PAYMENTS
-- =============================================================================

CREATE TABLE public.invoice_configuration (
  config_id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name                 TEXT NOT NULL,
  company_address              TEXT,
  company_phone                TEXT,
  company_email                TEXT,
  company_website              TEXT,
  npwp                         TEXT,
  tax_id                       TEXT,
  bank_accounts                TEXT,
  default_due_days             INT DEFAULT 30,
  default_tax_percentage       NUMERIC DEFAULT 11,
  invoice_prefix               TEXT DEFAULT 'INV',
  invoice_notes_template       TEXT,
  terms_conditions_template    TEXT,
  logo_url                     TEXT,
  is_active                    BOOLEAN DEFAULT TRUE,
  updated_by                   UUID REFERENCES public.user_management(auth_user_id),
  updated_at                   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.invoices (
  invoice_id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number              TEXT NOT NULL UNIQUE,
  order_id                    TEXT REFERENCES public.orders(order_id),
  customer_id                 TEXT REFERENCES public.customers(customer_id),
  invoice_date                DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date                    DATE NOT NULL,
  service_type                TEXT,
  service_name                TEXT,
  base_service_quantity       INT DEFAULT 1,
  base_service_price          NUMERIC,
  base_service_total          NUMERIC,
  addons_subtotal             NUMERIC DEFAULT 0,
  subtotal                    NUMERIC NOT NULL,
  discount_amount             NUMERIC DEFAULT 0,
  discount_percentage         NUMERIC DEFAULT 0,
  tax_percentage              NUMERIC DEFAULT 11,
  tax_amount                  NUMERIC DEFAULT 0,
  total_amount                NUMERIC NOT NULL,
  status                      TEXT NOT NULL DEFAULT 'DRAFT',
  payment_status              TEXT NOT NULL DEFAULT 'UNPAID',
  paid_amount                 NUMERIC DEFAULT 0,
  notes                       TEXT,
  terms_conditions            TEXT,
  invoice_type                TEXT NOT NULL DEFAULT 'FINAL' CHECK (invoice_type IN ('PROFORMA', 'FINAL')),
  source                      TEXT NOT NULL DEFAULT 'ORDER_LINKED' CHECK (source IN ('ORDER_LINKED', 'BLANK')),
  payment_account_id          TEXT,
  payment_account_label       TEXT,
  payment_bank_name           TEXT,
  payment_account_number      TEXT,
  payment_account_name        TEXT,
  customer_name_override      TEXT,
  customer_phone_override     TEXT,
  customer_email_override     TEXT,
  customer_address_override   TEXT,
  created_by                  UUID REFERENCES public.user_management(auth_user_id),
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_invoices_order ON public.invoices(order_id);
CREATE INDEX idx_invoices_customer ON public.invoices(customer_id);
CREATE INDEX idx_invoices_status ON public.invoices(status, payment_status);

CREATE TABLE public.invoice_items (
  item_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id       UUID NOT NULL REFERENCES public.invoices(invoice_id) ON DELETE CASCADE,
  item_type        TEXT NOT NULL,
  description      TEXT NOT NULL,
  quantity         NUMERIC NOT NULL DEFAULT 1,
  unit_price       NUMERIC NOT NULL,
  total_price      NUMERIC NOT NULL,
  service_type     TEXT,
  addon_id         UUID REFERENCES public.addon_catalog(addon_id),
  order_addon_id   UUID REFERENCES public.order_addons(order_addon_id),
  line_order       INT DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.invoice_communications (
  communication_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id            UUID NOT NULL REFERENCES public.invoices(invoice_id),
  communication_type    TEXT NOT NULL CHECK (communication_type IN ('EMAIL', 'WHATSAPP')),
  recipient             TEXT NOT NULL,
  status                TEXT DEFAULT 'sent',
  external_id           TEXT,
  error_message         TEXT,
  sent_by               UUID REFERENCES auth.users(id),
  sent_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.payment_records (
  payment_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id        UUID NOT NULL REFERENCES public.invoices(invoice_id),
  payment_date      DATE NOT NULL,
  payment_method    TEXT,
  amount            NUMERIC NOT NULL,
  reference_number  TEXT,
  notes             TEXT,
  recorded_by       UUID REFERENCES public.user_management(auth_user_id),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_payment_records_invoice ON public.payment_records(invoice_id);

-- Legacy payments table (kept for compat)
CREATE TABLE public.payments (
  payment_id      TEXT PRIMARY KEY,
  customer_id     TEXT REFERENCES public.customers(customer_id),
  service_id      TEXT REFERENCES public.service_records(service_id),
  payment_date    DATE,
  amount_paid     NUMERIC,
  payment_method  payment_method,
  status          payment_status,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- PUSH NOTIFICATIONS (V2 NEW)
-- =============================================================================

CREATE TABLE public.push_subscriptions (
  subscription_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint         TEXT NOT NULL,
  p256dh           TEXT NOT NULL,
  auth             TEXT NOT NULL,
  user_agent       TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, endpoint)
);
CREATE INDEX idx_push_subs_user ON public.push_subscriptions(user_id);

-- =============================================================================
-- MISC
-- =============================================================================

CREATE TABLE public.sheet_sync_config (
  id          INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  url         TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
