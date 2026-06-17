import React from 'react';

export default function RegisterModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
      <div className="relative w-full max-w-md animate-fade-in rounded-2xl border border-violet-300/25 bg-violet-950/45 p-8 shadow-2xl shadow-violet-900/50">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md px-2 py-1 text-xl text-violet-100/80 transition hover:bg-violet-900/40 hover:text-white"
          aria-label="Close"
        >
          x
        </button>
        <h2 className="mb-3 text-2xl font-bold text-white">Create an Account</h2>
        <p className="mb-5 text-sm text-violet-100/80">To continue chatting, please register first.</p>
        <form action="/register">
          <button
            type="submit"
            className="w-full rounded-lg bg-violet-400 px-4 py-2.5 font-semibold text-slate-950 transition hover:bg-violet-300"
          >
            Go to Registration
          </button>
        </form>
      </div>
    </div>
  );
}
