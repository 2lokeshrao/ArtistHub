import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Profile
export const getServicesByProfileId = async (profileId) => {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('profile_id', profileId)
    .eq('is_active', true); // Sirf active services dikhane ke liye
  if (error) throw error;
  return data || [];
};
export const getBusyDates = async (profileId) => {
  const { data, error } = await supabase
    .from('availability')
    .select('date')
    .eq('profile_id', profileId)
    .eq('status', 'busy');
  if (error) throw error;
  // Ise Set mein convert karte hain taaki check karna aasaan ho
  return new Set(data.map(item => item.date));
};
export const getOwnProfile = async (id) => {
  const { data } = await supabase.from('profiles').select('*').eq('id', id).single();
  return data;
};
export const getProfileByUsername = async (u) => {
  const { data } = await supabase.from('profiles').select('*, services(*)').eq('username', u).eq('is_public', true).single();
  return data;
};
export const upsertProfile = async (id, payload) => {
  const { data, error } = await supabase.from('profiles').upsert({ ...payload, id, user_id: id }).select().single();
  if (error) throw error; return data;
};

// Services
export const getServices = async (pid) => {
  const { data } = await supabase.from('services').select('*').eq('profile_id', pid).eq('is_active', true);
  return data || [];
};
export const upsertService = async (pid, svc) => {
  const { data, error } = await supabase.from('services').upsert({ ...svc, profile_id: pid, is_active: true }).select().single();
  if (error) throw error; return data;
};
export const deleteService = async (id) => { await supabase.from('services').delete().eq('id', id); };

// Availability & Bookings
export const getAvailMap = async (pid) => {
  const { data } = await supabase.from('availability').select('date, status').eq('profile_id', pid);
  const m = {}; data?.forEach(r => m[r.date] = r.status); return m;
};
export const toggleDate = async (pid, date, cur) => {
  const next = cur === 'busy' ? 'available' : 'busy';
  await supabase.from('availability').upsert({ profile_id: pid, date, status: next }, { onConflict: 'profile_id,date' });
  return next;
};
export const createBooking = async (b) => { return await supabase.from('bookings').insert(b).select().single(); };
export const getBookings = async (pid) => {
  const { data } = await supabase.from('bookings').select('*').eq('profile_id', pid).order('booking_date', { ascending: false });
  return data || [];
};
