import { useEldercare } from '../../context/EldercareContext';

export default function AdminSystemMonitoring() {
  const { storageMode } = useEldercare();

  const services = [
    { name: 'Firebase Firestore', status: 'Operational', details: `Mode: ${storageMode}` },
    { name: 'Authentication System', status: 'Operational', details: 'Firebase Auth Active' },
    { name: 'Device Connectivity', status: 'Operational', details: 'All gateways online' },
    { name: 'Notification Service', status: 'Operational', details: 'Web push active' },
    { name: 'AI Processing Pipeline', status: 'Operational', details: 'Rules engine active' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <header>
        <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-2">
          Admin Portal
        </span>
        <h1 className="text-3xl font-bold text-slate-900">Platform System Monitoring</h1>
        <p className="text-sm text-slate-500 mt-1">Infrastructure health, service status, and backend connectivity.</p>
      </header>

      <div className="rounded-3xl bg-white p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
        <h2 className="text-xl font-bold text-slate-900">Infrastructure Services Health</h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((srv) => (
            <div key={srv.name} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-sm">{srv.name}</span>
                <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold uppercase">
                  {srv.status}
                </span>
              </div>
              <p className="text-xs text-slate-500">{srv.details}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
