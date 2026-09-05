import { useEldercare } from '../../context/EldercareContext';

export default function AdminDeviceRegistry() {
  const { data } = useEldercare();
  const devices = data?.devices || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <header>
        <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-2">
          Admin Portal
        </span>
        <h1 className="text-3xl font-bold text-slate-900">Platform Device Registry</h1>
        <p className="text-sm text-slate-500 mt-1">System-wide device hardware status, connectivity, and firmware administration.</p>
      </header>

      <div className="rounded-3xl bg-white p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Registered Platform Hardware</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
            {devices.length} Registered Devices
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
          <strong>Security Notice:</strong> Device administration manages connection status and firmware. Raw camera feeds are restricted to authorized Caregivers and Elders.
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {devices.map((dev) => (
            <div key={dev.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 capitalize text-sm">{dev.source.replace('_', ' ')}</span>
                <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold uppercase">
                  {dev.status}
                </span>
              </div>
              <div className="text-xs text-slate-500 space-y-1">
                <p>Status: {dev.connected ? 'Connected' : 'Offline'}</p>
                <p>Notes: {dev.notes || 'Normal Operation'}</p>
                <p>Last Synced: {dev.lastSyncedAt ? new Date(dev.lastSyncedAt).toLocaleTimeString() : 'N/A'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
