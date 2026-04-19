import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// --- Profile Helpers ---
export async function getOwnProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error && error.code === 'PGRST116') return null;
  if (error) throw error;
  return data;
}

export async function upsertProfile(userId, payload) {
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ 
      ...payload, 
      id: userId, 
      user_id: userId 
    }, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// --- Service Helpers ---
export async function getServicesByProfileId(profileId) {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('profile_id', profileId)
    .eq('is_active', true); // Check active status
  if (error) throw error;
  return data ?? [];
}

export async function upsertService(profileId, service) {
  const payload = { 
    ...service, 
    profile_id: profileId,
    is_active: true // Hamesha active rakhein taaki gayab na ho
  };
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

// --- Availability & Bookings ---
export async function getAvailabilityMap(profileId) {
  const { data, error } = await supabase.from('availability').select('date, status').eq('profile_id', profileId);
  if (error) throw error;
  const map = {};
  (data ?? []).forEach(r => { map[r.date] = r.status; });
  return map;
}

export async function toggleDateStatus(profileId, date, currentStatus) {
  const newStatus = currentStatus === 'busy' ? 'available' : 'busy';
  const { error } = await supabase.from('availability').upsert({ profile_id: profileId, date, status: newStatus }, { onConflict: 'profile_id,date' });
  if (error) throw error;
  return newStatus;
}

export async function getOwnBookings(profileId) {
  const { data, error } = await supabase.from('bookings').select('*, services(name)').eq('profile_id', profileId).order('booking_date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
