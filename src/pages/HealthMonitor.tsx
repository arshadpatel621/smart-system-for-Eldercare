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
        <h1 className="text-4xl font-bold text-primary">Health Monitor</h1>
        <p className="text-slate-500">
          Manual entry and smartwatch data are stored as health metric documents for {data.profile.fullName}.
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <section className="grid gap-6 md:grid-cols-2">
          {[
            ['Blood oxygen', latestVitals.spo2?.value, '%', 'bloodtype'],
            ['Heart rate', latestVitals.heartRate?.value, 'bpm', 'favorite'],
            ['Blood pressure', latestVitals.bloodPressure ? `${latestVitals.bloodPressure.value}/${latestVitals.bloodPressure.secondaryValue}` : '--', 'mmHg', 'monitor_heart'],
            ['Hydration', latestVitals.hydration?.value, 'liters', 'water_drop'],
            ['Sleep', latestVitals.sleep?.value, 'hours', 'dark_mode'],
            ['Weight', latestVitals.weight?.value, 'kg', 'scale'],
          ].map(([label, value, unit, icon]) => (
            <div key={label} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold uppercase tracking-widest text-slate-400">{label}</div>
                  <div className="mt-2 text-4xl font-black text-primary">{value ?? '--'}</div>
                  <div className="mt-1 text-sm text-slate-500">{unit}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 text-primary">
                  <span className="material-symbols-outlined text-3xl">{icon}</span>
                </div>
              </div>
            </div>
          ))}
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
      </div>

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
