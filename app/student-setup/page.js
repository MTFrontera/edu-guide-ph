"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

export default function StudentSetupPage() {
  const router = useRouter();
  const [status, setStatus] = useState('loading');
  const [profile, setProfile] = useState(null);
  const [sections, setSections] = useState([]);
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setError('');

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      router.replace('/login');
      return;
    }

    const response = await fetch('/api/sections', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    const payload = await response.json();

    if (!response.ok) {
      if (response.status === 403) {
        router.replace('/prompt');
        return;
      }
      throw new Error(payload.error || 'Could not load your section settings.');
    }

    setProfile(payload.profile);
    setSections(payload.sections || []);
    setSelectedSectionId(payload.profile?.section_id || '');
    setStatus('ready');
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        await loadData();
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message || 'Could not load section settings.');
          setStatus('error');
        }
      }
    };

    run();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') router.replace('/login');
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [router]);

  const currentSection = useMemo(
    () => sections.find((section) => section.id === profile?.section_id) || null,
    [sections, profile]
  );

  const saveSection = async (sectionId) => {
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.replace('/login');
        return;
      }

      const response = await fetch('/api/sections', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'set-my-section',
          sectionId: sectionId || null,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Could not update your section.');
      }

      setProfile((current) => ({
        ...current,
        section_id: payload.result?.sectionId || null,
        section_onboarding_complete: true,
      }));
      setSelectedSectionId(payload.result?.sectionId || '');

      if (payload.result?.sectionId) {
        setMessage(`Your section is now ${payload.result.sectionName}.`);
      } else {
        setMessage('You are no longer listed under a section. You can choose one again anytime.');
      }
    } catch (saveError) {
      setError(saveError.message || 'Could not update your section.');
    } finally {
      setSaving(false);
    }
  };

  if (status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-violet-100">
        <div className="rounded-2xl border border-violet-300/20 bg-violet-950/35 px-6 py-4 shadow-xl backdrop-blur">
          Loading your school section...
        </div>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-14 text-slate-100">
        <div className="mx-auto max-w-xl rounded-3xl border border-rose-300/25 bg-rose-950/20 p-8">
          <h1 className="text-2xl font-bold">Section settings could not load</h1>
          <p className="mt-4 text-rose-100">{error}</p>
          <Link href="/prompt" className="mt-6 inline-flex text-sm font-semibold text-violet-300 hover:text-violet-200">
            Return to EduGuide
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_15%_10%,rgba(139,92,246,.28),transparent_30%),radial-gradient(circle_at_80%_10%,rgba(59,130,246,.14),transparent_30%),linear-gradient(180deg,#160a2f_0%,#0f172a_72%)]" />

      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-4">
          <Link href="/prompt" className="text-sm font-semibold text-violet-200 hover:text-white">
            &lt; Back to EduGuide
          </Link>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.replace('/');
            }}
            className="rounded-lg border border-violet-300/20 px-3 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-900/30"
          >
            Logout
          </button>
        </div>

        <section className="mt-6 rounded-3xl border border-violet-300/20 bg-violet-950/30 p-6 shadow-2xl backdrop-blur sm:p-8">
          <div className="flex items-start gap-4">
            <Image src="/edu.png" alt="EduGuide PH" width={52} height={52} className="h-12 w-12 object-contain" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-200/70">Student profile</p>
              <h1 className="mt-1 text-3xl font-bold text-white">Choose your section</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-violet-100/70">
                Your name appears only in the roster for the section you choose. Teachers can only see section rosters for classes assigned to them.
              </p>
            </div>
          </div>

          {currentSection && (
            <div className="mt-6 rounded-2xl border border-emerald-300/20 bg-emerald-950/15 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200/70">Current section</p>
              <p className="mt-2 text-xl font-semibold text-white">{currentSection.name}</p>
              {currentSection.grade_year && (
                <p className="mt-1 text-sm text-emerald-50/65">{currentSection.grade_year}</p>
              )}
            </div>
          )}

          {error && (
            <div className="mt-6 rounded-xl border border-rose-300/30 bg-rose-950/20 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          )}

          {message && (
            <div className="mt-6 rounded-xl border border-emerald-300/30 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-100">
              {message}
            </div>
          )}

          <div className="mt-7">
            <label htmlFor="section" className="mb-2 block text-sm font-semibold text-violet-100">
              Section
            </label>
            <select
              id="section"
              value={selectedSectionId}
              onChange={(event) => setSelectedSectionId(event.target.value)}
              className="w-full rounded-xl border border-violet-300/30 bg-slate-950/65 px-4 py-3 text-sm text-white outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-400/40"
            >
              <option value="">No section / choose later</option>
              {sections.map((section) => (
                <option value={section.id} key={section.id}>
                  {section.grade_year ? `${section.grade_year} - ` : ''}{section.name}
                </option>
              ))}
            </select>

            {sections.length === 0 && (
              <p className="mt-3 rounded-xl border border-amber-300/20 bg-amber-950/15 px-4 py-3 text-sm leading-6 text-amber-50/70">
                No sections have been configured for your school yet. You can continue using EduGuide and return here later.
              </p>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => saveSection(selectedSectionId)}
              disabled={saving}
              className="rounded-xl bg-violet-400 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-violet-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving...' : selectedSectionId ? 'Save section' : 'Continue without a section'}
            </button>

            {profile?.section_id && (
              <button
                onClick={() => saveSection(null)}
                disabled={saving}
                className="rounded-xl border border-rose-300/30 bg-rose-950/15 px-5 py-3 text-sm font-semibold text-rose-100 hover:bg-rose-950/30 disabled:opacity-60"
              >
                Remove me from this section
              </button>
            )}
          </div>

          <p className="mt-5 text-xs leading-6 text-violet-100/55">
            If you selected the wrong section, just choose the correct one and save. Your roster membership switches automatically.
          </p>
        </section>
      </div>
    </main>
  );
}
