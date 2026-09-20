"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export default function TeacherVerificationPage() {
  const router = useRouter();
  const [status, setStatus] = useState('loading');
  const [profile, setProfile] = useState(null);
  const [request, setRequest] = useState(null);
  const [schools, setSchools] = useState([]);
  const [schoolId, setSchoolId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [documentFile, setDocumentFile] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setError('');
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      router.replace('/login');
      return;
    }

    const [profileResult, schoolsResult, requestResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, email, first_name, last_name, role, account_type, school_id, employee_id')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('schools')
        .select('id, name, short_name')
        .eq('active', true)
        .order('name'),
      supabase
        .from('teacher_verification_requests')
        .select('id, school_id, employee_id, document_path, status, admin_notes, submitted_at, reviewed_at')
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);

    if (profileResult.error) {
      setError(profileResult.error.message);
      setStatus('error');
      return;
    }

    if (!profileResult.data) {
      setError('Your EduGuide profile could not be found.');
      setStatus('error');
      return;
    }

    setProfile(profileResult.data);
    setSchools(schoolsResult.data || []);
    setRequest(requestResult.data || null);
    setSchoolId(
      requestResult.data?.school_id ||
        profileResult.data.school_id ||
        schoolsResult.data?.[0]?.id ||
        ''
    );
    setEmployeeId(
      requestResult.data?.employee_id ||
        profileResult.data.employee_id ||
        ''
    );

    if (profileResult.data.account_type !== 'teacher') {
      setStatus('not-teacher');
    } else if (profileResult.data.role === 'teacher') {
      setStatus('approved');
    } else {
      setStatus('ready');
    }
  };

  useEffect(() => {
    loadData();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        router.replace('/login');
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const schoolName = useMemo(() => {
    const id = request?.school_id || profile?.school_id;
    const school = schools.find((item) => item.id === id);
    return school?.name || 'Your school';
  }, [profile, request, schools]);

  const handleFileChange = (event) => {
    setError('');
    const file = event.target.files?.[0] || null;

    if (!file) {
      setDocumentFile(null);
      return;
    }

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setDocumentFile(null);
      setError('Upload a JPG, PNG, WEBP, or PDF file.');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setDocumentFile(null);
      setError('Verification files must be 5 MB or smaller.');
      event.target.value = '';
      return;
    }

    setDocumentFile(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!schoolId) {
      setError('Select your school.');
      return;
    }

    if (!employeeId.trim()) {
      setError('Enter your teacher or employee ID number.');
      return;
    }

    if (!documentFile) {
      setError('Upload a school ID or employment proof document.');
      return;
    }

    setSubmitting(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('Your login session expired. Please sign in again.');
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const cleanName = documentFile.name
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .slice(-100);
      const path = `${user.id}/${Date.now()}-${cleanName}`;

      const { error: uploadError } = await supabase.storage
        .from('teacher-verifications')
        .upload(path, documentFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: documentFile.type,
        });

      if (uploadError) throw uploadError;

      const { error: submitError } = await supabase.rpc('submit_teacher_verification', {
        p_school_id: schoolId,
        p_employee_id: employeeId.trim(),
        p_document_path: path,
      });

      if (submitError) throw submitError;

      let notificationSent = false;
      let notificationMessage = '';

      if (session?.access_token) {
        try {
          const notifyResponse = await fetch('/api/teacher-verification/notify', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          });

          const notifyPayload = await notifyResponse.json();
          notificationSent = Boolean(notifyPayload.sent);

          if (!notifyResponse.ok || !notifyPayload.sent) {
            notificationMessage =
              notifyPayload.error ||
              'The verification request was saved, but the admin email notification could not be sent yet.';
          }
        } catch (notifyError) {
          notificationMessage =
            notifyError.message ||
            'The verification request was saved, but the admin email notification could not be sent yet.';
        }
      }

      setSuccess(
        notificationSent
          ? 'Verification submitted. Your school administrator has been notified by email.'
          : `Verification submitted and visible to the administrator dashboard. ${notificationMessage}`
      );
      setDocumentFile(null);
      await loadData();
    } catch (submitError) {
      setError(submitError.message || 'Could not submit teacher verification.');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-violet-100">
        <div className="rounded-2xl border border-violet-300/20 bg-violet-950/35 px-6 py-4 shadow-xl backdrop-blur">
          Loading teacher verification...
        </div>
      </main>
    );
  }

  if (status === 'not-teacher') {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-14 text-slate-100">
        <div className="mx-auto max-w-xl rounded-3xl border border-violet-300/20 bg-violet-950/30 p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-200/70">Teacher verification</p>
          <h1 className="mt-3 text-3xl font-bold">This is a student account</h1>
          <p className="mt-4 leading-7 text-violet-100/70">
            Teacher verification is only available to accounts that selected Teacher during registration.
          </p>
          <Link href="/prompt" className="mt-6 inline-flex rounded-xl bg-violet-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-violet-300">
            Return to EduGuide
          </Link>
        </div>
      </main>
    );
  }

  if (status === 'approved') {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-14 text-slate-100">
        <div className="mx-auto max-w-2xl rounded-3xl border border-emerald-300/20 bg-emerald-950/15 p-8 shadow-2xl">
          <div className="flex items-center gap-3">
            <Image src="/edu.png" alt="EduGuide PH" width={48} height={48} className="h-11 w-11 object-contain" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200/70">Verified teacher</p>
              <h1 className="text-3xl font-bold text-white">Teacher account approved</h1>
            </div>
          </div>
          <p className="mt-5 leading-7 text-emerald-50/75">
            Your teacher role is active for {schoolName}. You can now access the EduGuide staff dashboard.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/dashboard" className="rounded-xl bg-emerald-300 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-200">
              Open staff dashboard
            </Link>
            <Link href="/prompt" className="rounded-xl border border-violet-300/25 px-4 py-2.5 text-sm font-semibold text-violet-100 hover:bg-violet-900/30">
              Study chat
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_15%_10%,rgba(139,92,246,.28),transparent_30%),radial-gradient(circle_at_80%_10%,rgba(245,158,11,.12),transparent_30%),linear-gradient(180deg,#160a2f_0%,#0f172a_72%)]" />

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
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-200/70">Staff identity check</p>
              <h1 className="mt-1 text-3xl font-bold text-white">Verify your teacher account</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-violet-100/70">
                Teacher access is not activated automatically. Your teacher/employee ID comes from account creation. Upload school identification or employment proof here, then EduGuide notifies the administrator configured for your school to review the request.
              </p>
            </div>
          </div>

          {request?.status === 'pending' && (
            <div className="mt-6 rounded-2xl border border-amber-300/25 bg-amber-950/15 p-5">
              <p className="font-semibold text-amber-100">Verification pending</p>
              <p className="mt-2 text-sm leading-6 text-amber-50/70">
                Your request was submitted {request.submitted_at ? new Date(request.submitted_at).toLocaleString() : 'recently'}. Your teacher role stays inactive until an admin approves it.
              </p>
            </div>
          )}

          {request?.status === 'rejected' && (
            <div className="mt-6 rounded-2xl border border-rose-300/25 bg-rose-950/15 p-5">
              <p className="font-semibold text-rose-100">Verification needs another submission</p>
              <p className="mt-2 text-sm leading-6 text-rose-50/70">
                {request.admin_notes || 'The admin did not approve the previous verification. Review your details and submit a clearer or updated document.'}
              </p>
            </div>
          )}

          {error && (
            <div className="mt-6 rounded-xl border border-rose-300/30 bg-rose-950/20 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-6 rounded-xl border border-emerald-300/30 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-100">
              {success}
            </div>
          )}

          {request?.status !== 'pending' && (
            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
              <div>
                <label htmlFor="schoolId" className="mb-2 block text-sm font-semibold text-violet-100">
                  School
                </label>
                <select
                  id="schoolId"
                  value={schoolId}
                  onChange={(e) => setSchoolId(e.target.value)}
                  className="w-full rounded-xl border border-violet-300/30 bg-slate-950/65 px-4 py-3 text-sm text-white outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-400/40"
                  required
                >
                  <option value="">Select your school</option>
                  {schools.map((school) => (
                    <option value={school.id} key={school.id}>
                      {school.name}{school.short_name ? ` (${school.short_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="employeeId" className="mb-2 block text-sm font-semibold text-violet-100">
                  Teacher / Employee ID number
                </label>
                <input
                  id="employeeId"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  readOnly={Boolean(profile?.employee_id)}
                  placeholder="Enter the ID shown on your school identification"
                  className={`w-full rounded-xl border border-violet-300/30 bg-slate-950/65 px-4 py-3 text-sm text-white placeholder-violet-100/40 outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-400/40 ${
                    profile?.employee_id ? 'cursor-not-allowed opacity-80' : ''
                  }`}
                  required
                />
                <p className="mt-2 text-xs leading-5 text-violet-100/55">
                  {profile?.employee_id
                    ? 'This ID was recorded when the teacher account was created.'
                    : 'This is an older test account, so enter the teacher/employee ID once here. New teacher accounts collect it during signup.'}
                </p>
              </div>

              <div>
                <label htmlFor="verificationFile" className="mb-2 block text-sm font-semibold text-violet-100">
                  Verification document
                </label>
                <label
                  htmlFor="verificationFile"
                  className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-violet-300/30 bg-slate-950/35 px-5 py-8 text-center transition hover:border-violet-300/55 hover:bg-violet-950/35"
                >
                  <span className="text-sm font-semibold text-white">
                    {documentFile ? documentFile.name : 'Choose school ID or employment proof'}
                  </span>
                  <span className="mt-2 text-xs leading-5 text-violet-100/55">
                    JPG, PNG, WEBP, or PDF — maximum 5 MB. Files are stored in a private verification bucket.
                  </span>
                </label>
                <input
                  id="verificationFile"
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                  required
                />
              </div>

              <div className="rounded-2xl border border-violet-300/15 bg-slate-950/30 p-4 text-xs leading-6 text-violet-100/60">
                The document is used only for account verification. Students and ordinary teacher accounts cannot browse other verification files.
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-violet-400 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-violet-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Submitting verification...' : request?.status === 'rejected' ? 'Resubmit verification' : 'Submit teacher verification'}
              </button>
            </form>
          )}

          {request?.status === 'pending' && (
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/prompt" className="rounded-xl bg-violet-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-violet-300">
                Continue to EduGuide
              </Link>
              <span className="self-center text-xs text-violet-100/55">
                Staff dashboard access remains locked while pending.
              </span>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
