// pages/portfolio/[username].jsx
// ─────────────────────────────────────────────────────────────
//  Public-facing portfolio + booking page
//  Route: /portfolio/your-username
// ─────────────────────────────────────────────────────────────

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

// --- Yeh function Drive link ko image mein badal deta hai ---
function transformDriveLink(url) {
  if (!url || typeof url !== 'string') return url;
  if (url.includes('drive.google.com')) {
    const fileId = url.split('/d/')[1]?.split('/')[0] || url.split('id=')[1]?.split('&')[0];
    if (fileId) return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
  }
  return url;
}

// ── Tiny helpers ─────────────────────────────────────────────
function formatINR(n) {
  return `₹${Number(n).toLocaleString('en-IN')}`;
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function toISO(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function today() {
  const d = new Date();
  return toISO(d.getFullYear(), d.getMonth(), d.getDate());
}

// ── Portfolio image grid ──────────────────────────────────────
function PortfolioGrid({ images }) {
  if (!images?.length) return null;
  return (
    <section className="px-5 py-8">
      <h2 className="font-display text-xs tracking-[0.25em] text-champagne mb-5 uppercase">Portfolio</h2>
      <div className="grid grid-cols-3 gap-1.5">
        {images.slice(0, 9).map((url, i) => (
          <div
            key={i}
            className="aspect-square rounded-sm overflow-hidden bg-charcoal/20"
            style={{ gridRow: i === 0 ? 'span 2' : undefined, gridColumn: i === 0 ? 'span 2' : undefined }}
          >
            <img
              src={transformDriveLink(url)}
              alt={`Portfolio ${i + 1}`}
              className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
              loading="lazy"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Mini calendar for booking ────────────────────────────────
function BookingCalendar({ busyDates, selectedDate, onSelect }) {
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const { year, month } = viewDate;
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = new Date(year, month, 1).getDay();
  const monthName = new Date(year, month).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  const todayISO = today();

  const prev = () => {
    setViewDate(v => {
      if (v.month === 0) return { year: v.year - 1, month: 11 };
      return { year: v.year, month: v.month - 1 };
    });
  };
  const next = () => {
    setViewDate(v => {
      if (v.month === 11) return { year: v.year + 1, month: 0 };
      return { year: v.year, month: v.month + 1 };
    });
  };

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="bg-white/5 rounded-2xl p-4 backdrop-blur-sm border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <button onClick={prev} className="text-champagne hover:text-white transition-colors px-2 py-1 text-lg">‹</button>
        <span className="text-sm font-medium tracking-wide text-white/90">{monthName}</span>
        <button onClick={next} className="text-champagne hover:text-white transition-colors px-2 py-1 text-lg">›</button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} className="text-center text-[10px] text-white/40 font-medium py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const iso = toISO(year, month, day);
          const isBusy = busyDates.has(iso);
          const isPast = iso < todayISO;
          const isSelected = iso === selectedDate;

          let cls = 'w-full aspect-square rounded-lg text-[11px] font-medium transition-all duration-150 flex items-center justify-center ';
          if (isPast) {
            cls += 'text-white/20 cursor-not-allowed';
          } else if (isBusy) {
            cls += 'bg-red-500/20 text-red-400/70 cursor-not-allowed line-through';
          } else if (isSelected) {
            cls += 'bg-champagne text-charcoal shadow-lg scale-110 cursor-pointer';
          } else {
            cls += 'text-white/80 hover:bg-white/10 cursor-pointer hover:scale-105';
          }

          return (
            <button
              key={i}
              className={cls}
              disabled={isPast || isBusy}
              onClick={() => !isPast && !isBusy && onSelect(iso)}
            >
              {day}
            </button>
          );
        })}
      </div>

      <div className="flex gap-4 mt-4 text-[10px] text-white/50">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/50 inline-block"/>Busy
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-champagne inline-block"/>Selected
        </span>
      </div>
    </div>
  );
}

// ── Booking form ─────────────────────────────────────────────
function BookingForm({ profile, services, busyDates }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    selectedService: null,
    selectedDate: '',
    timeSlot: '',
    clientName: '',
    clientPhone: '',
    clientEmail: '',
    note: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async () => {
    if (!form.clientName || !form.clientPhone || !form.selectedDate || !form.selectedService) {
      setError('Please fill all required fields.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await createBooking({
        profile_id:   profile.id,
        service_id:   form.selectedService.id,
        client_name:  form.clientName,
        client_phone: form.clientPhone,
        client_email: form.clientEmail,
        booking_date: form.selectedDate,
        time_slot:    form.timeSlot,
        total_price:  form.selectedService.price,
        note:         form.note,
      });
      setSuccess(true);
      // Trigger WhatsApp
      if (profile.phone) {
        openWhatsApp(profile.phone, {
          clientName:  form.clientName,
          clientPhone: form.clientPhone,
          serviceName: form.selectedService.name,
          bookingDate: form.selectedDate,
          timeSlot:    form.timeSlot,
          totalPrice:  form.selectedService.price,
          note:        form.note,
        });
      }
    } catch (e) {
      setError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center py-10 px-6">
        <div className="text-5xl mb-4">✨</div>
        <h3 className="text-xl font-display text-champagne mb-2">Booking Sent!</h3>
        <p className="text-white/60 text-sm">
          Your request has been sent. {profile.full_name} will confirm via WhatsApp shortly.
        </p>
        <button
          onClick={() => { setSuccess(false); setForm({ selectedService: null, selectedDate: '', timeSlot: '', clientName: '', clientPhone: '', clientEmail: '', note: '' }); setStep(1); }}
          className="mt-6 text-xs text-champagne underline underline-offset-4"
        >
          Make another booking
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Step 1 — Choose service */}
      {step >= 1 && (
        <div>
          <label className="block text-[10px] tracking-widest text-champagne/70 mb-2 uppercase">Select Service *</label>
          <div className="grid gap-2">
            {services.map(svc => (
              <button
                key={svc.id}
                onClick={() => { set('selectedService', svc); setStep(Math.max(step, 2)); }}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all duration-200 ${
                  form.selectedService?.id === svc.id
                    ? 'border-champagne bg-champagne/10 shadow-inner'
                    : 'border-white/10 bg-white/5 hover:border-champagne/50'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-white/90">{svc.name}</span>
                  <span className="text-sm font-bold text-champagne">{formatINR(svc.price)}</span>
                </div>
                {svc.duration && <p className="text-[10px] text-white/40 mt-0.5">{svc.duration}</p>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2 — Pick date */}
      {step >= 2 && (
        <div>
          <label className="block text-[10px] tracking-widest text-champagne/70 mb-2 uppercase">Pick a Date *</label>
          <BookingCalendar
            busyDates={busyDates}
            selectedDate={form.selectedDate}
            onSelect={d => { set('selectedDate', d); setStep(Math.max(step, 3)); }}
          />
          {form.selectedDate && (
            <div className="mt-2">
              <label className="block text-[10px] tracking-widest text-champagne/70 mb-1.5 uppercase">Preferred Time</label>
              <input
                type="time"
                value={form.timeSlot}
                onChange={e => set('timeSlot', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-champagne/60"
              />
            </div>
          )}
        </div>
      )}

      {/* Step 3 — Contact info */}
      {step >= 3 && (
        <div className="space-y-3">
          <label className="block text-[10px] tracking-widest text-champagne/70 mb-1 uppercase">Your Details *</label>
          {[
            { key: 'clientName',  placeholder: 'Full Name',       type: 'text' },
            { key: 'clientPhone', placeholder: 'WhatsApp Number', type: 'tel'  },
            { key: 'clientEmail', placeholder: 'Email (optional)',type: 'email'},
          ].map(f => (
            <input
              key={f.key}
              type={f.type}
              placeholder={f.placeholder}
              value={form[f.key]}
              onChange={e => set(f.key, e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-champagne/60 transition-colors"
            />
          ))}
          <textarea
            placeholder="Special requests / note..."
            value={form.note}
            onChange={e => set('note', e.target.value)}
            rows={2}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-champagne/60 transition-colors resize-none"
          />
        </div>
      )}

      {error && <p className="text-red-400 text-xs">{error}</p>}

      {step >= 3 && (
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-3.5 rounded-2xl font-bold text-sm tracking-widest uppercase bg-gradient-to-r from-champagne to-[#c8a96e] text-charcoal hover:shadow-[0_0_24px_rgba(212,185,150,0.4)] transition-all duration-300 disabled:opacity-50"
        >
          {loading ? 'Sending…' : '✨ Confirm Booking'}
        </button>
      )}
    </div>
  );
}

// ── Main portfolio page ───────────────────────────────────────
export default function PortfolioPage() {
  const router = useRouter();
  const { username } = router.query;

  const [profile,  setProfile]  = useState(null);
  const [services, setServices] = useState([]);
  const [busyDates, setBusyDates] = useState(new Set());
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState('portfolio'); // 'portfolio' | 'book'
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    if (!username) return;
    (async () => {
      try {
        const p = await getProfileByUsername(username);
        setProfile(p);
        const [svc, busy] = await Promise.all([
          getServicesByProfileId(p.id),
          getBusyDates(p.id),
        ]);
        setServices(svc);
        setBusyDates(busy);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [username]);

  const handleDownloadPDF = useCallback(async () => {
    if (!profile) return;
    setPdfLoading(true);
    try {
      await generateArtistPDF(profile, services);
    } catch (e) {
      alert('PDF generation failed: ' + e.message);
    } finally {
      setPdfLoading(false);
    }
  }, [profile, services]);

  if (loading) {
    return (
      <div className="min-h-screen bg-charcoal flex items-center justify-center">
        <div className="text-champagne/60 text-sm tracking-widest animate-pulse">Loading…</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-charcoal flex items-center justify-center px-6 text-center">
        <div>
          <p className="text-champagne text-3xl mb-3">404</p>
          <p className="text-white/50 text-sm">This portfolio doesn't exist.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{profile.full_name} · ArtistHub</title>
        <meta name="description" content={profile.bio || `${profile.full_name}'s portfolio`} />
        <meta property="og:image" content={profile.avatar_url || ''} />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>

      <main className="min-h-screen bg-charcoal text-white font-body">

        {/* ── Cover image ─── */}
        <div className="relative h-48 w-full overflow-hidden">
          {profile.cover_url
            ? <img src={transformDriveLink(profile.cover_url)} alt="Cover" className="w-full h-full object-cover" />
            : <div className="w-full h-full bg-gradient-to-br from-[#2c2318] via-charcoal to-[#1a1a1a]" />
          }
          <div className="absolute inset-0 bg-gradient-to-t from-charcoal via-charcoal/40 to-transparent" />
        </div>

        {/* ── Profile card ─── */}
        <div className="relative px-5 -mt-16 pb-2">
          <div className="flex items-end gap-4">
            {profile.avatar_url
              ? <img src={transformDriveLink(profile.avatar_url)} alt={profile.full_name} className="w-24 h-24 rounded-2xl object-cover border-2 border-champagne/30 shadow-2xl flex-shrink-0" />
              : <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-champagne/30 to-champagne/10 flex items-center justify-center text-3xl flex-shrink-0">✨</div>
            }
            <div className="pb-1">
              <h1 className="font-display text-2xl leading-tight">{profile.full_name}</h1>
              {profile.tagline && <p className="text-champagne/80 text-xs mt-0.5 italic">{profile.tagline}</p>}
              {profile.city && <p className="text-white/40 text-xs mt-1">📍 {profile.city}</p>}
            </div>
          </div>

          {profile.bio && (
            <p className="text-white/60 text-sm leading-relaxed mt-4 border-l-2 border-champagne/30 pl-3">
              {profile.bio}
            </p>
          )}

          {/* Social links */}
          <div className="flex gap-2 mt-4 flex-wrap">
            {profile.instagram_url && (
              <a href={profile.instagram_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/70 hover:border-champagne/50 hover:text-champagne transition-all">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                Instagram
              </a>
            )}
            {profile.youtube_url && (
              <a href={profile.youtube_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/70 hover:border-champagne/50 hover:text-champagne transition-all">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg>
                YouTube
              </a>
            )}
            {profile.snapchat_url && (
              <a href={profile.snapchat_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/70 hover:border-champagne/50 hover:text-champagne transition-all">
                👻 Snapchat
              </a>
            )}
          </div>

          {/* PDF button */}
          <button
            onClick={handleDownloadPDF}
            disabled={pdfLoading}
            className="mt-3 w-full py-2.5 rounded-xl border border-champagne/30 text-champagne text-xs tracking-widest uppercase hover:bg-champagne/10 transition-all disabled:opacity-50"
          >
            {pdfLoading ? 'Generating PDF…' : '⬇ Download Portfolio PDF'}
          </button>
        </div>

        {/* ── Tab switcher ─── */}
        <div className="flex mx-5 mt-6 bg-white/5 rounded-2xl p-1 gap-1">
          {[['portfolio','Portfolio'],['book','Book Now']].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold tracking-widest uppercase transition-all duration-200 ${
                tab === id ? 'bg-champagne text-charcoal shadow-sm' : 'text-white/50 hover:text-white/80'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

                {/* ── Tab content ─── */}
        <div className="pb-12">
          {tab === 'portfolio' && (
            <>
              <PortfolioGrid images={profile.portfolio_images} />

              {/* Services Section */}
              {services.length > 0 && (
                <section className="px-5 py-4">
                  <h2 className="font-display text-xs tracking-[0.25em] text-champagne mb-4 uppercase">Services</h2>
                  <div className="space-y-2">
                    {services.map(svc => (
                      <div key={svc.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5">
                        <div>
                          <p className="text-sm font-medium">{svc.name}</p>
                          {svc.description && <p className="text-xs text-white/40 mt-0.5">{svc.description}</p>}
                          {svc.duration && <p className="text-[10px] text-white/30 mt-0.5">⏱ {svc.duration}</p>}
                        </div>
                        <span className="text-base font-bold text-champagne ml-4 flex-shrink-0">{formatINR(svc.price)}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* UPI QR Section Fix */}
              {profile.upi_qr_url && (
                <section className="px-5 py-8 text-center bg-white/5 rounded-3xl mx-5 mb-10 border border-white/5 mt-6">
                  <h2 className="font-display text-[10px] tracking-[0.25em] text-champagne mb-6 uppercase">Pay via UPI</h2>
                  <div className="bg-white p-4 rounded-2xl inline-block shadow-2xl">
                    <img 
                      src={transformDriveLink(profile.upi_qr_url)} 
                      alt="UPI QR" 
                      className="w-full max-w-[220px] h-auto object-contain mx-auto" 
                    />
                  </div>
                  <p className="text-[10px] text-white/30 mt-4 uppercase tracking-widest italic">Scan to Pay Advance</p>
                </section>
              )}
            </>
          )}

          {tab === 'book' && (
            <section className="px-5 py-6">
              <h2 className="font-display text-xs tracking-[0.25em] text-champagne mb-5 uppercase">Book an Appointment</h2>
              {services.length > 0
                ? <BookingForm profile={profile} services={services} busyDates={busyDates} />
                : <p className="text-white/40 text-sm text-center py-8">No services available at the moment.</p>
              }
            </section>
          )}
        </div>

        {/* ── Footer ─── */}
        <div className="text-center py-6 border-t border-white/5 text-[10px] text-white/20 tracking-widest uppercase">
          ARTISTHUB · DIGITAL PORTFOLIO &copy; 2026
        </div>
      </main>
    </>
  );
}
