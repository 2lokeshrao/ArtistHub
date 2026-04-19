// lib/supabaseClient.js
// -------------------------------------------------
//  Install:  npm install @supabase/supabase-js
//  Add to .env.local:
//    NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
//    NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
// -------------------------------------------------

import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables. Check your .env.local file.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// ── Convenience helpers ──────────────────────────────────────

/** Fetch a public profile by username (for portfolio page) */
export async function getProfileByUsername(username) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .eq('is_public', true)
    .single();
  if (error) throw error;
  return data;
}

/** Fetch active services for a profile */
export async function getServicesByProfileId(profileId) {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('profile_id', profileId)
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return data ?? [];
}

/** Fetch busy dates for a profile (returns Set of ISO date strings) */
export async function getBusyDates(profileId) {
  const { data, error } = await supabase
    .from('availability')
    .select('date')
    .eq('profile_id', profileId)
    .eq('status', 'busy');
  if (error) throw error;
  return new Set((data ?? []).map(r => r.date));
}

/** Toggle a date's busy/available status */
export async function toggleDateStatus(profileId, date, currentStatus) {
  const newStatus = currentStatus === 'busy' ? 'available' : 'busy';
  const { error } = await supabase
    .from('availability')
    .upsert({ profile_id: profileId, date, status: newStatus }, { onConflict: 'profile_id,date' });
  if (error) throw error;
  return newStatus;
}

/** Create a booking */
export async function createBooking(payload) {
  const { data, error } = await supabase
    .from('bookings')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Get own profile (dashboard) */
export async function getOwnProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error && error.code === 'PGRST116') return null; // no profile yet
  if (error) throw error;
  return data;
}

/** Upsert profile */
export async function upsertProfile(userId, payload) {
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ ...payload, user_id: userId }, { onConflict: 'user_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Get bookings for own profile */
export async function getOwnBookings(profileId) {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, services(name)')
    .eq('profile_id', profileId)
    .order('booking_date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Get availability map for own profile */
export async function getAvailabilityMap(profileId) {
  const { data, error } = await supabase
    .from('availability')
    .select('date, status')
    .eq('profile_id', profileId);
  if (error) throw error;
  const map = {};
  (data ?? []).forEach(r => { map[r.date] = r.status; });
  return map;
}

/** Manage services */
export async function upsertService(profileId, service) {
  const payload = { ...service, profile_id: profileId };
  const { data, error } = await supabase
    .from('services')
    .upsert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteService(serviceId) {
  const { error } = await supabase.from('services').delete().eq('id', serviceId);
  if (error) throw error;
}
