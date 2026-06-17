"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

export default function Login() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (session?.user) {
        router.replace('/prompt');
        return;
      }

      setAuthChecked(true);
    };

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user && event !== 'SIGNED_OUT') {
        router.replace('/prompt');
        return;
      }

      if (event === 'SIGNED_OUT' && !cancelled) {
        setAuthChecked(true);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [router]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (signInError) throw signInError;

      if (data.user) {
        router.replace('/prompt');
      }
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setLoading(false);
    }
  };

  if (!authChecked) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-6 text-slate-100">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(139,92,246,.32),transparent_35%),radial-gradient(circle_at_75%_10%,rgba(168,85,247,.24),transparent_35%),linear-gradient(180deg,#160a2f_0%,#1f1147_45%,#0f172a_100%)]" />
        <div className="rounded-2xl border border-violet-300/20 bg-violet-950/35 px-5 py-3 text-sm text-violet-100 shadow-2xl shadow-violet-900/40 backdrop-blur">
          Loading EduGuide PH...
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 sm:py-10 lg:px-8">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(139,92,246,.32),transparent_35%),radial-gradient(circle_at_75%_10%,rgba(168,85,247,.24),transparent_35%),linear-gradient(180deg,#160a2f_0%,#1f1147_45%,#0f172a_100%)]" />

      <div className="mx-auto w-full max-w-lg animate-slide-in-up space-y-6 rounded-2xl border border-violet-300/20 bg-violet-950/35 p-6 shadow-2xl shadow-violet-900/40 backdrop-blur sm:space-y-7 sm:p-10">
        <div className="relative text-center">
          <Link
            href="/"
            className="inline-flex rounded-lg border border-violet-300/25 bg-violet-900/30 px-3 py-1 text-sm text-violet-100 transition hover:border-violet-300/45 hover:bg-violet-900/50 sm:absolute sm:left-0 sm:top-0"
            title="Back to Home"
          >
            &lt; Back
          </Link>
          <h1 className="inline-flex items-center gap-2.5 text-3xl font-bold text-white">
            <Image src="/edu.png" alt="EduGuide PH logo" width={44} height={44} className="h-10 w-10 object-contain md:h-11 md:w-11" />
            <span>EduGuide PH</span>
          </h1>
          <p className="mt-2 text-sm text-violet-100/80">Sign in to continue learning</p>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-300/40 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <input
            name="email"
            type="email"
            value={formData.email}
            onChange={handleInputChange}
            required
            className="w-full rounded-lg border border-violet-300/30 bg-slate-950/65 px-4 py-3 text-sm text-white placeholder-violet-100/45 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-400/45"
            placeholder="yourname@gmail.com"
          />

          <input
            name="password"
            type="password"
            value={formData.password}
            onChange={handleInputChange}
            required
            className="w-full rounded-lg border border-violet-300/30 bg-slate-950/65 px-4 py-3 text-sm text-white placeholder-violet-100/45 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-400/45"
            placeholder="your password"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-violet-400 py-3 text-sm font-semibold text-slate-950 transition hover:bg-violet-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>

          <p className="text-center text-sm text-violet-100/80">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="font-semibold text-violet-200 hover:text-white">
              Register
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
