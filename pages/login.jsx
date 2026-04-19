// pages/login.jsx
// ─────────────────────────────────────────────────────────────
//  Auth page: Email + Password login / signup via Supabase
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

export default function LoginPage() {
  const router  = useRouter();
  const [mode, setMode]   = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [pass,  setPass]  = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [msg,     setMsg]     = useState('');

  // Redirect if already logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/dashboard');
    });
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMsg('');
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
        if (error) throw error;
        router.replace('/dashboard');
      } else {
        const { error } = await supabase.auth.signUp({ email, password: pass });
        if (error) throw error;
        setMsg('Account created! Check your email to confirm, then log in.');
        setMode('login');
      }
    } catch (e) {
      setError(e.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Login · ArtistHub</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>

      <div className="min-h-screen bg-charcoal flex items-center justify-center px-5">
        {/* Decorative background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-champagne/5 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-champagne/3 blur-3xl" />
        </div>

        <div className="relative w-full max-w-sm">
          {/* Logo */}
          <div className="text-center mb-10">
            <h1 className="font-display text-4xl text-champagne tracking-wider">ArtistHub</h1>
            <p className="text-white/40 text-xs mt-2 tracking-widest">DIGITAL PORTFOLIO & BOOKING</p>
          </div>

          {/* Card */}
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-3xl p-6">
            {/* Toggle */}
            <div className="flex bg-white/5 rounded-2xl p-1 mb-6 gap-1">
              {[['login','Sign In'],['signup','Sign Up']].map(([id, label]) => (
                <button key={id} onClick={() => { setMode(id); setError(''); setMsg(''); }}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold tracking-widest uppercase transition-all ${
                    mode === id ? 'bg-champagne text-charcoal' : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] tracking-widest text-champagne/70 mb-1.5 uppercase">Email</label>
                <input
                  type="email" required
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-champagne/60 transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] tracking-widest text-champagne/70 mb-1.5 uppercase">Password</label>
                <input
                  type="password" required
                  value={pass} onChange={e => setPass(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-champagne/60 transition-colors"
                />
              </div>

              {error && <p className="text-red-400 text-xs">{error}</p>}
              {msg   && <p className="text-emerald-400 text-xs">{msg}</p>}

              <button
                type="submit" disabled={loading}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-champagne to-[#c8a96e] text-charcoal font-bold text-sm tracking-widest uppercase hover:shadow-[0_0_24px_rgba(212,185,150,0.35)] transition-all disabled:opacity-50"
              >
                {loading ? '…' : mode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
