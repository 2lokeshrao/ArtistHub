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
    <div className="bg-white/5 rounded-3xl p-4 border border-white/10 mt-2">
      <div className="flex justify-between items-center mb-4 px-2">
        <button onClick={() => setView(v => v.m === 0 ? { y: v.y - 1, m: 11 } : { ...v, m: v.m - 1 })} className="text-[#D4B996]">‹</button>
        <span className="text-xs font-bold uppercase tracking-widest">{new Date(view.y, view.m).toLocaleString('default', { month: 'short', year: 'numeric' })}</span>
        <button onClick={() => setView(v => v.m === 11 ? { y: v.y + 1, m: 0 } : { ...v, m: v.m + 1 })} className="text-[#D4B996]">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <div key={d} className="text-[10px] text-white/20 py-1 font-bold">{d}</div>)}
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const iso = toISO(view.y, view.m, day);
          const isBusy = busyDates.has(iso);
          const isSelected = iso === selectedDate;
          const isPast = iso < new Date().toISOString().split('T')[0];
          return (
            <button key={i} onClick={() => onSelect(iso)} disabled={isBusy || isPast}
              className={`aspect-square rounded-xl text-[11px] font-bold transition-all ${isSelected ? 'bg-[#D4B996] text-[#1A1A1A]' : isBusy || isPast ? 'text-white/10 line-through' : 'text-white/80 hover:bg-white/10'}`}>
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
  const pending = (form.svc?.price || 0) - advance;
  const upiLink = profile ? `upi://pay?pa=${profile.upi_id}&pn=${encodeURIComponent(profile.full_name)}&am=${advance}&cu=INR&tn=Booking` : '';

  const handleBookingSubmit = async () => {
    if (!form.utr || form.utr.length < 10) return alert("Please enter valid UTR");
    setBookingLoading(true);
    try {
      const bookingData = {
        profile_id: profile.id,
        service_id: form.svc.id,
        client_name: form.name,
        client_phone: form.phone,
        booking_date: form.date,
        total_price: form.svc.price,
        note: `Advance: ${advance}, UTR: ${form.utr}`
      };
      
      await createBooking(bookingData);
      setSuccess(true);
      
      // WhatsApp Data Fix
      openWhatsApp(profile.phone, {
        clientName: form.name,
        clientPhone: form.phone,
        selectedDate: form.date,
        advance,
        pending,
        serviceName: form.svc.name
      });

    } catch (e) { alert("Booking failed. Please check connection."); } finally { setBookingLoading(false); }
  };

  if (loading) return <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center text-[#D4B996] animate-pulse italic">ArtistHub Loading...</div>;

  return (
    <main className="min-h-screen bg-[#1A1A1A] text-white font-sans">
      <Head><title>{profile.full_name} | Portfolio</title></Head>

      {/* Mobile Responsive Header */}
      <div className="fixed top-0 left-0 right-0 p-4 flex justify-between items-center z-50 bg-[#1A1A1A]/80 backdrop-blur-md border-b border-white/5">
        <button className="px-4 py-1.5 bg-white/5 rounded-full text-[10px] font-bold uppercase text-[#D4B996]">Portfolio</button>
        <button onClick={() => bookingRef.current?.scrollIntoView({ behavior: 'smooth' })} className="px-4 py-1.5 bg-[#D4B996] rounded-full text-[10px] font-black uppercase text-black shadow-lg">Book Now</button>
      </div>

      {/* Hero: Fixed Gap */}
      <div className="pt-24 flex flex-col items-center px-6">
        <div className="relative p-0.5 bg-gradient-to-b from-[#D4B996] to-transparent rounded-[32px] mb-4">
          <img src={transformDriveLink(profile.avatar_url)} className="w-24 h-24 rounded-[30px] object-cover border-2 border-[#1A1A1A]" />
        </div>
        <h1 className="text-3xl font-black text-[#D4B996] italic tracking-tighter">{profile.full_name}</h1>
        <p className="text-[10px] uppercase tracking-[0.3em] text-white/30 mt-1">{profile.tagline}</p>
      </div>

      {/* Sections: Fixed Padding for Mobile */}
      <section className="mt-12 px-6 space-y-12">
        <div className="bg-white/5 rounded-3xl p-6 border border-white/10 space-y-3 italic text-xs text-white/60">
          <p>{profile.education || "Bachelor of Arts degree with Professional Certifications."}</p>
          <div className="h-[1px] bg-white/5 w-full" />
          <p>{profile.experience || "5+ years of experience in high-end projects."}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {profile.portfolio_images?.map((img, i) => (
            <img key={i} src={transformDriveLink(img)} className="w-full aspect-[4/5] object-cover rounded-2xl" />
          ))}
        </div>

        <div className="space-y-4">
          <h2 className="text-[10px] uppercase tracking-[0.3em] text-[#D4B996] font-bold">Expertise</h2>
          {services.map(s => (
            <div key={s.id} className="bg-white/5 rounded-3xl p-5 border border-white/10">
              <div className="flex justify-between mb-2">
                <h3 className="font-bold italic text-[#D4B996]">{s.name}</h3>
                <span className="text-xs font-bold">{formatINR(s.price)}</span>
              </div>
              <p className="text-[10px] text-white/40 leading-relaxed mb-4">{s.description || "Premium service with high-end results."}</p>
            </div>
          ))}
        </div>

        {/* Booking Container: Fixed Mobile Gap */}
        <div ref={bookingRef} className="pt-4 scroll-mt-20 pb-20">
          <div className="bg-white/5 rounded-[40px] p-6 border border-white/10">
            {success ? (
              <div className="text-center py-8">
                <h3 className="text-xl font-bold text-[#D4B996] italic mb-2">Confirmed! ✨</h3>
                <p className="text-xs text-white/40">Check WhatsApp for summary.</p>
                <button onClick={() => { setSuccess(false); setStep(1); }} className="mt-4 text-[10px] uppercase font-bold text-[#D4B996]">New Booking</button>
              </div>
            ) : (
              <div className="space-y-6">
                <p className="text-[10px] text-white/30 uppercase text-center tracking-widest">Secure Date</p>
                {step === 1 && (
                  <div className="space-y-2">
                    {services.map(s => (
                      <button key={s.id} onClick={() => { setForm({ ...form, svc: s }); setStep(2); }} className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl flex justify-between items-center text-sm">
                        <span className="font-bold">{s.name}</span>
                        <span className="text-[#D4B996] font-bold">{formatINR(s.price)}</span>
                      </button>
                    ))}
                  </div>
                )}
                {step === 2 && (
                  <div className="space-y-4 text-center">
                    <BookingCalendar busyDates={busyDates} selectedDate={form.date} onSelect={d => setForm({ ...form, date: d })} />
                    <button disabled={!form.date} onClick={() => setStep(3)} className="w-full py-3.5 bg-[#D4B996] text-black font-black rounded-2xl uppercase text-[10px]">Continue</button>
                  </div>
                )}
                {step === 3 && (
                  <div className="space-y-3">
                    <input placeholder="Name" className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none text-sm" onChange={e => setForm({ ...form, name: e.target.value })} />
                    <input placeholder="WhatsApp Number" className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none text-sm" onChange={e => setForm({ ...form, phone: e.target.value })} />
                    <button disabled={!form.name || !form.phone} onClick={() => setStep(4)} className="w-full py-3.5 bg-[#D4B996] text-black font-black rounded-2xl uppercase text-[10px]">Proceed</button>
                  </div>
                )}
                {step === 4 && (
                  <div className="space-y-4 text-center">
                    <div className="p-4 bg-[#D4B996]/10 rounded-2xl border border-[#D4B996]/20">
                      <p className="text-[10px] uppercase text-white/40 mb-1">Advance Pay</p>
                      <p className="text-2xl font-black text-[#D4B996]">{formatINR(advance)}</p>
                    </div>
                    <a href={upiLink} className="inline-block bg-[#5f259f] text-white px-6 py-2.5 rounded-xl font-bold text-[10px] uppercase">🟣 Pay via App</a>
                    <div className="bg-white p-3 rounded-2xl mt-4 inline-block shadow-lg">
                      <img src={transformDriveLink(profile.upi_qr_url)} className="w-32 h-auto mx-auto" />
                      <p className="text-[9px] text-black/40 font-mono mt-1">{profile.upi_id}</p>
                    </div>
                    <input placeholder="Paste 12-digit UTR" className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-center outline-none text-sm" onChange={e => setForm({ ...form, utr: e.target.value })} />
                    <button onClick={handleBookingSubmit} disabled={!form.utr || bookingLoading} className="w-full py-3.5 bg-[#D4B996] text-black font-black rounded-2xl uppercase text-[10px]">
                      {bookingLoading ? 'Wait...' : 'Confirm'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Footer Fix: Social Gaps */}
      <footer className="px-6 pb-12 text-center border-t border-white/5 pt-8">
        <div className="flex justify-center gap-4 mb-8">
          <a href={profile.instagram_url} className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/10">📸</a>
          <a href={`tel:${profile.phone}`} className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/10">📞</a>
        </div>
        <p className="text-xs font-bold italic text-[#D4B996] opacity-30 tracking-widest mb-1">ArtistHub</p>
        <p className="text-[8px] uppercase tracking-[0.5em] text-white/20 font-bold">Made by Lucky 🤞</p>
      </footer>
    </main>
  );
}
