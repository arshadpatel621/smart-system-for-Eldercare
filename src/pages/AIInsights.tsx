import { useEldercare } from '../context/EldercareContext';

export default function AIInsights() {
  const { data, recommendations, latestVitals, derivedAlerts, importWatchData } = useEldercare();

  if (!data || !latestVitals) {
    return <div className="text-slate-500">Loading AI insights...</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-4xl font-bold text-primary">AI Health Insights</h1>
          <p className="text-slate-500">
            Suggestions are generated from current vitals, medication adherence, and active safety alerts.
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

      <section className="rounded-3xl bg-gradient-to-br from-primary to-blue-900 p-8 text-white shadow-xl">
        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <div className="text-sm uppercase tracking-widest text-blue-100">Heart rate</div>
            <div className="mt-2 text-4xl font-black">{latestVitals.heartRate?.value ?? '--'} bpm</div>
          </div>
          <div>
            <div className="text-sm uppercase tracking-widest text-blue-100">SpO2</div>
            <div className="mt-2 text-4xl font-black">{latestVitals.spo2?.value ?? '--'}%</div>
          </div>
          <div>
            <div className="text-sm uppercase tracking-widest text-blue-100">Open alerts</div>
            <div className="mt-2 text-4xl font-black">{derivedAlerts.filter((alert) => !alert.acknowledged).length}</div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-primary">Generated suggestions</h2>
          <div className="mt-5 space-y-4">
            {recommendations.map((item) => (
              <div key={item.id} className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-lg font-bold text-slate-800">{item.title}</div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold uppercase text-slate-500">{item.priority}</span>
                </div>
                <p className="mt-2 text-sm text-slate-500">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-primary">Connected devices</h2>
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
