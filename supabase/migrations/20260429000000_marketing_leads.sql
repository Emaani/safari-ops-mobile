-- ============================================================================
-- Marketing Leads & UTM Attribution
-- Run this in Supabase SQL Editor → New Query
-- ============================================================================

-- marketing_leads: captures every website visitor action with full UTM context
create table if not exists public.marketing_leads (
  id                  uuid default gen_random_uuid() primary key,
  -- Contact info (optional — filled when form submitted)
  name                text,
  email               text,
  phone               text,
  -- Attribution
  source              text,          -- 'booking_form' | 'contact_form' | 'safari_enquiry' | 'safari_booking'
  utm_source          text,          -- e.g. 'google', 'facebook', 'instagram'
  utm_medium          text,          -- e.g. 'cpc', 'organic', 'social'
  utm_campaign        text,          -- e.g. 'gorilla_trek_2026'
  utm_content         text,          -- e.g. blog slug or ad variant
  utm_term            text,          -- paid search keyword
  referrer_url        text,          -- full referrer URL
  -- Conversion links
  booking_id          uuid references public.bookings(id) on delete set null,
  safari_booking_id   uuid references public.safari_bookings(id) on delete set null,
  -- Metadata
  notes               text,
  created_at          timestamptz default now()
);

-- Indexes for common query patterns
create index if not exists marketing_leads_utm_content_idx  on public.marketing_leads (utm_content);
create index if not exists marketing_leads_utm_source_idx   on public.marketing_leads (utm_source);
create index if not exists marketing_leads_utm_campaign_idx on public.marketing_leads (utm_campaign);
create index if not exists marketing_leads_created_at_idx   on public.marketing_leads (created_at desc);
create index if not exists marketing_leads_safari_bkg_idx   on public.marketing_leads (safari_booking_id);

-- RLS
alter table public.marketing_leads enable row level security;

-- Authenticated users (ops staff) can read all leads
create policy "Staff can read marketing leads"
  on public.marketing_leads for select
  to authenticated
  using (true);

-- Authenticated users can insert (app submits leads)
create policy "App can insert marketing leads"
  on public.marketing_leads for insert
  to authenticated
  with check (true);

-- Anon users can also insert (public-facing forms)
create policy "Anon can insert marketing leads"
  on public.marketing_leads for insert
  to anon
  with check (true);

-- Grant permissions
grant select, insert on public.marketing_leads to authenticated;
grant insert on public.marketing_leads to anon;

-- ============================================================================
-- Add UTM columns to safari_bookings if they don't exist
-- (allows direct attribution on booking records)
-- ============================================================================

alter table public.safari_bookings
  add column if not exists utm_source   text,
  add column if not exists utm_medium   text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content  text,
  add column if not exists referrer_url text;

-- ============================================================================
-- Supabase Vault Secrets (set these in Supabase Dashboard)
-- Settings → Edge Functions → Secrets:
--
--   GA4_SERVICE_ACCOUNT_JSON  = <paste your service account JSON>
--   GA4_PROPERTY_ID           = <your numeric GA4 property ID>
--
-- To get your GA4 Property ID:
--   Google Analytics → Admin → Property → Property Details → Property ID
--
-- To create a service account:
--   Google Cloud Console → IAM → Service Accounts → Create
--   Add role: "Viewer" on the GA4 property
--   Generate JSON key → paste full JSON as GA4_SERVICE_ACCOUNT_JSON secret
-- ============================================================================
