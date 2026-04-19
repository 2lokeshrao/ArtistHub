-- ============================================================
--  ArtistHub  ·  Supabase Schema
--  Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- ── Extensions ──────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Profiles ────────────────────────────────────────────────
create table if not exists public.profiles (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade not null unique,
  username      text unique not null,                  -- used for public URL  /portfolio/[username]
  full_name     text not null default '',
  tagline       text default '',                        -- e.g. "Luxury Bridal Artist · Jaipur"
  bio           text default '',
  avatar_url    text default '',                        -- pasted external image URL
  cover_url     text default '',                        -- pasted external banner URL
  phone         text default '',                        -- for WhatsApp automation
  city          text default '',
  upi_qr_url    text default '',                        -- external link for UPI QR image
  -- Portfolio images (up to 9, stored as JSON array of URLs)
  portfolio_images  jsonb default '[]'::jsonb,
  -- Social media links
  instagram_url text default '',
  snapchat_url  text default '',
  youtube_url   text default '',
  -- Settings
  is_public     boolean default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── Services ────────────────────────────────────────────────
create table if not exists public.services (
  id          uuid primary key default uuid_generate_v4(),
  profile_id  uuid references public.profiles(id) on delete cascade not null,
  name        text not null,                            -- e.g. "Bridal Makeup"
  description text default '',
  price       numeric(10,2) not null default 0,
  duration    text default '',                          -- e.g. "3-4 hours"
  category    text default '',                          -- e.g. "Makeup", "Hair", "Nails"
  is_active   boolean default true,
  sort_order  integer default 0,
  created_at  timestamptz default now()
);

-- ── Availability ────────────────────────────────────────────
create table if not exists public.availability (
  id          uuid primary key default uuid_generate_v4(),
  profile_id  uuid references public.profiles(id) on delete cascade not null,
  date        date not null,
  status      text check (status in ('available','busy')) default 'available',
  note        text default '',
  created_at  timestamptz default now(),
  unique (profile_id, date)
);

-- ── Bookings ────────────────────────────────────────────────
create table if not exists public.bookings (
  id            uuid primary key default uuid_generate_v4(),
  profile_id    uuid references public.profiles(id) on delete cascade not null,
  service_id    uuid references public.services(id) on delete set null,
  -- Client details
  client_name   text not null,
  client_phone  text not null,
  client_email  text default '',
  -- Booking details
  booking_date  date not null,
  time_slot     text default '',                        -- e.g. "10:00 AM"
  total_price   numeric(10,2) not null default 0,
  note          text default '',
  -- Status
  status        text check (status in ('pending','confirmed','cancelled')) default 'pending',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── RLS (Row Level Security) ─────────────────────────────────

alter table public.profiles    enable row level security;
alter table public.services    enable row level security;
alter table public.availability enable row level security;
alter table public.bookings    enable row level security;

-- Profiles: owner can do everything; public can read public profiles
create policy "profiles_select_public"  on public.profiles  for select using (is_public = true);
create policy "profiles_select_own"     on public.profiles  for select using (auth.uid() = user_id);
create policy "profiles_insert_own"     on public.profiles  for insert with check (auth.uid() = user_id);
create policy "profiles_update_own"     on public.profiles  for update using (auth.uid() = user_id);
create policy "profiles_delete_own"     on public.profiles  for delete using (auth.uid() = user_id);

-- Services: public can read active services of public profiles; owner manages
create policy "services_select_public"  on public.services  for select
  using (exists (select 1 from public.profiles p where p.id = profile_id and p.is_public = true));
create policy "services_owner_all"      on public.services  for all
  using (exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = auth.uid()));

-- Availability: public can read; owner manages
create policy "availability_select_public" on public.availability for select
  using (exists (select 1 from public.profiles p where p.id = profile_id and p.is_public = true));
create policy "availability_owner_all"     on public.availability for all
  using (exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = auth.uid()));

-- Bookings: anyone can insert (clients book); only owner can read/update
create policy "bookings_insert_anyone"  on public.bookings  for insert with check (true);
create policy "bookings_owner_select"   on public.bookings  for select
  using (exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = auth.uid()));
create policy "bookings_owner_update"   on public.bookings  for update
  using (exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = auth.uid()));

-- ── Helper trigger: updated_at ───────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger trg_bookings_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();
