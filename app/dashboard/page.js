'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

function formatDate(value) {
  if (!value) return 'No recorded activity';
  try {
    return new Date(value).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return 'Unknown';
  }
}

function StatCard({ label, value, helper }) {
  return (
    <div className="rounded-2xl border border-violet-300/20 bg-violet-950/35 p-5 shadow-lg shadow-violet-950/20 backdrop-blur">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200/75">{label}</p>
      <p className="mt-3 text-3xl font-bold text-white">{value ?? 0}</p>
      <p className="mt-2 text-xs leading-5 text-violet-100/65">{helper}</p>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [reviewingId, setReviewingId] = useState('');
  const [reviewNotes, setReviewNotes] = useState({});
  const [reviewMessage, setReviewMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          router.replace('/login');
          return;
        }

        const response = await fetch('/api/dashboard', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        const payload = await response.json();

        if (cancelled) return;

        if (response.status === 403) {
          setStatus('forbidden');
          setError(payload.error || 'Staff access is required.');
          return;
        }

        if (!response.ok) {
          throw new Error(payload.error || 'Failed to load dashboard');
        }

        setData(payload);
        setStatus('ready');
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError.message || 'Could not load the dashboard.');
        setStatus('error');
      }
    };

    loadDashboard();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        router.replace('/');
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [router]);

  const usageMax = useMemo(() => {
    const values = (data?.usage || []).map((item) => Number(item.message_count || 0));
    return Math.max(1, ...values);
  }, [data]);

  const reviewTeacher = async (requestId, decision) => {
    setReviewMessage('');
    setError('');
    setReviewingId(requestId);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.replace('/login');
        return;
      }

      const response = await fetch('/api/dashboard', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId,
          decision,
          notes: reviewNotes[requestId] || '',
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Could not review teacher verification.');
      }

      setData((current) => ({
        ...current,
        teacherVerifications: (current?.teacherVerifications || []).map((item) =>
          item.request_id === requestId
            ? {
                ...item,
                status: decision,
                admin_notes: reviewNotes[requestId] || null,
                reviewed_at: new Date().toISOString(),
              }
            : item
        ),
      }));
      setReviewMessage(
        decision === 'approved'
          ? 'Teacher account approved. Staff access is now enabled.'
          : 'Verification rejected. The teacher can resubmit with updated documents.'
      );
    } catch (reviewError) {
      setError(reviewError.message || 'Could not review teacher verification.');
    } finally {
      setReviewingId('');
    }
  };

  if (status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-violet-100">
        <div className="rounded-2xl border border-violet-300/20 bg-violet-950/35 px-6 py-4 shadow-xl backdrop-blur">
          Loading EduGuide staff dashboard...
        </div>
      </main>
    );
  }

  if (status === 'forbidden') {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-14 text-slate-100">
        <div className="mx-auto max-w-xl rounded-3xl border border-amber-300/25 bg-amber-950/20 p-8 shadow-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200/80">Protected area</p>
          <h1 className="mt-3 text-3xl font-bold">Staff dashboard</h1>
          <p className="mt-4 leading-7 text-slate-300">{error}</p>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Student accounts remain student-only by default. A teacher, guidance, or admin role must be assigned in Supabase by an authorized project administrator.
          </p>
          <Link
            href="/prompt"
            className="mt-6 inline-flex rounded-xl bg-violet-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-violet-300"
          >
            Return to EduGuide
          </Link>
        </div>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-14 text-slate-100">
        <div className="mx-auto max-w-xl rounded-3xl border border-rose-300/25 bg-rose-950/20 p-8">
          <h1 className="text-2xl font-bold">Dashboard could not load</h1>
          <p className="mt-4 text-rose-100">{error}</p>
          <p className="mt-3 text-sm text-slate-400">
            If this is the first time using the dashboard, run SUPABASE_DASHBOARD_UPGRADE.sql in the matching Supabase project first.
          </p>
          <Link href="/prompt" className="mt-6 inline-flex text-sm font-semibold text-violet-300 hover:text-violet-200">
            Back to EduGuide
          </Link>
        </div>
      </main>
    );
  }

  const summary = data?.summary || {};
  const profile = data?.profile || {};
  const staffName =
    [profile.first_name, profile.last_name].filter(Boolean).join(' ') ||
    profile.email ||
    'Staff member';

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_15%_10%,rgba(139,92,246,.26),transparent_30%),radial-gradient(circle_at_80%_10%,rgba(168,85,247,.18),transparent_32%),linear-gradient(180deg,#160a2f_0%,#0f172a_70%)]" />

      <header className="sticky top-0 z-20 border-b border-violet-300/20 bg-slate-950/80 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Image src="/edu.png" alt="EduGuide PH logo" width={44} height={44} className="h-10 w-10 object-contain" />
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-white">EduGuide PH</p>
              <p className="text-xs text-violet-200/70">Staff dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/prompt"
              className="rounded-lg border border-violet-300/25 bg-violet-900/30 px-3 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-900/50 sm:text-sm"
            >
              Study chat
            </Link>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                router.replace('/');
              }}
              className="rounded-lg bg-violet-400 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-violet-300 sm:text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-7 px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-3xl border border-violet-300/20 bg-violet-950/30 p-6 shadow-2xl shadow-violet-950/20 backdrop-blur sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-200/70">Authorized staff view</p>
              <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">Welcome, {staffName}</h1>
              <p className="mt-3 max-w-3xl leading-7 text-violet-100/75">
                Monitor EduGuide usage without exposing student chat content. This first dashboard focuses on the minimum project requirement: role-aware access, aggregate activity, and recent student usage metadata.
              </p>
            </div>
            <div className="rounded-2xl border border-violet-300/20 bg-slate-950/35 px-4 py-3 text-sm text-violet-100/85">
              Role: <span className="font-semibold capitalize text-white">{profile.role}</span>
            </div>
          </div>
        </section>

        {profile.role === 'admin' && (
          <section className="rounded-3xl border border-cyan-300/20 bg-cyan-950/10 p-6 shadow-xl backdrop-blur sm:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/75">Admin verification</p>
                <h2 className="mt-2 text-2xl font-bold text-white">Teacher account requests</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-cyan-50/65">
                  Teacher signups stay non-staff until an admin checks their school, employee ID, and private verification document.
                </p>
              </div>
              <span className="rounded-full border border-cyan-300/20 bg-cyan-950/20 px-3 py-1 text-xs font-semibold text-cyan-100">
                {(data?.teacherVerifications || []).filter((item) => item.status === 'pending').length} pending
              </span>
            </div>

            {reviewMessage && (
              <div className="mt-5 rounded-xl border border-emerald-300/25 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-100">
                {reviewMessage}
              </div>
            )}

            <div className="mt-6 grid gap-4">
              {(data?.teacherVerifications || []).map((item) => (
                <article
                  key={item.request_id}
                  className="rounded-2xl border border-violet-300/15 bg-slate-950/35 p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-white">
                          {item.teacher_name || item.email || 'Teacher applicant'}
                        </h3>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${
                            item.status === 'approved'
                              ? 'bg-emerald-500/15 text-emerald-200'
                              : item.status === 'rejected'
                                ? 'bg-rose-500/15 text-rose-200'
                                : 'bg-amber-500/15 text-amber-200'
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-violet-100/65">{item.email}</p>
                      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                        <p className="text-violet-100/70">
                          School: <span className="font-medium text-white">{item.school_name}</span>
                        </p>
                        <p className="text-violet-100/70">
                          Employee ID: <span className="font-medium text-white">{item.employee_id}</span>
                        </p>
                        <p className="text-violet-100/70 sm:col-span-2">
                          Submitted: <span className="text-white">{formatDate(item.submitted_at)}</span>
                        </p>
                      </div>
                      {item.admin_notes && (
                        <p className="mt-3 rounded-lg border border-violet-300/10 bg-violet-950/20 px-3 py-2 text-xs leading-5 text-violet-100/70">
                          Admin note: {item.admin_notes}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      {item.documentUrl ? (
                        <a
                          href={item.documentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-cyan-300/25 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-950/30"
                        >
                          View verification file
                        </a>
                      ) : (
                        <span className="rounded-lg border border-rose-300/15 px-3 py-2 text-xs text-rose-100/70">
                          File unavailable
                        </span>
                      )}
                    </div>
                  </div>

                  {item.status === 'pending' && (
                    <div className="mt-5 border-t border-violet-300/10 pt-4">
                      <label className="text-xs font-semibold uppercase tracking-wider text-violet-200/65">
                        Admin note
                      </label>
                      <textarea
                        value={reviewNotes[item.request_id] || ''}
                        onChange={(event) =>
                          setReviewNotes((current) => ({
                            ...current,
                            [item.request_id]: event.target.value,
                          }))
                        }
                        placeholder="Optional for approval; useful when rejecting a request."
                        rows={2}
                        className="mt-2 w-full resize-none rounded-xl border border-violet-300/20 bg-slate-950/55 px-3 py-2 text-sm text-white placeholder-violet-100/35 outline-none focus:border-violet-300"
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          onClick={() => reviewTeacher(item.request_id, 'approved')}
                          disabled={reviewingId === item.request_id}
                          className="rounded-lg bg-emerald-300 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-200 disabled:opacity-50"
                        >
                          {reviewingId === item.request_id ? 'Reviewing...' : 'Approve teacher'}
                        </button>
                        <button
                          onClick={() => reviewTeacher(item.request_id, 'rejected')}
                          disabled={reviewingId === item.request_id}
                          className="rounded-lg border border-rose-300/30 bg-rose-950/20 px-4 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-950/35 disabled:opacity-50"
                        >
                          Reject / request new proof
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              ))}

              {(data?.teacherVerifications || []).length === 0 && (
                <div className="rounded-2xl border border-dashed border-cyan-300/20 px-5 py-8 text-center text-sm text-cyan-50/55">
                  No teacher verification requests yet.
                </div>
              )}
            </div>
          </section>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Students" value={summary.totalStudents} helper="Accounts registered as students." />
          <StatCard label="Chat sessions" value={summary.totalSessions} helper="Saved EduGuide study sessions across users." />
          <StatCard label="Messages" value={summary.totalMessages} helper="Total stored messages; content is not shown here." />
          <StatCard label="Active in 7 days" value={summary.activeStudents7d} helper="Distinct students with recently updated sessions." />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
          <div className="rounded-3xl border border-violet-300/20 bg-violet-950/30 p-6 shadow-xl backdrop-blur">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200/70">Recent activity</p>
              <h2 className="mt-2 text-xl font-bold text-white">Student usage overview</h2>
              <p className="mt-2 text-sm leading-6 text-violet-100/65">
                Limited metadata only: student name, grade/year, counts, and last activity.
              </p>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-violet-300/20 text-xs uppercase tracking-wider text-violet-200/65">
                    <th className="px-3 py-3 font-semibold">Student</th>
                    <th className="px-3 py-3 font-semibold">Grade/Year</th>
                    <th className="px-3 py-3 font-semibold">Sessions</th>
                    <th className="px-3 py-3 font-semibold">Messages</th>
                    <th className="px-3 py-3 font-semibold">Last active</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.recentActivity || []).map((row) => (
                    <tr key={row.user_id} className="border-b border-violet-300/10 text-violet-50">
                      <td className="px-3 py-3 font-medium">{row.student_name || 'Unnamed student'}</td>
                      <td className="px-3 py-3 text-violet-100/70">{row.grade_year || 'Not set'}</td>
                      <td className="px-3 py-3">{row.session_count ?? 0}</td>
                      <td className="px-3 py-3">{row.message_count ?? 0}</td>
                      <td className="px-3 py-3 text-violet-100/70">{formatDate(row.last_active)}</td>
                    </tr>
                  ))}
                  {(data?.recentActivity || []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-violet-100/60">
                        No student activity has been recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl border border-violet-300/20 bg-violet-950/30 p-6 shadow-xl backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200/70">Last 7 days</p>
              <h2 className="mt-2 text-xl font-bold text-white">Message activity</h2>
              <div className="mt-6 space-y-3">
                {(data?.usage || []).map((item) => {
                  const count = Number(item.message_count || 0);
                  const width = Math.max(4, Math.round((count / usageMax) * 100));
                  return (
                    <div key={item.activity_day} className="grid grid-cols-[72px_1fr_44px] items-center gap-3 text-xs">
                      <span className="text-violet-100/65">
                        {new Date(`${item.activity_day}T00:00:00`).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      <div className="h-2 overflow-hidden rounded-full bg-violet-950/80">
                        <div
                          className="h-full rounded-full bg-violet-400"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                      <span className="text-right font-semibold text-white">{count}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-3xl border border-emerald-300/20 bg-emerald-950/15 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/75">Privacy by design</p>
              <h2 className="mt-2 text-lg font-bold text-white">No chat contents in this dashboard</h2>
              <p className="mt-3 text-sm leading-6 text-emerald-50/70">
                Staff analytics currently expose counts and activity metadata only. Student message text remains outside this dashboard unless a later, explicitly approved guidance workflow is designed.
              </p>
            </section>

            <section className="rounded-3xl border border-amber-300/20 bg-amber-950/15 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200/75">Planned AI validation</p>
              <h2 className="mt-2 text-lg font-bold text-white">Target: at least 90%</h2>
              <p className="mt-3 text-sm leading-6 text-amber-50/70">
                This is still a project target, not an achieved result. When the Gemini integration is implemented, validated test-set results can be added here with real evidence.
              </p>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
