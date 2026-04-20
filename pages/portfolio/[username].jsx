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
        <button onClick={() => setView(v => v.m === 0 ? { y: v.y - 1, m: 11 } : { ...v, m: v.m - 1 })} className="text-[#D4B996] text-xl font-bold">‹</button>
        <span className="text-sm font-bold uppercase tracking-[0.2em]">{new Date(view.y, view.m).toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
        <button onClick={() => setView(v => v.m === 11 ? { y: v.y + 1, m: 0 } : { ...v, m: v.m + 1 })} className="text-[#D4B996] text-xl font-bold">›</button>
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
  
  const [cart, setCart] = useState([]);
  const [form, setForm] = useState({ date: '', name: '', phone: '', utr: '' });
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

  const totalVal = cart.reduce((s, i) => s + Number(i.price || 0), 0);
  const adv = Math.round(totalVal * 0.3);
  const upi = profile ? `upi://pay?pa=${profile.upi_id}&pn=${encodeURIComponent(profile.full_name)}&am=${adv}&cu=INR&tn=Booking` : '';

  const handleBooking = async () => {
    if (!form.utr || form.utr.length < 10) return alert("Valid UTR required");
    setBookingLoading(true);
    try {
      const sNames = cart.map(s => s.name).join(', ');
      await createBooking({ profile_id: profile.id, service_id: cart[0].id, client_name: form.name, client_phone: form.phone, booking_date: form.date, total_price: totalVal, note: `Services: ${sNames} | UTR: ${form.utr}` });
      setSuccess(true);
      openWhatsApp(profile.phone, { clientName: form.name, clientPhone: form.phone, selectedDate: form.date, advance: adv, pending: totalVal - adv, serviceName: sNames });
    } catch (e) { alert("Error!"); } finally { setBookingLoading(false); }
  };

  if (loading) return <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center text-[#D4B996] animate-pulse">Loading...</div>;

  return (
    <main className="min-h-screen bg-[#1A1A1A] text-white font-sans selection:bg-[#D4B996] selection:text-black">
      <Head><title>{profile.full_name} | Portfolio</title></Head>

      {/* Header */}
      <div className="fixed top-0 left-0 right-0 p-4 flex justify-between items-center z-50 bg-[#1A1A1A]/80 backdrop-blur-md border-b border-white/5">
        <button className="px-5 py-2 bg-white/5 rounded-full text-[10px] font-bold uppercase tracking-widest text-[#D4B996]">Portfolio</button>
        <button onClick={() => bookingRef.current?.scrollIntoView({ behavior: 'smooth' })} className="px-5 py-2 bg-[#D4B996] rounded-full text-[10px] font-black uppercase tracking-widest text-black">Checkout ({cart.length})</button>
      </div>

      <div className="pt-24 flex flex-col items-center px-6">
        <div className="relative p-0.5 bg-gradient-to-b from-[#D4B996] to-transparent rounded-[32px] mb-4">
          <img src={transformDriveLink(profile.avatar_url)} className="w-24 h-24 rounded-[30px] object-cover border-2 border-[#1A1A1A]" />
        </div>
        <h1 className="text-3xl font-black text-[#D4B996] italic tracking-tighter text-center">{profile.full_name}</h1>
        <p className="text-[10px] uppercase tracking-[0.4em] text-white/30 mt-1">{profile.tagline || 'Makeup Artist'}</p>
      </div>

      {/* Achievements (Fixed) */}
      <section className="mt-12 px-6">
        <h2 className="text-[11px] uppercase tracking-[0.4em] text-[#D4B996] font-bold mb-6">Education & Experience</h2>
        <div className="bg-white/5 rounded-[32px] p-6 border border-white/10 space-y-4">
          <div className="flex gap-4 items-start">
            <span className="text-xl">🎓</span>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1 font-bold">Qualification</p>
              <p className="text-xs text-white/80 leading-relaxed italic">{profile.education || "Bachelor of Arts graduate with professional certification."}</p>
            </div>
          </div>
          <div className="h-[1px] bg-white/10 w-full" />
          <div className="flex gap-4 items-start">
            <span className="text-xl">💼</span>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1 font-bold">Experience</p>
              <p className="text-xs text-white/80 leading-relaxed italic">{profile.experience || "Extensive experience in sales, marketing, and commercial food production."}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Gallery (Screenshot Style) */}
      <section className="mt-16 px-6">
        <h2 className="text-[11px] uppercase tracking-[0.4em] text-[#D4B996] font-bold mb-6">Client Work</h2>
        <div className="grid grid-cols-3 gap-1.5">
          {profile.portfolio_images?.map((img, i) => (
            <div key={i} className={`rounded-lg overflow-hidden border border-white/5 ${i === 0 ? 'col-span-2 row-span-2' : ''}`}>
              <img src={transformDriveLink(img)} className="w-full h-full object-cover" loading="lazy" />
            </div>
          ))}
        </div>
      </section>

      {/* Services (Add to Cart) */}
      <section className="mt-16 px-6">
        <h2 className="text-[11px] uppercase tracking-[0.4em] text-[#D4B996] font-bold mb-6 text-center">Our Service Charges</h2>
        <div className="space-y-6">
          {services.map(s => {
            const added = cart.find(x => x.id === s.id);
            return (
              <div key={s.id} className={`bg-[#1F1F1F] rounded-[32px] p-6 border ${added ? 'border-[#D4B996]' : 'border-[#D4B996]/10'}`}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-black italic tracking-tight">{s.name}</h3>
                  <span className="bg-[#D4B996] text-black px-4 py-1.5 rounded-full text-sm font-black">{formatINR(s.price)}</span>
                </div>
                <p className="text-xs text-white/50 leading-relaxed mb-6 font-medium">{s.description || "Professional service with high-end finish."}</p>
                <button onClick={() => added ? setCart(cart.filter(x => x.id !== s.id)) : setCart([...cart, s])} className={`w-full py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest ${added ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-white/5 border border-[#D4B996]/30 text-[#D4B996]'}`}>
                  {added ? 'Remove Item' : 'Add to Cart'}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Checkout Dates (Multi-Service Sum) */}
      <section ref={bookingRef} className="mt-20 px-6 pb-20 scroll-mt-24">
        <div className="bg-[#1A1A1A] rounded-[40px] p-6 border border-white/5 shadow-2xl">
          {success ? (
            <div className="text-center py-10 animate-fadeIn">
              <h3 className="text-2xl font-black text-[#D4B996] italic mb-2 tracking-tighter">Booking Confirmed! ✨</h3>
              <p className="text-[10px] text-white/40 uppercase tracking-widest">Date Blocked: {form.date}</p>
              <button onClick={() => window.location.reload()} className="mt-8 text-[10px] uppercase font-black tracking-[0.3em] text-[#D4B996] border-b border-[#D4B996]">Book Again</button>
            </div>
          ) : (
            <div className="space-y-8">
              <h2 className="text-[11px] uppercase tracking-[0.4em] text-[#D4B996] font-bold text-center">Checkout Dates</h2>
              {cart.length > 0 ? (
                <>
                  <div className="space-y-2">
                    {cart.map(x => <div key={x.id} className="flex justify-between p-3 bg-white/5 rounded-xl text-xs"><span>{x.name}</span><span className="text-[#D4B996] font-bold">{formatINR(x.price)}</span></div>)}
                    <div className="flex justify-between p-4 border-t border-white/10 mt-2 font-black text-[#D4B996] text-sm"><span>TOTAL</span><span>{formatINR(totalVal)}</span></div>
                  </div>
                  <BookingCalendar busyDates={busyDates} selectedDate={form.date} onSelect={d => setForm({...form, date:d})} />
                  <div className="space-y-4">
                    <input placeholder="Name" className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none text-sm font-bold" onChange={e => setForm({...form, name: e.target.value})} />
                    <input placeholder="WhatsApp No" className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none text-sm font-bold" onChange={e => setForm({...form, phone: e.target.value})} />
                  </div>
                  {form.date && form.name && (
                    <div className="space-y-6 animate-slideUp text-center border-t border-white/5 pt-6">
                      <div className="p-6 bg-[#D4B996]/10 rounded-3xl border border-[#D4B996]/30">
                        <p className="text-[10px] uppercase text-white/40 mb-2 font-bold tracking-widest">Pay Advance (30%)</p>
                        <p className="text-4xl font-black text-[#D4B996] tracking-tighter mb-6">{formatINR(adv)}</p>
                        <a href={upi} className="inline-block bg-[#5f259f] text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em]">Open UPI App</a>
                      </div>
                      <div className="bg-white p-4 rounded-3xl inline-block shadow-2xl">
                        <img src={transformDriveLink(profile.upi_qr_url)} className="w-40 h-auto mx-auto" />
                        <p className="text-[9px] text-black/40 font-mono mt-3 uppercase font-bold">{profile.upi_id}</p>
                      </div>
                      <input placeholder="Transaction ID / UTR" className="w-full p-4 bg-white/5 border border-[#D4B996]/30 rounded-2xl text-center outline-none text-sm font-black" onChange={e => setForm({...form, utr: e.target.value})} />
                      <button onClick={handleBooking} disabled={!form.utr || bookingLoading} className="w-full py-4 bg-[#D4B996] text-black font-black rounded-2xl uppercase text-[11px] tracking-widest">Confirm Booking</button>
                    </div>
                  )}
                </>
              ) : <div className="text-center py-10 border border-dashed border-white/10 rounded-3xl text-white/20 text-[10px] uppercase">Cart is empty</div>}
            </div>
          )}
        </div>
      </section>

      <footer className="px-6 pb-12 text-center text-white/10 border-t border-white/5 pt-10">
        <p className="text-sm font-black italic tracking-widest mb-1 text-[#D4B996]/30 uppercase">ArtistHub</p>
        <p className="text-[8px] uppercase tracking-[0.5em] font-black">Made by Lucky 🤞</p>
      </footer>
    </main>
  );
}
