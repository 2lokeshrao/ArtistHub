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

function BookingCalendar({ busyDates, selectedDate, onSelect }) {
  const [view, setView] = useState({ y: new Date().getFullYear(), m: new Date().getMonth() });
  const days = new Date(view.y, view.m + 1, 0).getDate();
  const first = new Date(view.y, view.m, 1).getDay();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const monthName = new Date(view.y, view.m).toLocaleString('default', { month: 'long' });

  return (
    <div className="w-full bg-white/5 border border-white/10 rounded-[32px] p-6 mt-4">
      <div className="flex justify-between items-center mb-6 px-2">
        <button onClick={() => setView({ ...view, m: view.m - 1 })} className="p-2 text-[#D4B996]">←</button>
        <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-[#D4B996]">{monthName} {view.y}</h3>
        <button onClick={() => setView({ ...view, m: view.m + 1 })} className="p-2 text-[#D4B996]">→</button>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {['S','M','T','W','T','F','S'].map(d => <div key={d} className="text-[9px] font-black text-white/20 text-center pb-2">{d}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const dateStr = toISO(view.y, view.m, d);
          const isBusy = busyDates.has(dateStr);
          const isSelected = selectedDate === dateStr;
          return (
            <button key={i} disabled={isBusy || dateStr < new Date().toISOString().split('T')[0]} onClick={() => onSelect(dateStr)}
              className={`aspect-square rounded-xl text-[10px] font-bold transition-all ${isBusy ? 'opacity-10 bg-white/5' : isSelected ? 'bg-[#D4B996] text-black scale-110 shadow-lg' : 'hover:bg-white/10 text-white/60'}`}>{d}</button>
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

  const toggleCart = (s) => {
    setCart(prev => prev.find(i => i.id === s.id) ? prev.filter(i => i.id !== s.id) : [...prev, s]);
    bookingRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const total = cart.reduce((acc, s) => acc + s.price, 0);
  const adv = Math.round(total * 0.3);
  const upi = profile ? `upi://pay?pa=${profile.upi_id}&pn=${encodeURIComponent(profile.full_name)}&am=${adv}&cu=INR&tn=Booking` : '';

  const handleCheckout = async () => {
    if (!form.date || !form.name || !form.phone) return alert("Fill Name, Phone & Date");
    setBookingLoading(true);
    try {
      const sNames = cart.map(s => s.name).join(', ');
      await createBooking({ profile_id: profile.id, booking_date: form.date, client_name: form.name, client_phone: form.phone, total_price: total, note: `Services: ${sNames} | UTR: ${form.utr || 'N/A'}` });
      setSuccess(true);
      openWhatsApp(profile.phone, { clientName: form.name, clientPhone: form.phone, selectedDate: form.date, advance: adv, pending: total - adv, serviceName: sNames });
    } catch (e) { alert("Booking failed"); } finally { setBookingLoading(false); }
  };

  if (loading) return <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center text-[#D4B996] animate-pulse">Loading...</div>;
  if (!profile) return <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center text-white/20">Artist not found</div>;

  return (
    <main className="min-h-screen bg-[#1A1A1A] text-white font-sans selection:bg-[#D4B996]">
      <Head><title>{profile.full_name} | Portfolio</title></Head>

      <div className="fixed top-0 left-0 right-0 p-4 flex justify-between items-center z-50 bg-[#1A1A1A]/80 backdrop-blur-md border-b border-white/5">
        <button className="px-5 py-2 bg-white/5 rounded-full text-[10px] font-bold uppercase text-[#D4B996]">Portfolio</button>
        <button onClick={() => bookingRef.current?.scrollIntoView({ behavior: 'smooth' })} className="px-5 py-2 bg-[#D4B996] rounded-full text-[10px] font-black uppercase text-black">Checkout ({cart.length})</button>
      </div>

      <div className="pt-24 flex flex-col items-center px-6">
        <img src={transformDriveLink(profile.avatar_url)} className="w-24 h-24 rounded-[30px] object-cover border-2 border-[#1A1A1A] mb-4 shadow-2xl" />
        <h1 className="text-3xl font-black text-[#D4B996] italic tracking-tighter">{profile.full_name}</h1>
        <p className="text-[10px] uppercase tracking-[0.4em] text-white/30 mt-1 mb-6">{profile.tagline}</p>
        <button onClick={() => generateArtistPDF(profile, services)} className="px-8 py-3 border border-white/10 rounded-full text-[9px] uppercase font-black text-white/40 hover:text-[#D4B996] transition-all">Download PDF</button>
      </div>

      <section className="mt-12 px-6">
        <h2 className="text-[11px] uppercase tracking-[0.4em] text-[#D4B996] font-bold mb-6">Education & Experience</h2>
        <div className="bg-white/5 rounded-[32px] p-6 border border-white/10 space-y-4">
          <div><p className="text-[10px] uppercase text-white/40 font-bold">Qualification</p><p className="text-xs text-white/80 italic">{profile.education || "BA Graduation"}</p></div>
          <div className="h-[1px] bg-white/5 w-full" />
          <div><p className="text-[10px] uppercase text-white/40 font-bold">Professional History</p><p className="text-xs text-white/80 italic">{profile.experience || "6 + year"}</p></div>
        </div>
      </section>

      {profile.instagram_url && (
        <section className="px-6 mt-10">
          <a href={profile.instagram_url} target="_blank" className="flex items-center justify-between p-6 bg-gradient-to-br from-purple-600/10 to-pink-500/10 border border-white/10 rounded-[28px] group active:scale-95 transition-all">
            <div className="flex items-center gap-4"><span className="text-3xl">📸</span><div><p className="text-[11px] font-black uppercase text-white">Instagram Work</p><p className="text-[9px] text-white/30">Follow for latest reels</p></div></div>
            <div className="bg-white/5 px-4 py-2 rounded-xl text-[10px] font-bold text-[#D4B996]">FOLLOW</div>
          </a>
        </section>
      )}

      <section className="mt-16 px-6">
        <h2 className="text-[11px] uppercase tracking-[0.4em] text-[#D4B996] font-bold mb-6">Client Work</h2>
        <div className="grid grid-cols-3 gap-1.5">
          {profile.portfolio_images?.map((img, i) => (
            <div key={i} className={`rounded-lg overflow-hidden border border-white/5 ${i === 0 ? 'col-span-2 row-span-2' : ''}`}><img src={transformDriveLink(img)} className="w-full h-full object-cover" loading="lazy" /></div>
          ))}
        </div>
      </section>

      <section className="mt-16 px-6">
        <h2 className="text-[11px] uppercase tracking-[0.4em] text-[#D4B996] font-bold mb-6 text-center">Our Service Charges</h2>
        <div className="space-y-6">
          {services.map(s => {
            const added = cart.find(x => x.id === s.id);
            return (
              <div key={s.id} className={`bg-[#1F1F1F] rounded-[32px] p-6 border ${added ? 'border-[#D4B996]' : 'border-white/5'}`}>
                <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-black italic">{s.name}</h3><span className="bg-[#D4B996] text-black px-4 py-1.5 rounded-full text-sm font-black">{formatINR(s.price)}</span></div>
                <p className="text-xs text-white/50 leading-relaxed mb-6">{s.description || "Premium products and professional finish included."}</p>
                <button onClick={() => toggleCart(s)} className={`w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest ${added ? 'bg-red-500/10 text-red-500' : 'bg-white/5 border border-[#D4B996]/30 text-[#D4B996]'}`}>{added ? 'Remove' : 'Add to Cart'}</button>
              </div>
            );
          })}
        </div>
      </section>

      <section ref={bookingRef} className="mt-20 px-6 pb-20 scroll-mt-24">
        <div className="bg-[#1A1A1A] rounded-[40px] p-6 border border-white/5 shadow-2xl">
          {success ? <div className="text-center py-12 animate-fadeIn"><h3 className="text-3xl font-black text-[#D4B996] italic mb-4">Confirmed! ✨</h3><button onClick={() => window.location.reload()} className="mt-6 text-[10px] uppercase font-black text-[#D4B996] border-b border-[#D4B996]">Book Again</button></div> : (
            <div className="space-y-8">
              <h2 className="text-[11px] uppercase tracking-[0.4em] text-[#D4B996] font-bold text-center">Checkout Items</h2>
              {cart.length > 0 ? (
                <>
                  <div className="space-y-2">{cart.map(x => <div key={x.id} className="flex justify-between p-4 bg-white/5 rounded-2xl text-xs border border-white/5"><span>{x.name}</span><span className="text-[#D4B996] font-bold">{formatINR(x.price)}</span></div>)}<div className="flex justify-between p-5 border-t border-white/10 mt-4 font-black text-[#D4B996] text-sm tracking-widest"><span>TOTAL</span><span>{formatINR(total)}</span></div></div>
                  <BookingCalendar busyDates={busyDates} selectedDate={form.date} onSelect={d => setForm({...form, date:d})} />
                  <div className="space-y-4"><input placeholder="Name" className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold text-center" onChange={e => setForm({...form, name: e.target.value})} /><input placeholder="WhatsApp No" className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold text-center" onChange={e => setForm({...form, phone: e.target.value})} /></div>
                  {form.date && form.name && (
                    <div className="space-y-8 text-center animate-slideUp pt-8 border-t border-white/5">
                      <div className="p-8 bg-[#D4B996]/10 rounded-[35px] border border-[#D4B996]/30"><p className="text-[10px] uppercase text-white/40 mb-2 font-bold">Advance (30%)</p><p className="text-4xl font-black text-[#D4B996] mb-8">{formatINR(adv)}</p><a href={upi} className="inline-block bg-[#5f259f] text-white px-10 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest">Pay Now</a></div>
                      <div className="bg-white p-5 rounded-[40px] inline-block shadow-2xl"><img src={transformDriveLink(profile.upi_qr_url)} className="w-44 h-auto mx-auto" /><p className="text-[10px] text-black/40 font-mono mt-4 uppercase font-bold">{profile.upi_id}</p></div>
                      <input placeholder="Enter 12-Digit UTR" className="w-full p-5 bg-white/5 border border-[#D4B996]/30 rounded-2xl text-center outline-none text-sm font-black text-[#D4B996]" onChange={e => setForm({...form, utr: e.target.value})} />
                      <button onClick={handleCheckout} disabled={!form.utr || bookingLoading} className="w-full py-5 bg-[#D4B996] text-black font-black rounded-3xl uppercase text-[11px] tracking-[0.2em] shadow-2xl shadow-[#D4B996]/20">{bookingLoading ? 'Processing...' : 'Confirm Order'}</button>
                    </div>
                  )}
                </>
              ) : <div className="text-center py-16 border border-dashed border-white/10 rounded-[32px] text-white/20 text-[10px] uppercase tracking-widest italic">Your cart is empty</div>}
            </div>
          )}
        </div>
      </section>

      <footer className="px-6 pb-12 text-center border-t border-white/5 pt-12 space-y-8">
        <div className="flex justify-center gap-8"><a href={profile.instagram_url} className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-2xl grayscale opacity-30">📸</a><a href={`tel:${profile.phone}`} className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-2xl grayscale opacity-30">📞</a></div>
        <div><p className="text-xl font-black italic text-[#D4B996] opacity-30 tracking-widest mb-1 uppercase">ArtistHub</p><p className="text-[9px] uppercase tracking-[0.5em] font-black text-white/10">Digital Identity by Lucky 🤞</p></div>
      </footer>
    </main>
  );
 }
      
