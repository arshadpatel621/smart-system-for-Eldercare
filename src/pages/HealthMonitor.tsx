import { useState } from 'react';
import { useEldercare } from '../context/EldercareContext';
import type { MetricType } from '../types/eldercare';

const metricUnitMap: Record<MetricType, string> = {
  heart_rate: 'bpm',
  spo2: '%',
  blood_pressure: 'mmHg',
  sleep_hours: 'hours',
  steps: 'steps',
  weight: 'kg',
  hydration: 'liters',
  calories: 'kcal',
  mood: '/5',
};

export default function HealthMonitor() {
  const { data, latestVitals, createMetric } = useEldercare();
  const [form, setForm] = useState({
    type: 'blood_pressure' as MetricType,
    value: '',
    secondaryValue: '',
    note: '',
    source: 'manual' as const,
  });

  if (!data || !latestVitals) {
    return <div className="text-slate-500">Loading health monitor...</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-4xl font-bold text-slate-800">Health Monitor</h1>
        <p className="text-slate-500 mt-2">
          Real-time biometrics and historical health data for {data.profile.fullName}.
        </p>
      </header>

      {/* Device Connection Status */}
      <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center gap-4">
        <div className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
        </div>
        <div>
          <h3 className="text-sm font-bold text-emerald-900">Apple Watch Series 9 Connected</h3>
          <p className="text-xs text-emerald-700">Last synced: Just now • Battery: 84%</p>
        </div>
      </div>

        <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[
            ['Heart rate', latestVitals.heartRate?.value, 'bpm', 'favorite', 'text-rose-500'],
            ['SpO₂', latestVitals.spo2?.value, '%', 'bloodtype', 'text-blue-500'],
            ['Blood pressure', latestVitals.bloodPressure ? `${latestVitals.bloodPressure.value}/${latestVitals.bloodPressure.secondaryValue}` : '--', 'mmHg', 'monitor_heart', 'text-indigo-500'],
            ['Temperature', '--', '°F', 'device_thermostat', 'text-amber-500'],
            ['Sleep', latestVitals.sleep?.value, 'hours', 'dark_mode', 'text-purple-500'],
            ['Steps', latestVitals.steps?.value, 'steps', 'directions_walk', 'text-emerald-500'],
          ].map(([label, value, unit, icon, color]) => (
            <div key={label as string} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className={`rounded-2xl bg-slate-50 p-3 ${color as string}`}>
                  <span className="material-symbols-outlined text-2xl">{icon as string}</span>
                </div>
                <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md">TODAY</span>
              </div>
              <div className="mt-4">
                <div className="text-sm font-bold uppercase tracking-widest text-slate-400">{label as string}</div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-4xl font-black text-slate-800">{value ?? '--'}</span>
                  <span className="text-sm font-bold text-slate-400">{unit as string}</span>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Historical Charts Placeholder */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-800">Health Trends</h2>
            <select className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-600">
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
              <option>This Year</option>
            </select>
          </div>
          <div className="h-64 w-full bg-slate-50 rounded-2xl border border-slate-100 flex items-end px-4 pt-8 pb-4 gap-2 relative">
             <div className="absolute top-4 left-4 flex gap-4 text-xs font-bold text-slate-400">
               <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-rose-400"></div>Heart Rate</div>
               <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-400"></div>SpO₂</div>
             </div>
             {/* Mock Chart Bars */}
             {[60, 45, 80, 50, 90, 70, 65, 55, 75, 40, 85, 60].map((h, i) => (
                <div key={i} className="flex-1 flex gap-1 items-end h-full">
                   <div className="w-full bg-rose-400/80 rounded-t-sm transition-all hover:bg-rose-500" style={{ height: `${h}%` }}></div>
                   <div className="w-full bg-blue-400/80 rounded-t-sm transition-all hover:bg-blue-500" style={{ height: `${(h + 20) > 100 ? 95 : h + 20}%` }}></div>
                </div>
             ))}
          </div>
        </section>

        <form
          className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            void createMetric({
              type: form.type,
              value: Number(form.value),
              secondaryValue: form.secondaryValue ? Number(form.secondaryValue) : undefined,
              unit: metricUnitMap[form.type],
              source: form.source,
              note: form.note,
              recordedAt: new Date().toISOString(),
            });
            setForm({ type: 'blood_pressure', value: '', secondaryValue: '', note: '', source: 'manual' });
          }}
        >
          <h2 className="text-2xl font-bold text-primary">Manual health entry</h2>
          <select
            className="w-full rounded-xl border border-slate-200 px-4 py-3"
            value={form.type}
            onChange={(event) => setForm({ ...form, type: event.target.value as MetricType })}
          >
            <option value="blood_pressure">Blood pressure</option>
            <option value="heart_rate">Heart rate</option>
            <option value="spo2">SpO2</option>
            <option value="weight">Weight</option>
            <option value="hydration">Hydration</option>
            <option value="calories">Calories</option>
            <option value="mood">Mood</option>
          </select>
          <input
            className="w-full rounded-xl border border-slate-200 px-4 py-3"
            type="number"
            placeholder="Primary value"
            value={form.value}
            onChange={(event) => setForm({ ...form, value: event.target.value })}
          />
          {form.type === 'blood_pressure' ? (
            <input
              className="w-full rounded-xl border border-slate-200 px-4 py-3"
              type="number"
              placeholder="Diastolic value"
              value={form.secondaryValue}
              onChange={(event) => setForm({ ...form, secondaryValue: event.target.value })}
            />
          ) : null}
          <textarea
            className="min-h-24 w-full rounded-xl border border-slate-200 px-4 py-3"
            placeholder="Symptoms or note"
            value={form.note}
            onChange={(event) => setForm({ ...form, note: event.target.value })}
          />
          <button className="w-full rounded-xl bg-primary px-4 py-3 font-bold text-white">
            Save metric
          </button>
        </form>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-primary">Recent health records</h2>
        <div className="mt-5 space-y-3">
          {data.metrics
            .slice()
            .sort((left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime())
            .slice(0, 10)
            .map((metric) => (
              <div key={metric.id} className="grid gap-2 rounded-2xl bg-slate-50 p-4 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
                <div>
                  <div className="font-bold capitalize text-slate-800">{metric.type.replace('_', ' ')}</div>
                  <div className="text-sm text-slate-500">{metric.note || 'No additional note'}</div>
                </div>
                <div className="text-sm font-bold text-slate-700">
                  {metric.value}
                  {metric.secondaryValue ? `/${metric.secondaryValue}` : ''} {metric.unit}
                </div>
                <div className="text-sm capitalize text-slate-500">{metric.source}</div>
                <div className="text-sm text-slate-500">{new Date(metric.recordedAt).toLocaleString()}</div>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}
