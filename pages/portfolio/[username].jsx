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
function transformDriveLink(url) {
  if (!url || typeof url !== 'string') return url;
  if (url.includes('drive.google.com')) {
    const fileId = url.split('/d/')[1]?.split('/')[0] || url.split('id=')[1]?.split('&')[0];
    if (fileId) return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
  }
  return url;
}

const formatINR = n => `₹${Number(n).toLocaleString('en-IN')}`;

export default function PortfolioPage() {
  const router = useRouter();
  const { username } = router.query;
  const bookingRef = useRef(null); // For scrolling to booking
  
  const [profile, setProfile] = useState(null);
  const [services, setServices] = useState([]);
  const [busyDates, setBusyDates] = useState(new Set());
  const [loading, setLoading] = useState(true);

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

  const scrollToBooking = () => bookingRef.current?.scrollIntoView({ behavior: 'smooth' });

  if (loading) return <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center text-[#D4B996]">ArtistHub Loading...</div>;
  if (!profile) return <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center text-white/20 uppercase tracking-widest">Artist Not Found</div>;

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-white font-sans selection:bg-[#D4B996] selection:text-black">
      <Head><title>{profile.full_name} | Portfolio</title></Head>

      {/* 1. Profile Header & Top Buttons */}
      <div className="relative h-[450px] w-full overflow-hidden">
        {profile.cover_url ? (
          <img src={transformDriveLink(profile.cover_url)} className="w-full h-full object-cover opacity-50 scale-105" />
        ) : <div className="w-full h-full bg-gradient-to-b from-[#252525] to-[#1A1A1A]" />}
        
        {/* Top Buttons Overlay */}
        <div className="absolute top-8 left-0 right-0 px-6 flex justify-between items-center z-20">
          <button className="px-5 py-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest text-[#D4B996]">Portfolio</button>
          <button onClick={scrollToBooking} className="px-5 py-2 bg-[#D4B996] rounded-full text-[10px] font-black uppercase tracking-widest text-black shadow-xl shadow-[#D4B996]/20">Book Now</button>
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A1A] via-[#1A1A1A]/20 to-transparent" />
      </div>

      {/* 2. Artist Identity */}
      <div className="relative px-6 -mt-32 flex flex-col items-center text-center pb-12 border-b border-white/5">
        <div className="relative p-1 bg-gradient-to-b from-[#D4B996] to-transparent rounded-[40px] mb-6">
          <img src={transformDriveLink(profile.avatar_url)} className="w-32 h-32 rounded-[38px] object-cover border-4 border-[#1A1A1A]" />
        </div>
        <h1 className="text-4xl font-black text-[#D4B996] italic tracking-tighter mb-2">{profile.full_name}</h1>
        <p className="text-[11px] uppercase tracking-[0.5em] text-white/30 font-medium">{profile.tagline || 'Visual Artist & Expert'}</p>
      </div>

      {/* 3. Achievements & Portfolio Gallery */}
      <section className="p-6 space-y-16 mt-8">
        
        {/* Achievement Section */}
        <div className="grid gap-4">
          <h2 className="text-[10px] uppercase tracking-[0.3em] text-[#D4B996] font-bold mb-2">Background & Experience</h2>
          <div className="p-6 bg-white/5 rounded-[32px] border border-white/10 italic text-xs leading-relaxed text-white/60">
            {profile.education || "Bachelor of Arts degree with Advanced Professional Certifications."}
            <div className="h-[1px] w-full bg-white/5 my-4" />
            {profile.experience || "Handling professional high-end projects with 5+ years of expertise."}
          </div>
        </div>

        {/* Gallery */}
        <div className="space-y-6">
          <h2 className="text-[10px] uppercase tracking-[0.3em] text-[#D4B996] font-bold">Featured Work</h2>
          <div className="grid grid-cols-2 gap-3">
            {profile.portfolio_images?.map((img, i) => (
              <img key={i} src={transformDriveLink(img)} className="w-full aspect-[4/5] object-cover rounded-3xl border border-white/5 hover:scale-[1.02] transition-transform" />
            ))}
          </div>
        </div>

        {/* Services */}
        <div className="space-y-6">
          <h2 className="text-[10px] uppercase tracking-[0.3em] text-[#D4B996] font-bold">Our Expertise</h2>
          <div className="grid gap-4">
            {services.map(s => (
              <div key={s.id} className="p-6 bg-white/5 border border-white/10 rounded-[35px] group">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold text-lg text-[#D4B996] italic">{s.name}</h3>
                  <span className="font-bold text-sm bg-white/5 px-3 py-1 rounded-full">{formatINR(s.price)}</span>
                </div>
                <p className="text-[11px] text-white/40 leading-relaxed mb-4">{s.description || "Premium service with high-end results and attention to detail."}</p>
                <div className="flex gap-2">
                   <span className="text-[8px] border border-[#D4B996]/20 text-[#D4B996] px-3 py-1 rounded-full uppercase font-bold tracking-widest">Premium Kit</span>
                   <span className="text-[8px] border border-[#D4B996]/20 text-[#D4B996] px-3 py-1 rounded-full uppercase font-bold tracking-widest">Long Lasting</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Booking Ref Point */}
        <div ref={bookingRef} className="pt-10 scroll-mt-10">
          <h2 className="text-[10px] uppercase tracking-[0.3em] text-[#D4B996] font-bold mb-6 text-center">Secure Appointment</h2>
          {/* Booking Flow logic (Same as before) will be embedded here */}
          <div className="p-8 bg-[#D4B996]/5 border border-[#D4B996]/20 rounded-[45px] text-center">
            <p className="text-xs text-white/40 mb-6 italic">Select a date and pay 30% advance to confirm your slot.</p>
            <button onClick={() => alert("Redirecting to Booking Flow...")} className="w-full py-5 bg-[#D4B996] text-black font-black rounded-3xl uppercase tracking-widest text-xs shadow-2xl shadow-[#D4B996]/20">Start Booking Process</button>
          </div>
        </div>

        {/* Social & Contact */}
        <div className="py-10 border-t border-white/5 text-center">
          <p className="text-[10px] uppercase tracking-[0.4em] text-white/20 mb-8">Connect With Me</p>
          <div className="flex justify-center gap-6">
            <a href={profile.instagram_url || '#'} className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-xl border border-white/10 group active:scale-90 transition-all">📸</a>
            <a href={`tel:${profile.phone}`} className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-xl border border-white/10 group active:scale-90 transition-all">📞</a>
          </div>
        </div>
      </section>

      <footer className="px-6 py-12 text-center text-white/10">
        <p className="text-sm font-bold italic tracking-widest mb-1">ArtistHub</p>
        <p className="text-[8px] uppercase tracking-[0.5em]">Made by 🤞 Lucky</p>
      </footer>
    </div>
  );
}
