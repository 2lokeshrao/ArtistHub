import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { 
  supabase, getOwnProfile, upsertProfile, getServices, 
  upsertService, deleteService, getAvailMap, toggleDate, getBookings 
} from '../../lib/supabaseClient';

const formatINR = n => `₹${Number(n).toLocaleString('en-IN')}`;

// Helper to format date for WhatsApp and Display
const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

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

  if (loading) return <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center text-[#D4B996]">Loading Dashboard...</div>;

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-white font-sans pb-24">
      <Head><title>Dashboard | ArtistHub</title></Head>
      <header className="p-6 border-b border-white/5 flex justify-between items-center sticky top-0 bg-[#1A1A1A]/80 backdrop-blur-md z-50">
        <div><h1 className="text-xl font-bold tracking-tighter text-[#D4B996] italic">ArtistHub</h1></div>
        <button onClick={() => supabase.auth.signOut()} className="text-[10px] uppercase font-bold text-white/40">Sign Out</button>
      </header>

      <nav className="flex px-6 mt-4 gap-8 border-b border-white/5 overflow-x-auto no-scrollbar">
        {['profile', 'services', 'calendar', 'bookings'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`pb-3 text-[11px] uppercase tracking-widest font-bold border-b-2 transition-all ${tab === t ? 'border-[#D4B996] text-[#D4B996]' : 'border-transparent text-white/30'}`}>{t}</button>
        ))}
      </nav>

      <main className="p-6 max-w-xl mx-auto">
        {tab === 'profile' && <ProfileEditor profile={profile} userId={session?.user?.id} onSaved={setProfile} />}
        {tab === 'services' && profile && <ServicesManager profileId={profile.id} />}
        {tab === 'calendar' && profile && <CalendarManager profileId={profile.id} />}
        {tab === 'bookings' && profile && <BookingsList profileId={profile.id} />}
      </main>
    </div>
  );
}

// --- 1. Profile Editor (PDF & Share Included) ---
function ProfileEditor({ profile, userId, onSaved }) {
  const [isSaving, setIsSaving] = useState(false);
  const [f, setF] = useState({
    username: profile?.username || '', 
    full_name: profile?.full_name || '', 
    phone: profile?.phone || '',
    upi_id: profile?.upi_id || '', 
    tagline: profile?.tagline || '', 
    education: profile?.education || '',
    experience: profile?.experience || '', 
    instagram_url: profile?.instagram_url || '',
    avatar_url: profile?.avatar_url || '', 
    cover_url: profile?.cover_url || '',
    upi_qr_url: profile?.upi_qr_url || '', 
    portfolio_images: (profile?.portfolio_images || []).join('\n'),
  });

  const save = async () => {
    if(!f.username) return alert("Username required!");
    if(isSaving) return;
    setIsSaving(true);
    const imgs = f.portfolio_images.split('\n').filter(x => x.trim());
    
    const profileData = {
      id: userId,
      username: f.username,
      full_name: f.full_name,
      phone: f.phone,
      upi_id: f.upi_id,
      tagline: f.tagline,
      education: f.education,      
      experience: f.experience,    
      instagram_url: f.instagram_url,
      avatar_url: f.avatar_url,
      cover_url: f.cover_url,
      upi_qr_url: f.upi_qr_url,
      portfolio_images: imgs,
      updated_at: new Date()
    };

    try {
      const { data, error } = await supabase
        .from('profiles')
        .upsert(profileData)
        .select()
        .single();
      if (error) throw error;
      onSaved(data); 
      alert("Profile Updated Successfully! ✨");
    } catch (err) {
      alert("Error: " + (err.message || "Save nahi ho paya. SQL columns check karein."));
    } finally {
      setIsSaving(false);
    }
  };

  const copyLink = () => {
    if(!profile?.username) return alert("Pehle profile save karein!");
    const link = `${window.location.origin}/portfolio/${profile.username}`;
    navigator.clipboard.writeText(link);
    alert("Portfolio Link Copied! 📋");
  };

  const inputStyle = "w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm focus:border-[#D4B996]/50 outline-none mb-4 transition-all";

  return (
    <div className="animate-fadeIn pb-10">
      {/* 📸 PHOTO UPLOAD INSTRUCTIONS BOX */}
      <div className="bg-[#D4B996]/10 border border-[#D4B996]/30 p-6 rounded-[32px] mb-8">
        <h4 className="text-[10px] text-[#D4B996] uppercase mb-4 italic font-black tracking-widest">📸 Photo Upload Instructions:</h4>
        <ul className="text-[10px] text-white/60 space-y-2 list-disc ml-5 leading-relaxed">
          <li>Google Drive par photo upload karein.</li>
          <li>Photo par right-click karke <b>"Share"</b> par click karein.</li>
          <li>General Access ko <b>"Anyone with the link"</b> par set karein.</li>
          <li>Link copy karein aur niche box mein paste kar dein.</li>
        </ul>
      </div>

      <div className="space-y-6">
        {/* PERSONAL & PAYMENT SECTION */}
        <div>
          <h3 className="text-[10px] uppercase tracking-widest text-[#D4B996] mb-4 font-black">Personal & Payment</h3>
          <input placeholder="Username (Unique)" value={f.username} onChange={e => setF({...f, username: e.target.value})} className={inputStyle} />
          <input placeholder="Full Name" value={f.full_name} onChange={e => setF({...f, full_name: e.target.value})} className={inputStyle} />
          <input placeholder="WhatsApp Phone (e.g. 91...)" value={f.phone} onChange={e => setF({...f, phone: e.target.value})} className={inputStyle} />
          <input placeholder="Instagram Link (URL)" value={f.instagram_url} onChange={e => setF({...f, instagram_url: e.target.value})} className={inputStyle} />
          <input placeholder="UPI ID (for payments)" value={f.upi_id} onChange={e => setF({...f, upi_id: e.target.value})} className={inputStyle} />
        </div>

        {/* ABOUT & EXPERIENCE SECTION */}
        <div>
          <h3 className="text-[10px] uppercase tracking-widest text-[#D4B996] mb-4 font-black">About & Experience</h3>
          <textarea placeholder="Education (e.g. BA Graduate)" value={f.education} onChange={e => setF({...f, education: e.target.value})} className={inputStyle} rows={2} />
          <textarea placeholder="Experience (e.g. 5 Years in Makeup)" value={f.experience} onChange={e => setF({...f, experience: e.target.value})} className={inputStyle} rows={2} />
        </div>

        {/* MEDIA SECTION */}
        <div>
          <h3 className="text-[10px] uppercase tracking-widest text-[#D4B996] mb-4 font-black">Portfolio Media</h3>
          <textarea placeholder="Portfolio Image Links (one per line)" value={f.portfolio_images} onChange={e => setF({...f, portfolio_images: e.target.value})} className={inputStyle} rows={4} />
          <input placeholder="Profile Photo Link (Avatar URL)" value={f.avatar_url} onChange={e => setF({...f, avatar_url: e.target.value})} className={inputStyle} />
          <input placeholder="UPI QR Image Link" value={f.upi_qr_url} onChange={e => setF({...f, upi_qr_url: e.target.value})} className={inputStyle} />
        </div>
      </div>
      
      <button 
        onClick={save} 
        disabled={isSaving}
        className={`w-full py-5 bg-[#D4B996] text-[#1A1A1A] font-black rounded-3xl uppercase text-xs mb-8 transition-all shadow-2xl shadow-[#D4B996]/10 ${isSaving ? 'opacity-50 cursor-not-allowed' : 'opacity-100 active:scale-95'}`}
      >
        {isSaving ? 'Processing...' : 'Save Profile ✨'}
      </button>

      {profile?.username && (
        <div className="mt-8 p-8 bg-white/5 border border-[#D4B996]/20 rounded-[40px] text-center">
          <p className="text-[10px] uppercase tracking-widest text-[#D4B996] mb-6 font-black">Public Portfolio</p>
          <div className="flex gap-3">
            <button onClick={() => window.open(`/portfolio/${profile.username}`, '_blank')} className="flex-1 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-bold uppercase transition-all hover:bg-white/10">View Live</button>
            <button onClick={copyLink} className="flex-1 py-4 bg-[#D4B996] text-black rounded-2xl text-[10px] font-bold uppercase transition-all hover:bg-[#D4B996]/80">Copy Link</button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- 2. Services Manager ---
function ServicesManager({ profileId }) {
  const [list, setList] = useState([]);
  const [f, setF] = useState({ name: '', price: '', description: '' });
  
  const refresh = useCallback(() => getServices(profileId).then(setList), [profileId]);
  useEffect(() => { refresh(); }, [refresh]);

  const add = async () => {
    await upsertService({ ...f, profile_id: profileId });
    setF({ name: '', price: '', description: '' }); refresh();
  };

  return (
    <div className="space-y-6">
      <div className="p-6 bg-white/5 rounded-3xl border border-white/10">
        <input placeholder="Service Name" value={f.name} onChange={e => setF({...f, name: e.target.value})} className="w-full bg-transparent border-b border-white/10 py-3 mb-4 outline-none text-sm" />
        <input placeholder="Price" type="number" value={f.price} onChange={e => setF({...f, price: e.target.value})} className="w-full bg-transparent border-b border-white/10 py-3 mb-6 outline-none text-sm" />
        <button onClick={add} className="w-full py-3 bg-[#D4B996] text-black font-bold rounded-xl text-[10px] uppercase">Add Service</button>
      </div>
      {list.map(s => (
        <div key={s.id} className="flex justify-between items-center p-5 bg-white/5 rounded-2xl border border-white/5">
          <div><p className="font-bold text-sm">{s.name}</p><p className="text-[#D4B996] text-xs font-bold">{formatINR(s.price)}</p></div>
          <button onClick={async () => { await deleteService(s.id); refresh(); }} className="text-red-500 text-[10px] font-bold uppercase">Delete</button>
        </div>
      ))}
    </div>
  );
}

// --- 3. Calendar Manager (Busy/Green Toggle Fixed) ---
function CalendarManager({ profileId }) {
  const [map, setMap] = useState({});
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i);
    return d.toISOString().split('T')[0];
  });

  const refresh = useCallback(() => getAvailMap(profileId).then(setMap), [profileId]);
  useEffect(() => { refresh(); }, [refresh]);

  const toggle = async (date) => {
    const isBusy = map[date] === 'busy';
    // isBusy ? Make it Green (Available) : Make it Red (Busy)
    await toggleDate(profileId, date, !isBusy);
    refresh();
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#D4B996]/10 p-4 rounded-2xl border border-[#D4B996]/20 mb-4">
        <p className="text-[10px] text-[#D4B996] font-bold uppercase text-center">Tap to Toggle: Green = Available | Red = Busy</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {days.map(d => (
          <button key={d} onClick={() => toggle(d)} 
            className={`p-5 rounded-[24px] border transition-all active:scale-95 text-center ${map[d] === 'busy' ? 'bg-red-500/10 border-red-500/50 text-red-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'}`}>
            <span className="text-[11px] font-black tracking-tighter block mb-1">{formatDate(d)}</span>
            <span className="text-[9px] uppercase font-bold opacity-60">{map[d] === 'busy' ? '🔴 Busy' : '🟢 Available'}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// --- 4. Bookings List (Details & WhatsApp Fix) ---
function BookingsList({ profileId }) {
  const [list, setList] = useState([]);
  useEffect(() => { getBookings(profileId).then(setList); }, [profileId]);

  return (
    <div className="space-y-4">
      {list.length === 0 && <p className="text-center py-10 text-white/20 text-xs">No bookings found yet.</p>}
      {list.map(b => (
        <div key={b.id} className="p-6 bg-white/5 border border-white/10 rounded-[32px] animate-slideUp">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-[10px] uppercase text-[#D4B996] font-bold tracking-widest mb-1">Booking Date</p>
              <p className="text-lg font-black italic">{formatDate(b.booking_date)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase text-white/30 font-bold mb-1">Status</p>
              <span className="bg-[#D4B996] text-black text-[9px] font-black px-3 py-1 rounded-full uppercase">Confirmed</span>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-white/5">
            <div className="flex justify-between items-center">
              <span className="text-[10px] uppercase text-white/40 font-bold">Client</span>
              <span className="text-sm font-bold">{b.client_name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] uppercase text-white/40 font-bold">Phone</span>
              <span className="text-sm font-bold text-[#D4B996]">{b.client_phone}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] uppercase text-white/40 font-bold">Amount</span>
              <span className="text-sm font-bold">{formatINR(b.total_price)}</span>
            </div>
            
            {/* Displaying WhatsApp Details like UTR/Notes */}
            {b.note && (
              <div className="mt-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-[9px] uppercase text-white/30 font-bold mb-2">Booking Notes (WhatsApp Info)</p>
                <p className="text-[11px] text-white/80 leading-relaxed font-mono">{b.note}</p>
              </div>
            )}
          </div>
          
          <a href={`https://wa.me/${b.client_phone}`} target="_blank" className="block w-full text-center mt-6 py-3 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-xl text-[10px] font-bold uppercase tracking-widest">Chat on WhatsApp</a>
        </div>
      ))}
    </div>
  );
}
