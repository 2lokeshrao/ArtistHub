import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { 
  supabase, getOwnProfile, upsertProfile, getServicesByProfileId,
  upsertService, deleteService, getAvailabilityMap, toggleDateStatus,
  getOwnBookings 
} from '../../lib/supabaseClient';

// ── Helpers ──────────────────────────────────────────────────
const formatINR = n => `₹${Number(n).toLocaleString('en-IN')}`;
function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function toISO(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// ── Toast notification ────────────────────────────────────────
function Toast({ msg, type }) {
  if (!msg) return null;
  return (
    <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-2xl text-sm font-medium shadow-2xl transition-all ${
      type === 'error' ? 'bg-red-500/90 text-white' : 'bg-champagne text-charcoal'
    }`}>
      {msg}
    </div>
  );
}

// ── Profile Editor (Fixed Keyboard & Toggle) ──────────────────
function ProfileEditor({ profile, userId, onSaved }) {
  const [form, setForm] = useState({
    username: profile?.username || '',
    full_name: profile?.full_name || '',
    tagline: profile?.tagline || '',
    bio: profile?.bio || '',
    avatar_url: profile?.avatar_url || '',
    cover_url: profile?.cover_url || '',
    phone: profile?.phone || '',
    city: profile?.city || '',
    upi_qr_url: profile?.upi_qr_url || '',
    portfolio_images: (profile?.portfolio_images || []).join('\n'),
    instagram_url: profile?.instagram_url || '',
    snapchat_url: profile?.snapchat_url || '',
    youtube_url: profile?.youtube_url || '',
    is_public: profile?.is_public ?? true,
  });
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!form.username.trim()) { setError('Username is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const portfolio_images = form.portfolio_images
        .split('\n').map(u => u.trim()).filter(Boolean);
      const saved = await upsertProfile(userId, { ...form, portfolio_images });
      onSaved(saved);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-champagne/60 transition-colors";

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] tracking-widest text-champagne/70 mb-1.5 uppercase">Username *</label>
          <input name="username" value={form.username} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className="block text-[10px] tracking-widest text-champagne/70 mb-1.5 uppercase">Full Name *</label>
          <input name="full_name" value={form.full_name} onChange={handleChange} className={inputClass} />
        </div>
      </div>
      
      <div>
        <label className="block text-[10px] tracking-widest text-champagne/70 mb-1.5 uppercase">Tagline</label>
        <input name="tagline" value={form.tagline} onChange={handleChange} className={inputClass} />
      </div>

      <div>
        <label className="block text-[10px] tracking-widest text-champagne/70 mb-1.5 uppercase">Bio</label>
        <textarea name="bio" value={form.bio} onChange={handleChange} rows={3} className={inputClass + " resize-none"} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] tracking-widest text-champagne/70 mb-1.5 uppercase">Phone</label>
          <input name="phone" value={form.phone} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className="block text-[10px] tracking-widest text-champagne/70 mb-1.5 uppercase">City</label>
          <input name="city" value={form.city} onChange={handleChange} className={inputClass} />
        </div>
      </div>

      <hr className="border-white/10" />
      <p className="text-xs text-champagne/50 tracking-widest uppercase font-bold">Image URLs</p>

      <div>
        <label className="block text-[10px] tracking-widest text-champagne/70 mb-1.5 uppercase">Avatar URL</label>
        <input name="avatar_url" value={form.avatar_url} onChange={handleChange} className={inputClass} />
      </div>
      <div>
        <label className="block text-[10px] tracking-widest text-champagne/70 mb-1.5 uppercase">Cover URL</label>
        <input name="cover_url" value={form.cover_url} onChange={handleChange} className={inputClass} />
      </div>
      <div>
        <label className="block text-[10px] tracking-widest text-champagne/70 mb-1.5 uppercase">UPI QR URL</label>
        <input name="upi_qr_url" value={form.upi_qr_url} onChange={handleChange} className={inputClass} />
      </div>

      <div>
        <label className="block text-[10px] tracking-widest text-champagne/70 mb-1.5 uppercase">Portfolio Images (One per line)</label>
        <textarea name="portfolio_images" value={form.portfolio_images} onChange={handleChange} rows={5} className={inputClass + " font-mono resize-none"} />
      </div>

      <hr className="border-white/10" />
      <p className="text-xs text-champagne/50 tracking-widest uppercase font-bold">Social Links</p>
      
      <div className="space-y-3">
        <input name="instagram_url" placeholder="Instagram URL" value={form.instagram_url} onChange={handleChange} className={inputClass} />
        <input name="youtube_url" placeholder="YouTube URL" value={form.youtube_url} onChange={handleChange} className={inputClass} />
        <input name="snapchat_url" placeholder="Snapchat URL" value={form.snapchat_url} onChange={handleChange} className={inputClass} />
      </div>

      {/* Fixed Toggle Button using Inline Styles */}
      <div className="flex items-center gap-3 py-4 border-t border-white/10">
        <button
          type="button"
          onClick={() => setForm(f => ({ ...f, is_public: !f.is_public }))}
          style={{
            width: '44px',
            height: '24px',
            backgroundColor: form.is_public ? '#D4B996' : 'rgba(255,255,255,0.2)',
            borderRadius: '999px',
            position: 'relative',
            transition: 'background-color 0.2s',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            padding: '0 2px',
            flexShrink: 0
          }}
        >
          <div
            style={{
              width: '20px',
              height: '20px',
              backgroundColor: 'white',
              borderRadius: '50%',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              transform: form.is_public ? 'translateX(20px)' : 'translateX(0)',
              transition: 'transform 0.2s ease-in-out'
            }}
          />
        </button>
        <span className="text-sm text-white/70">
          Profile is <strong style={{ color: form.is_public ? '#D4B996' : 'rgba(255,255,255,0.4)' }}>
            {form.is_public ? 'Public' : 'Hidden'}
          </strong>
        </span>
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}
      <button onClick={handleSave} disabled={saving} className="w-full py-3 rounded-2xl bg-gradient-to-r from-champagne to-[#c8a96e] text-charcoal font-bold text-sm tracking-widest uppercase disabled:opacity-50">
        {saving ? 'Saving…' : 'Save Profile'}
      </button>
    </div>
  );
}

// ── Services Manager ──────────────────────────────────────────
function ServicesManager({ profileId }) {
  const [services, setServices] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', price: '', duration: '', category: '' });
  const [loading, setLoading] = useState(false);

  const loadServices = useCallback(async () => {
    if (!profileId) return;
    const data = await getServicesByProfileId(profileId);
    setServices(data);
  }, [profileId]);

  useEffect(() => { loadServices(); }, [loadServices]);

  const startEdit = (svc) => {
    setEditingId(svc ? svc.id : 'new');
    setForm(svc ? { name: svc.name, description: svc.description, price: svc.price, duration: svc.duration, category: svc.category } : { name: '', description: '', price: '', duration: '', category: '' });
  };

  const handleSave = async () => {
    if (!form.name || !form.price) return;
    setLoading(true);
    try {
      await upsertService(profileId, {
        ...(editingId !== 'new' ? { id: editingId } : {}),
        ...form,
        price: parseFloat(form.price),
      });
      setEditingId(null);
      loadServices();
    } catch (e) { alert(e.message); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this service?')) return;
    await deleteService(id);
    loadServices();
  };

  const CATEGORIES = ['Makeup', 'Hair', 'Nails', 'Skincare', 'Other'];

  return (
    <div className="space-y-4">
      {services.map(svc => (
        <div key={svc.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5">
          <div>
            <p className="font-medium text-sm">{svc.name}</p>
            <p className="text-[10px] text-white/40">{svc.category} · {svc.duration}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-champagne font-bold text-sm">{formatINR(svc.price)}</span>
            <button onClick={() => startEdit(svc)} className="text-white/40 hover:text-champagne text-xs">✏️</button>
            <button onClick={() => handleDelete(svc.id)} className="text-white/40 hover:text-red-400 text-xs">🗑</button>
          </div>
        </div>
      ))}

      {editingId ? (
        <div className="bg-white/5 border border-champagne/30 rounded-2xl p-4 space-y-3">
          <p className="text-xs text-champagne tracking-widest uppercase font-bold">
            {editingId === 'new' ? 'Add Service' : 'Edit Service'}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Service Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-champagne/60" />
            <input placeholder="Price (₹) *" type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-champagne/60" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Duration (e.g. 2-3 hrs)" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-champagne/60" />
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="bg-charcoal border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-champagne/60">
              <option value="">Category</option>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <input placeholder="Short description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-champagne/60" />
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={loading}
              className="flex-1 py-2 rounded-xl bg-champagne text-charcoal text-xs font-bold tracking-widest uppercase disabled:opacity-50">
              {loading ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setEditingId(null)}
              className="px-4 py-2 rounded-xl border border-white/10 text-white/50 text-xs">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => startEdit(null)}
          className="w-full py-3 rounded-2xl border border-dashed border-champagne/30 text-champagne/60 text-sm hover:border-champagne hover:text-champagne transition-all">
          + Add Service
        </button>
      )}
    </div>
  );
}

// ── Availability Calendar ─────────────────────────────────────
function AvailabilityCalendar({ profileId }) {
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [availMap, setAvailMap] = useState({});
  const [toggling, setToggling] = useState(null);

  const { year, month } = viewDate;

  useEffect(() => {
    if (!profileId) return;
    getAvailabilityMap(profileId).then(setAvailMap);
  }, [profileId, viewDate]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = new Date(year, month, 1).getDay();
  const monthName = new Date(year, month).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  const todayISO = toISO(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  const handleToggle = async (day) => {
    const iso = toISO(year, month, day);
    if (iso < todayISO) return;
    setToggling(iso);
    try {
      const current = availMap[iso] || 'available';
      const newStatus = await toggleDateStatus(profileId, iso, current);
      setAvailMap(m => ({ ...m, [iso]: newStatus }));
    } catch (e) { alert(e.message); }
    finally { setToggling(null); }
  };

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      <p className="text-xs text-white/40 mb-4">Tap a date to toggle Busy / Available. Clients cannot book Busy dates.</p>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setViewDate(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 })}
          className="text-champagne text-lg px-2">‹</button>
        <span className="text-sm font-medium">{monthName}</span>
        <button onClick={() => setViewDate(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 })}
          className="text-champagne text-lg px-2">›</button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} className="text-center text-[10px] text-white/40 font-medium py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const iso = toISO(year, month, day);
          const status = availMap[iso] || 'available';
          const isBusy = status === 'busy';
          const isPast = iso < todayISO;
          const isToggling = toggling === iso;

          return (
            <button key={i} onClick={() => handleToggle(day)} disabled={isPast || isToggling}
              className={`w-full aspect-square rounded-lg text-[11px] font-medium transition-all flex items-center justify-center ${
                isPast
                  ? 'text-white/20 cursor-not-allowed'
                  : isBusy
                  ? 'bg-red-500/30 text-red-300 hover:bg-red-500/50 border border-red-500/30'
                  : 'bg-emerald-500/10 text-emerald-300/80 hover:bg-emerald-500/20 border border-emerald-500/20'
              } ${isToggling ? 'scale-90 opacity-50' : ''}`}
            >
              {day}
            </button>
          );
        })}
      </div>

      <div className="flex gap-4 mt-4 text-[10px] text-white/50">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-500/30 inline-block" />Available</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-red-500/30 inline-block" />Busy</span>
      </div>
    </div>
  );
}

// ── Bookings list ─────────────────────────────────────────────
function BookingsList({ profileId }) {
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!profileId) return;
    getOwnBookings(profileId).then(setBookings);
  }, [profileId]);

  const STATUS_COLOR = { pending: 'text-yellow-400', confirmed: 'text-emerald-400', cancelled: 'text-red-400' };

  const filtered = filter === 'all' ? bookings : bookings.filter(b => b.status === filter);

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {['all','pending','confirmed','cancelled'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-full text-xs capitalize transition-all ${
              filter === s ? 'bg-champagne text-charcoal' : 'bg-white/5 text-white/50 hover:bg-white/10'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      {filtered.length === 0 && <p className="text-white/30 text-sm text-center py-6">No bookings yet.</p>}
      <div className="space-y-3">
        {filtered.map(b => (
          <div key={b.id} className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-sm">{b.client_name}</p>
                <p className="text-[11px] text-white/50 mt-0.5">{b.services?.name ?? 'Service'} · {b.booking_date}</p>
                {b.time_slot && <p className="text-[10px] text-white/40">⏰ {b.time_slot}</p>}
                <p className="text-[11px] text-white/40 mt-1">📞 {b.client_phone}</p>
              </div>
              <div className="text-right">
                <span className="text-champagne font-bold text-sm">{formatINR(b.total_price)}</span>
                <p className={`text-[10px] mt-1 capitalize font-medium ${STATUS_COLOR[b.status]}`}>{b.status}</p>
              </div>
            </div>
            {b.note && <p className="text-[10px] text-white/30 mt-2 border-t border-white/5 pt-2">{b.note}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Dashboard Main Component ──────────────────────────────────
export default function Dashboard() {
  const router = useRouter();
  const [session, setSession]   = useState(null);
  const [profile, setProfile]   = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tab, setTab]           = useState('profile');
  const [toast, setToast]       = useState({ msg: '', type: 'success' });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: 'success' }), 3000);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
      if (!session) router.replace('/login');
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) router.replace('/login');
    });
    return () => subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!session?.user) return;
