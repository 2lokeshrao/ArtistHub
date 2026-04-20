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

// WhatsApp ke liye sundar date format: 20-Apr-2026
const formatDisplayDate = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

function toISO(year, month, day) { 
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; 
}

// --- Sub-Component: Calendar ---
function BookingCalendar({ busyDates, selectedDate, onSelect }) {
  const [view, setView] = useState({ y: new Date().getFullYear(), m: new Date().getMonth() });
  const days = new Date(view.y, view.m + 1, 0).getDate();
  const first = new Date(view.y, view.m, 1).getDay();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];

  const monthName = new Date(view.y, view.m).toLocaleString('default', { month: 'long' });

  return (
    <div className="w-full bg-white/5 border border-white/10 rounded-[32px] p-6">
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
            <button
              key={i}
              disabled={isBusy}
              onClick={() => onSelect(dateStr)}
              className={`aspect-square rounded-xl text-[10px] font-bold transition-all flex items-center justify-center
                ${isBusy ? 'opacity-10 cursor-not-allowed bg-white/5' : 
                  isSelected ? 'bg-[#D4B996] text-black scale-110 shadow-lg' : 'hover:bg-white/10 text-white/60'}`}
            >
              {d}
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
        if (!p) return;
        setProfile(p);
        const [svc, busy] = await Promise.all([
          getServicesByProfileId(p.id),
          getBusyDates(p.id)
        ]);
        setServices(svc);
        setBusyDates(new Set(busy));
      } catch (e) { console.error(e); } finally { setLoading(false); }
    })();
  }, [username]);

  const toggleService = (s) => {
    setCart(prev => prev.find(item => item.id === s.id) ? prev.filter(item => item.id !== s.id) : [...prev, s]);
  };

  const total = cart.reduce((acc, s) => acc + s.price, 0);

  const handleCheckout = async () => {
    if (!form.date || !form.name || !form.phone) return alert("Please fill Name, Phone and Select Date");
    setBookingLoading(true);
    try {
      const serviceNames = cart.map(s => s.name).join(', ');
      // WhatsApp message ke liye note create karna
      const note = `Services: ${serviceNames} | UTR: ${form.utr || 'N/A'}`;
      
      const success = await createBooking({
        profile_id: profile.id,
        booking_date: form.date,
        client_name: form.name,
        client_phone: form.phone,
        total_price: total,
        note: note
      });

      if (success) {
        setSuccess(true);
        // Date format fix for WhatsApp
        const prettyDate = formatDisplayDate(form.date);
        openWhatsApp(profile.phone, {
          ...form,
          date: prettyDate,
          services: serviceNames,
          total: total
        });
      }
    } catch (e) { alert("Booking failed. Try again."); } finally { setBookingLoading(false); }
  };

  if (loading) return <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center text-[#D4B996] animate-pulse uppercase tracking-[0.3em] text-[10px] font-black">Loading Portfolio...</div>;
  if (!profile) return <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center text-white/20">Artist not found</div>;

  return (
    <main className="min-h-screen bg-[#1A1A1A] text-white font-sans selection:bg-[#D4B996] selection:text-black">
      <Head><title>{profile.full_name} | Artist Portfolio</title></Head>

      {/* Hero Section */}
      <section className="pt-24 pb-12 px-6 flex flex-col items-center text-center">
        <div className="relative p-1 bg-gradient-to-b from-[#D4B996] to-transparent rounded-[32px] mb-6 shadow-2xl">
          <img src={transformDriveLink(profile.avatar_url)} className="w-28 h-28 rounded-[28px] object-cover border-4 border-[#1A1A1A]" alt={profile.full_name} />
        </div>
        <h1 className="text-4xl font-black text-[#D4B996] italic tracking-tighter mb-2">{profile.full_name}</h1>
        <p className="text-[10px] uppercase tracking-[0.5em] text-white/30 font-bold mb-8">{profile.tagline || 'Professional Artist'}</p>
        
        {/* PDF Download Button */}
        <button 
          onClick={() => generateArtistPDF(profile, services)}
          className="px-8 py-3 border border-white/10 rounded-full text-[9px] uppercase tracking-widest font-black text-white/40 hover:text-[#D4B996] hover:border-[#D4B996]/40 transition-all"
        >
          Download PDF Portfolio
        </button>
      </section>

      {/* Services Grid */}
      <section className="px-6 mb-20">
        <h2 className="text-[10px] uppercase tracking-[0.3em] text-white/20 font-black mb-8 text-center italic">— Select Services —</h2>
        <div className="grid gap-4">
          {services.map(s => {
            const isSelected = cart.find(item => item.id === s.id);
            return (
              <button key={s.id} onClick={() => toggleService(s)} className={`p-6 rounded-[32px] border text-left transition-all ${isSelected ? 'bg-[#D4B996] border-[#D4B996] text-black scale-[1.02] shadow-xl' : 'bg-white/5 border-white/10 text-white'}`}>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-black uppercase tracking-tight">{s.name}</span>
                  <span className={`text-xs font-black ${isSelected ? 'text-black/60' : 'text-[#D4B996]'}`}>{formatINR(s.price)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Booking Section */}
      <section ref={bookingRef} className="px-6 pb-32">
        <div className="max-w-md mx-auto">
          {success ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 p-10 rounded-[40px] text-center animate-fadeIn">
              <div className="text-4xl mb-4">✨</div>
              <h2 className="text-xl font-black text-emerald-500 uppercase tracking-tighter mb-2">Booking Sent!</h2>
              <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest">Check your WhatsApp for details.</p>
            </div>
          ) : (
            <div className="space-y-8">
              <BookingCalendar busyDates={busyDates} selectedDate={form.date} onSelect={d => setForm({...form, date: d})} />
              
              {cart.length > 0 && form.date && (
                <div className="space-y-4 animate-slideUp">
                  <input placeholder="YOUR FULL NAME" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-sm outline-none focus:border-[#D4B996]" />
                  <input placeholder="WHATSAPP NUMBER" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-sm outline-none focus:border-[#D4B996]" />
                  <input placeholder="PAYMENT UTR (OPTIONAL)" value={form.utr} onChange={e => setForm({...form, utr: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-sm outline-none focus:border-[#D4B996]" />
                  
                  <div className="bg-[#D4B996] p-8 rounded-[40px] text-black shadow-2xl">
                    <div className="flex justify-between items-end mb-6">
                      <div>
                        <p className="text-[9px] font-black uppercase opacity-40 mb-1">Total Amount</p>
                        <p className="text-3xl font-black italic tracking-tighter">{formatINR(total)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-black uppercase opacity-40 mb-1">Event Date</p>
                        <p className="text-sm font-black">{formatDisplayDate(form.date)}</p>
                      </div>
                    </div>
                    <button onClick={handleCheckout} disabled={bookingLoading} className="w-full py-5 bg-black text-white rounded-3xl text-[11px] font-black uppercase tracking-[0.2em] active:scale-95 transition-all">
                      {bookingLoading ? 'Processing...' : 'Confirm via WhatsApp'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <footer className="p-12 text-center border-t border-white/5 opacity-20">
        <p className="text-[9px] font-black uppercase tracking-[0.5em]">Powered by ArtistHub</p>
      </footer>
    </main>
  );
}
