"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

export default function Register() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    age: '',
    gender: '',
    gradeYear: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
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
    setSuccess(false);
    setSuccessMessage('');

    try {
      const profileMetadata = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        age: formData.age ? parseInt(formData.age, 10) : null,
        gender: formData.gender || null,
        grade_year: formData.gradeYear || null,
      };

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: profileMetadata,
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        setSuccess(true);
        if (authData.session) {
          setSuccessMessage('Registration successful. You can now sign in and start using EduGuide PH.');
        } else {
          setSuccessMessage('Registration successful. Check your email for the verification link before logging in.');
        }
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

      <div className="mx-auto w-full max-w-2xl animate-slide-in-up space-y-6 rounded-2xl border border-violet-300/20 bg-violet-950/35 p-6 shadow-2xl shadow-violet-900/40 backdrop-blur sm:space-y-7 sm:p-10">
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
          <p className="mt-2 text-sm text-violet-100/80">Create your account and start learning</p>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-300/40 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-lg border border-emerald-300/40 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-100">
            {successMessage || 'Registration successful. Check your email for verification before logging in.'}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <input
            type="email"
            name="email"
            placeholder="yourname@gmail.com"
            value={formData.email}
            onChange={handleInputChange}
            className="w-full rounded-lg border border-violet-300/30 bg-slate-950/65 px-4 py-3 text-sm text-white placeholder-violet-100/45 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-400/45"
            required
          />

          <input
            type="password"
            name="password"
            placeholder="your password"
            value={formData.password}
            onChange={handleInputChange}
            className="w-full rounded-lg border border-violet-300/30 bg-slate-950/65 px-4 py-3 text-sm text-white placeholder-violet-100/45 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-400/45"
            required
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              type="text"
              name="firstName"
              placeholder="First Name"
              value={formData.firstName}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-violet-300/30 bg-slate-950/65 px-4 py-3 text-sm text-white placeholder-violet-100/45 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-400/45"
              required
            />
            <input
              type="text"
              name="lastName"
              placeholder="Last Name"
              value={formData.lastName}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-violet-300/30 bg-slate-950/65 px-4 py-3 text-sm text-white placeholder-violet-100/45 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-400/45"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input
              type="number"
              name="age"
              placeholder="Age"
              value={formData.age}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-violet-300/30 bg-slate-950/65 px-4 py-3 text-sm text-white placeholder-violet-100/45 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-400/45"
            />

            <select
              name="gender"
              value={formData.gender}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-violet-300/30 bg-slate-950/65 px-4 py-3 text-sm text-white outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-400/45"
            >
              <option value="">Gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>

            <input
              type="text"
              name="gradeYear"
              placeholder="Grade/Year"
              value={formData.gradeYear}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-violet-300/30 bg-slate-950/65 px-4 py-3 text-sm text-white placeholder-violet-100/45 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-400/45"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-violet-400 py-3 text-sm font-semibold text-slate-950 transition hover:bg-violet-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Creating account...' : 'Sign up'}
          </button>

          <p className="text-center text-sm text-violet-100/80">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-violet-200 hover:text-white">
              Sign in
            </Link>
          </p>

          {success && (
            <p className="text-center text-xs text-violet-200/90">
              After verifying your email, you can sign in from the login page.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
