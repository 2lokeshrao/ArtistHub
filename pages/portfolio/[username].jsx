import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  getProfileByUsername,
  getServicesByProfileId,
  getBusyDates,
  createBooking,
} from '../../lib/supabaseClient';
import { openWhatsApp } from '../../lib/whatsapp';
import { generateArtistPDF } from '../../lib/generatePDF';

// ── UNIVERSAL IMAGE TRANSFORMER ──
function transformDriveLink(url) {
  if (!url || typeof url !== 'string') return url;
  const trimmed = url.trim();
  if (trimmed.includes('drive.google.com')) {
    const fileId = trimmed.split('/d/')[1]?.split('/')[0] || trimmed.split('id=')[1]?.split('&')[0];
    if (fileId) return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
  }
  return trimmed;
}

function formatINR(n) {
  return `₹${Number(n).toLocaleString('en-IN')}`;
}

function getDaysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }
function toISO(year, month, day) { return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; }
function today() { const d = new Date(); return toISO(d.getFullYear(), d.getMonth(), d.getDate()); }

// ── Portfolio image grid ──
function PortfolioGrid({ images }) {
  if (!images?.length) return null;
  return (
    <section className="px-5 py-8">
      <h2 className="font-display text-xs tracking-[0.25em] text-champagne mb-5 uppercase">Portfolio</h2>
      <div className="grid grid-cols-3 gap-1.5">
        {images.slice(0, 9).map((url, i) => (
          <div key={i} className="aspect-square rounded-sm overflow-hidden bg-charcoal/20"
               style={{ gridRow: i === 0 ? 'span 2' : undefined, gridColumn: i === 0 ? 'span 2' : undefined }}>
            <img src={transformDriveLink(url)} alt={`Work ${i+1}`} className="w-full h-full object-cover transition-all hover:scale-105" loading="lazy" />
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Original Booking Calendar ──
function BookingCalendar({ busyDates, selectedDate, onSelect }) {
  const [viewDate, setViewDate] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });
  const { year, month } = viewDate;
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = new Date(year, month, 1).getDay();
  const monthName = new Date(year, month).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="bg-white/5 rounded-2xl p-4 border border-white/10 mt-2">
      <div className="flex items-center justify-between mb-4 px-2">
        <button onClick={() => setViewDate(v => v.month === 0 ? {year:v.year-1, month:11} : {year:v.year, month:v.month-1})} className="text-champagne">‹</button>
        <span className="text-sm font-medium">{monthName}</span>
        <button onClick={() => setViewDate(v => v.month === 11 ? {year:v.year+1, month:0} : {year:v.year, month:v.month+1})} className="text-champagne">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <div key={d} className="text-[10px] text-white/30 py-1">{d}</div>)}
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const iso = toISO(year, month, day);
          const isBusy = busyDates.has(iso);
          const isSelected = iso === selectedDate;
          return (
            <button key={i} onClick={() => onSelect(iso)} disabled={isBusy || iso < today()}
              className={`aspect-square rounded-lg text-[11px] ${isSelected ? 'bg-champagne text-charcoal' : isBusy ? 'text-white/20 line-through' : 'text-white/80 hover:bg-white/10'}`}>
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Updated Booking Form (Step 4 Logic) ──
function BookingForm({ profile, services, busyDates }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ selectedService: null, selectedDate: '', clientName: '', clientPhone: '', utr: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const totalPrice = form.selectedService?.price || 0;
  const advance = Math.round(totalPrice * 0.3);
  const pending = totalPrice - advance;

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await createBooking({ ...form, profile_id: profile.id, total_price: totalPrice, note: `UTR: ${form.utr}` });
      setSuccess(true);
      openWhatsApp(profile.phone, { ...form, advance, pending, serviceName: form.selectedService.name });
    } catch (e) { alert("Error!"); } finally { setLoading(false); }
  };

  if (success) return (
    <div className="text-center py-10 px-6">
      <div className="text-5xl mb-4">✨</div>
      <h2 className="text-xl text-champagne font-bold">Booking Successful!</h2>
      <p className="text-sm text-white/50 mt-2">Advance of {formatINR(advance)} recorded. See you on {form.selectedDate}!</p>
    </div>
  );

  return (
    <div className="space-y-5">
      {step === 1 && (
        <div className="space-y-2">
          {services.map(s => <button key={s.id} onClick={()=>{setForm({...form, selectedService:s}); setStep(2)}} className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl flex justify-between"><span>{s.name}</span><span className="text-champagne">{formatINR(s.price)}</span></button>)}
        </div>
      )}
      {step === 2 && (
        <div className="space-y-4">
          <BookingCalendar busyDates={busyDates} selectedDate={form.selectedDate} onSelect={d => setForm({...form, selectedDate:d})} />
          <button disabled={!form.selectedDate} onClick={()=>setStep(3)} className="w-full py-4 bg-champagne text-charcoal font-bold rounded-2xl">Next Step</button>
        </div>
      )}
      {step === 3 && (
        <div className="space-y-4">
          <input placeholder="Your Full Name" className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl" onChange={e=>setForm({...form, clientName:e.target.value})} />
          <input placeholder="WhatsApp Number" className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl" onChange={e=>setForm({...form, clientPhone:e.target.value})} />
          <button onClick={()=>setStep(4)} className="w-full py-4 bg-champagne text-charcoal font-bold rounded-2xl">Pay Advance</button>
        </div>
      )}
      {step === 4 && (
        <div className="space-y-6">
          <div className="bg-white/5 p-5 rounded-2xl border border-champagne/30 text-center">
            <p className="text-[10px] uppercase text-white/40 tracking-widest">Total: {formatINR(totalPrice)}</p>
            <p className="text-lg font-bold text-green-400 mt-1">Pay Advance: {formatINR(advance)}</p>
            <div className="bg-white p-3 rounded-xl inline-block mt-4 shadow-2xl">
              <img src={transformDriveLink(profile.upi_qr_url)} className="w-40 h-auto" />
            </div>
            <p className="text-[10px] text-white/30 mt-4 italic uppercase tracking-widest">Balance {formatINR(pending)} pay on event date morning</p>
          </div>
          <input placeholder="Enter Transaction ID / UTR" className="w-full p-4 bg-white/5 border border-champagne/30 rounded-2xl" onChange={e=>setForm({...form, utr:e.target.value})} />
          <div className="text-[10px] text-white/40 bg-red-500/5 p-4 rounded-xl border border-red-500/10">
            <b>T&C:</b> Advance is non-refundable. Balance must be paid on event morning or booking will be cancelled.
          </div>
          <button onClick={handleSubmit} disabled={!form.utr || loading} className="w-full py-4 bg-champagne text-charcoal font-bold rounded-2xl">Confirm Booking</button>
        </div>
      )}
    </div>
  );
}

// ── Main Page Component ──
export default function PortfolioPage() {
  const router = useRouter();
  const { username } = router.query;
  const [profile, setProfile] = useState(null);
  const [services, setServices] = useState([]);
  const [busyDates, setBusyDates] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('portfolio');

  useEffect(() => {
    if (!username) return;
    (async () => {
      try {
        const p = await getProfileByUsername(username);
        setProfile(p);
        const [svc, busy] = await Promise.all([getServicesByProfileId(p.id), getBusyDates(p.id)]);
        setServices(svc);
        setBusyDates(busy);
      } catch (e) { console.error(e); } finally { setLoading(false); }
    })();
  }, [username]);

  if (loading) return <div className="min-h-screen bg-charcoal flex items-center justify-center text-champagne animate-pulse">Loading…</div>;

  return (
    <main className="min-h-screen bg-charcoal text-white font-body">
      <Head>
        <title>{profile.full_name} · ArtistHub</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>

      {/* Cover */}
      <div className="relative h-48 w-full overflow-hidden">
        {profile.cover_url ? <img src={transformDriveLink(profile.cover_url)} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-charcoal" />}
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal via-transparent to-transparent" />
      </div>

      {/* Profile Card Fix (Less Gap) */}
      <div className="relative px-5 -mt-20 pb-4">
        <div className="flex items-end gap-4">
          {profile.avatar_url ? <img src={transformDriveLink(profile.avatar_url)} className="w-24 h-24 rounded-2xl object-cover border-2 border-champagne/30 shadow-2xl flex-shrink-0" /> : <div className="w-24 h-24 rounded-2xl bg-white/10 flex items-center justify-center text-2xl">✨</div>}
          <div className="pb-1">
            <h1 className="font-display text-2xl leading-tight">{profile.full_name}</h1>
            <p className="text-champagne/80 text-xs italic tracking-wide">{profile.tagline}</p>
          </div>
        </div>
        <button onClick={() => generateArtistPDF(profile, services)} className="mt-5 w-full py-2.5 rounded-xl border border-champagne/20 text-champagne text-[10px] uppercase tracking-[0.3em]">Download Portfolio PDF</button>
      </div>

      {/* Tab Switcher */}
      <div className="flex mx-5 mt-4 bg-white/5 rounded-2xl p-1 gap-1 border border-white/5">
        {[['portfolio','Portfolio'],['book','Book Now']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`flex-1 py-3 rounded-xl text-[10px] font-bold tracking-[0.2em] uppercase transition-all ${tab === id ? 'bg-champagne text-charcoal' : 'text-white/40'}`}>{label}</button>
        ))}
      </div>

      <div className="pb-20">
        {tab === 'portfolio' ? (
          <>
            <PortfolioGrid images={profile.portfolio_images} />
            {profile.upi_qr_url && (
              <section className="px-5 py-8 text-center bg-white/5 rounded-3xl mx-5 mt-4 border border-white/5">
                <h2 className="font-display text-[13px] tracking-widest text-champagne mb-5 uppercase">Pay via UPI</h2>
                <div className="bg-white p-4 rounded-2xl inline-block shadow-2xl">
                  <img src={transformDriveLink(profile.upi_qr_url)} className="w-full max-w-[180px] h-auto object-contain mx-auto" />
                </div>
                <p className="text-[14px] text-white/30 mt-4 uppercase tracking-widest italic">Scan to Pay 30% Advance</p>
              </section>
            )}
          </>
        ) : (
          <section className="px-5 py-8">
            <BookingForm profile={profile} services={services} busyDates={busyDates} />
          </section>
        )}
      </div>
      
      <footer className="text-center py-6 border-t border-white/5 text-[10px] text-white/20 tracking-widest uppercase">
        ArtistHub · Digital Portfolio &copy; 2026
        Made by 🤞 Lucky
      </footer>
    </main>
  );
 }
