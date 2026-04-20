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
import { generateArtistPDF } from '../../lib/generatePDF';

// --- Utils ---
const formatINR = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;
function transformDriveLink(url) {
  if (!url || typeof url !== 'string') return url;
  const fileId = url.split('/d/')[1]?.split('/')[0] || url.split('id=')[1]?.split('&')[0];
  return fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000` : url;
}
const formatDisplayDate = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
function toISO(year, month, day) { return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; }

// --- Sub-Component: Calendar ---
function BookingCalendar({ busyDates, selectedDate, onSelect }) {
  const [view, setView] = useState({ y: new Date().getFullYear(), m: new Date().getMonth() });
  const days = new Date(view.y, view.m + 1, 0).getDate();
  const first = new Date(view.y, view.m, 1).getDay();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const monthName = new Date(view.y, view.m).toLocaleString('default', { month: 'long' });

  return (
    <div className="w-full bg-[#1F1F1F] border border-white/5 rounded-[40px] p-8 shadow-2xl">
      <div className="flex justify-between items-center mb-8 px-2">
        <button onClick={() => setView({ ...view, m: view.m - 1 })} className="p-2 text-[#D4B996] text-xl">←</button>
        <h3 className="text-xs font-black uppercase tracking-[0.4em] text-[#D4B996] italic">{monthName} {view.y}</h3>
        <button onClick={() => setView({ ...view, m: view.m + 1 })} className="p-2 text-[#D4B996] text-xl">→</button>
      </div>
      <div className="grid grid-cols-7 gap-3">
        {['S','M','T','W','T','F','S'].map(d => <div key={d} className="text-[10px] font-black text-white/10 text-center pb-4 uppercase tracking-tighter">{d}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const dateStr = toISO(view.y, view.m, d);
          const isBusy = busyDates.has(dateStr);
          const isSelected = selectedDate === dateStr;
          const isPast = dateStr < new Date().toISOString().split('T')[0];
          return (
            <button key={i} disabled={isBusy || isPast} onClick={() => onSelect(dateStr)}
              className={`aspect-square rounded-2xl text-[11px] font-black transition-all flex items-center justify-center
                ${isBusy || isPast ? 'opacity-5 bg-transparent line-through' : isSelected ? 'bg-[#D4B996] text-black scale-110 shadow-[0_0_20px_rgba(212,185,150,0.4)]' : 'hover:bg-white/5 text-white/60'}`}>{d}</button>
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
        if (!p) return;
        setProfile(p);
        const [svc, busy] = await Promise.all([getServicesByProfileId(p.id), getBusyDates(p.id)]);
        setServices(svc);
        setBusyDates(new Set(busy));
      } catch (e) { console.error(e); } finally { setLoading(false); }
    })();
  }, [username]);

  const toggleCart = (s) => {
    setCart(prev => prev.find(i => i.id === s.id) ? prev.filter(i => i.id !== s.id) : [...prev, s]);
  };

  const total = cart.reduce((acc, s) => acc + s.price, 0);
  const adv = Math.round(total * 0.3);
  const upi = profile ? `upi://pay?pa=${profile.upi_id}&pn=${encodeURIComponent(profile.full_name)}&am=${adv}&cu=INR&tn=Booking` : '';

  const handleCheckout = async () => {
    if (!form.date || !form.name || !form.phone) return alert("Fill Name, Phone & Date");
    setBookingLoading(true);
    try {
      const sNames = cart.map(s => s.name).join(', ');
      const note = `Services: ${sNames} | UTR: ${form.utr || 'N/A'}`;
      const success = await createBooking({ profile_id: profile.id, booking_date: form.date, client_name: form.name, client_phone: form.phone, total_price: total, note: note });
      if (success) {
        setSuccess(true);
        openWhatsApp(profile.phone, { clientName: form.name, clientPhone: form.phone, selectedDate: formatDisplayDate(form.date), advance: adv, pending: total - adv, serviceName: sNames });
      }
    } catch (e) { alert("Booking failed"); } finally { setBookingLoading(false); }
  };

  if (loading) return <div className="min-h-screen bg-[#141414] flex items-center justify-center text-[#D4B996] animate-pulse italic font-black text-xs tracking-widest uppercase">ArtistHub Loading...</div>;
  if (!profile) return <div className="min-h-screen bg-[#141414] flex items-center justify-center text-white/10 italic">Artist not found.</div>;

  return (
    <main className="min-h-screen bg-[#141414] text-white font-sans selection:bg-[#D4B996] selection:text-black pb-20">
      <Head><title>{profile.full_name} | Portfolio</title></Head>

      {/* Floating Header */}
      <div className="fixed top-0 left-0 right-0 p-6 flex justify-between items-center z-50 bg-[#141414]/60 backdrop-blur-xl border-b border-white/5">
        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#D4B996] italic">Portfolio</span>
        <button onClick={() => bookingRef.current?.scrollIntoView({ behavior: 'smooth' })} className="px-6 py-2.5 bg-[#D4B996] rounded-full text-[10px] font-black uppercase tracking-widest text-black shadow-lg shadow-[#D4B996]/10">Checkout ({cart.length})</button>
      </div>

      {/* Hero: Luxury Profile Design */}
      <div className="pt-32 pb-16 flex flex-col items-center px-6 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-[#D4B996]/5 blur-[120px] rounded-full" />
        <div className="relative p-1 bg-gradient-to-b from-[#D4B996] to-transparent rounded-[45px] mb-8 shadow-2xl">
          <img src={transformDriveLink(profile.avatar_url)} className="w-32 h-32 rounded-[42px] object-cover border-4 border-[#141414]" />
        </div>
        <h1 className="text-5xl font-black text-[#D4B996] italic tracking-tighter mb-2">{profile.full_name}</h1>
        <p className="text-[11px] uppercase tracking-[0.6em] text-white/30 font-black mb-8 italic">{profile.tagline || 'Makeup Artist'}</p>
        <button onClick={() => generateArtistPDF(profile, services)} className="px-10 py-4 border border-white/10 rounded-3xl text-[9px] uppercase tracking-[0.3em] font-black text-white/40 hover:text-[#D4B996] hover:border-[#D4B996]/40 transition-all bg-white/2 backdrop-blur-md">Download PDF</button>
      </div>

      {/* Background & Education */}
      <section className="mt-12 px-6">
        <h2 className="text-[10px] uppercase tracking-[0.5em] text-white/20 font-black mb-8 text-center italic">Education & Experience</h2>
        <div className="bg-[#1F1F1F] rounded-[45px] p-8 border border-white/5 space-y-6 shadow-xl">
          <div className="flex gap-6 items-start">
            <span className="text-3xl grayscale opacity-50">🎓</span>
            <div>
              <p className="text-[9px] uppercase text-[#D4B996] font-black tracking-widest mb-1 italic">Qualification</p>
              <p className="text-sm text-white/80 font-medium leading-relaxed">{profile.education || "Bachelor of Arts degree with professional certification."}</p>
            </div>
          </div>
          <div className="h-[1px] bg-white/5 w-full" />
          <div className="flex gap-6 items-start">
            <span className="text-3xl grayscale opacity-50">💼</span>
            <div>
              <p className="text-[9px] uppercase text-[#D4B996] font-black tracking-widest mb-1 italic">Professional History</p>
              <p className="text-sm text-white/80 font-medium leading-relaxed">{profile.experience || "Over 5+ years of high-end experience."}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Instagram: Vibrant Section */}
      {profile.instagram_url && (
        <section className="px-6 mt-16">
          <a href={profile.instagram_url} target="_blank" className="flex items-center justify-between p-8 bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-transparent border border-white/5 rounded-[45px] active:scale-95 transition-all">
            <div className="flex items-center gap-6">
              <span className="text-4xl">📸</span>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.3em] text-white italic">Latest Work</p>
                <p className="text-[9px] text-white/20 uppercase tracking-widest font-bold">Follow on Instagram</p>
              </div>
            </div>
            <div className="bg-[#D4B996] px-5 py-2.5 rounded-2xl text-[10px] font-black text-black">FOLLOW</div>
          </a>
        </section>
      )}

      {/* Gallery: 3-Column Masonry */}
      <section className="mt-20 px-6">
        <h2 className="text-[10px] uppercase tracking-[0.5em] text-white/20 font-black mb-8 text-center italic">Portfolio Gallery</h2>
        <div className="grid grid-cols-3 gap-2">
          {profile.portfolio_images?.map((img, i) => (
            <div key={i} className={`rounded-[24px] overflow-hidden border border-white/5 ${i === 0 ? 'col-span-2 row-span-2' : ''}`}>
              <img src={transformDriveLink(img)} className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700" loading="lazy" />
            </div>
          ))}
        </div>
      </section>

      {/* Service Charges: Premium Cards */}
      <section className="mt-24 px-6">
        <h2 className="text-[11px] uppercase tracking-[0.5em] text-[#D4B996] font-black mb-10 text-center italic">— Service Charges —</h2>
        <div className="space-y-6">
          {services.map(s => {
            const added = cart.find(x => x.id === s.id);
            return (
              <div key={s.id} className={`bg-[#1F1F1F] rounded-[45px] p-8 border transition-all ${added ? 'border-[#D4B996] shadow-2xl shadow-[#D4B996]/5' : 'border-white/5 shadow-xl'}`}>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-black italic tracking-tighter">{s.name}</h3>
                  <span className="bg-[#D4B996] text-black px-5 py-2 rounded-full text-xs font-black shadow-lg">{formatINR(s.price)}</span>
                </div>
                <p className="text-xs text-white/40 leading-relaxed mb-8 italic font-medium">{s.description || "Premium products and professional finish included."}</p>
                <button onClick={() => toggleCart(s)} className={`w-full py-5 rounded-[24px] text-[10px] font-black uppercase tracking-[0.3em] transition-all shadow-xl ${added ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-white/5 border border-white/10 text-[#D4B996]'}`}>{added ? 'Remove Service' : 'Add to Cart'}</button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Checkout: Seamless Design */}
      <section ref={bookingRef} className="mt-24 px-6 pb-20 scroll-mt-32">
        <div className="bg-[#1F1F1F] rounded-[55px] p-10 border border-white/5 shadow-[0_50px_100px_rgba(0,0,0,0.4)]">
          {success ? (
            <div className="text-center py-16 animate-fadeIn">
              <div className="text-5xl mb-6">✨</div>
              <h3 className="text-3xl font-black text-[#D4B996] italic mb-4 tracking-tighter">Booking Sent!</h3>
              <p className="text-[10px] text-white/20 uppercase tracking-[0.4em] font-black">Check WhatsApp for Confirmation</p>
              <button onClick={() => window.location.reload()} className="mt-12 text-[10px] uppercase font-black text-[#D4B996] border-b-2 border-[#D4B996] pb-1">Start New Booking</button>
            </div>
          ) : (
            <div className="space-y-10">
              <h2 className="text-[11px] uppercase tracking-[0.5em] text-[#D4B996] font-black text-center italic">Checkout & Secure Date</h2>
              {cart.length > 0 ? (
                <>
                  <div className="space-y-3">
                    {cart.map(x => <div key={x.id} className="flex justify-between p-5 bg-white/2 rounded-3xl text-xs border border-white/5 font-black italic tracking-tight"><span>{x.name}</span><span className="text-[#D4B996]">{formatINR(x.price)}</span></div>)}
                    <div className="flex justify-between p-6 border-t border-white/10 mt-6 font-black text-[#D4B996] text-lg tracking-tighter italic"><span>GRAND TOTAL</span><span>{formatINR(total)}</span></div>
                  </div>
                  <BookingCalendar busyDates={busyDates} selectedDate={form.date} onSelect={d => setForm({...form, date:d})} />
                  <div className="space-y-4">
                    <input placeholder="ENTER YOUR NAME" className="w-full p-6 bg-white/2 border border-white/10 rounded-[28px] text-[11px] font-black text-center tracking-widest placeholder:text-white/10 focus:border-[#D4B996] outline-none" onChange={e => setForm({...form, name: e.target.value})} />
                    <input placeholder="WHATSAPP NUMBER" className="w-full p-6 bg-white/2 border border-white/10 rounded-[28px] text-[11px] font-black text-center tracking-widest placeholder:text-white/10 focus:border-[#D4B996] outline-none" onChange={e => setForm({...form, phone: e.target.value})} />
                  </div>
                  {form.date && form.name && (
                    <div className="space-y-10 text-center animate-slideUp pt-10 border-t border-white/5">
                      <div className="p-10 bg-[#D4B996]/5 rounded-[45px] border border-[#D4B996]/20">
                        <p className="text-[10px] uppercase text-white/40 mb-3 font-black tracking-[0.3em]">SECURE WITH ADVANCE (30%)</p>
                        <p className="text-5xl font-black text-[#D4B996] tracking-tighter mb-10 italic">{formatINR(adv)}</p>
                        <a href={upi} className="inline-block bg-[#5f259f] text-white px-12 py-5 rounded-3xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-[#5f259f]/20 active:scale-95">Open UPI Apps</a>
                      </div>
                      <div className="bg-white p-6 rounded-[45px] inline-block shadow-2xl relative">
                        <div className="absolute -top-4 -right-4 bg-[#D4B996] text-black text-[8px] font-black px-3 py-1 rounded-full uppercase italic shadow-lg">Verified</div>
                        <img src={transformDriveLink(profile.upi_qr_url)} className="w-44 h-auto mx-auto" />
                        <p className="text-[10px] text-black/40 font-mono mt-4 uppercase font-black">{profile.upi_id}</p>
                      </div>
                      <input placeholder="ENTER 12-DIGIT TRANSACTION ID (UTR)" className="w-full p-6 bg-white/2 border border-[#D4B996]/30 rounded-[28px] text-[11px] font-black text-center tracking-widest text-[#D4B996] placeholder:text-white/10 focus:border-[#D4B996] outline-none" onChange={e => setForm({...form, utr: e.target.value})} />
                      <button onClick={handleCheckout} disabled={!form.utr || bookingLoading} className="w-full py-6 bg-[#D4B996] text-black font-black rounded-[28px] uppercase text-[12px] tracking-[0.3em] shadow-2xl shadow-[#D4B996]/20">{bookingLoading ? 'Processing...' : 'Confirm Order'}</button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-20 border border-dashed border-white/5 rounded-[45px] text-white/10 text-[10px] uppercase tracking-[0.5em] font-black italic">Your cart is empty</div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Footer Branding */}
      <footer className="px-6 py-20 text-center border-t border-white/5 space-y-12">
        <div className="flex justify-center gap-10">
          <a href={profile.instagram_url} className="text-3xl opacity-20 hover:opacity-100 transition-all grayscale hover:grayscale-0">📸</a>
          <a href={`tel:${profile.phone}`} className="text-3xl opacity-20 hover:opacity-100 transition-all grayscale hover:grayscale-0">📞</a>
        </div>
        <div className="space-y-2">
          <p className="text-2xl font-black italic text-[#D4B996] opacity-30 tracking-[0.3em] uppercase">ArtistHub</p>
          <p className="text-[8px] uppercase tracking-[0.8em] font-black text-white/10">Made by 🤞 Lucky</p>
        </div>
      </footer>
    </main>
  );
}
