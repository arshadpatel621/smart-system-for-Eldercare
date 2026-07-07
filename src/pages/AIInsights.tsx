import { useEldercare } from '../context/EldercareContext';

export default function AIInsights() {
  const { data, recommendations, latestVitals, importWatchData } = useEldercare();

  if (!data || !latestVitals) {
    return <div className="text-slate-500">Loading AI insights...</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-4xl font-bold text-slate-800">AI Intelligence Center</h1>
          <p className="text-slate-500 mt-2">
            Predictive modeling and generative suggestions based on resident data streams.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="text-sm font-bold uppercase tracking-widest text-slate-400">Watch import</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={() => void importWatchData('fitbit')} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white">Fitbit sample</button>
            <button onClick={() => void importWatchData('health_connect')} className="rounded-full bg-secondary px-4 py-2 text-sm font-bold text-white">Health Connect</button>
            <button onClick={() => void importWatchData('apple_health')} className="rounded-full bg-blue-700 px-4 py-2 text-sm font-bold text-white">Apple Health</button>
          </div>
        </div>
      </header>

      <section className="grid gap-6 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm border-t-4 border-t-amber-400">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-amber-500">warning</span>
            <h3 className="font-bold text-slate-800">Predictive Fall Risk</h3>
          </div>
          <div className="mt-4 flex items-end gap-2">
            <div className="text-4xl font-black text-amber-500">12%</div>
            <div className="text-sm font-bold text-slate-400 mb-1">ELEVATED</div>
          </div>
          <p className="text-sm text-slate-500 mt-3">Slight gait instability detected during morning routine. Recommend reviewing physical therapy exercises.</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm border-t-4 border-t-emerald-400">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-emerald-500">bedtime</span>
            <h3 className="font-bold text-slate-800">Sleep Pattern Anomaly</h3>
          </div>
          <div className="mt-4 flex items-end gap-2">
            <div className="text-4xl font-black text-emerald-500">0%</div>
            <div className="text-sm font-bold text-slate-400 mb-1">NORMAL</div>
          </div>
          <p className="text-sm text-slate-500 mt-3">Sleep cycles are consistent. Deep sleep ratio is optimal for the past 72 hours.</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm border-t-4 border-t-blue-400">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-blue-500">route</span>
            <h3 className="font-bold text-slate-800">Routine Deviation</h3>
          </div>
          <div className="mt-4 flex items-end gap-2">
            <div className="text-4xl font-black text-blue-500">-30m</div>
            <div className="text-sm font-bold text-slate-400 mb-1">EARLY</div>
          </div>
          <p className="text-sm text-slate-500 mt-3">Resident woke up 30 minutes earlier than usual today. No action required.</p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-800">AI Care Suggestions</h2>
          <div className="mt-5 space-y-4">
            {recommendations.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-lg font-bold text-slate-800">{item.title}</div>
                  <span className="rounded-md bg-blue-100 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-blue-700">{item.priority}</span>
                </div>
                <p className="mt-2 text-sm text-slate-500">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-800">Connected devices</h2>
          <div className="mt-5 space-y-3">
            {data.devices.map((device) => (
              <div key={device.id} className="rounded-2xl bg-slate-50 p-4">
                <div className="font-bold capitalize text-slate-800">{device.source.replace('_', ' ')}</div>
                <div className="text-sm text-slate-500">
                  {device.connected ? 'Connected' : 'Disconnected'} • {device.lastSyncedAt ? new Date(device.lastSyncedAt).toLocaleString() : 'No sync yet'}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
