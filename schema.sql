-- Run this once in Supabase: Project -> SQL Editor -> New query -> paste -> Run
--
-- If you already ran an earlier version of this schema, run just these
-- migration lines instead of the whole script:
--   alter table models add column if not exists per_pallet numeric;
--   alter table jobs add column if not exists installation_date date;
--   alter table jobs add column if not exists reference text;
--   alter table movements add column if not exists performed_by text;
--   alter table stock drop column if exists edits;
--   alter table jobs drop column if exists edits;

create extension if not exists pgcrypto;

create table if not exists owners (
  id text primary key,
  name text not null
);

create table if not exists stock (
  id uuid primary key default gen_random_uuid(),
  category text not null,               -- panel | inverter | battery
  brand text not null,
  quantity numeric not null default 0,
  owner_id text references owners(id),
  wattage numeric,
  cost numeric,
  kw numeric,
  inv_type text,
  batt_type text,
  shipment_date date,
  reference text,
  created_at timestamptz not null default now()
);

create table if not exists models (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  brand text not null,
  wattage numeric,
  cost numeric,
  kw numeric,
  inv_type text,
  batt_type text,
  per_pallet numeric                    -- panels per pallet (panel presets only)
);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id text references owners(id),
  date date,
  installation_date date,
  reference text,
  notes text,
  items jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table if not exists movements (
  id uuid primary key default gen_random_uuid(),
  type text not null,                   -- in | out | adjust | transfer
  category text not null,
  brand text,
  wattage numeric,
  kw numeric,
  inv_type text,
  batt_type text,
  cost numeric,
  quantity numeric,
  owner_id text references owners(id),
  reference text,
  date date,
  notes text,
  performed_by text,                    -- signed-in user's email; the audit trail
  created_at timestamptz not null default now()
);

-- Lock every table down to signed-in users only
alter table owners enable row level security;
alter table stock enable row level security;
alter table models enable row level security;
alter table jobs enable row level security;
alter table movements enable row level security;

create policy "auth read/write owners" on owners for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth read/write stock" on stock for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth read/write models" on models for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth read/write jobs" on jobs for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth read/write movements" on movements for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Enable realtime so the app updates live across everyone's browsers
alter publication supabase_realtime add table owners, stock, models, jobs, movements;
