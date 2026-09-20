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
  const [sectionForm, setSectionForm] = useState({ schoolId: '', name: '', gradeYear: '' });
  const [courseForm, setCourseForm] = useState({ schoolId: '', name: '' });
  const [sectionActionBusy, setSectionActionBusy] = useState('');
  const [sectionMessage, setSectionMessage] = useState('');
  const [courseActionBusy, setCourseActionBusy] = useState('');
  const [courseMessage, setCourseMessage] = useState('');
  const [schoolAdminDrafts, setSchoolAdminDrafts] = useState({});

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

  const refreshDashboardData = async () => {
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

    if (!response.ok) {
      throw new Error(payload.error || 'Could not refresh dashboard data.');
    }

    setData(payload);
  };

  const updateSchoolAdminEmail = async (schoolId, currentEmail) => {
    const adminEmail = String(
      schoolAdminDrafts[schoolId] ?? currentEmail ?? ''
    ).trim();

    if (!adminEmail) {
      setSectionMessage('Enter the school administrator email.');
      return;
    }

    const busyKey = `admin-email-${schoolId}`;
    setSectionActionBusy(busyKey);
    setSectionMessage('');

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch('/api/sections', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token || ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update-school-admin-email',
          schoolId,
          adminEmail,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Could not update administrator email.');
      }

      setSectionMessage('School administrator email updated.');
      await refreshDashboardData();
    } catch (schoolError) {
      setSectionMessage(schoolError.message || 'Could not update administrator email.');
    } finally {
      setSectionActionBusy('');
    }
  };

  const createSection = async () => {
    const schoolId =
      sectionForm.schoolId ||
      data?.sectionManagement?.schools?.[0]?.id ||
      '';

    if (!schoolId || !sectionForm.name.trim()) {
      setSectionMessage('Choose a school and enter a section name.');
      return;
    }

    setSectionActionBusy('create');
    setSectionMessage('');

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch('/api/sections', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token || ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create-section',
          schoolId,
          name: sectionForm.name.trim(),
          gradeYear: sectionForm.gradeYear.trim(),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Could not create section.');
      }

      setSectionForm((current) => ({ ...current, name: '', gradeYear: '' }));
      setSectionMessage('Section created.');
      await refreshDashboardData();
    } catch (sectionError) {
      setSectionMessage(sectionError.message || 'Could not create section.');
    } finally {
      setSectionActionBusy('');
    }
  };

  const createCourse = async () => {
    const schoolId =
      courseForm.schoolId ||
      data?.sectionManagement?.schools?.[0]?.id ||
      '';

    if (!schoolId || !courseForm.name.trim()) {
      setSectionMessage('Choose a school and enter a course or subject name.');
      return;
    }

    setSectionActionBusy('create-course');
    setSectionMessage('');

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch('/api/sections', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token || ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create-course',
          schoolId,
          name: courseForm.name.trim(),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Could not create course or subject.');
      }

      setCourseForm((current) => ({ ...current, name: '' }));
      setSectionMessage('Course or subject added to the school list.');
      await refreshDashboardData();
    } catch (courseError) {
      setSectionMessage(courseError.message || 'Could not create course or subject.');
    } finally {
      setSectionActionBusy('');
    }
  };

  const setMyCourse = async (courseId, selected) => {
    if (!courseId) return;

    setCourseActionBusy(courseId);
    setCourseMessage('');

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch('/api/sections', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token || ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'set-my-course',
          courseId,
          selected,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Could not update your courses.');
      }

      setCourseMessage(
        selected
          ? 'Course added to your teaching profile.'
          : 'Course removed from your teaching profile.'
      );
      await refreshDashboardData();
    } catch (courseError) {
      setCourseMessage(courseError.message || 'Could not update your courses.');
    } finally {
      setCourseActionBusy('');
    }
  };

  const setTeacherSection = async (teacherId, sectionId, assigned) => {
    if (!teacherId || !sectionId) return;

    const busyKey = `${assigned ? 'assign' : 'remove'}-${teacherId}-${sectionId}`;
    setSectionActionBusy(busyKey);
    setSectionMessage('');

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch('/api/sections', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token || ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'set-teacher-section',
          teacherId,
          sectionId,
          assigned,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Could not update teacher assignment.');
      }

      setSectionMessage(
        assigned
          ? 'Teacher assigned to section.'
          : 'Teacher removed from section.'
      );
      await refreshDashboardData();
    } catch (sectionError) {
      setSectionMessage(sectionError.message || 'Could not update teacher assignment.');
    } finally {
      setSectionActionBusy('');
    }
  };

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

  if (profile.role === 'teacher') {
    const teacherSections = data?.teacherSections || [];

    return (
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_15%_10%,rgba(139,92,246,.26),transparent_30%),radial-gradient(circle_at_80%_10%,rgba(59,130,246,.14),transparent_32%),linear-gradient(180deg,#160a2f_0%,#0f172a_70%)]" />

        <header className="sticky top-0 z-20 border-b border-violet-300/20 bg-slate-950/80 px-4 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <Image src="/edu.png" alt="EduGuide PH logo" width={44} height={44} className="h-10 w-10 object-contain" />
              <div>
                <p className="text-lg font-bold text-white">EduGuide PH</p>
                <p className="text-xs text-violet-200/70">Teacher dashboard</p>
              </div>
            </div>
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
        </header>

        <div className="mx-auto max-w-7xl space-y-7 px-4 py-8 sm:px-6 lg:px-8">
          <section className="rounded-3xl border border-violet-300/20 bg-violet-950/30 p-6 shadow-2xl backdrop-blur sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-200/70">Teacher workspace</p>
            <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">Welcome, {staffName}</h1>
            <p className="mt-3 max-w-3xl leading-7 text-violet-100/70">
              Your dashboard is split into the EduGuide AI workspace and the class sections assigned to you. You only receive student rosters for sections an administrator has assigned to your teacher account.
            </p>
          </section>

          <section className="rounded-3xl border border-fuchsia-300/20 bg-fuchsia-950/10 p-6 shadow-xl sm:p-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fuchsia-200/70">Teaching profile</p>
                <h2 className="mt-2 text-2xl font-bold text-white">My courses / subjects</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-fuchsia-50/65">
                  Your school administrator controls the available list. Select every course or subject you currently teach; you can choose more than one.
                </p>
              </div>
              <span className="rounded-full border border-fuchsia-300/20 bg-slate-950/30 px-3 py-1 text-xs font-semibold text-fuchsia-100">
                {(data?.teacherCourseCatalog || []).filter((course) => course.selected).length} selected
              </span>
            </div>

            {courseMessage && (
              <div className="mt-4 rounded-xl border border-fuchsia-300/20 bg-slate-950/30 px-4 py-3 text-sm text-fuchsia-50">
                {courseMessage}
              </div>
            )}

            {(data?.teacherCourseCatalog || []).length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-fuchsia-300/20 px-5 py-7 text-center text-sm text-fuchsia-50/55">
                No courses or subjects have been added by the school administrator yet.
              </div>
            ) : (
              <div className="mt-5 flex flex-wrap gap-2">
                {(data?.teacherCourseCatalog || []).map((course) => (
                  <button
                    key={course.id}
                    onClick={() => setMyCourse(course.id, !course.selected)}
                    disabled={courseActionBusy === course.id}
                    className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
                      course.selected
                        ? 'border-fuchsia-200/40 bg-fuchsia-300 text-slate-950'
                        : 'border-fuchsia-300/20 bg-slate-950/35 text-fuchsia-50 hover:bg-fuchsia-950/30'
                    }`}
                  >
                    {courseActionBusy === course.id
                      ? 'Saving...'
                      : `${course.selected ? '✓ ' : '+ '}${course.name}`}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <Link
              href="/prompt"
              className="group rounded-3xl border border-violet-300/20 bg-violet-950/30 p-6 shadow-xl transition hover:border-violet-300/45 hover:bg-violet-950/45 sm:p-8"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200/70">Area 1</p>
              <h2 className="mt-2 text-2xl font-bold text-white">EduGuide AI</h2>
              <p className="mt-3 text-sm leading-6 text-violet-100/65">
                Open the AI workspace for explanations, lesson support, practice-question generation, brainstorming, and other teaching assistance.
              </p>
              <span className="mt-5 inline-flex rounded-xl bg-violet-400 px-4 py-2.5 text-sm font-semibold text-slate-950 group-hover:bg-violet-300">
                Open AI workspace
              </span>
            </Link>

            <div className="rounded-3xl border border-cyan-300/20 bg-cyan-950/10 p-6 shadow-xl sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/70">Area 2</p>
              <h2 className="mt-2 text-2xl font-bold text-white">My sections</h2>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <StatCard label="Assigned sections" value={summary.assignedSections} helper="Classes explicitly assigned to you." />
                <StatCard label="Students" value={summary.assignedStudents} helper="Students currently listed across your assigned sections." />
              </div>
            </div>
          </section>

          <section className="space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200/70">Class rosters</p>
              <h2 className="mt-2 text-2xl font-bold text-white">Sections assigned to you</h2>
              <p className="mt-2 text-sm leading-6 text-violet-100/60">
                Students control their own section membership. If they switch or remove their section, the roster updates automatically.
              </p>
            </div>

            {teacherSections.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-violet-300/25 bg-violet-950/20 px-6 py-12 text-center">
                <p className="font-semibold text-white">No sections assigned yet</p>
                <p className="mt-2 text-sm text-violet-100/60">
                  An administrator must assign one or more sections to your verified teacher account before student names appear here.
                </p>
              </div>
            ) : (
              <div className="grid gap-5 xl:grid-cols-2">
                {teacherSections.map((section) => (
                  <article key={section.id} className="overflow-hidden rounded-3xl border border-violet-300/20 bg-violet-950/25 shadow-xl">
                    <div className="border-b border-violet-300/15 px-5 py-4 sm:px-6">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h3 className="text-xl font-bold text-white">{section.name}</h3>
                          {section.gradeYear && (
                            <p className="mt-1 text-sm text-violet-100/60">{section.gradeYear}</p>
                          )}
                        </div>
                        <span className="rounded-full border border-violet-300/20 bg-slate-950/35 px-3 py-1 text-xs font-semibold text-violet-100">
                          {section.studentCount || 0} student{Number(section.studentCount || 0) === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                      {(section.students || []).length === 0 ? (
                        <p className="px-6 py-8 text-center text-sm text-violet-100/55">
                          No students have selected this section yet.
                        </p>
                      ) : (
                        <div className="divide-y divide-violet-300/10">
                          {(section.students || []).map((student, index) => (
                            <div key={student.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-400/15 text-xs font-semibold text-violet-100">
                                {index + 1}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate font-medium text-white">{student.name || 'Unnamed student'}</p>
                                {student.gradeYear && (
                                  <p className="text-xs text-violet-100/55">{student.gradeYear}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-emerald-300/20 bg-emerald-950/10 p-5 text-sm leading-6 text-emerald-50/70">
            Teacher access is roster-scoped. This dashboard does not expose student chat content, and a teacher cannot open rosters for sections that have not been assigned to them.
          </section>
        </div>
      </main>
    );
  }

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
          <section className="rounded-3xl border border-blue-300/20 bg-blue-950/10 p-6 shadow-xl backdrop-blur sm:p-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200/75">School structure</p>
              <h2 className="mt-2 text-2xl font-bold text-white">Sections & teacher assignments</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-50/65">
                Create the real school sections here, then assign one or more verified teachers to each section. Teachers choose their own courses from the school-approved list.
              </p>
            </div>

            {sectionMessage && (
              <div className="mt-5 rounded-xl border border-blue-300/20 bg-slate-950/30 px-4 py-3 text-sm text-blue-50">
                {sectionMessage}
              </div>
            )}

            <div className="mt-6 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-100/60">
                Verification administrator
              </p>
              {(data?.sectionManagement?.schools || []).map((school) => (
                <div
                  key={school.id}
                  className="grid gap-3 rounded-2xl border border-blue-300/15 bg-slate-950/30 p-4 lg:grid-cols-[1fr_1.2fr_auto]"
                >
                  <div>
                    <p className="font-semibold text-white">{school.name}</p>
                    <p className="mt-1 text-xs leading-5 text-blue-100/50">
                      Teacher verification notifications for this academy are sent to this single administrator email.
                    </p>
                  </div>
                  <input
                    type="email"
                    value={schoolAdminDrafts[school.id] ?? school.adminEmail ?? ''}
                    onChange={(event) =>
                      setSchoolAdminDrafts((current) => ({
                        ...current,
                        [school.id]: event.target.value,
                      }))
                    }
                    placeholder="admin@school.edu"
                    className="rounded-xl border border-blue-300/20 bg-slate-950/55 px-3 py-2.5 text-sm text-white placeholder-blue-100/35 outline-none"
                  />
                  <button
                    onClick={() => updateSchoolAdminEmail(school.id, school.adminEmail)}
                    disabled={sectionActionBusy === `admin-email-${school.id}`}
                    className="rounded-xl border border-blue-300/30 bg-blue-950/25 px-4 py-2.5 text-sm font-semibold text-blue-50 hover:bg-blue-950/40 disabled:opacity-50"
                  >
                    {sectionActionBusy === `admin-email-${school.id}`
                      ? 'Saving...'
                      : 'Save admin email'}
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-6 border-t border-blue-300/10 pt-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-100/60">
                Courses / subjects
              </p>
              <p className="mt-2 text-sm leading-6 text-blue-50/55">
                Maintain the school's approved course list here. Verified teachers choose one or more of these courses for their own teaching profile.
              </p>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1.5fr_auto]">
              <select
                value={courseForm.schoolId || data?.sectionManagement?.schools?.[0]?.id || ''}
                onChange={(event) =>
                  setCourseForm((current) => ({ ...current, schoolId: event.target.value }))
                }
                className="rounded-xl border border-blue-300/20 bg-slate-950/55 px-3 py-2.5 text-sm text-white outline-none"
              >
                {(data?.sectionManagement?.schools || []).map((school) => (
                  <option key={school.id} value={school.id}>{school.name}</option>
                ))}
              </select>
              <input
                value={courseForm.name}
                onChange={(event) =>
                  setCourseForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Course / subject name (e.g. Mathematics)"
                className="rounded-xl border border-blue-300/20 bg-slate-950/55 px-3 py-2.5 text-sm text-white placeholder-blue-100/35 outline-none"
              />
              <button
                onClick={createCourse}
                disabled={sectionActionBusy === 'create-course'}
                className="rounded-xl bg-blue-300 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-blue-200 disabled:opacity-50"
              >
                {sectionActionBusy === 'create-course' ? 'Adding...' : 'Add course'}
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {(data?.sectionManagement?.courses || [])
                .filter(
                  (course) =>
                    course.schoolId ===
                    (courseForm.schoolId || data?.sectionManagement?.schools?.[0]?.id || '')
                )
                .map((course) => (
                  <span
                    key={course.id}
                    className="rounded-full border border-blue-300/20 bg-blue-950/20 px-3 py-1.5 text-xs text-blue-50"
                  >
                    {course.name}
                  </span>
                ))}
              {(data?.sectionManagement?.courses || []).filter(
                (course) =>
                  course.schoolId ===
                  (courseForm.schoolId || data?.sectionManagement?.schools?.[0]?.id || '')
              ).length === 0 && (
                <span className="text-xs text-blue-100/45">
                  No courses or subjects configured for this school yet.
                </span>
              )}
            </div>

            <div className="mt-6 border-t border-blue-300/10 pt-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-100/60">
                Sections
              </p>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
              <select
                value={sectionForm.schoolId || data?.sectionManagement?.schools?.[0]?.id || ''}
                onChange={(event) =>
                  setSectionForm((current) => ({ ...current, schoolId: event.target.value }))
                }
                className="rounded-xl border border-blue-300/20 bg-slate-950/55 px-3 py-2.5 text-sm text-white outline-none"
              >
                {(data?.sectionManagement?.schools || []).map((school) => (
                  <option key={school.id} value={school.id}>{school.name}</option>
                ))}
              </select>
              <input
                value={sectionForm.gradeYear}
                onChange={(event) =>
                  setSectionForm((current) => ({ ...current, gradeYear: event.target.value }))
                }
                placeholder="Grade / Year (optional)"
                className="rounded-xl border border-blue-300/20 bg-slate-950/55 px-3 py-2.5 text-sm text-white placeholder-blue-100/35 outline-none"
              />
              <input
                value={sectionForm.name}
                onChange={(event) =>
                  setSectionForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Section name"
                className="rounded-xl border border-blue-300/20 bg-slate-950/55 px-3 py-2.5 text-sm text-white placeholder-blue-100/35 outline-none"
              />
              <button
                onClick={createSection}
                disabled={sectionActionBusy === 'create'}
                className="rounded-xl bg-blue-300 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-blue-200 disabled:opacity-50"
              >
                {sectionActionBusy === 'create' ? 'Creating...' : 'Add section'}
              </button>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              {(data?.sectionManagement?.sections || []).map((section) => {
                const availableTeachers = (data?.sectionManagement?.teachers || []).filter(
                  (teacher) =>
                    teacher.schoolId === section.schoolId &&
                    !(section.teachers || []).some((assigned) => assigned.id === teacher.id)
                );

                return (
                  <article key={section.id} className="rounded-2xl border border-blue-300/15 bg-slate-950/30 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-white">{section.name}</h3>
                        <p className="mt-1 text-xs text-blue-100/55">
                          {section.gradeYear || 'No grade/year set'} · {section.studentCount || 0} student{Number(section.studentCount || 0) === 1 ? '' : 's'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-blue-100/55">Assigned teachers</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(section.teachers || []).map((teacher) => (
                          <div
                            key={teacher.id}
                            className="inline-flex items-center gap-2 rounded-xl border border-blue-300/20 bg-blue-950/20 px-3 py-2 text-xs text-blue-50"
                          >
                            <div>
                              <p className="font-semibold text-white">{teacher.name || teacher.email}</p>
                              <p className="mt-0.5 text-[11px] text-blue-100/55">
                                {(teacher.courses || []).length > 0
                                  ? (teacher.courses || []).map((course) => course.name).join(', ')
                                  : 'No courses selected yet'}
                              </p>
                            </div>
                            <button
                              onClick={() => setTeacherSection(teacher.id, section.id, false)}
                              disabled={Boolean(sectionActionBusy)}
                              className="ml-1 font-bold text-rose-200 hover:text-rose-100 disabled:opacity-50"
                              title="Remove teacher from this section"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        {(section.teachers || []).length === 0 && (
                          <span className="text-xs text-blue-100/45">No teacher assigned.</span>
                        )}
                      </div>
                    </div>

                    {availableTeachers.length > 0 && (
                      <div className="mt-4">
                        <select
                          defaultValue=""
                          onChange={(event) => {
                            const teacherId = event.target.value;
                            if (teacherId) {
                              void setTeacherSection(teacherId, section.id, true);
                              event.target.value = '';
                            }
                          }}
                          className="w-full rounded-xl border border-blue-300/20 bg-slate-950/55 px-3 py-2 text-sm text-white outline-none"
                        >
                          <option value="">
                            {(section.teachers || []).length > 0
                              ? 'Add another verified teacher...'
                              : 'Assign a verified teacher...'}
                          </option>
                          {availableTeachers.map((teacher) => (
                            <option key={teacher.id} value={teacher.id}>
                              {teacher.name || teacher.email}
                              {(teacher.courses || []).length > 0
                                ? ` — ${(teacher.courses || []).map((course) => course.name).join(', ')}`
                                : ' — no courses selected yet'}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </article>
                );
              })}

              {(data?.sectionManagement?.sections || []).length === 0 && (
                <div className="rounded-2xl border border-dashed border-blue-300/20 px-5 py-8 text-center text-sm text-blue-50/55 xl:col-span-2">
                  No sections configured yet. Add the school's real section names above.
                </div>
              )}
            </div>
          </section>
        )}

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
