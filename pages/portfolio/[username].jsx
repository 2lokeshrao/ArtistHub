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

// ── UTILS ──
const formatINR = n => `₹${Number(n).toLocaleString('en-IN')}`;
function transformDriveLink(url) {
  if (!url || typeof url !== 'string') return url;
  const fileId = url.split('/d/')[1]?.split('/')[0] || url.split('id=')[1]?.split('&')[0];
  return fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000` : url;
}
function toISO(year, month, day) { return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; }

// ── CALENDAR COMPONENT ──
function BookingCalendar({ busyDates, selectedDate, onSelect }) {
  const [view, setView] = useState({ y: new Date().getFullYear(), m: new Date().getMonth() });
  const days = new Date(view.y, view.m + 1, 0).getDate();
  const first = new Date(view.y, view.m, 1).getDay();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];

  return (
    <div className="bg-white/5 rounded-3xl p-4 border border-white/10">
      <div className="flex justify-between items-center mb-4 px-2">
        <button onClick={() => setView(v => v.m === 0 ? { y: v.y - 1, m: 11 } : { ...v, m: v.m - 1 })} className="text-[#D4B996]">‹</button>
        <span className="text-xs font-bold uppercase tracking-widest">{new Date(view.y, view.m).toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
        <button onClick={() => setView(v => v.m === 11 ? { y: v.y + 1, m: 0 } : { ...v, m: v.m + 1 })} className="text-[#D4B996]">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d} className="text-[10px] text-white/20 py-1 font-bold">{d}</div>)}
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const iso = toISO(view.y, view.m, day);
          const isBusy = busyDates.has(iso);
          const isSelected = iso === selectedDate;
          const isPast = iso < new Date().toISOString().split('T')[0];
          return (
            <button key={i} onClick={() => onSelect(iso)} disabled={isBusy || isPast}
              className={`aspect-square rounded-xl text-[11px] font-bold ${isSelected ? 'bg-[#D4B996] text-[#1A1A1A]' : isBusy || isPast ? 'text-white/10 line-through' : 'text-white/80 hover:bg-white/10'}`}>
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── MAIN PAGE ──
export default function PortfolioPage() {
  const router = useRouter();
  const { username } = router.query;
  const bookingRef = useRef(null);

  const [profile, setProfile] = useState(null);
  const [services, setServices] = useState([]);
  const [busyDates, setBusyDates] = useState(new Set());
  const [loading, setLoading] = useState(true);
  
  // Booking Logic States
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
        setBusyDates(busy);
      } catch (e) { console.error(e); } finally { setLoading(false); }
    })();
  }, [username]);

  const advance = Math.round((form.svc?.price || 0) * 0.3);
  const upiLink = profile ? `upi://pay?pa=${profile.upi_id}&pn=${encodeURIComponent(profile.full_name)}&am=${advance}&cu=INR&tn=Booking` : '';

  const handleBooking = async () => {
    setBookingLoading(true);
    try {
      await createBooking({ ...form, profile_id: profile.id, total_price: form.svc.price, note: `Advance: ${advance}, UTR: ${form.utr}` });
      setSuccess(true);
      openWhatsApp(profile.phone, { ...form, advance, pending: form.svc.price - advance, serviceName: form.svc.name });
    } catch (e) { alert("Error!"); } finally { setBookingLoading(false); }
  };

  if (loading) return <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center text-[#D4B996] animate-pulse italic">ArtistHub Loading...</div>;

  return (
    <main className="min-h-screen bg-[#1A1A1A] text-white font-sans pb-20">
      <Head><title>{profile.full_name} | Portfolio</title></Head>

      {/* Header Navigation */}
      <div className="fixed top-0 left-0 right-0 p-6 flex justify-between items-center z-50 bg-gradient-to-b from-[#1A1A1A] to-transparent">
        <button className="px-6 py-2 bg-white/5 backdrop-blur-md rounded-full text-[10px] font-bold uppercase tracking-widest text-[#D4B996] border border-white/10">Portfolio</button>
        <button onClick={() => bookingRef.current?.scrollIntoView({ behavior: 'smooth' })} className="px-6 py-2 bg-[#D4B996] rounded-full text-[10px] font-black uppercase tracking-widest text-black shadow-xl shadow-[#D4B996]/20">Book Now</button>
      </div>

      {/* Hero Section */}
      <div className="pt-32 flex flex-col items-center px-6">
        <div className="relative p-1 bg-gradient-to-b from-[#D4B996] to-transparent rounded-[40px] mb-8">
          <img src={transformDriveLink(profile.avatar_url)} className="w-32 h-32 rounded-[38px] object-cover border-4 border-[#1A1A1A]" />
        </div>
        <h1 className="text-4xl font-black text-[#D4B996] italic tracking-tighter text-center">{profile.full_name}</h1>
        <p className="text-[10px] uppercase tracking-[0.4em] text-white/30 mt-3">{profile.tagline || 'Makeup Artist'}</p>
      </div>

      {/* Background & Experience */}
      <section className="mt-20 px-6">
        <h2 className="text-[10px] uppercase tracking-[0.3em] text-[#D4B996] font-bold mb-6">Background & Experience</h2>
        <div className="bg-white/5 rounded-[32px] p-8 border border-white/10 space-y-4 italic text-xs leading-relaxed text-white/60">
          <p>{profile.education || "Bachelor of Arts degree with Professional Certifications."}</p>
          <div className="h-[1px] bg-white/5 w-full" />
          <p>{profile.experience || "5+ years of experience in high-end projects."}</p>
        </div>
      </section>

      {/* Gallery */}
      <section className="mt-20 px-6">
        <h2 className="text-[10px] uppercase tracking-[0.3em] text-[#D4B996] font-bold mb-6">Featured Work</h2>
        <div className="grid grid-cols-2 gap-3">
          {profile.portfolio_images?.map((img, i) => (
            <img key={i} src={transformDriveLink(img)} className="w-full aspect-[4/5] object-cover rounded-[30px] border border-white/5" />
          ))}
        </div>
      </section>

      {/* Expertise / Services */}
      <section className="mt-20 px-6">
        <h2 className="text-[10px] uppercase tracking-[0.3em] text-[#D4B996] font-bold mb-6">Our Expertise</h2>
        <div className="space-y-4">
          {services.map(s => (
            <div key={s.id} className="bg-white/5 rounded-[40px] p-8 border border-white/10">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xl font-bold italic text-[#D4B996]">{s.name}</h3>
                <span className="bg-white/10 px-4 py-1 rounded-full text-sm font-bold">{formatINR(s.price)}</span>
              </div>
              <p className="text-[11px] text-white/40 leading-relaxed mb-6">{s.description || "Premium service with high-end results."}</p>
              <div className="flex gap-2">
                <span className="text-[9px] uppercase font-bold tracking-widest border border-[#D4B996]/20 text-[#D4B996] px-4 py-1 rounded-full">Premium Kit</span>
                <span className="text-[9px] uppercase font-bold tracking-widest border border-[#D4B996]/20 text-[#D4B996] px-4 py-1 rounded-full">Long Lasting</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Booking Section */}
      <section ref={bookingRef} className="mt-20 px-6 scroll-mt-24">
        <h2 className="text-[10px] uppercase tracking-[0.3em] text-[#D4B996] font-bold mb-6 text-center">Secure Appointment</h2>
        <div className="bg-white/5 rounded-[45px] p-8 border border-white/10">
          {success ? (
            <div className="text-center py-10 animate-fadeIn">
              <h3 className="text-2xl font-bold text-[#D4B996] italic mb-2">Booking Confirmed! ✨</h3>
              <p className="text-xs text-white/40">Check WhatsApp for details.</p>
              <button onClick={() => { setSuccess(false); setStep(1); }} className="mt-6 text-[10px] uppercase font-bold tracking-widest text-[#D4B996]">New Booking</button>
            </div>
          ) : (
            <div className="space-y-8">
              {step === 1 && (
                <div className="space-y-3">
                  <p className="text-[10px] text-white/30 uppercase text-center mb-6">1. Choose Service</p>
                  {services.map(s => (
                    <button key={s.id} onClick={() => { setForm({ ...form, svc: s }); setStep(2); }} className="w-full p-6 bg-white/5 border border-white/10 rounded-3xl flex justify-between items-center hover:border-[#D4B996]/50 transition-all">
                      <span className="font-bold text-sm">{s.name}</span>
                      <span className="text-[#D4B996] font-bold">{formatINR(s.price)}</span>
                    </button>
                  ))}
                </div>
              )}
              {step === 2 && (
                <div className="space-y-6">
                  <p className="text-[10px] text-white/30 uppercase text-center mb-4">2. Select Date</p>
                  <BookingCalendar busyDates={busyDates} selectedDate={form.date} onSelect={d => setForm({ ...form, date: d })} />
                  <button disabled={!form.date} onClick={() => setStep(3)} className="w-full py-5 bg-[#D4B996] text-black font-black rounded-3xl uppercase tracking-widest text-xs disabled:opacity-20">Continue</button>
                </div>
              )}
              {step === 3 && (
                <div className="space-y-4">
                  <p className="text-[10px] text-white/30 uppercase text-center mb-4">3. Your Info</p>
                  <input placeholder="Your Name" className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-[#D4B996]/50" onChange={e => setForm({ ...form, name: e.target.value })} />
                  <input placeholder="WhatsApp Number" className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-[#D4B996]/50" onChange={e => setForm({ ...form, phone: e.target.value })} />
                  <button disabled={!form.name || !form.phone} onClick={() => setStep(4)} className="w-full py-5 bg-[#D4B996] text-black font-black rounded-3xl uppercase tracking-widest text-xs">Final Step</button>
                </div>
              )}
              {step === 4 && (
                <div className="space-y-6">
                  <div className="bg-[#D4B996]/10 p-8 rounded-[35px] text-center border border-[#D4B996]/20">
                    <p className="text-[10px] uppercase text-white/40 mb-2">Advance (30%)</p>
                    <p className="text-3xl font-black text-[#D4B996] mb-6">{formatINR(advance)}</p>
                    <a href={upiLink} className="inline-block bg-[#5f259f] text-white px-8 py-3 rounded-2xl font-bold text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all">🟣 Pay via App</a>
                    <div className="bg-white p-4 rounded-3xl mt-8 inline-block shadow-2xl">
                      <img src={transformDriveLink(profile.upi_qr_url)} className="w-40 h-auto" />
                      <p className="text-[10px] text-black/40 font-mono mt-3 uppercase">{profile.upi_id}</p>
                    </div>
                  </div>
                  <input placeholder="Paste 12-digit UTR / ID" className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl text-center outline-none focus:border-[#D4B996]" onChange={e => setForm({ ...form, utr: e.target.value })} />
                  <p className="text-[9px] text-white/20 uppercase text-center leading-relaxed italic">Advance is non-refundable. Balance due on event morning.</p>
                  <button onClick={handleBooking} disabled={!form.utr || bookingLoading} className="w-full py-5 bg-[#D4B996] text-black font-black rounded-3xl uppercase tracking-widest text-xs">
                    {bookingLoading ? 'Processing...' : 'Confirm Booking'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-32 px-6 pb-12 text-center border-t border-white/5 pt-12">
        <div className="flex justify-center gap-6 mb-12">
          <a href={profile.instagram_url} className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 active:scale-90 transition-all">📸</a>
          <a href={`tel:${profile.phone}`} className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 active:scale-90 transition-all">📞</a>
        </div>
        <p className="text-sm font-bold italic text-[#D4B996] opacity-30 tracking-widest mb-1">ArtistHub</p>
        <p className="text-[8px] uppercase tracking-[0.5em] text-white/20 font-bold">Made by 🤞 Lucky</p>
      </footer>
    </main>
  );
 }
