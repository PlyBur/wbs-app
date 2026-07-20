-- Payment terms defaults on workspaces
alter table workspaces add column if not exists terms_deposit_pct numeric(5,2) default 60;
alter table workspaces add column if not exists terms_deposit_label text default 'Deposit';
alter table workspaces add column if not exists terms_progress_pct numeric(5,2) default 35;
alter table workspaces add column if not exists terms_progress_label text default 'Progress payment';
alter table workspaces add column if not exists terms_final_pct numeric(5,2) default 5;
alter table workspaces add column if not exists terms_final_label text default 'Final payment on completion';

-- Payment terms on quotes
alter table quotes add column if not exists terms_enabled boolean default false;
alter table quotes add column if not exists terms_deposit_pct numeric(5,2);
alter table quotes add column if not exists terms_deposit_label text;
alter table quotes add column if not exists terms_progress_pct numeric(5,2);
alter table quotes add column if not exists terms_progress_label text;
alter table quotes add column if not exists terms_final_pct numeric(5,2);
alter table quotes add column if not exists terms_final_label text;

-- Client interaction log per project
create table if not exists project_interactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  project_id uuid references projects(id) on delete cascade not null,
  interaction_date date not null default current_date,
  type text not null default 'call', -- call | email | whatsapp | site_visit | meeting | other
  contact_person text,
  summary text not null,
  next_action text,
  next_action_date date,
  created_at timestamptz default now()
);

alter table project_interactions enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'Project interactions workspace access' and tablename = 'project_interactions') then
    create policy "Project interactions workspace access" on project_interactions
      using (workspace_id in (select id from workspaces where owner_id = auth.uid()));
  end if;
end $$;

create index if not exists project_interactions_project_id_idx on project_interactions(project_id);

-- Project expenses / cost of sale
create table if not exists project_expenses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  project_id uuid references projects(id) on delete cascade not null,
  expense_date date not null default current_date,
  category text not null default 'materials', -- materials | labour | equipment | subcontract | transport | software | other
  description text not null,
  supplier text,
  quantity numeric(10,2) not null default 1,
  unit_cost numeric(10,2) not null default 0,
  notes text,
  created_at timestamptz default now()
);

alter table project_expenses enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'Project expenses workspace access' and tablename = 'project_expenses') then
    create policy "Project expenses workspace access" on project_expenses
      using (workspace_id in (select id from workspaces where owner_id = auth.uid()));
  end if;
end $$;

create index if not exists project_expenses_project_id_idx on project_expenses(project_id);
