import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { 
  supabase, getOwnProfile, upsertProfile, getServicesByProfileId,
  upsertService, deleteService, getAvailabilityMap, toggleDateStatus,
  getOwnBookings 
} from '../../lib/supabaseClient';

const formatINR = n => `₹${Number(n).toLocaleString('en-IN')}`;
function toISO(y, m, d) { return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }

// --- Toast ---
function Toast({ msg, type }) {
  if (!msg) return null;
  return <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-2xl text-sm ${type === 'error' ? 'bg-red-500' : 'bg-champagne text-charcoal'}`}>{msg}</div>;
}

// --- Profile Editor ---
function ProfileEditor({ profile, userId, onSaved }) {
  const [form, setForm] = useState({
    username: profile?.username || '', full_name: profile?.full_name || '',
    tagline: profile?.tagline || '', bio: profile?.bio || '',
    avatar_url: profile?.avatar_url || '', cover_url: profile?.cover_url || '',
    phone: profile?.phone || '', city: profile?.city || '',
    portfolio_images: (profile?.portfolio_images || []).join('\n'), is_public: profile?.is_public ?? true,
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!form.username.trim()) return alert("Username required");
    setSaving(true);
    try {
      const p_imgs = form.portfolio_images.split('\n').map(u => u.trim()).filter(Boolean);
      const saved = await upsertProfile(userId, { ...form, portfolio_images: p_imgs });
      onSaved(saved);
    } catch (e) { alert(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <input name="username" placeholder="Username" value={form.username} onChange={handleChange} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white" />
        <input name="full_name" placeholder="Full Name" value={form.full_name} onChange={handleChange} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white" />
      </div>
      <input name="tagline" placeholder="Tagline" value={form.tagline} onChange={handleChange} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white" />
      <textarea name="bio" placeholder="Bio" value={form.bio} onChange={handleChange} rows={3} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white" />
      
      <div className="flex items-center gap-3 py-2">
        <button type="button" onClick={() => setForm(f => ({ ...f, is_public: !f.is_public }))}
          style={{ width: '44px', height: '24px', backgroundColor: form.is_public ? '#D4B996' : '#444', borderRadius: '20px', position: 'relative', border: 'none' }}>
          <div style={{ width: '18px', height: '18px', backgroundColor: 'white', borderRadius: '50%', position: 'absolute', top: '3px', left: form.is_public ? '23px' : '3px', transition: '0.2s' }} />
        </button>
        <span className="text-sm text-white/60">Profile is {form.is_public ? 'Public' : 'Hidden'}</span>
      </div>

      <button onClick={handleSave} disabled={saving} className="w-full py-3 rounded-xl bg-champagne text-charcoal font-bold uppercase tracking-widest">{saving ? 'Saving...' : 'Save Profile'}</button>
    </div>
  );
}

// --- Services Manager (Fixed Add Service) ---
function ServicesManager({ profileId }) {
  const [services, setServices] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', price: '', duration: '', category: 'Other' });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => { if (profileId) setServices(await getServicesByProfileId(profileId)); }, [profileId]);
  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.name || !form.price) return alert("Fill Name & Price");
    setLoading(true);
    try {
      await upsertService(profileId, { ...(editingId !== 'new' ? { id: editingId } : {}), ...form, price: parseFloat(form.price) });
      setEditingId(null);
      setForm({ name: '', price: '', duration: '', category: 'Other' });
      load();
    } catch (e) { alert(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      {services.map(s => (
        <div key={s.id} className="p-4 bg-white/5 border border-white/10 rounded-xl flex justify-between items-center">
          <div><p className="text-sm font-bold">{s.name}</p><p className="text-xs text-white/40">{formatINR(s.price)} · {s.duration}</p></div>
          <button onClick={async () => { if(confirm('Delete?')) { await deleteService(s.id); load(); } }} className="text-xs text-red-400">🗑</button>
        </div>
      ))}

      {editingId ? (
        <div className="p-4 bg-white/5 border border-champagne/30 rounded-xl space-y-3">
          <input placeholder="Service Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full bg-charcoal border border-white/10 rounded-lg p-2 text-sm" />
          <input placeholder="Price" type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})} className="w-full bg-charcoal border border-white/10 rounded-lg p-2 text-sm" />
          <input placeholder="Duration" value={form.duration} onChange={e => setForm({...form, duration: e.target.value})} className="w-full bg-charcoal border border-white/10 rounded-lg p-2 text-sm" />
          <div className="flex gap-2">
            <button onClick={handleSave} className="flex-1 py-2 bg-champagne text-charcoal rounded-lg text-xs font-bold uppercase">{loading ? '...' : 'Save'}</button>
            <button onClick={() => setEditingId(null)} className="flex-1 py-2 border border-white/10 rounded-lg text-xs">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setEditingId('new')} className="w-full py-3 border border-dashed border-champagne/40 text-champagne rounded-xl text-sm">+ Add Service</button>
      )}
    </div>
  );
}

// --- Main Dashboard ---
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

  if (loading) return <div className="min-h-screen bg-charcoal flex items-center justify-center text-champagne">Loading...</div>;

  return (
    <div className="min-h-screen bg-charcoal text-white font-body pb-20">
      <header className="p-5 border-b border-white/5 flex justify-between items-center">
        <h1 className="font-display text-xl text-champagne italic">ArtistHub</h1>
        <button onClick={() => supabase.auth.signOut()} className="text-[10px] text-white/40 uppercase tracking-widest">Logout</button>
      </header>

      <nav className="flex px-5 mt-4 border-b border-white/5 gap-6">
        {['profile', 'services'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`pb-2 text-[11px] uppercase tracking-widest font-bold border-b-2 transition-all ${tab === t ? 'border-champagne text-champagne' : 'border-transparent text-white/30'}`}>{t}</button>
        ))}
      </nav>

      <div className="p-6 max-w-xl mx-auto">
        {tab === 'profile' && <ProfileEditor profile={profile} userId={session?.user?.id} onSaved={setProfile} />}
        {tab === 'services' && profile && <ServicesManager profileId={profile.id} />}
      </div>
    </div>
  );
}
