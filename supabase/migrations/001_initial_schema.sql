-- ============================================================
-- Whistle Business Suite — Initial Schema
-- Run this in Supabase SQL editor or via: supabase db push
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- WORKSPACES (multi-tenant root)
-- ============================================================
create table if not exists workspaces (
  id                    uuid primary key default uuid_generate_v4(),
  name                  text not null,
  slug                  text unique,
  owner_id              uuid references auth.users(id) on delete cascade,
  email                 text,
  phone                 text,
  website               text,
  logo_url              text,
  address_line1         text,
  address_city          text,
  address_province      text,
  address_postal_code   text,
  registration_number   text,
  vat_number            text,
  default_vat_rate      numeric(5,2) not null default 15,
  quote_expiry_days     int not null default 30,
  travel_free_radius_km numeric(10,2) default 20,
  travel_cost_per_km    numeric(10,2) default 4.50,
  bank_name             text,
  bank_account_holder   text,
  bank_account_number   text,
  bank_branch_code      text,
  invoice_due_days      int not null default 30,
  created_at            timestamptz not null default now()
);

alter table workspaces enable row level security;
create policy "Workspace owner access" on workspaces
  using (owner_id = auth.uid());

-- ============================================================
-- TEAM MEMBERS
-- ============================================================
create table if not exists team_members (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete set null,
  name          text not null,
  email         text not null,
  phone         text,
  role          text not null default 'technician',  -- owner | admin | manager | technician | viewer
  status        text not null default 'invited',     -- invited | active | inactive
  avatar_url    text,
  created_at    timestamptz not null default now()
);

alter table team_members enable row level security;
create policy "Team member workspace access" on team_members
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));

-- ============================================================
-- CLIENTS
-- ============================================================
create table if not exists clients (
  id                  uuid primary key default uuid_generate_v4(),
  workspace_id        uuid not null references workspaces(id) on delete cascade,
  name                text not null,
  client_type         text not null default 'individual',  -- individual | business
  company             text,
  email               text,
  phone               text,
  whatsapp_number     text,
  vat_number          text,
  address_line1       text,
  address_line2       text,
  address_city        text,
  address_province    text,
  address_postal_code text,
  gps_lat             numeric(10,7),
  gps_lng             numeric(10,7),
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table clients enable row level security;
create policy "Client workspace access" on clients
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));

-- ============================================================
-- PRODUCTS
-- ============================================================
create table if not exists products (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  name          text not null,
  sku           text,
  description   text,
  unit_price    numeric(12,2) not null default 0,
  unit          text default 'unit',
  cost_price    numeric(12,2),
  is_taxable    boolean not null default true,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

alter table products enable row level security;
create policy "Product workspace access" on products
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));

-- ============================================================
-- SERVICES
-- ============================================================
create table if not exists services (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  name          text not null,
  description   text,
  default_rate  numeric(12,2) not null default 0,
  unit          text default 'hr',
  pricing_type  text not null default 'hourly',  -- hourly | fixed | per_unit
  is_taxable    boolean not null default true,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

alter table services enable row level security;
create policy "Service workspace access" on services
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));

-- ============================================================
-- QUOTES
-- ============================================================
create table if not exists quotes (
  id               uuid primary key default uuid_generate_v4(),
  workspace_id     uuid not null references workspaces(id) on delete cascade,
  client_id        uuid references clients(id) on delete set null,
  doc_number       text,
  status           text not null default 'draft',  -- draft | sent | accepted | declined | expired
  notes            text,
  terms            text,
  subtotal         numeric(12,2) not null default 0,
  travel_cost      numeric(12,2) not null default 0,
  discount_amount  numeric(12,2) not null default 0,
  vat_rate         numeric(5,2) not null default 15,
  vat_amount       numeric(12,2) not null default 0,
  total            numeric(12,2) not null default 0,
  expires_at       timestamptz,
  sent_at          timestamptz,
  accepted_at      timestamptz,
  public_token     text unique default encode(gen_random_bytes(24), 'hex'),
  created_by       uuid references team_members(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table quotes enable row level security;
create policy "Quote workspace access" on quotes
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));
-- Public token read (no auth required for client-facing page)
create policy "Quote public token read" on quotes
  for select using (public_token is not null);

create sequence if not exists quote_seq;

-- ============================================================
-- QUOTE LINE ITEMS
-- ============================================================
create table if not exists quote_line_items (
  id           uuid primary key default uuid_generate_v4(),
  quote_id     uuid not null references quotes(id) on delete cascade,
  item_type    text not null default 'product',  -- product | service | custom
  product_id   uuid references products(id) on delete set null,
  service_id   uuid references services(id) on delete set null,
  description  text not null,
  quantity     numeric(10,3) not null default 1,
  unit_price   numeric(12,2) not null default 0,
  is_taxable   boolean not null default true,
  notes        text,
  sort_order   int not null default 0
);

alter table quote_line_items enable row level security;
create policy "Quote line item access" on quote_line_items
  using (quote_id in (select id from quotes where workspace_id in (select id from workspaces where owner_id = auth.uid())));

-- ============================================================
-- PROJECTS
-- ============================================================
create table if not exists projects (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  quote_id        uuid references quotes(id) on delete set null,
  client_id       uuid references clients(id) on delete set null,
  doc_number      text,
  title           text not null,
  description     text,
  status          text not null default 'pending',  -- pending | active | on_hold | completed
  start_date      date,
  due_date        date,
  completed_date  date,
  address         text,
  gps_lat         numeric(10,7),
  gps_lng         numeric(10,7),
  completion_pct  int not null default 0,
  assigned_to     uuid references team_members(id) on delete set null,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table projects enable row level security;
create policy "Project workspace access" on projects
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));

create sequence if not exists project_seq;

-- ============================================================
-- PROJECT TASKS
-- ============================================================
create table if not exists project_tasks (
  id            uuid primary key default uuid_generate_v4(),
  project_id    uuid not null references projects(id) on delete cascade,
  title         text not null,
  description   text,
  status        text not null default 'todo',  -- todo | in_progress | done
  assigned_to   uuid references team_members(id) on delete set null,
  due_date      date,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

alter table project_tasks enable row level security;
create policy "Project task access" on project_tasks
  using (project_id in (select id from projects where workspace_id in (select id from workspaces where owner_id = auth.uid())));

-- ============================================================
-- PROJECT IMAGES
-- ============================================================
create table if not exists project_images (
  id            uuid primary key default uuid_generate_v4(),
  project_id    uuid not null references projects(id) on delete cascade,
  storage_path  text not null,
  caption       text,
  phase         text default 'during',  -- before | during | after
  uploaded_by   uuid references team_members(id) on delete set null,
  uploaded_at   timestamptz not null default now()
);

alter table project_images enable row level security;
create policy "Project image access" on project_images
  using (project_id in (select id from projects where workspace_id in (select id from workspaces where owner_id = auth.uid())));

-- ============================================================
-- PROJECT ACTIVITY LOG
-- ============================================================
create table if not exists project_activity (
  id              uuid primary key default uuid_generate_v4(),
  project_id      uuid not null references projects(id) on delete cascade,
  team_member_id  uuid references team_members(id) on delete set null,
  activity_type   text not null default 'note',  -- note | status_change | task_done | image_upload | invoice_sent
  body            text not null,
  metadata        jsonb,
  created_at      timestamptz not null default now()
);

alter table project_activity enable row level security;
create policy "Project activity access" on project_activity
  using (project_id in (select id from projects where workspace_id in (select id from workspaces where owner_id = auth.uid())));

-- ============================================================
-- INVOICES
-- ============================================================
create table if not exists invoices (
  id               uuid primary key default uuid_generate_v4(),
  workspace_id     uuid not null references workspaces(id) on delete cascade,
  project_id       uuid references projects(id) on delete set null,
  client_id        uuid references clients(id) on delete set null,
  doc_number       text,
  status           text not null default 'draft',  -- draft | sent | paid | overdue | cancelled
  notes            text,
  terms            text,
  subtotal         numeric(12,2) not null default 0,
  travel_cost      numeric(12,2) not null default 0,
  discount_amount  numeric(12,2) not null default 0,
  vat_rate         numeric(5,2) not null default 15,
  vat_amount       numeric(12,2) not null default 0,
  total            numeric(12,2) not null default 0,
  amount_paid      numeric(12,2) not null default 0,
  due_date         date,
  sent_at          timestamptz,
  paid_at          timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table invoices enable row level security;
create policy "Invoice workspace access" on invoices
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));

create sequence if not exists invoice_seq;

-- ============================================================
-- INVOICE LINE ITEMS
-- ============================================================
create table if not exists invoice_line_items (
  id           uuid primary key default uuid_generate_v4(),
  invoice_id   uuid not null references invoices(id) on delete cascade,
  item_type    text not null default 'product',
  product_id   uuid references products(id) on delete set null,
  service_id   uuid references services(id) on delete set null,
  description  text not null,
  quantity     numeric(10,3) not null default 1,
  unit_price   numeric(12,2) not null default 0,
  is_taxable   boolean not null default true,
  notes        text,
  sort_order   int not null default 0
);

alter table invoice_line_items enable row level security;
create policy "Invoice line item access" on invoice_line_items
  using (invoice_id in (select id from invoices where workspace_id in (select id from workspaces where owner_id = auth.uid())));

-- ============================================================
-- PAYMENTS
-- ============================================================
create table if not exists payments (
  id          uuid primary key default uuid_generate_v4(),
  invoice_id  uuid not null references invoices(id) on delete cascade,
  amount      numeric(12,2) not null,
  method      text default 'eft',  -- eft | cash | card | other
  reference   text,
  notes       text,
  paid_at     timestamptz not null default now()
);

alter table payments enable row level security;
create policy "Payment access" on payments
  using (invoice_id in (select id from invoices where workspace_id in (select id from workspaces where owner_id = auth.uid())));

-- ============================================================
-- CALENDAR EVENTS
-- ============================================================
create table if not exists calendar_events (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  project_id      uuid references projects(id) on delete set null,
  client_id       uuid references clients(id) on delete set null,
  assigned_to     uuid references team_members(id) on delete set null,
  title           text not null,
  description     text,
  event_type      text default 'site_visit',  -- site_visit | meeting | delivery | reminder | other
  start_at        timestamptz not null,
  end_at          timestamptz,
  all_day         boolean not null default false,
  location        text,
  created_at      timestamptz not null default now()
);

alter table calendar_events enable row level security;
create policy "Calendar event workspace access" on calendar_events
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));

-- ============================================================
-- WHATSAPP MESSAGES
-- ============================================================
create table if not exists whatsapp_messages (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  client_id       uuid references clients(id) on delete set null,
  wa_message_id   text,
  direction       text not null default 'inbound',  -- inbound | outbound
  message_type    text not null default 'text',     -- text | audio | image | document
  from_number     text,
  to_number       text,
  body            text,
  media_url       text,
  transcription   text,  -- AI transcription of voice notes
  is_read         boolean not null default false,
  received_at     timestamptz not null default now()
);

alter table whatsapp_messages enable row level security;
create policy "WhatsApp message workspace access" on whatsapp_messages
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));

-- ============================================================
-- DOCUMENT NUMBER TRIGGERS
-- ============================================================

create or replace function assign_quote_number()
returns trigger language plpgsql as $$
begin
  if new.doc_number is null then
    new.doc_number := 'QTE-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('quote_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

create trigger set_quote_number before insert on quotes
  for each row execute function assign_quote_number();

create or replace function assign_project_number()
returns trigger language plpgsql as $$
begin
  if new.doc_number is null then
    new.doc_number := 'PRJ-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('project_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

create trigger set_project_number before insert on projects
  for each row execute function assign_project_number();

create or replace function assign_invoice_number()
returns trigger language plpgsql as $$
begin
  if new.doc_number is null then
    new.doc_number := 'INV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('invoice_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

create trigger set_invoice_number before insert on invoices
  for each row execute function assign_invoice_number();

-- Auto-update updated_at
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger touch_quotes_updated_at before update on quotes
  for each row execute function touch_updated_at();
create trigger touch_projects_updated_at before update on projects
  for each row execute function touch_updated_at();
create trigger touch_invoices_updated_at before update on invoices
  for each row execute function touch_updated_at();
create trigger touch_clients_updated_at before update on clients
  for each row execute function touch_updated_at();

-- ============================================================
-- INDEXES for common query patterns
-- ============================================================
create index if not exists idx_quotes_workspace on quotes(workspace_id);
create index if not exists idx_quotes_client on quotes(client_id);
create index if not exists idx_quotes_status on quotes(status);
create index if not exists idx_quotes_public_token on quotes(public_token);
create index if not exists idx_projects_workspace on projects(workspace_id);
create index if not exists idx_projects_client on projects(client_id);
create index if not exists idx_projects_status on projects(status);
create index if not exists idx_invoices_workspace on invoices(workspace_id);
create index if not exists idx_invoices_status on invoices(status);
create index if not exists idx_clients_workspace on clients(workspace_id);
create index if not exists idx_project_tasks_project on project_tasks(project_id);
create index if not exists idx_project_activity_project on project_activity(project_id);
create index if not exists idx_calendar_events_start on calendar_events(start_at);
create index if not exists idx_whatsapp_messages_workspace on whatsapp_messages(workspace_id);
