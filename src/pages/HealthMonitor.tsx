import { useState } from 'react';
import { useEldercare } from '../context/EldercareContext';
import { useWatchManager } from '../hooks/useWatchManager';
import { useNavigate } from 'react-router-dom';
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
  const { watches } = useWatchManager();
  const navigate = useNavigate();
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

  const connectedWearable = watches.find(w => w.connectionStatus === 'connected');
  const syncingWearable   = !connectedWearable && watches.find(w => w.connectionStatus === 'syncing');
  const activeWearable    = connectedWearable ?? syncingWearable ?? null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-4xl font-bold text-slate-800">Health Monitor</h1>
        <p className="text-slate-500 mt-2">
          Real-time biometrics and historical health data for {data.profile.fullName}.
        </p>
      </header>

      {/* Device Connection Status */}
      {activeWearable ? (
        <div className={`border rounded-2xl p-4 flex items-center justify-between ${
          activeWearable.connectionStatus === 'connected'
            ? 'bg-emerald-50 border-emerald-100'
            : 'bg-amber-50 border-amber-100'
        }`}>
          <div className="flex items-center gap-4">
            <div className="relative flex h-3 w-3">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                activeWearable.connectionStatus === 'connected' ? 'bg-emerald-400' : 'bg-amber-400'
              }`} />
              <span className={`relative inline-flex rounded-full h-3 w-3 ${
                activeWearable.connectionStatus === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'
              }`} />
            </div>
            <div>
              <h3 className={`text-sm font-bold ${
                activeWearable.connectionStatus === 'connected' ? 'text-emerald-900' : 'text-amber-900'
              }`}>
                {activeWearable.watchName}
                {activeWearable.connectionStatus === 'syncing' ? ' — Syncing' : ' — Connected'}
              </h3>
              <p className={`text-xs ${
                activeWearable.connectionStatus === 'connected' ? 'text-emerald-700' : 'text-amber-700'
              }`}>
                Last seen: {activeWearable.lastSeen ? new Date(activeWearable.lastSeen).toLocaleTimeString() : 'Unknown'}
                {activeWearable.battery !== undefined ? ` • Battery: ${activeWearable.battery}%` : ''}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate('/devices')} className={`text-xs font-bold px-3 py-1.5 border rounded-lg ${
              activeWearable.connectionStatus === 'connected'
                ? 'text-emerald-700 hover:text-emerald-900 border-emerald-200'
                : 'text-amber-700 hover:text-amber-900 border-amber-200'
            }`}>View Details</button>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
              <span className="material-symbols-outlined text-slate-400">watch_off</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">No smart watch connected</h3>
              <p className="text-xs text-slate-500">Go to Device Management to add or manage smart watches.</p>
            </div>
          </div>
          <button onClick={() => navigate('/devices')} className="bg-indigo-600 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-indigo-700 shadow-sm transition-colors">
            Manage Watches
          </button>
        </div>
      )}

        <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[
            { id: 'heart_rate',    label: 'Heart Rate',      value: latestVitals.heartRate?.value,    unit: 'bpm',   icon: 'favorite',             color: 'text-rose-500'   },
            { id: 'spo2',          label: 'SpO₂',            value: latestVitals.spo2?.value,          unit: '%',     icon: 'bloodtype',            color: 'text-blue-500'   },
            { id: 'blood_pressure',label: 'Blood Pressure',  value: latestVitals.bloodPressure
              ? `${latestVitals.bloodPressure.value}/${latestVitals.bloodPressure.secondaryValue}`
              : undefined,                                                                               unit: 'mmHg',  icon: 'monitor_heart',        color: 'text-indigo-500' },
            { id: 'temperature',   label: 'Temperature',     value: undefined,                         unit: '°F',    icon: 'device_thermostat',    color: 'text-amber-500'  },
            { id: 'sleep_hours',   label: 'Sleep',           value: latestVitals.sleep?.value,         unit: 'h',     icon: 'dark_mode',            color: 'text-purple-500' },
            { id: 'steps',         label: 'Steps',           value: latestVitals.steps?.value,         unit: 'steps', icon: 'directions_walk',      color: 'text-emerald-500'},
            { id: 'calories',      label: 'Calories',        value: latestVitals.calories?.value,      unit: 'kcal',  icon: 'local_fire_department',color: 'text-orange-500' },
          ].map(({ id, label, value, unit, icon, color }) => {
            const hasDevice   = activeWearable !== null;
            const hasRealData = value !== undefined && value !== null;

            return (
              <div
                key={id}
                className={`rounded-3xl border ${
                  hasDevice ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-70'
                } p-6 shadow-sm flex flex-col justify-between`}
              >
                <div className="flex items-center justify-between">
                  <div className={`rounded-2xl bg-slate-50/50 p-3 ${hasDevice ? color : 'text-slate-400'}`}>
                    <span className="material-symbols-outlined text-2xl">{icon}</span>
                  </div>
                  {hasDevice && hasRealData && (
                    <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">TODAY</span>
                  )}
                </div>
                <div className="mt-4">
                  <div className="text-sm font-bold uppercase tracking-widest text-slate-400">{label}</div>
                  {hasDevice ? (
                    hasRealData ? (
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-4xl font-black text-slate-800">{value}</span>
                        <span className="text-sm font-bold text-slate-400">{unit}</span>
                      </div>
                    ) : (
                      <div className="mt-2">
                        <span className="text-3xl font-black text-slate-300">--</span>
                        <p className="text-xs text-slate-400 mt-1">Waiting for device</p>
                      </div>
                    )
                  ) : (
                    <div className="mt-2">
                      <span className="text-3xl font-black text-slate-300">--</span>
                      <p className="text-xs text-slate-400 mt-1">No watch connected</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
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
