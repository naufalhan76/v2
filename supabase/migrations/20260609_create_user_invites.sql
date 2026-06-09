create type invite_status as enum ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');

create table user_invites (
  invite_id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null check (role in ('SUPERADMIN', 'ADMIN', 'FINANCE', 'TECHNICIAN')),
  status invite_status not null default 'PENDING',
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  last_sent_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index user_invites_one_pending_per_email
  on user_invites (lower(email))
  where status = 'PENDING';
