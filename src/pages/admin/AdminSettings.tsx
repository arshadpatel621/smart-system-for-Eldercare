export default function AdminSettings() {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <header>
        <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-2">
          Admin Portal
        </span>
        <h1 className="text-3xl font-bold text-slate-900">System Platform Configuration</h1>
        <p className="text-sm text-slate-500 mt-1">Platform defaults, notification gateways, and system-wide settings.</p>
      </header>

      <div className="rounded-3xl bg-white p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
        <h2 className="text-xl font-bold text-slate-900">Platform Settings</h2>

        <div className="space-y-4 max-w-xl text-xs text-slate-700">
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-1">
            <span className="font-bold text-slate-900 text-sm">Emergency Dispatch Threshold</span>
            <p className="text-slate-500">Automatically escalate critical fall events to emergency contacts after 5 minutes.</p>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-1">
            <span className="font-bold text-slate-900 text-sm">Notification Push Gateways</span>
            <p className="text-slate-500">Web push notifications enabled for high-severity safety alerts.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
