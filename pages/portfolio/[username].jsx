import { useState, useEffect, useRef } from 'react';
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
const formatINR = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;
function transformDriveLink(url) {
  if (!url || typeof url !== 'string') return url;
  const fileId = url.split('/d/')[1]?.split('/')[0] || url.split('id=')[1]?.split('&')[0];
  return fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000` : url;
}
function toISO(year, month, day) { return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; }

// --- Sub-Component: Calendar ---
function BookingCalendar({ busyDates, selectedDate, onSelect }) {
  const [view, setView] = useState({ y: new Date().getFullYear(), m: new Date().getMonth() });
  const days = new Date(view.y, view.m + 1, 0).getDate();
  const first = new Date(view.y, view.m, 1).getDay();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];

  return (
    <div className="bg-white/5 rounded-3xl p-4 border border-white/10 mt-4">
      <div className="flex justify-between items-center mb-6 px-2">
        <button onClick={() => setView(v => v.m === 0 ? { y: v.y - 1, m: 11 } : { ...v, m: v.m - 1 })} className="text-[#D4B996] text-xl">‹</button>
        <span className="text-sm font-bold uppercase tracking-[0.2em]">{new Date(view.y, view.m).toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
        <button onClick={() => setView(v => v.m === 11 ? { y: v.y + 1, m: 0 } : { ...v, m: v.m + 1 })} className="text-[#D4B996] text-xl">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <div key={d} className="text-[10px] text-white/20 py-2 font-bold uppercase">{d}</div>)}
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const iso = toISO(view.y, view.m, day);
          const isBusy = busyDates.has(iso);
          const isSelected = iso === selectedDate;
          const isPast = iso < new Date().toISOString().split('T')[0];
          return (
            <button key={i} onClick={() => onSelect(iso)} disabled={isBusy || isPast}
              className={`aspect-square rounded-xl text-xs font-bold transition-all ${isSelected ? 'bg-[#D4B996] text-[#1A1A1A] scale-110 shadow-lg' : isBusy || isPast ? 'text-white/10 line-through' : 'text-white/80 hover:bg-white/10'}`}>
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function PortfolioPage() {
  const router = useRouter();
  const { username } = router.query;
  const bookingRef = useRef(null);

  const [profile, setProfile] = useState(null);
  const [services, setServices] = useState([]);
  const [busyDates, setBusyDates] = useState(new Set());
  const [loading, setLoading] = useState(true);
  
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ svc: null, date: '', name: '', phone: '', utr: '' });
  const [bookingLoading, setBookingLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!username) return;
    (async () => {
      try {
        const p = await getProfileByUsername(username);
        setProfile(p);
        const [svc, busy] = await Promise.all([getServicesByProfileId(p.id), getBusyDates(p.id)]);
        setServices(svc);
        setBusyDates(new Set(busy));
      } catch (e) { console.error(e); } finally { setLoading(false); }
    })();
  }, [username]);

  const advance = Math.round((form.svc?.price || 0) * 0.3);
  const upiLink = profile ? `upi://pay?pa=${profile.upi_id}&pn=${encodeURIComponent(profile.full_name)}&am=${advance}&cu=INR&tn=Booking` : '';

  const handleBookingSubmit = async () => {
    if (!form.utr || form.utr.length < 10) return alert("Please enter valid UTR");
    setBookingLoading(true);
    try {
      await createBooking({ profile_id: profile.id, service_id: form.svc.id, client_name: form.name, client_phone: form.phone, booking_date: form.date, total_price: form.svc.price, note: `Advance: ${advance}, UTR: ${form.utr}` });
      setSuccess(true);
      openWhatsApp(profile.phone, { clientName: form.name, clientPhone: form.phone, selectedDate: form.date, advance, pending: form.svc.price - advance, serviceName: form.svc.name });
    } catch (e) { alert("Error!"); } finally { setBookingLoading(false); }
  };

  if (loading) return <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center text-[#D4B996] animate-pulse italic">ArtistHub Loading...</div>;

  return (
    <main className="min-h-screen bg-[#1A1A1A] text-white font-sans selection:bg-[#D4B996] selection:text-black">
      <Head><title>{profile.full_name} | Portfolio</title></Head>

      {/* Header Navigation */}
      <div className="fixed top-0 left-0 right-0 p-4 flex justify-between items-center z-50 bg-[#1A1A1A]/80 backdrop-blur-md border-b border-white/5">
        <button className="px-5 py-2 bg-white/5 rounded-full text-[10px] font-bold uppercase tracking-widest text-[#D4B996]">Portfolio</button>
        <button onClick={() => bookingRef.current?.scrollIntoView({ behavior: 'smooth' })} className="px-5 py-2 bg-[#D4B996] rounded-full text-[10px] font-black uppercase tracking-widest text-black">Book Now</button>
      </div>

      <div className="pt-24 flex flex-col items-center px-6">
        <div className="relative p-0.5 bg-gradient-to-b from-[#D4B996] to-transparent rounded-[32px] mb-4">
          <img src={transformDriveLink(profile.avatar_url)} className="w-24 h-24 rounded-[30px] object-cover border-2 border-[#1A1A1A]" />
        </div>
        <h1 className="text-3xl font-black text-[#D4B996] italic tracking-tighter">{profile.full_name}</h1>
        <p className="text-[10px] uppercase tracking-[0.4em] text-white/30 mt-1">{profile.tagline || 'Makeup Artist'}</p>
      </div>

      {/* PORTFOLIO GALLERY (Screenshot Style) */}
      <section className="mt-16 px-6">
        <h2 className="text-[11px] uppercase tracking-[0.4em] text-[#D4B996] font-bold mb-6">Client Work</h2>
        <div className="grid grid-cols-3 gap-1.5">
          {profile.portfolio_images?.map((img, i) => (
            <div key={i} className={`rounded-lg overflow-hidden border border-white/5 ${i === 0 ? 'col-span-2 row-span-2' : ''}`}>
              <img src={transformDriveLink(img)} className="w-full h-full object-cover" loading="lazy" alt="Work" />
            </div>
          ))}
        </div>
      </section>

      {/* OUR SERVICE CHARGES (Add to Cart style) */}
      <section className="mt-16 px-6">
        <h2 className="text-[11px] uppercase tracking-[0.4em] text-[#D4B996] font-bold mb-6">Our Service Charges</h2>
        <div className="space-y-6">
          {services.map(s => (
            <div key={s.id} className="bg-[#1F1F1F] rounded-[32px] p-6 border border-[#D4B996]/10 shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-black italic text-white tracking-tight">{s.name}</h3>
                <span className="bg-[#D4B996] text-black px-4 py-1.5 rounded-full text-sm font-black">{formatINR(s.price)}</span>
              </div>
              <p className="text-xs text-white/50 leading-relaxed mb-6 font-medium">{s.description || "Premium service with high-end results and professional finish."}</p>
              <button 
                onClick={() => { setForm({ ...form, svc: s }); setStep(2); bookingRef.current?.scrollIntoView({ behavior: 'smooth' }); }}
                className="w-full py-3.5 bg-white/5 border border-[#D4B996]/30 text-[#D4B996] rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#D4B996] hover:text-black transition-all"
              >
                Add to Cart
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* CHECKOUT DATES (Booking) */}
      <section ref={bookingRef} className="mt-20 px-6 scroll-mt-24 pb-20">
        <div className="bg-[#1A1A1A] rounded-[40px] p-6 border border-white/5 shadow-2xl relative overflow-hidden">
          {success ? (
            <div className="text-center py-10 animate-fadeIn">
              <h3 className="text-2xl font-black text-[#D4B996] italic mb-2 tracking-tighter">Booking Confirmed! ✨</h3>
              <p className="text-xs text-white/40 uppercase tracking-widest">Date Blocked: {form.date}</p>
              <button onClick={() => { setSuccess(false); setStep(1); }} className="mt-8 text-[10px] uppercase font-black tracking-[0.3em] text-[#D4B996] border-b border-[#D4B996]">Book Another Service</button>
            </div>
          ) : (
            <div className="space-y-8">
              <h2 className="text-[11px] uppercase tracking-[0.4em] text-[#D4B996] font-bold text-center">Checkout Dates</h2>
              
              {step === 1 && (
                <div className="text-center py-10 border border-dashed border-white/10 rounded-3xl">
                  <p className="text-white/20 text-[10px] uppercase tracking-widest">Please select a service from charges above</p>
                </div>
              )}

              {step === 2 && (
                <div className="animate-slideUp">
                  <p className="text-[10px] text-white/40 uppercase text-center tracking-[0.3em] mb-4 font-bold">Pick Your Date</p>
                  <BookingCalendar busyDates={busyDates} selectedDate={form.date} onSelect={d => setForm({ ...form, date: d })} />
                  <button disabled={!form.date} onClick={() => setStep(3)} className="w-full mt-8 py-4 bg-[#D4B996] text-black font-black rounded-2xl uppercase text-[11px] tracking-widest shadow-xl">Continue to Checkout</button>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4 animate-slideUp">
                  <p className="text-[10px] text-white/40 uppercase text-center tracking-[0.3em] mb-4 font-bold">Client Information</p>
                  <input placeholder="Enter Full Name" className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none text-sm font-bold placeholder:text-white/20 focus:border-[#D4B996]/50" onChange={e => setForm({ ...form, name: e.target.value })} />
                  <input placeholder="WhatsApp Mobile Number" className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none text-sm font-bold placeholder:text-white/20 focus:border-[#D4B996]/50" onChange={e => setForm({ ...form, phone: e.target.value })} />
                  <button disabled={!form.name || !form.phone} onClick={() => setStep(4)} className="w-full py-4 bg-[#D4B996] text-black font-black rounded-2xl uppercase text-[11px] tracking-widest shadow-xl">Proceed to Payment</button>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-6 animate-slideUp text-center">
                  <div className="p-6 bg-white/5 rounded-3xl border border-[#D4B996]/20">
                    <p className="text-[10px] uppercase text-white/40 mb-2 font-bold tracking-widest">Order Summary: Advance (30%)</p>
                    <p className="text-4xl font-black text-[#D4B996] tracking-tighter mb-6">{formatINR(advance)}</p>
                    <a href={upiLink} className="inline-block bg-[#5f259f] text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg active:scale-95">🟣 Pay via App</a>
                  </div>
                  
                  <div className="bg-white p-4 rounded-3xl inline-block shadow-2xl mt-4">
                    <img src={transformDriveLink(profile.upi_qr_url)} className="w-40 h-auto mx-auto" alt="QR" />
                    <p className="text-[9px] text-black/40 font-mono mt-3 uppercase font-bold">{profile.upi_id}</p>
                  </div>

                  <input placeholder="Paste 12-Digit Transaction UTR" className="w-full p-4 bg-white/5 border border-[#D4B996]/30 rounded-2xl text-center outline-none text-sm font-black placeholder:text-white/20 focus:border-[#D4B996]" onChange={e => setForm({ ...form, utr: e.target.value })} />
                  <p className="text-[9px] text-white/20 uppercase tracking-widest leading-relaxed font-bold">Advance is non-refundable. Final settlement on event day.</p>
                  <button onClick={handleBookingSubmit} disabled={!form.utr || bookingLoading} className="w-full py-4 bg-[#D4B996] text-black font-black rounded-2xl uppercase text-[11px] tracking-widest shadow-xl">
                    {bookingLoading ? 'Processing Order...' : 'Confirm Order & Date'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Quick Scan Pay (Original Design) */}
      <section className="px-6 pb-20">
        <div className="bg-[#1A1A1A] rounded-[40px] p-10 border border-white/5 text-center">
          <p className="text-[11px] uppercase tracking-[0.5em] text-[#D4B996] font-black mb-10">Quick Scan Pay</p>
          <div className="bg-white p-6 rounded-[40px] inline-block shadow-2xl relative">
            <div className="absolute -top-4 -right-4 bg-[#D4B996] text-black text-[8px] font-black px-3 py-1 rounded-full uppercase italic">Verified</div>
            <img src={transformDriveLink(profile.upi_qr_url)} className="w-48 h-auto mx-auto" alt="Scan Pay" />
          </div>
          <p className="text-[10px] text-white/20 mt-8 uppercase tracking-[0.3em] font-bold">Block Your Date with 30% Advance</p>
        </div>
      </section>

      <footer className="px-6 pb-12 text-center text-white/10 border-t border-white/5 pt-10">
        <p className="text-sm font-black italic tracking-widest mb-1 text-[#D4B996]/30 uppercase">ArtistHub</p>
        <p className="text-[8px] uppercase tracking-[0.5em] font-black">Handcrafted by Lucky 🤞</p>
      </footer>
    </main>
  );
 }
