"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

const fieldClass =
  'w-full rounded-xl border border-violet-300/30 bg-slate-950/65 px-4 py-3 text-sm text-white placeholder-violet-100/45 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-400/45';

export default function Register() {
  const router = useRouter();
  const registrationInProgressRef = useRef(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    age: '',
    gender: '',
    gradeYear: '',
    studentId: '',
    employeeId: '',
    schoolId: '',
    accountType: 'student',
  });
  const [schools, setSchools] = useState([]);
  const [schoolsLoading, setSchoolsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadPage = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (session?.user) {
        router.replace('/prompt');
        return;
      }

      const { data: schoolRows, error: schoolError } = await supabase
        .from('schools')
        .select('id, name, short_name')
        .eq('active', true)
        .order('name');

      if (cancelled) return;

      if (schoolError) {
        setError('School options could not be loaded. Please try again.');
      } else {
        const availableSchools = schoolRows || [];
        setSchools(availableSchools);
        if (availableSchools.length === 1) {
          setFormData((prev) => ({ ...prev, schoolId: availableSchools[0].id }));
        }
      }

      setSchoolsLoading(false);
      setAuthChecked(true);
    };

    loadPage();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        session?.user &&
        event !== 'SIGNED_OUT' &&
        !registrationInProgressRef.current
      ) {
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
      [name]: value,
    }));
  };

  const chooseAccountType = (accountType) => {
    setFormData((prev) => ({
      ...prev,
      accountType,
      gradeYear: accountType === 'teacher' ? '' : prev.gradeYear,
      studentId: accountType === 'teacher' ? '' : prev.studentId,
      employeeId: accountType === 'student' ? '' : prev.employeeId,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    setSuccessMessage('');
    registrationInProgressRef.current = true;

    try {
      if (!formData.schoolId) {
        throw new Error('Please select your school.');
      }

      if (formData.accountType === 'student' && !formData.gradeYear.trim()) {
        throw new Error('Please enter your grade or year level.');
      }

      if (formData.accountType === 'student' && !formData.studentId.trim()) {
        throw new Error('Please enter your student ID.');
      }

      if (formData.accountType === 'teacher' && !formData.employeeId.trim()) {
        throw new Error('Please enter your teacher or employee ID.');
      }

      const profileMetadata = {
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        age: formData.age ? parseInt(formData.age, 10) : null,
        gender: formData.gender || null,
        grade_year:
          formData.accountType === 'student' ? formData.gradeYear.trim() : null,
        account_type: formData.accountType,
        school_id: formData.schoolId,
        student_id:
          formData.accountType === 'student' ? formData.studentId.trim() : null,
        employee_id:
          formData.accountType === 'teacher' ? formData.employeeId.trim() : null,
      };

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password,
        options: {
          data: profileMetadata,
        },
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('Account creation did not complete. Please try again.');
      }

      if (authData.session) {
        if (formData.accountType === 'teacher') {
          router.replace('/teacher-verification');
        } else {
          router.replace('/student-setup');
        }
        return;
      }

      setSuccess(true);
      if (formData.accountType === 'teacher') {
        setSuccessMessage(
          'Teacher account created. After email confirmation, sign in and upload your school ID or employment proof. The teacher-role verification request is then sent to your school administrator for approval.'
        );
      } else {
        setSuccessMessage(
          'Student account created. Check your email for the verification link. After signing in, EduGuide will ask you to choose your section.'
        );
      }
    } catch (submitError) {
      setError(submitError.message || 'Could not create your account.');
    } finally {
      registrationInProgressRef.current = false;
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
    <div className="relative min-h-screen overflow-hidden bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 sm:py-10 lg:px-8">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_15%,rgba(139,92,246,.34),transparent_32%),radial-gradient(circle_at_82%_15%,rgba(168,85,247,.22),transparent_30%),linear-gradient(180deg,#160a2f_0%,#1f1147_45%,#0f172a_100%)]" />

      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <aside className="rounded-3xl border border-violet-300/20 bg-violet-950/30 p-6 shadow-2xl shadow-violet-950/30 backdrop-blur sm:p-8">
          <Link
            href="/"
            className="inline-flex rounded-lg border border-violet-300/25 bg-violet-900/30 px-3 py-1.5 text-sm text-violet-100 transition hover:border-violet-300/45 hover:bg-violet-900/50"
          >
            &lt; Back
          </Link>

          <div className="mt-8 flex items-center gap-3">
            <Image
              src="/edu.png"
              alt="EduGuide PH logo"
              width={56}
              height={56}
              className="h-12 w-12 object-contain"
            />
            <div>
              <h1 className="text-2xl font-bold text-white">EduGuide PH</h1>
              <p className="text-sm text-violet-100/65">School-connected learning support</p>
            </div>
          </div>

          <h2 className="mt-8 text-3xl font-bold leading-tight text-white">
            Create the account that matches your role.
          </h2>
          <p className="mt-4 text-sm leading-7 text-violet-100/75">
            Students can start using EduGuide after account verification. Teacher accounts require an additional school-identity check before staff access is enabled.
          </p>

          <div className="mt-7 space-y-3 text-sm">
            <div className="rounded-2xl border border-violet-300/15 bg-slate-950/30 p-4">
              <p className="font-semibold text-white">Student</p>
              <p className="mt-1 leading-6 text-violet-100/65">
                School, grade/year, study chat, saved sessions, and learning support.
              </p>
            </div>
            <div className="rounded-2xl border border-amber-300/20 bg-amber-950/15 p-4">
              <p className="font-semibold text-amber-100">Teacher</p>
              <p className="mt-1 leading-6 text-amber-50/65">
                Select your school first, then verify using a teacher/employee ID or school employment document. An EduGuide admin reviews the request.
              </p>
            </div>
          </div>
        </aside>

        <section className="rounded-3xl border border-violet-300/20 bg-violet-950/35 p-6 shadow-2xl shadow-violet-900/40 backdrop-blur sm:p-8 lg:p-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-200/70">Account creation</p>
            <h2 className="mt-2 text-3xl font-bold text-white">Join EduGuide PH</h2>
            <p className="mt-2 text-sm text-violet-100/70">
              Choose your school and whether you are joining as a student or teacher.
            </p>
          </div>

          {error && (
            <div className="mt-6 rounded-xl border border-rose-300/40 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-6 rounded-xl border border-emerald-300/40 bg-emerald-500/15 px-4 py-3 text-sm leading-6 text-emerald-100">
              {successMessage}
            </div>
          )}

          <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-sm font-semibold text-violet-100">I am a...</label>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  {
                    value: 'student',
                    title: 'Student',
                    description: 'Study support and career guidance',
                  },
                  {
                    value: 'teacher',
                    title: 'Teacher',
                    description: 'Requires admin verification',
                  },
                ].map((option) => {
                  const selected = formData.accountType === option.value;
                  return (
                    <button
                      type="button"
                      key={option.value}
                      onClick={() => chooseAccountType(option.value)}
                      className={`rounded-2xl border p-4 text-left transition ${
                        selected
                          ? 'border-violet-300 bg-violet-500/20 ring-2 ring-violet-400/25'
                          : 'border-violet-300/20 bg-slate-950/35 hover:border-violet-300/45'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-white">{option.title}</span>
                        <span
                          className={`h-4 w-4 rounded-full border ${
                            selected
                              ? 'border-violet-200 bg-violet-300 shadow-[inset_0_0_0_3px_#24113e]'
                              : 'border-violet-200/45'
                          }`}
                        />
                      </div>
                      <p className="mt-1 text-xs leading-5 text-violet-100/60">
                        {option.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label htmlFor="schoolId" className="mb-2 block text-sm font-semibold text-violet-100">
                School
              </label>
              <select
                id="schoolId"
                name="schoolId"
                value={formData.schoolId}
                onChange={handleInputChange}
                className={fieldClass}
                required
                disabled={schoolsLoading}
              >
                <option value="">
                  {schoolsLoading ? 'Loading schools...' : 'Select your school'}
                </option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}{school.short_name ? ` (${school.short_name})` : ''}
                  </option>
                ))}
              </select>
              {!schoolsLoading && schools.length === 0 && (
                <p className="mt-2 text-xs text-amber-200">
                  No active school is configured yet. Ask an EduGuide administrator.
                </p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="firstName" className="mb-2 block text-sm font-medium text-violet-100/80">
                  First name
                </label>
                <input
                  id="firstName"
                  type="text"
                  name="firstName"
                  placeholder="First name"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className={fieldClass}
                  required
                />
              </div>
              <div>
                <label htmlFor="lastName" className="mb-2 block text-sm font-medium text-violet-100/80">
                  Last name
                </label>
                <input
                  id="lastName"
                  type="text"
                  name="lastName"
                  placeholder="Last name"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className={fieldClass}
                  required
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-medium text-violet-100/80">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  placeholder="name@example.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={fieldClass}
                  required
                />
              </div>
              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-medium text-violet-100/80">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  name="password"
                  placeholder="Create a password"
                  value={formData.password}
                  onChange={handleInputChange}
                  minLength={6}
                  className={fieldClass}
                  required
                />
              </div>
            </div>

            <div className={`grid gap-3 ${
              formData.accountType === 'student' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
            }`}>
              <div>
                <label htmlFor="age" className="mb-2 block text-sm font-medium text-violet-100/80">
                  Age
                </label>
                <input
                  id="age"
                  type="number"
                  name="age"
                  min="5"
                  max="120"
                  placeholder="Age"
                  value={formData.age}
                  onChange={handleInputChange}
                  className={fieldClass}
                />
              </div>

              <div>
                <label htmlFor="gender" className="mb-2 block text-sm font-medium text-violet-100/80">
                  Gender
                </label>
                <select
                  id="gender"
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                  className={fieldClass}
                >
                  <option value="">Prefer not to say</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {formData.accountType === 'student' && (
                <div>
                  <label htmlFor="gradeYear" className="mb-2 block text-sm font-medium text-violet-100/80">
                    Grade / Year
                  </label>
                  <input
                    id="gradeYear"
                    type="text"
                    name="gradeYear"
                    placeholder="e.g. Grade 11"
                    value={formData.gradeYear}
                    onChange={handleInputChange}
                    className={fieldClass}
                    required
                  />
                </div>
              )}
            </div>

            <div>
              <label
                htmlFor={formData.accountType === 'teacher' ? 'employeeId' : 'studentId'}
                className="mb-2 block text-sm font-semibold text-violet-100"
              >
                {formData.accountType === 'teacher'
                  ? 'Teacher / Employee ID'
                  : 'Student ID'}
              </label>
              <input
                id={formData.accountType === 'teacher' ? 'employeeId' : 'studentId'}
                type="text"
                name={formData.accountType === 'teacher' ? 'employeeId' : 'studentId'}
                placeholder={
                  formData.accountType === 'teacher'
                    ? 'Enter your school teacher or employee ID'
                    : 'Enter your school student ID'
                }
                value={
                  formData.accountType === 'teacher'
                    ? formData.employeeId
                    : formData.studentId
                }
                onChange={handleInputChange}
                className={fieldClass}
                required
              />
              <p className="mt-2 text-xs leading-5 text-violet-100/55">
                This ID is tied to the selected school and is used to identify your school account.
              </p>
            </div>

            {formData.accountType === 'teacher' && (
              <div className="rounded-2xl border border-amber-300/20 bg-amber-950/15 p-4 text-sm leading-6 text-amber-50/75">
                <p className="font-semibold text-amber-100">Teacher verification required</p>
                <p className="mt-1">
                  Your teacher/employee ID is collected here during account creation. After sign-in, EduGuide will ask for a photo/PDF of school identification or employment proof. The verification request is then sent to the administrator configured for your school, and your account will not receive the teacher role until that admin approves it.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || schoolsLoading || schools.length === 0}
              className="w-full rounded-xl bg-violet-400 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-violet-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? 'Creating account...'
                : formData.accountType === 'teacher'
                  ? 'Create teacher account'
                  : 'Create student account'}
            </button>

            <p className="text-center text-sm text-violet-100/80">
              Already have an account?{' '}
              <Link href="/login" className="font-semibold text-violet-200 hover:text-white">
                Sign in
              </Link>
            </p>
          </form>
        </section>
      </div>
    </div>
  );
}
