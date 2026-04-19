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
      <header className="p-6 border-b border-white/5 flex justify-between items-center sticky top-0 bg-[#1A1A1A]/80 backdrop-blur-md z-50">
        <div>
          <h1 className="text-xl font-bold tracking-tighter text-[#D4B996] italic">ArtistHub</h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/30">Artist Studio</p>
        </div>
        <button onClick={() => supabase.auth.signOut()} className="text-[10px] uppercase font-bold text-white/40">Sign Out</button>
      </header>

      {/* Tabs Navigation */}
      <nav className="flex px-6 mt-4 gap-8 border-b border-white/5 overflow-x-auto no-scrollbar">
        {['profile', 'services', 'calendar', 'bookings'].map(t => (
          <button 
            key={t} 
            onClick={() => setTab(t)} 
            className={`pb-3 text-[11px] uppercase tracking-widest font-bold transition-all border-b-2 whitespace-nowrap ${
              tab === t ? 'border-[#D4B996] text-[#D4B996]' : 'border-transparent text-white/30'
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      {/* Tab Content */}
      <main className="p-6 max-w-xl mx-auto">
        {tab === 'profile' && <ProfileEditor profile={profile} userId={session?.user?.id} onSaved={setProfile} />}
        {tab === 'services' && profile && <ServicesManager profileId={profile.id} />}
        {tab === 'calendar' && profile && <CalendarManager profileId={profile.id} />}
        {tab === 'bookings' && profile && <BookingsList profileId={profile.id} />}
        
        {tab !== 'profile' && !profile && (
          <div className="text-center py-20 border border-dashed border-white/10 rounded-3xl">
            <p className="text-white/40 text-sm">Pehle Profile tab mein apni jaankari save karein.</p>
          </div>
        )}
      </main>
    </div>
  );
}

// --- 1. Profile Editor Component ---
function ProfileEditor({ profile, userId, onSaved }) {
  const [f, setF] = useState({
    username: profile?.username || '', full_name: profile?.full_name || '',
    tagline: profile?.tagline || '', bio: profile?.bio || '',
    avatar_url: profile?.avatar_url || '', upi_qr_url: profile?.upi_qr_url || '',
    portfolio_images: (profile?.portfolio_images || []).join('\n'),
    phone: profile?.phone || ''
  });

  const save = async () => {
    if(!f.username) return alert("Username required!");
    const imgs = f.portfolio_images.split('\n').filter(x => x.trim());
    const res = await upsertProfile(userId, { ...f, portfolio_images: imgs });
    onSaved(res); alert("Profile Updated! ✨");
  };

  const copyLink = () => {
    const link = `${window.location.origin}/portfolio/${profile.username}`;
    navigator.clipboard.writeText(link);
    alert("Link copied! 📋");
  };

  const inputStyle = "w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm focus:border-[#D4B996]/50 outline-none transition-all";

  return (
    <div className="space-y-4">
      <input placeholder="Username (Unique)" value={f.username} onChange={e => setF({...f, username: e.target.value})} className={inputStyle} />
      <input placeholder="Full Name" value={f.full_name} onChange={e => setF({...f, full_name: e.target.value})} className={inputStyle} />
      <input placeholder="Phone (with country code)" value={f.phone} onChange={e => setF({...f, phone: e.target.value})} className={inputStyle} />
      <input placeholder="Tagline" value={f.tagline} onChange={e => setF({...f, tagline: e.target.value})} className={inputStyle} />
      <textarea placeholder="Portfolio Images (URLs, one per line)" value={f.portfolio_images} onChange={e => setF({...f, portfolio_images: e.target.value})} rows={4} className={inputStyle} />
      <input placeholder="Avatar URL" value={f.avatar_url} onChange={e => setF({...f, avatar_url: e.target.value})} className={inputStyle} />
      <input placeholder="UPI QR Image URL" value={f.upi_qr_url} onChange={e => setF({...f, upi_qr_url: e.target.value})} className={inputStyle} />
      
      <button onClick={save} className="w-full py-4 bg-[#D4B996] text-[#1A1A1A] font-bold rounded-2xl uppercase tracking-widest text-xs shadow-lg">Save Profile</button>

      {/* Share Section */}
      {profile?.username && (
        <div className="mt-10 p-6 bg-white/5 border border-[#D4B996]/20 rounded-3xl text-center">
          <p className="text-[10px] uppercase tracking-widest text-[#D4B996] mb-4 font-bold">Your Live Portfolio</p>
          <div className="flex gap-2">
            <button onClick={() => window.open(`/portfolio/${profile.username}`, '_blank')} className="flex-1 py-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-bold">View Live</button>
            <button onClick={copyLink} className="flex-1 py-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-bold">Copy Link</button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- 2. Services Manager Component ---
function ServicesManager({ profileId }) {
  const [list, setList] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', price: '', duration: '' });

  const load = useCallback(async () => setList(await getServices(profileId)), [profileId]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if(!form.name || !form.price) return alert("Fill Name and Price");
    await upsertService(profileId, { ...form, price: parseFloat(form.price) });
    setShowAdd(false); setForm({ name: '', price: '', duration: '' }); load();
  };

  return (
    <div className="space-y-4">
      {list.map(s => (
        <div key={s.id} className="p-5 bg-white/5 border border-white/10 rounded-3xl flex justify-between items-center">
          <div><p className="font-bold text-[#D4B996]">{s.name}</p><p className="text-[10px] text-white/40">{formatINR(s.price)} · {s.duration}</p></div>
          <button onClick={async () => { if(confirm('Delete?')) { await deleteService(s.id); load(); } }} className="text-red-500/50 text-xs">Delete</button>
        </div>
      ))}
      {showAdd ? (
        <div className="p-6 bg-white/5 border border-[#D4B996]/20 rounded-3xl space-y-3">
          <input placeholder="Service Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full bg-black/20 p-4 rounded-xl text-sm outline-none" />
          <input placeholder="Price" type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})} className="w-full bg-black/20 p-4 rounded-xl text-sm outline-none" />
          <input placeholder="Duration (e.g. 1 hr)" value={form.duration} onChange={e => setForm({...form, duration: e.target.value})} className="w-full bg-black/20 p-4 rounded-xl text-sm outline-none" />
          <button onClick={add} className="w-full py-3 bg-white text-black font-bold rounded-xl text-xs uppercase">Add Service</button>
        </div>
      ) : (
        <button onClick={() => setShowAdd(true)} className="w-full py-4 border border-dashed border-[#D4B996]/30 text-[#D4B996] rounded-3xl text-xs uppercase tracking-widest">+ New Service</button>
      )}
    </div>
  );
}

// --- 3. Calendar Manager Component ---
function CalendarManager({ profileId }) {
  const [map, setMap] = useState({});
  useEffect(() => { getAvailMap(profileId).then(setMap); }, [profileId]);

  const toggle = async (d) => {
    const res = await toggleDate(profileId, d, map[d] || 'available');
    setMap(prev => ({...prev, [d]: res}));
  };

  const days = Array.from({length: 14}, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i);
    return d.toISOString().split('T')[0];
  });

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
            <p className="text-[#D4B996] font-bold text-sm">{b.client_name}</p>
            <p className="text-[#D4B996] font-bold text-sm">{formatINR(b.total_price)}</p>
          </div>
          <p className="text-[10px] text-white/50 uppercase tracking-widest">{b.service_name} · {b.booking_date}</p>
          <p className="text-[10px] text-white/30 mt-2 italic">📞 {b.client_phone}</p>
        </div>
      ))}
    </div>
  );
      }
            
