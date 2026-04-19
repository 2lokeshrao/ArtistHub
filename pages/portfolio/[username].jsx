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

// --- Utils ---
function transformDriveLink(url) {
  if (!url || typeof url !== 'string') return url;
  if (url.includes('drive.google.com')) {
    const fileId = url.split('/d/')[1]?.split('/')[0] || url.split('id=')[1]?.split('&')[0];
    if (fileId) return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
  }
  return url;
}

const formatINR = n => `₹${Number(n).toLocaleString('en-IN')}`;

function getDaysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }
function toISO(year, month, day) { return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; }
function today() { const d = new Date(); return toISO(d.getFullYear(), d.getMonth(), d.getDate()); }

// --- Sub-Component: Calendar ---
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
    <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
      <div className="flex items-center justify-between mb-4 px-2">
        <button onClick={() => setViewDate(v => v.month === 0 ? {year:v.year-1, month:11} : {year:v.year, month:v.month-1})} className="text-[#D4B996]">‹</button>
        <span className="text-sm font-medium">{monthName}</span>
        <button onClick={() => setViewDate(v => v.month === 11 ? {year:v.year+1, month:0} : {year:v.year, month:v.month+1})} className="text-[#D4B996]">›</button>
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
              className={`aspect-square rounded-lg text-[11px] font-bold ${isSelected ? 'bg-[#D4B996] text-[#1A1A1A] shadow-lg' : isBusy ? 'text-white/10 line-through' : 'text-white/80 hover:bg-white/10'}`}>
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --- Main Page Component ---
export default function PortfolioPage() {
  const router = useRouter();
  const { username } = router.query;
  const [profile, setProfile] = useState(null);
  const [services, setServices] = useState([]);
  const [busyDates, setBusyDates] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [showBooking, setShowBooking] = useState(false);

  useEffect(() => {
    if (!username) return;
    (async () => {
      try {
        const p = await getProfileByUsername(username);
        setProfile(p);
        const [svc, busy] = await Promise.all([getServicesByProfileId(p.id), getBusyDates(p.id)]);
        setServices(svc);
        setBusyDates(busy);
      } catch (e) { console.error(e); } 
      finally { setLoading(false); }
    })();
  }, [username]);

  if (loading) return <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center text-[#D4B996] animate-pulse italic">ArtistHub Loading...</div>;
  if (!profile) return <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center text-white/20 uppercase tracking-widest">Artist Not Found</div>;

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-white font-sans pb-32">
      <Head><title>{profile.full_name} | Portfolio</title></Head>

      {/* 1. Header (No Gap) */}
      <div className="relative h-60 w-full overflow-hidden">
        {profile.cover_url ? (
          <img src={transformDriveLink(profile.cover_url)} className="w-full h-full object-cover opacity-30" />
        ) : <div className="w-full h-full bg-[#252525]" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A1A] to-transparent" />
      </div>

      <div className="relative px-6 -mt-20 flex flex-col items-center text-center pb-10 border-b border-white/5">
        <img src={transformDriveLink(profile.avatar_url)} className="w-32 h-32 rounded-[32px] object-cover border-4 border-[#1A1A1A] shadow-2xl mb-4" />
        <h1 className="text-3xl font-bold text-[#D4B996] italic tracking-tighter">{profile.full_name}</h1>
        <p className="text-[10px] uppercase tracking-[0.4em] text-white/30 mt-2">{profile.tagline || 'Makeup Artist & Stylist'}</p>
      </div>

      {/* 2. Content Sections */}
      <section className="p-6 space-y-12">
        
        {/* Achievements */}
        <div className="space-y-4">
          <h2 className="text-[10px] uppercase tracking-[0.3em] text-[#D4B996] font-bold border-l-2 border-[#D4B996] pl-3">Education & Experience</h2>
          <div className="grid gap-3 text-xs leading-relaxed text-white/60 italic">
            <div className="p-5 bg-white/5 rounded-3xl border border-white/10">
              {profile.education || "Bachelor of Arts degree with Advanced Professional Makeup Certification from International Academy."}
            </div>
          </div>
        </div>

        {/* Services */}
        <div className="space-y-4">
          <h2 className="text-[10px] uppercase tracking-[0.3em] text-[#D4B996] font-bold border-l-2 border-[#D4B996] pl-3">Our Services</h2>
          <div className="grid gap-4">
            {services.map(s => (
              <div key={s.id} className="p-6 bg-white/5 border border-white/10 rounded-[32px] relative overflow-hidden group">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-lg text-[#D4B996]">{s.name}</h3>
                  <span className="font-bold text-[#D4B996]">{formatINR(s.price)}</span>
                </div>
                <p className="text-[11px] text-white/40 mb-4">{s.description || "Includes premium HD products, professional hairstyling, and draping."}</p>
                <div className="flex gap-2">
                   <span className="text-[8px] bg-[#D4B996]/10 text-[#D4B996] px-2 py-1 rounded-md uppercase">MAC & Kryolan</span>
                   <span className="text-[8px] bg-[#D4B996]/10 text-[#D4B996] px-2 py-1 rounded-md uppercase">Waterproof</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Social */}
        <div className="space-y-4">
          <h2 className="text-[10px] uppercase tracking-[0.3em] text-[#D4B996] font-bold border-l-2 border-[#D4B996] pl-3">Social Handles</h2>
          <a href={profile.instagram_url || '#'} className="block p-6 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-white/10 rounded-[32px] text-center group active:scale-95 transition-all">
             <span className="text-3xl mb-2 block">📸</span>
             <p className="text-xs font-bold tracking-widest uppercase">Instagram Profile</p>
             <p className="text-[9px] text-white/30 mt-1 italic">Check my recent works & reels</p>
          </a>
        </div>

        {/* Payment Section */}
        <div className="text-center py-10 bg-white/5 rounded-[40px] border border-white/10">
           <h2 className="text-[10px] uppercase tracking-[0.3em] text-[#D4B996] font-bold mb-8">Official Payment QR</h2>
           {profile.upi_qr_url ? (
             <div className="bg-white p-5 rounded-[40px] inline-block shadow-2xl border-8 border-[#D4B996]/10">
               <img src={transformDriveLink(profile.upi_qr_url)} className="w-48 h-auto" alt="QR" />
               <p className="text-[10px] text-black/30 font-mono mt-4 tracking-tighter uppercase">{profile.upi_id}</p>
             </div>
           ) : <p className="text-xs text-white/20 italic">No QR Link provided</p>}
        </div>

      </section>

      {/* 3. Footer */}
      <footer className="px-6 py-12 text-center border-t border-white/5 space-y-4">
          <h2 className="text-xl font-bold italic text-[#D4B996] opacity-30">ArtistHub</h2>
          <p className="text-[9px] text-white/20 uppercase tracking-[0.4em] leading-loose">
            Digital Portfolio &copy; 2026 <br/> 
            Made by 🤞 Lucky
          </p>
      </footer>

      {/* 4. Book Now Fixed Button */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-[#1A1A1A]/90 backdrop-blur-2xl z-40 border-t border-white/5">
        <button onClick={() => setShowBooking(true)} className="w-full py-5 bg-[#D4B996] text-[#1A1A1A] font-bold rounded-3xl shadow-2xl shadow-[#D4B996]/20 uppercase tracking-[0.2em] text-xs active:scale-95 transition-all">
          Book Appointment ✨
        </button>
      </div>

      {/* 5. Booking Overlay Flow */}
      {showBooking && (
        <div className="fixed inset-0 z-[60] bg-[#1A1A1A] overflow-y-auto animate-fadeIn">
          <div className="p-6">
            <button onClick={() => setShowBooking(false)} className="text-[#D4B996] text-[10px] font-bold uppercase mb-10 tracking-[0.3em] block">← Back to Portfolio</button>
            <BookingFlow profile={profile} services={services} busyDates={busyDates} />
          </div>
        </div>
      )}
    </div>
  );
}

// --- Full Booking Logic Component ---
function BookingFlow({ profile, services, busyDates }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({ selectedService: null, selectedDate: '', clientName: '', clientPhone: '', utr: '' });

  const totalPrice = form.selectedService?.price || 0;
  const advance = Math.round(totalPrice * 0.3);
  const pending = totalPrice - advance;
  const upiLink = `upi://pay?pa=${profile.upi_id}&pn=${encodeURIComponent(profile.full_name)}&am=${advance}&cu=INR&tn=BookingAdvance`;

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await createBooking({ ...form, profile_id: profile.id, total_price: totalPrice, note: `Advance: ${advance}, UTR: ${form.utr}` });
      setSuccess(true);
      openWhatsApp(profile.phone, { ...form, advance, pending, serviceName: form.selectedService.name });
    } catch (e) { alert("Error!"); } finally { setLoading(false); }
  };

  if (success) return (
    <div className="text-center py-20 animate-fadeIn">
      <div className="text-6xl mb-6">✨</div>
      <h2 className="text-3xl font-bold text-[#D4B996] italic mb-4">Confirmed!</h2>
      <p className="text-white/60 text-sm leading-relaxed mb-10">Advance of {formatINR(advance)} recorded. <br/> See you on {form.selectedDate}!</p>
      <div className="p-4 bg-[#D4B996]/10 border border-[#D4B996]/20 rounded-2xl text-[10px] uppercase text-[#D4B996] tracking-widest">Balance {formatINR(pending)} to be paid on event morning</div>
    </div>
  );

  return (
    <div className="space-y-8 animate-slideUp">
      {/* Step 1: Select Service */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-[10px] text-white/40 uppercase tracking-widest ml-1">Step 01: Select Service</p>
          {services.map(s => (
            <button key={s.id} onClick={() => { setForm({...form, selectedService: s}); setStep(2); }} className="w-full p-5 bg-white/5 border border-white/10 rounded-3xl flex justify-between items-center active:bg-[#D4B996]/10 transition-colors">
              <span className="font-bold text-sm">{s.name}</span>
              <span className="text-[#D4B996] font-bold">{formatINR(s.price)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Step 2: Select Date */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-[10px] text-white/40 uppercase tracking-widest ml-1">Step 02: Pick Date</p>
          <BookingCalendar busyDates={busyDates} selectedDate={form.selectedDate} onSelect={d => setForm({...form, selectedDate: d})} />
          <button disabled={!form.selectedDate} onClick={() => setStep(3)} className="w-full py-4 bg-[#D4B996] text-[#1A1A1A] font-bold rounded-2xl disabled:opacity-20">Continue</button>
        </div>
      )}

      {/* Step 3: Client Info */}
      {step === 3 && (
        <div className="space-y-4">
          <p className="text-[10px] text-white/40 uppercase tracking-widest ml-1">Step 03: Your Details</p>
          <input placeholder="Your Full Name" className="w-full p-5 bg-white/5 border border-white/10 rounded-3xl outline-none" onChange={e => setForm({...form, clientName: e.target.value})} />
          <input placeholder="WhatsApp Number" className="w-full p-5 bg-white/5 border border-white/10 rounded-3xl outline-none" onChange={e => setForm({...form, clientPhone: e.target.value})} />
          <button disabled={!form.clientName || !form.clientPhone} onClick={() => setStep(4)} className="w-full py-4 bg-[#D4B996] text-[#1A1A1A] font-bold rounded-2xl">Proceed to Payment</button>
        </div>
      )}

      {/* Step 4: Advance Payment */}
      {step === 4 && (
        <div className="space-y-6">
          <p className="text-[10px] text-white/40 uppercase tracking-widest ml-1">Step 04: Secure Booking</p>
          <div className="bg-[#D4B996]/10 p-6 rounded-[32px] border border-[#D4B996]/20 text-center space-y-2">
            <p className="text-xs text-white/40 uppercase tracking-widest">Pay 30% Advance Now</p>
            <p className="text-3xl font-bold text-[#D4B996] tracking-tighter">{formatINR(advance)}</p>
            <a href={upiLink} className="inline-block mt-4 bg-[#5f259f] text-white px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg">🟣 Pay via App</a>
          </div>
          <input placeholder="Enter Transaction ID / UTR" className="w-full p-5 bg-white/5 border border-white/10 rounded-3xl text-center outline-none focus:border-[#D4B996]" onChange={e => setForm({...form, utr: e.target.value})} />
          <div className="text-[10px] text-white/30 bg-red-500/5 p-5 rounded-2xl border border-red-500/10 uppercase italic leading-relaxed">
            Note: Advance is non-refundable. Final 70% must be paid on event morning to confirm services.
          </div>
          <button onClick={handleSubmit} disabled={!form.utr || loading} className="w-full py-5 bg-[#D4B996] text-[#1A1A1A] font-bold rounded-3xl uppercase tracking-widest text-xs disabled:opacity-20">Confirm Booking ✨</button>
        </div>
      )}
    </div>
  );
}
