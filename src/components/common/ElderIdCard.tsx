import { useState } from 'react';

interface ElderIdCardProps {
  elderId: string;
  className?: string;
}

export default function ElderIdCard({ elderId, className = '' }: ElderIdCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(elderId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = elderId;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className={`relative overflow-hidden rounded-3xl border border-blue-200 bg-blue-50/60 p-6 shadow-sm ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 text-xl font-bold">
            <span className="material-symbols-outlined">badge</span>
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900">Your Shareable Elder ID</h3>
            <p className="text-xs text-slate-500">Share this ID with your caregiver to connect</p>
          </div>
        </div>

        <span className="rounded-full bg-blue-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-700">
          Shareable
        </span>
      </div>

      <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-blue-200 bg-white p-4 shadow-sm">
        <span className="font-mono text-2xl font-bold tracking-wider text-blue-950 select-all">
          {elderId}
        </span>

        <button
          onClick={handleCopy}
          className={`w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
            copied
              ? 'bg-emerald-600 text-white shadow-sm scale-105'
              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm active:scale-[0.98]'
          }`}
        >
          {copied ? (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <span>Copied!</span>
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>Copy Elder ID</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
