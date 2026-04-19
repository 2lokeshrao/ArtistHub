import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { 
  supabase, getOwnProfile, upsertProfile, getServices, 
  upsertService, deleteService, getAvailMap, toggleDate, getBookings 
} from '../../lib/supabaseClient';

const formatINR = n => `₹${Number(n).toLocaleString('en-IN')}`;

// --- Main Dashboard Component ---
export default function Dashboard() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState('profile');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session); setLoading(false);
      if (!session) router.replace('/login');
    });
  }, [router]);

  useEffect(() => {
    if (session?.user?.id) getOwnProfile(session.user.id).then(setProfile);
  }, [session]);

  if (loading) return <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center text-[#D4B996]">ArtistHub Loading...</div>;

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-white font-sans pb-24">
      <Head><title>ArtistHub | Dashboard</title></Head>
      
      {/* Header */}
      <header className="p-6 flex justify-between items-center bg-[#1A1A1A]/80 backdrop-blur-md sticky top-0 z-30 border-b border-white/5">
        <div>
          <h1 className="text-xl font-bold text-[#D4B996]">Dashboard</h1>
          <p className="text-[10px] text-white/30 uppercase tracking-widest mt-1">Manage your business</p>
        </div>
        <button onClick={() => supabase.auth.signOut()} className="text-[10px] font-bold uppercase text-red-500/60 tracking-widest px-4 py-2 border border-red-500/10 rounded-full">Logout</button>
      </header>

      {/* Tabs */}
      <div className="flex px-4 gap-1 mt-4 sticky top-20 z-20">
        {[
          ['profile', 'Profile'],
          ['services', 'Services'],
          ['calendar', 'Availability'],
          ['bookings', 'Bookings']
        ].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`flex-1 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all ${tab === id ? 'bg-[#D4B996] text-[#1A1A1A]' : 'bg-white/5 text-white/30'}`}>{label}</button>
        ))}
      </div>

      <main className="p-5 max-w-xl mx-auto">
        {tab === 'profile' && profile && (
          <ProfileTab profile={profile} onUpdate={setProfile} />
        )}
        {tab === 'services' && profile && (
          <ServicesTab profileId={profile.id} />
        )}
        {tab === 'calendar' && profile && (
          <CalendarTab profileId={profile.id} />
        )}
        {tab === 'bookings' && profile && (
          <BookingsList profileId={profile.id} />
        )}
      </main>
    </div>
  );
}

// --- 1. Profile Tab Component ---
function ProfileTab({ profile, onUpdate }) {
  const [form, setForm] = useState(profile);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      // Yahan upi_id ko bhi upsertProfile mein bheja ja raha hai
      await upsertProfile(form);
      onUpdate(form);
      alert("Profile Saved!");
    } catch (e) { alert("Error!"); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-white/5 p-6 rounded-3xl border border-white/10 space-y-5">
        <div className="space-y-2">
          <label className="text-[9px] uppercase tracking-[0.2em] text-[#D4B996] ml-1">Full Name</label>
          <input className="w-full bg-[#1A1A1A] p-4 rounded-2xl border border-white/5 outline-none focus:border-[#D4B996]/50" value={form.full_name || ''} onChange={e=>setForm({...form, full_name:e.target.value})} />
        </div>
        
        <div className="space-y-2">
          <label className="text-[9px] uppercase tracking-[0.2em] text-[#D4B996] ml-1">WhatsApp Phone (91...)</label>
          <input className="w-full bg-[#1A1A1A] p-4 rounded-2xl border border-white/5 outline-none focus:border-[#D4B996]/50" value={form.phone || ''} onChange={e=>setForm({...form, phone:e.target.value})} />
        </div>

        {/* NAYA UPI ID SECTION */}
        <div className="space-y-2 p-4 bg-[#D4B996]/5 border border-[#D4B996]/20 rounded-2xl">
          <label className="text-[10px] uppercase tracking-[0.2em] text-[#D4B996] font-bold">UPI ID (Deep Link Payment)</label>
          <input 
            className="w-full bg-[#1A1A1A] p-4 rounded-xl border border-white/5 outline-none focus:border-[#D4B996] mt-2 font-mono text-xs" 
            placeholder="example@okicici"
            value={form.upi_id || ''} 
            onChange={e=>setForm({...form, upi_id:e.target.value})} 
          />
          <p className="text-[8px] text-white/30 italic mt-1">Is ID se PhonePe/GPay direct open hoga.</p>
        </div>

        <div className="space-y-2">
          <label className="text-[9px] uppercase tracking-[0.2em] text-[#D4B996] ml-1">UPI QR Link (Drive)</label>
          <input className="w-full bg-[#1A1A1A] p-4 rounded-2xl border border-white/5 outline-none focus:border-[#D4B996]/50" value={form.upi_qr_url || ''} onChange={e=>setForm({...form, upi_qr_url:e.target.value})} />
        </div>

        <div className="space-y-2">
          <label className="text-[9px] uppercase tracking-[0.2em] text-[#D4B996] ml-1">Avatar Image URL</label>
          <input className="w-full bg-[#1A1A1A] p-4 rounded-2xl border border-white/5 outline-none focus:border-[#D4B996]/50" value={form.avatar_url || ''} onChange={e=>setForm({...form, avatar_url:e.target.value})} />
        </div>

        <div className="space-y-2">
          <label className="text-[9px] uppercase tracking-[0.2em] text-[#D4B996] ml-1">Cover Image URL</label>
          <input className="w-full bg-[#1A1A1A] p-4 rounded-2xl border border-white/5 outline-none focus:border-[#D4B996]/50" value={form.cover_url || ''} onChange={e=>setForm({...form, cover_url:e.target.value})} />
        </div>

        <div className="space-y-2">
          <label className="text-[9px] uppercase tracking-[0.2em] text-[#D4B996] ml-1">Professional Tagline</label>
          <textarea className="w-full bg-[#1A1A1A] p-4 rounded-2xl border border-white/5 outline-none focus:border-[#D4B996]/50 h-24 text-sm" value={form.tagline || ''} onChange={e=>setForm({...form, tagline:e.target.value})} />
        </div>

        <button onClick={save} disabled={saving} className="w-full py-4 bg-[#D4B996] text-[#1A1A1A] font-bold rounded-2xl shadow-xl shadow-[#D4B996]/10 active:scale-95 transition-all">
          {saving ? 'Saving...' : 'Save Profile Changes'}
        </button>
      </div>
    </div>
  );
}

// --- 2. Services Tab Component ---
function ServicesTab({ profileId }) {
  const [list, setList] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [edit, setEdit] = useState({ name: '', price: '' });

  const load = useCallback(() => getServices(profileId).then(setList), [profileId]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!edit.name || !edit.price) return;
    await upsertService({ ...edit, profile_id: profileId });
    setEdit({ name: '', price: '' }); setShowForm(false); load();
  };

  const remove = async (id) => { if(confirm("Delete?")) { await deleteService(id); load(); } };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-xs uppercase tracking-widest text-white/40">My Services</h3>
        <button onClick={() => setShowForm(!showForm)} className="text-[10px] font-bold uppercase text-[#D4B996] bg-[#D4B996]/10 px-4 py-2 rounded-full">+ Add New</button>
      </div>
      
      {showForm && (
        <div className="p-5 bg-[#D4B996]/5 border border-[#D4B996]/20 rounded-3xl space-y-4 animate-fadeIn">
          <input placeholder="Service Name (e.g. Bridal Makeup)" className="w-full bg-[#1A1A1A] p-4 rounded-2xl border border-white/5 outline-none" value={edit.name} onChange={e=>setEdit({...edit, name:e.target.value})} />
          <input placeholder="Price (INR)" type="number" className="w-full bg-[#1A1A1A] p-4 rounded-2xl border border-white/5 outline-none" value={edit.price} onChange={e=>setEdit({...edit, price:e.target.value})} />
          <button onClick={add} className="w-full py-4 bg-[#D4B996] text-[#1A1A1A] font-bold rounded-2xl">Add Service</button>
        </div>
      )}

      <div className="grid gap-3">
        {list.map(s => (
          <div key={s.id} className="p-5 bg-white/5 border border-white/10 rounded-3xl flex justify-between items-center">
            <div>
              <p className="font-bold text-sm">{s.name}</p>
              <p className="text-xs text-[#D4B996] mt-0.5">{formatINR(s.price)}</p>
            </div>
            <button onClick={() => remove(s.id)} className="text-red-500/50 p-2">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- 3. Calendar Tab Component ---
function CalendarTab({ profileId }) {
  const [map, setMap] = useState({});
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i); return d.toISOString().split('T')[0];
  });

  useEffect(() => { getAvailMap(profileId).then(setMap); }, [profileId]);

  const toggle = async (date) => {
    const isBusy = map[date] === 'busy';
    setMap({ ...map, [date]: isBusy ? 'available' : 'busy' });
    await toggleDate(profileId, date, !isBusy);
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {days.map(d => (
        <button key={d} onClick={() => toggle(d)} className={`p-4 rounded-2xl border text-[10px] font-bold uppercase transition-all ${map[d] === 'busy' ? 'bg-red-500/10 border-red-500/50 text-red-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'}`}>
          {new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}<br/>
          <span className="opacity-50">{map[d] === 'busy' ? 'Busy' : 'Available'}</span>
        </button>
      ))}
    </div>
  );
}

// --- 4. Bookings List Component ---
function BookingsList({ profileId }) {
  const [list, setList] = useState([]);
  useEffect(() => { getBookings(profileId).then(setList); }, [profileId]);
  return (
    <div className="space-y-3">
      {list.length === 0 && <p className="text-center py-10 text-white/20 text-xs">No bookings found.</p>}
      {list.map(b => (
        <div key={b.id} className="p-5 bg-white/5 border border-white/10 rounded-3xl">
          <div className="flex justify-between items-start mb-1">
            <p className="text-[#D4B996] font-bold">{b.client_name}</p>
            <span className="text-[9px] bg-white/5 px-2 py-1 rounded-md text-white/40 uppercase tracking-tighter italic">Pending</span>
          </div>
          <p className="text-[11px] text-white/60">{b.client_phone}</p>
          <div className="mt-3 flex justify-between items-center border-t border-white/5 pt-3">
            <p className="text-[10px] uppercase text-white/30">{new Date(b.booking_date).toLocaleDateString()}</p>
            <p className="text-xs font-bold text-emerald-400">{formatINR(b.total_price)}</p>
          </div>
          {b.note && <p className="mt-2 text-[9px] text-white/20 italic">{b.note}</p>}
        </div>
      ))}
    </div>
  );
 }
