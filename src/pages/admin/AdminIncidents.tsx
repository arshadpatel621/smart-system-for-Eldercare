import { useEldercare } from '../../context/EldercareContext';

export default function AdminIncidents() {
  const { data } = useEldercare();
  const incidents = data?.safetyEvents || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <header>
        <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-2">
          Admin Portal
        </span>
        <h1 className="text-3xl font-bold text-slate-900">Platform Incident Center</h1>
        <p className="text-sm text-slate-500 mt-1">System-wide emergency events, fall detections, and critical system alerts.</p>
      </header>

      <div className="rounded-3xl bg-white p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
        <h2 className="text-xl font-bold text-slate-900">All System Incidents</h2>

        {incidents.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            No critical incidents recorded.
          </div>
        ) : (
          <div className="space-y-3">
            {incidents.map((inc) => (
              <div key={inc.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900 text-sm capitalize">{inc.type.replace('_', ' ')}</div>
                  <div className="text-xs text-slate-500">{inc.location}: {inc.note}</div>
                </div>
                <span className="rounded-full bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1 text-xs font-bold uppercase">
                  {inc.severity}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
