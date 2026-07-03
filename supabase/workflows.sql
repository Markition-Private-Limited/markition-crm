create table if not exists public.workflow_history (
  id uuid primary key,
  module text not null,
  entity_id text not null,
  field text not null,
  previous_status text not null,
  next_status text not null,
  actor_id text,
  actor_name text,
  actor_email text,
  reason text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.workflow_events (
  id uuid primary key,
  module text not null,
  entity_id text not null,
  label text not null,
  detail text,
  tone text not null default 'default',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.workflow_history enable row level security;
alter table public.workflow_events enable row level security;

drop policy if exists "workflow history select" on public.workflow_history;
drop policy if exists "workflow history insert" on public.workflow_history;
drop policy if exists "workflow events select" on public.workflow_events;
drop policy if exists "workflow events insert" on public.workflow_events;

create policy "workflow history select"
  on public.workflow_history
  for select
  to authenticated
  using (true);

create policy "workflow history insert"
  on public.workflow_history
  for insert
  to authenticated
  with check (true);

create policy "workflow events select"
  on public.workflow_events
  for select
  to authenticated
  using (true);

create policy "workflow events insert"
  on public.workflow_events
  for insert
  to authenticated
  with check (true);
