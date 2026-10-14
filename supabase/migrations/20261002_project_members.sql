-- project_members join table
create table if not exists project_members (
  id            uuid        primary key default gen_random_uuid(),
  project_id    uuid        not null references projects(id) on delete cascade,
  user_id       uuid        not null references profiles(id) on delete cascade,
  role_in_project text      not null default 'Member',
  created_at    timestamptz not null default now(),
  unique (project_id, user_id)
);

alter table project_members enable row level security;
create policy "pm_authenticated_all" on project_members
  for all to authenticated using (true) with check (true);

-- audit_logs RLS (table already exists, add policies)
alter table audit_logs enable row level security;

drop policy if exists "audit_authenticated_insert" on audit_logs;
drop policy if exists "audit_authenticated_select" on audit_logs;

create policy "audit_authenticated_insert" on audit_logs
  for insert to authenticated with check (true);

create policy "audit_authenticated_select" on audit_logs
  for select to authenticated using (true);
