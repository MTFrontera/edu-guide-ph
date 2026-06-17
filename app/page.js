"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

function SunIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </svg>
  );
}

function MoonIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" {...props}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 1 0 9.8 9.8z" />
    </svg>
  );
}

function LockIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" {...props}>
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function SparklesIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" {...props}>
      <path d="M12 3l1.8 3.7L17.5 8l-3.7 1.3L12 13l-1.8-3.7L6.5 8l3.7-1.3L12 3zM5 14l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2zM19 14l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z" />
    </svg>
  );
}

const FEEDBACK_POOL = [
  {
    quote:
      "I finally understood algebra because the bot explained it in the way we speak at home. It feels like a tutor who never gets tired.",
    author: "Grade 10 learner, Bukidnon",
  },
  {
    quote:
      "When our signal drops, I still prepare answers and review later. It helped me stay ready for quizzes.",
    author: "Grade 9 learner, Misamis Oriental",
  },
  {
    quote:
      "I use it before class to simplify science topics, then ask follow-up questions in Tagalog after school.",
    author: "Senior High student, Davao del Sur",
  },
  {
    quote:
      "The career suggestions gave me a clear list of courses to research. I now have a plan after graduation.",
    author: "Grade 12 learner, Cotabato",
  },
];

const CHAT_REPLIES = [
  "Photosynthesis mao ang proseso diin ang tanom naghimo ug pagkaon gamit sa kahayag sa adlaw, tubig, ug carbon dioxide.",
  "Sure. Here are 3 quick quiz questions and one bonus challenge for practice.",
  "No problem. I can explain this again in English, Cebuano, or Tagalog.",
  "Great work. Want me to build a 20-minute review plan for tonight?",
];

export default function Home() {
  const router = useRouter();
  const [feedbackIndex, setFeedbackIndex] = useState(0);
  const [chatIndex, setChatIndex] = useState(0);
  const [authChecked, setAuthChecked] = useState(false);
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "dark";
    const savedTheme = localStorage.getItem("eduguide-theme");
    return savedTheme === "light" || savedTheme === "dark" ? savedTheme : "dark";
  });
  const didMountThemeRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    document.documentElement.setAttribute("data-theme", theme);
    if (didMountThemeRef.current) {
      localStorage.setItem("eduguide-theme", theme);
    }
    didMountThemeRef.current = true;
  }, [theme]);

  useEffect(() => {
    let cancelled = false;

    const syncSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (session?.user) {
        router.replace("/prompt");
        return;
      }

      setAuthChecked(true);
    };

    syncSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user && event !== "SIGNED_OUT") {
        router.replace("/prompt");
        return;
      }

      if (event === "SIGNED_OUT" && !cancelled) {
        setAuthChecked(true);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    const feedbackTimer = setInterval(() => {
      setFeedbackIndex((prev) => (prev + 1) % FEEDBACK_POOL.length);
    }, 3800);

    return () => clearInterval(feedbackTimer);
  }, []);

  useEffect(() => {
    const chatTimer = setInterval(() => {
      setChatIndex((prev) => (prev + 1) % CHAT_REPLIES.length);
    }, 5200);
    return () => clearInterval(chatTimer);
  }, []);

  const isLight = theme === "light";
  const activeFeedback = FEEDBACK_POOL[feedbackIndex];

  if (!authChecked) {
    return (
      <div className={`flex min-h-screen items-center justify-center ${isLight ? "bg-violet-50 text-slate-900" : "bg-slate-950 text-slate-100"}`}>
        <div className={`rounded-3xl border px-6 py-4 text-sm shadow-xl ${isLight ? "border-violet-200 bg-white text-violet-700" : "border-violet-300/20 bg-violet-950/40 text-violet-100"}`}>
          Loading EduGuide PH...
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isLight ? "bg-violet-50 text-slate-900" : "bg-slate-950 text-slate-100"}`}>
      <div
        className={`absolute inset-0 -z-10 ${
          isLight
            ? "bg-[radial-gradient(circle_at_20%_20%,rgba(167,139,250,.35),transparent_35%),radial-gradient(circle_at_75%_10%,rgba(196,181,253,.35),transparent_35%),linear-gradient(180deg,#f5f3ff_0%,#ede9fe_45%,#e2e8f0_100%)]"
            : "bg-[radial-gradient(circle_at_20%_20%,rgba(139,92,246,.35),transparent_35%),radial-gradient(circle_at_75%_10%,rgba(168,85,247,.28),transparent_35%),linear-gradient(180deg,#160a2f_0%,#1f1147_45%,#0f172a_100%)]"
        }`}
      />

      <header className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-10 md:py-6">
        <Link href="/" className={`inline-flex items-center gap-2.5 text-xl font-semibold tracking-tight md:text-2xl ${isLight ? "text-slate-900" : "text-white"}`}>
          <Image src="/edu.png" alt="EduGuide PH logo" width={44} height={44} className="h-10 w-10 object-contain md:h-11 md:w-11" />
          <span>EduGuide PH</span>
        </Link>
        <nav className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:gap-3">
          <button
            onClick={() => setTheme(isLight ? "dark" : "light")}
            className={`rounded-full px-3 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm ${
              isLight
                ? "border border-violet-300 bg-white text-violet-700 hover:bg-violet-100"
                : "border border-violet-300/30 bg-violet-900/30 text-violet-100 hover:border-violet-300"
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              {isLight ? <MoonIcon className="h-4 w-4" /> : <SunIcon className="h-4 w-4" />}
              <span>{isLight ? "Night" : "Light"}</span>
            </span>
          </button>
          <Link
            href="/login"
            className={`rounded-full border px-3 py-2 text-xs transition sm:px-4 sm:text-sm ${
              isLight
                ? "border-violet-300 bg-white text-slate-700 hover:border-violet-500 hover:text-slate-900"
                : "border-violet-300/30 text-slate-200 hover:border-violet-300 hover:text-white"
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <LockIcon className="h-4 w-4" />
              <span>Sign in</span>
            </span>
          </Link>
          <Link
            href="/register"
            className={`rounded-full px-4 py-2 text-xs font-semibold transition sm:px-5 sm:text-sm ${
              isLight ? "bg-violet-600 text-white hover:bg-violet-700" : "bg-violet-400 text-slate-950 hover:bg-violet-300"
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <SparklesIcon className="h-4 w-4" />
              <span>Start free</span>
            </span>
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid w-full max-w-7xl gap-8 px-4 pb-12 pt-4 md:grid-cols-2 md:items-center md:gap-12 md:px-10 md:pb-16 md:pt-12">
          <div>
            <p className={`mb-4 inline-block rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wider ${isLight ? "border-violet-300 bg-violet-100 text-violet-700" : "border-violet-300/30 bg-violet-500/10 text-violet-200"}`}>
              Built for rural-first learning
            </p>
            <h1 className={`text-3xl font-bold leading-tight md:text-6xl ${isLight ? "text-slate-900" : "text-white"}`}>
              A modern AI study companion for every student in Mindanao
            </h1>
            <p className={`mt-6 max-w-xl text-base leading-relaxed md:text-lg ${isLight ? "text-slate-700" : "text-slate-300"}`}>
              Personalized tutoring, quizzes, and study plans in English, Cebuano, and Tagalog.
              Fast on low-end devices, useful even on unstable data.
            </p>
            <p className={`mt-4 max-w-xl text-sm leading-relaxed ${isLight ? "text-violet-700" : "text-violet-200"}`}>
              You can use the AI chat immediately without creating an account. Create one only if you want extra features like saving chat history and personalized progress.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/register"
                className={`rounded-full px-6 py-3 font-semibold transition hover:-translate-y-0.5 ${isLight ? "bg-violet-600 text-white hover:bg-violet-700" : "bg-violet-400 text-slate-950 hover:bg-violet-300"}`}
              >
                Create account
              </Link>
              <Link
                href="/prompt"
                className={`rounded-full border px-6 py-3 font-semibold transition hover:-translate-y-0.5 ${isLight ? "border-violet-300 bg-white text-violet-700 hover:border-violet-500" : "border-violet-300/40 text-white hover:border-violet-300"}`}
              >
                Try live demo
              </Link>
            </div>
            <div className="mt-8 grid max-w-lg grid-cols-3 gap-2 text-center md:mt-10 md:gap-3">
              {["3\nLanguages", "24/7\nStudy support", "AI\nTutor + mentor"].map((item) => {
                const [value, label] = item.split("\n");
                return (
                  <div key={item} className={`rounded-2xl border p-3 md:p-4 ${isLight ? "border-violet-200 bg-white" : "border-violet-300/20 bg-violet-950/40"}`}>
                    <p className="text-xl font-bold text-violet-500 md:text-2xl">{value}</p>
                    <p className={`text-[11px] md:text-xs ${isLight ? "text-slate-600" : "text-slate-300"}`}>{label}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={`rounded-3xl border p-5 shadow-2xl backdrop-blur ${isLight ? "border-violet-200 bg-white shadow-violet-200/40" : "border-violet-300/20 bg-violet-950/40 shadow-violet-900/40"}`}>
            <div className={`rounded-2xl p-4 ${isLight ? "bg-violet-50" : "bg-slate-950/80"}`}>
              <div className="mb-4 flex items-center justify-between">
                <p className={`text-sm font-medium ${isLight ? "text-slate-700" : "text-slate-300"}`}>EduGuide Chat</p>
                <span className={`rounded-full px-2 py-1 text-xs ${isLight ? "bg-violet-100 text-violet-700" : "bg-violet-500/20 text-violet-300"}`}>Online</span>
              </div>
              <div className="space-y-3 text-sm">
                <div className={`ml-auto w-[85%] rounded-2xl rounded-tr-md p-3 ${isLight ? "bg-white text-slate-700 border border-violet-200" : "bg-slate-800 text-slate-200"}`}>
                  Explain photosynthesis in Cebuano with an example.
                </div>
                <div className="flex w-[90%] items-start gap-2">
                  <Image
                    src="/edu.png"
                    alt="EduGuide PH"
                    width={44}
                    height={44}
                    className="mt-0.5 h-11 w-11 shrink-0 rounded-lg object-contain"
                  />
                  <div
                    key={chatIndex}
                    className={`rounded-2xl rounded-tl-md p-3 animate-fade-in ${isLight ? "bg-violet-600 text-white" : "bg-violet-400 text-slate-950"}`}
                  >
                    {CHAT_REPLIES[chatIndex]}
                  </div>
                </div>
                <div className={`ml-auto w-[78%] rounded-2xl rounded-tr-md p-3 ${isLight ? "bg-white text-slate-700 border border-violet-200" : "bg-slate-800 text-slate-200"}`}>
                  Great. Give me 3 quick quiz questions.
                </div>
                <p className={`text-left text-[11px] ${isLight ? "text-violet-600" : "text-violet-200/80"}`}>EduGuide replying...</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 pb-10 md:px-10">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["Localized Learning", "Explanations adjust to local context and language, so lessons feel familiar and easier to understand."],
              ["Low-Bandwidth Ready", "Designed to stay useful in unstable connections and on entry-level Android phones."],
              ["Career Direction", "Beyond homework help, students get step-by-step guidance toward courses and career paths."],
            ].map(([title, desc]) => (
              <article key={title} className={`rounded-2xl border p-6 ${isLight ? "border-violet-200 bg-white" : "border-violet-300/20 bg-violet-950/35"}`}>
                <h2 className={`text-lg font-semibold ${isLight ? "text-slate-900" : "text-white"}`}>{title}</h2>
                <p className={`mt-2 text-sm leading-relaxed ${isLight ? "text-slate-600" : "text-slate-300"}`}>{desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-4 pb-14 md:px-10 md:pb-16">
          <div className={`rounded-3xl border p-8 text-center ${isLight ? "border-violet-200 bg-white" : "border-violet-300/20 bg-violet-950/35"}`}>
            <p className={`text-sm uppercase tracking-widest ${isLight ? "text-violet-700" : "text-violet-200"}`}>Student feedback</p>
            <blockquote
              key={feedbackIndex}
              className={`mx-auto mt-4 max-w-3xl text-lg leading-relaxed md:text-2xl animate-fade-in ${isLight ? "text-slate-700" : "text-slate-200"}`}
            >
              &ldquo;{activeFeedback.quote}&rdquo;
            </blockquote>
            <p className={`mt-4 text-sm ${isLight ? "text-slate-500" : "text-slate-400"}`}>{activeFeedback.author}</p>
            <div className="mt-4 flex items-center justify-center gap-2">
              {FEEDBACK_POOL.map((_, idx) => (
                <span
                  key={idx}
                  className={`h-1.5 w-6 rounded-full transition ${idx === feedbackIndex ? "bg-violet-500" : isLight ? "bg-violet-300" : "bg-violet-300/30"}`}
                />
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className={`${isLight ? "border-t border-violet-200" : "border-t border-violet-300/20"}`}>
        <div className={`mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-8 text-sm md:flex-row md:items-center md:justify-between md:px-10 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
          <p>© 2026 EduGuide PH. Education access, redesigned.</p>
          <div className="flex items-center gap-4">
            <Link href="/login" className="transition hover:text-violet-600">
              Sign in
            </Link>
            <Link href="/register" className="transition hover:text-violet-600">
              Register
            </Link>
            <Link href="/prompt" className="transition hover:text-violet-600">
              Demo
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
