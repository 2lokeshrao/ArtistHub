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
            <img src={transformDriveLink(url)} alt="Work" className="w-full h-full object-cover transition-all hover:scale-105" loading="lazy" />
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
              className={`aspect-square rounded-lg text-[11px] ${isSelected ? 'bg-champagne text-charcoal shadow-lg scale-105' : isBusy ? 'text-white/20 line-through' : 'text-white/80 hover:bg-white/10'}`}>
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Updated Booking Form with Dynamic UPI ID Logic ──
function BookingForm({ profile, services, busyDates }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ selectedService: null, selectedDate: '', clientName: '', clientPhone: '', utr: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const totalPrice = form.selectedService?.price || 0;
  const advance = Math.round(totalPrice * 0.3);
  const pending = totalPrice - advance;

  // DYNAMIC UPI LOGIC: Using profile.upi_id from database
  const upiId = profile.upi_id || "payment@upi"; // Fallback if ID is missing
  const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(profile.full_name)}&am=${advance}&cu=INR&tn=AdvanceBooking`;

  const handleSubmit = async () => {
    if (!form.utr || form.utr.length < 10) return;
    setLoading(true);
    try {
      await createBooking({ 
        profile_id: profile.id,
        service_id: form.selectedService.id,
        client_name: form.clientName,
        client_phone: form.clientPhone,
        booking_date: form.selectedDate,
        total_price: totalPrice,
        note: `Advance: ${advance}, UTR: ${form.utr}, UPI: ${upiId}` 
      });
      setSuccess(true);
      if (profile.phone) {
        openWhatsApp(profile.phone, { ...form, advance, pending, serviceName: form.selectedService.name });
      }
    } catch (e) { alert("Error in booking."); } finally { setLoading(false); }
  };

  if (success) return (
    <div className="text-center py-12 px-6 animate-fadeIn">
      <div className="text-6xl mb-6">🎉</div>
      <h2 className="text-2xl text-champagne font-bold mb-3">Confirmed!</h2>
      <p className="text-sm text-white/70">Your booking is secure. <br/> Transaction ID: {form.utr}</p>
      <div className="mt-8 p-4 bg-white/5 rounded-xl border border-white/10 text-[9px] text-white/30 uppercase tracking-[0.2em]">
        Pay balance {formatINR(pending)} on {form.selectedDate}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {step === 1 && (
        <div className="space-y-3">
          <label className="text-[10px] tracking-widest text-champagne uppercase ml-2">Choose Service</label>
          {services.map(s => (
            <button key={s.id} onClick={()=>{setForm({...form, selectedService:s}); setStep(2)}} 
                    className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl flex justify-between hover:border-champagne/40">
              <span className="font-medium">{s.name}</span>
              <span className="text-champagne font-bold">{formatINR(s.price)}</span>
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <label className="text-[10px] tracking-widest text-champagne uppercase ml-2">Select Date</label>
          <BookingCalendar busyDates={busyDates} selectedDate={form.selectedDate} onSelect={d => setForm({...form, selectedDate:d})} />
          <button disabled={!form.selectedDate} onClick={()=>setStep(3)} 
                  className="w-full py-4 bg-champagne text-charcoal font-bold rounded-2xl disabled:opacity-30">Next</button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <label className="text-[10px] tracking-widest text-champagne uppercase ml-2">Details</label>
          <input placeholder="Your Name" className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-champagne/40" 
                 onChange={e=>setForm({...form, clientName:e.target.value})} />
          <input placeholder="WhatsApp Number" className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-champagne/40" 
                 onChange={e=>setForm({...form, clientPhone:e.target.value})} />
          <button disabled={!form.clientName || !form.clientPhone} onClick={()=>setStep(4)} 
                  className="w-full py-4 bg-champagne text-charcoal font-bold rounded-2xl disabled:opacity-30">Payment</button>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-6">
          <div className="bg-white/5 p-5 rounded-2xl border border-champagne/30 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-champagne text-charcoal px-3 py-1 text-[8px] font-bold uppercase">30% Advance</div>
            <p className="text-[10px] uppercase text-white/40 tracking-widest mt-2">Total Amount: {formatINR(totalPrice)}</p>
            <p className="text-xl font-bold text-green-400 mt-1">Pay Now: {formatINR(advance)}</p>
            
            <a href={upiLink} className="inline-flex items-center gap-2 bg-[#5f259f] text-white px-6 py-3 rounded-xl font-bold mt-6 shadow-lg active:scale-95 text-sm">
              🟣 Pay via App
            </a>

            <div className="bg-white p-3 rounded-xl inline-block mt-6 shadow-2xl block mx-auto">
              <img src={transformDriveLink(profile.upi_qr_url)} className="w-40 h-auto" alt="QR" />
            </div>
            <p className="text-[9px] text-white/30 mt-4 uppercase tracking-widest">UPI ID: {upiId}</p>
          </div>

          <div className="space-y-2 text-center">
            <label className="text-[10px] text-champagne uppercase tracking-[0.2em]">Enter Transaction ID / UTR *</label>
            <input placeholder="Paste 12-digit UTR Number" 
                   className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-center outline-none focus:border-champagne" 
                   onChange={e=>setForm({...form, utr: e.target.value})} />
          </div>

          <div className="text-[9px] text-white/30 bg-red-500/5 p-4 rounded-xl border border-red-500/10 uppercase leading-relaxed">
            <b>Note:</b> Advance is non-refundable. Pay 70% balance on event morning.
          </div>

          <button onClick={handleSubmit} 
                  disabled={!form.utr || form.utr.length < 10 || loading} 
                  className={`w-full py-4 rounded-2xl font-bold transition-all ${form.utr && form.utr.length >= 10 ? 'bg-champagne text-charcoal shadow-lg' : 'bg-white/10 text-white/20'}`}>
            {loading ? 'Verifying...' : '✅ Confirm Booking'}
          </button>
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

  if (loading) return <div className="min-h-screen bg-charcoal flex items-center justify-center text-champagne animate-pulse uppercase tracking-[0.3em] text-xs">ArtistHub Loading...</div>;
  if (!profile) return <div className="min-h-screen bg-charcoal flex items-center justify-center text-white/30 tracking-widest uppercase">Profile Not Found</div>;

  return (
    <main className="min-h-screen bg-charcoal text-white font-body pb-10">
      <Head>
        <title>{profile.full_name} · ArtistHub</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </Head>

      <div className="relative h-48 w-full overflow-hidden">
        {profile.cover_url ? <img src={transformDriveLink(profile.cover_url)} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-charcoal" />}
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal via-transparent to-transparent" />
      </div>

      <div className="relative px-5 -mt-20 pb-4">
        <div className="flex items-end gap-4">
          {profile.avatar_url ? <img src={transformDriveLink(profile.avatar_url)} className="w-24 h-24 rounded-2xl object-cover border-2 border-champagne/30 shadow-2xl flex-shrink-0" /> : <div className="w-24 h-24 rounded-2xl bg-white/10 flex items-center justify-center text-2xl">✨</div>}
          <div className="pb-1">
            <h1 className="font-display text-2xl leading-tight">{profile.full_name}</h1>
            <p className="text-champagne/80 text-xs italic tracking-wide">{profile.tagline}</p>
          </div>
        </div>
        <button onClick={() => generateArtistPDF(profile, services)} className="mt-5 w-full py-2.5 rounded-xl border border-white/10 text-white/50 text-[10px] uppercase tracking-[0.3em] hover:text-champagne hover:border-champagne/30 transition-all">Download Portfolio PDF</button>
      </div>

      <div className="flex mx-5 mt-4 bg-white/5 rounded-2xl p-1 gap-1 border border-white/5">
        {[['portfolio','Portfolio'],['book','Book Now']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`flex-1 py-3 rounded-xl text-[10px] font-bold tracking-[0.2em] uppercase transition-all ${tab === id ? 'bg-champagne text-charcoal shadow-lg' : 'text-white/40'}`}>{label}</button>
        ))}
      </div>

      <div className="mt-2 min-h-[400px]">
        {tab === 'portfolio' ? (
          <>
            <PortfolioGrid images={profile.portfolio_images} />
            {profile.upi_qr_url && (
              <section className="px-5 py-8 text-center bg-white/5 rounded-3xl mx-5 mt-4 border border-white/5">
                <h2 className="font-display text-[10px] tracking-widest text-champagne mb-5 uppercase">Quick Scan Pay</h2>
                <div className="bg-white p-4 rounded-2xl inline-block shadow-2xl">
                  <img src={transformDriveLink(profile.upi_qr_url)} className="w-full max-w-[180px] h-auto object-contain mx-auto" />
                </div>
                {profile.upi_id && <p className="text-[11px] text-white/50 mt-4 font-mono">{profile.upi_id}</p>}
                <p className="text-[10px] text-white/20 mt-2 uppercase tracking-widest italic font-medium">30% Advance required to block date</p>
              </section>
            )}
          </>
        ) : (
          <section className="px-5 py-6 animate-fadeIn">
            <BookingForm profile={profile} services={services} busyDates={busyDates} />
          </section>
        )}
      </div>
      
      <footer className="text-center py-10 border-t border-white/5 text-[9px] text-white/10 tracking-[0.3em] uppercase leading-relaxed">
        ArtistHub Digital Portfolio &copy; 2026 <br/>
        Made by 🤞 Lucky
      </footer>
    </main>
  );
  }
          
