import { useState } from 'react';

export interface CaregiverReportCardProps {
  status: 'idle' | 'thinking' | 'completed';
  summary?: string;
  alerts?: string[];
  actionItems?: string[];
  observationNotes?: string;
  medicationCompliance?: string;
  readyToSend?: boolean;
  onSend?: () => void;
}

export function CaregiverReportCard({
  status,
  summary = 'Resident Anita Rao is stable today. Vital signs are within normal clinical thresholds.',
  alerts = [],
  actionItems = [
    'Ensure Lisinopril is taken at 8 PM',
    'Encourage a short walk in the evening',
    'Log fluid intake',
  ],
  observationNotes = 'Anita has been active today (4,120 steps). She reports good energy levels and did not experience any dizziness during morning activities. Soft meals are prepared for dinner.',
  medicationCompliance = '95%',
  readyToSend = true,
  onSend,
}: CaregiverReportCardProps) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    setSending(true);
    if (onSend) {
      onSend();
    }
    // Simulate sending progress
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setSending(false);
    setSent(true);
    setTimeout(() => setSent(false), 3000);
  };

  if (status === 'thinking') {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md border-t-4 border-t-blue-500 animate-pulse transition-all duration-300">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-50 p-3 text-blue-600">
              <span className="text-2xl block animate-spin">⏳</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Caregiver Report Agent</h3>
              <p className="text-xs text-slate-500 mt-1">Generating clinician report...</p>
            </div>
          </div>
          <span className="rounded-full bg-blue-50 text-blue-700 px-3 py-1 text-xs font-bold animate-pulse">
            Thinking...
          </span>
        </div>
        <div className="space-y-4 animate-pulse">
          <div className="h-16 bg-slate-50 border border-slate-100 rounded-2xl" />
          <div className="h-24 bg-slate-50 border border-slate-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (status === 'idle') {
    return (
      <div className="rounded-3xl border border-slate-200 bg-slate-50/55 p-6 border-t-4 border-t-slate-300 transition-all duration-300">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3 opacity-50">
            <div className="rounded-full bg-slate-100 p-3 text-slate-500">
              <span className="text-2xl block">📋</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-700">Caregiver Report Agent</h3>
              <p className="text-xs text-slate-400 mt-1 font-medium">Awaiting analysis trigger</p>
            </div>
          </div>
          <span className="rounded-full bg-slate-100 text-slate-500 px-3 py-1 text-xs font-bold">
            Idle
          </span>
        </div>
        <div className="text-center py-10">
          <p className="text-sm text-slate-400">Click "Analyze Health Data" to invoke this agent.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md border-t-4 border-t-purple-500 transition-all duration-300 hover:shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-gradient-to-br from-purple-50 to-purple-100 p-3 text-purple-600">
            <span className="text-2xl block">📋</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-900">Caregiver Report Agent</h3>
              <span className="text-purple-500 text-sm">✓</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Automated clinical shift report</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {readyToSend && (
            <span className="rounded-full bg-purple-50 text-purple-700 px-2.5 py-1 text-[10px] font-black border border-purple-100 uppercase tracking-wider">
              Ready to Send
            </span>
          )}
          <span className="rounded-full bg-purple-50 text-purple-700 px-3 py-1.5 text-xs font-bold border border-purple-100 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
            Completed
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Executive Summary & Compliance */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl bg-purple-50/30 p-5 border border-purple-100/50">
            <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block mb-1">
              Executive Summary
            </span>
            <p className="text-sm text-slate-700 leading-relaxed font-semibold">
              {summary}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50/50 p-5 border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Today's Observations & Logs
            </span>
            <p className="text-xs text-slate-600 leading-relaxed italic">
              {observationNotes}
            </p>
          </div>
        </div>

        {/* Action Items & Compliance stats */}
        <div className="space-y-4">
          {/* Compliance Card */}
          <div className="rounded-2xl bg-slate-50/50 p-4 border border-slate-100 flex justify-between items-center">
            <div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Medication Compliance</span>
              <p className="text-2xl font-black text-slate-800 mt-0.5">{medicationCompliance}</p>
            </div>
            <span className="text-2xl">💊</span>
          </div>

          {/* Action items */}
          <div className="rounded-2xl bg-slate-50/50 p-4 border border-slate-100">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-2.5">
              Caregiver Action Items
            </span>
            <ul className="space-y-2">
              {actionItems.map((item, index) => (
                <li key={index} className="flex items-start gap-2 text-xs text-slate-700 font-semibold">
                  <span className="text-purple-500 font-bold mt-0.5">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Alerts if any */}
          {alerts && alerts.length > 0 && (
            <div className="rounded-2xl bg-rose-50 border border-rose-100 p-4">
              <span className="text-[9px] font-bold text-rose-700 uppercase tracking-wider block mb-2">
                Alerts Checklist
              </span>
              <ul className="space-y-1">
                {alerts.map((a, i) => (
                  <li key={i} className="text-xs text-rose-700 font-medium flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-rose-500" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="mt-6 pt-4 border-t border-slate-150 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <span className="text-[10px] text-slate-400 font-semibold uppercase">
          Report Generated: {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
        </span>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => void handleSend()}
            disabled={sending || sent}
            className={`w-full sm:w-auto rounded-xl px-5 py-2.5 text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              sent
                ? 'bg-emerald-600 text-white cursor-default'
                : sending
                  ? 'bg-purple-400 text-white cursor-not-allowed'
                  : 'bg-purple-600 text-white hover:bg-purple-700 active:scale-95'
            }`}
          >
            {sending ? (
              <>
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Dispatching Report...
              </>
            ) : sent ? (
              <>
                <span>✓ Report Dispatched to Care Team</span>
              </>
            ) : (
              <>
                <span>📤 Send Shift Report</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
