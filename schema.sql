-- QLD Strata Rankings — Supabase schema
-- Run this once in the Supabase SQL editor for your project.
-- Table names are prefixed with strata_ so they don't clash with
-- tables from other apps (e.g. PARKnSPIN) sharing the same project.

create extension if not exists "pgcrypto";

create table if not exists strata_managers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  agency text,
  photo_url text,
  linkedin_url text,
  created_at timestamptz default now()
);

create table if not exists strata_schemes (
  id uuid primary key default gen_random_uuid(),
  suburb text not null,
  plan_type text,                -- 'BFP' or 'SFP' — admin fills in before approval
  module text,                   -- industry-known scheme identifier — admin fills in before approval
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
  website_url text,
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
  event_id uuid references strata_events(id) on delete cascade, -- which specific win this tradie is tied to
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
  website_url text,              -- optional — logo links out to this on Recent wins
  category text,                 -- legacy, no longer used by the app
  icon_url text,                 -- trade icon uploaded directly for this contractor
  created_at timestamptz default now()
);

create table if not exists strata_agency_logos (
  key text primary key,          -- lowercased, trimmed agency name
  name text not null,
  logo_url text not null,
  website_url text,
  created_at timestamptz default now()
);

create table if not exists strata_contractor_icons (
  key text primary key,          -- lowercased, trimmed category label (e.g. 'locker')
  label text not null,           -- display label (e.g. 'Locker')
  icon_url text not null,        -- uploaded icon image
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
alter table strata_sponsor_invites add column if not exists website_url text;

-- Drives the colored "tip source" banner shown on Win of the Week /
-- Recent wins. Admin-only — set from the nominations list, never by the
-- public submission. One of 'anonymous' (gold) | 'body_corporate' (green)
-- | 'strata_company' (blue) | 'tradie' (pink) | null (no banner).
alter table strata_events add column if not exists tip_source text;
alter table strata_sponsors add column if not exists website_url text;
alter table strata_sponsor_invites add column if not exists category text;
alter table strata_sponsor_invites add column if not exists icon_url text;
alter table strata_agency_logos add column if not exists website_url text;
alter table strata_managers add column if not exists photo_url text;
alter table strata_managers add column if not exists linkedin_url text;

-- The public Scoop form stopped collecting scheme type & module a
-- while back (admin fills these in before approving), so the columns
-- can no longer be required at insert time.
alter table strata_schemes alter column plan_type drop not null;
alter table strata_schemes alter column module drop not null;

-- Fix for installs that ran this file before the cascade rule existed:
-- deleting a win should also delete any contractor attached to it,
-- instead of Postgres blocking the delete outright.
alter table strata_sponsor_invites drop constraint if exists strata_sponsor_invites_event_id_fkey;
alter table strata_sponsor_invites add constraint strata_sponsor_invites_event_id_fkey
  foreign key (event_id) references strata_events(id) on delete cascade;

-- Daily strata quiz. One row per answer submitted. The question bank
-- itself lives as a static file (public/Quiz Questions/questions.json),
-- not in the database — this table only records who answered what and
-- how fast. One entry per person per day (same name + company on the
-- same quiz_date is rejected as a duplicate play).
create table if not exists strata_quiz_entries (
  id uuid primary key default gen_random_uuid(),
  quiz_date date not null,
  question_id int not null,
  name text not null,
  role text,
  company text not null,
  selected_option text not null,
  is_correct boolean not null,
  elapsed_seconds int not null,
  submitted_at timestamptz default now(),
  unique (quiz_date, name, company)
);
create index if not exists idx_quiz_entries_date on strata_quiz_entries(quiz_date, is_correct, elapsed_seconds);

-- Admin attaches a photo to a top finisher by hand (behind the scenes —
-- not shown on the public quiz tab).
alter table strata_quiz_entries add column if not exists photo_url text;

-- Strata Daily Drill — replaces the old multiple-choice quiz above.
-- Ten practical, scenario-based tasks a day (drawn in order from
-- public/Daily Drill/tasks.json), answered freeform in writing. There's
-- no auto-marking: every submission is judged by hand by an admin against
-- the task bank's model answer, so is_correct starts out null (pending)
-- and is set true/false from the Daily Drill admin tab. One entry per
-- person per day (same name + company on the same drill_date is rejected
-- as a duplicate play). Ranked for the public board by elapsed_seconds —
-- time from when that day's set went live to when they submitted — but
-- only once marked correct.
create table if not exists strata_drill_entries (
  id uuid primary key default gen_random_uuid(),
  drill_date date not null,
  name text not null,
  role text,
  company text not null,
  answers jsonb not null,       -- [{ "taskId": 1, "text": "..." }, ...] — 10 entries
  is_correct boolean,           -- null = pending admin review
  elapsed_seconds int not null,
  submitted_at timestamptz default now(),
  photo_url text,                -- admin-attached, top finishers only
  logo_url text,                 -- admin-attached company logo, top finishers only
  unique (drill_date, name, company)
);
create index if not exists idx_drill_entries_date on strata_drill_entries(drill_date, is_correct, elapsed_seconds);
