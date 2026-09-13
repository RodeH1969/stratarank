-- QLD Strata Rankings — Supabase schema
-- Run this once in the Supabase SQL editor for your project.
-- Table names are prefixed with strata_ so they don't clash with
-- tables from other apps (e.g. PARKnSPIN) sharing the same project.

create extension if not exists "pgcrypto";

create table if not exists strata_managers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  agency text,
  created_at timestamptz default now()
);

create table if not exists strata_schemes (
  id uuid primary key default gen_random_uuid(),
  suburb text not null,
  plan_type text not null,       -- 'BFP' or 'SFP'
  module text not null,          -- industry-known scheme identifier
  lot_count int not null,
  scheme_name text,              -- PRIVATE — verification only, never sent to the public site
  cts text,                      -- PRIVATE — Community Titles Scheme number, verification only
  current_manager_id uuid references strata_managers(id),
  current_term int,
  created_at timestamptz default now()
);

create table if not exists strata_events (
  id uuid primary key default gen_random_uuid(),
  type text not null,            -- 'win' | 'upgrade' | 'loss'
  scheme_id uuid references strata_schemes(id) not null,
  manager_id uuid references strata_managers(id) not null,
  new_term int,
  prev_term int,
  points int not null,
  date date not null,
  created_at timestamptz default now()
);

create table if not exists strata_sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  logo_name text,
  position int default 1,
  active boolean default true,
  nominated_by text,
  nominated_by_agency text,
  sponsorship_price numeric,
  commission_owed numeric,
  commission_paid boolean default false,
  created_at timestamptz default now()
);

create table if not exists strata_sponsor_invites (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references strata_events(id), -- which specific win this tradie is tied to
  business_name text not null,
  contact_name text,             -- optional: the tradie/contractor's own name
  event_type text,
  scheme_label text,
  new_term int,
  nominated_by text,
  nominated_by_agency text,
  status text default 'pending', -- 'pending' | 'accepted' | 'declined'
  logo_url text,                 -- set once accepted — shown next to this win on Recent wins
  tagline text,                  -- a short line about their business, shown alongside the logo
  created_at timestamptz default now()
);

create table if not exists strata_agency_logos (
  key text primary key,          -- lowercased, trimmed agency name
  name text not null,
  logo_url text not null,
  created_at timestamptz default now()
);

-- Helpful indexes
create index if not exists idx_strata_events_date on strata_events(date desc);
create index if not exists idx_strata_events_manager on strata_events(manager_id);
create index if not exists idx_strata_events_scheme on strata_events(scheme_id);

-- If you already ran this file before scheme_name/cts existed, this adds
-- them safely without touching anything else.
alter table strata_schemes add column if not exists scheme_name text;
alter table strata_schemes add column if not exists cts text;
alter table strata_sponsor_invites add column if not exists contact_name text;
alter table strata_sponsor_invites add column if not exists event_id uuid references strata_events(id);
alter table strata_sponsor_invites add column if not exists logo_url text;
alter table strata_sponsor_invites add column if not exists tagline text;
