import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useEldercare } from '../../context/EldercareContext';
import { useWatchManager } from '../../hooks/useWatchManager';
import { getLinkedEldersForCaregiver } from '../../services/relationshipService';
import type { AppUserProfile } from '../../types/auth';
import type { MetricType } from '../../types/eldercare';

type ManualMetricType = Extract<MetricType, 'heart_rate' | 'spo2' | 'sleep_hours'>;

const metricDetails: Record<ManualMetricType, { label: string; unit: string; min: number; max: number }> = {
  heart_rate: { label: 'Heart rate', unit: 'bpm', min: 20, max: 250 },
  spo2: { label: 'Blood oxygen (SpO₂)', unit: '%', min: 50, max: 100 },
  sleep_hours: { label: 'Night sleep', unit: 'hours', min: 0, max: 24 },
};

const initialForm = { type: 'heart_rate' as ManualMetricType, value: '', note: '' };

export default function CaregiverHealth() {
  const { profile } = useAuth();
  const { data, latestVitals, activeElderId, error, createMetric, setActiveElderId } = useEldercare();

  const [linkedElders, setLinkedElders] = useState<AppUserProfile[]>([]);
  const [selectedElderId, setSelectedElderId] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const { watches, loading: watchesLoading, error: watchesError } = useWatchManager(selectedElderId);

  useEffect(() => {
    let active = true;

    async function loadElders() {
      if (!profile) {
        setLoading(false);
        return;
      }

      try {
        const elders = await getLinkedEldersForCaregiver(profile);
        if (!active) return;
        setLinkedElders(elders);
        const firstId = elders[0]?.elderId || '';
        setSelectedElderId(firstId);
        setActiveElderId(firstId || null);
      } catch {
        if (active) setLoadError('Unable to load connected elders. Please try again later.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadElders();
    return () => {
      active = false;
    };
  }, [profile, setActiveElderId]);

  const selectedElder = linkedElders.find((elder) => elder.elderId === selectedElderId);
  const connectedWearable = watches.find((watch) => watch.connectionStatus === 'connected') ?? null;
  const syncingWearable = connectedWearable
    ? null
    : watches.find((watch) => watch.connectionStatus === 'syncing') ?? null;
  const activeWearable = connectedWearable ?? syncingWearable ?? null;
  const elderDataIsReady = Boolean(
    selectedElderId && activeElderId === selectedElderId && data?.profile.id === selectedElderId,
  );
  const selectedMetric = metricDetails[form.type];

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = Number(form.value);

    if (!selectedElderId || !elderDataIsReady) {
      setSaveError('Wait for this elder’s health records to finish loading before saving.');
      return;
    }
    if (!Number.isFinite(value) || value < selectedMetric.min || value > selectedMetric.max) {
      setSaveError(
        `Enter ${selectedMetric.label.toLowerCase()} from ${selectedMetric.min} to ${selectedMetric.max} ${selectedMetric.unit}.`,
      );
      return;
    }

    setSaving(true);
    setSaveError('');
    setSaveMessage('');
    const saved = await createMetric({
      type: form.type,
      value,
      unit: selectedMetric.unit,
      source: 'manual',
      note: form.note.trim() || undefined,
      recordedAt: new Date().toISOString(),
    });
    setSaving(false);

    if (saved) {
      setSaveMessage(`${selectedMetric.label} saved to ${selectedElder?.fullName || 'this elder'}’s health records.`);
      setForm(initialForm);
    } else {
      setSaveError('The reading could not be saved. Check the message below and try again.');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="mb-2 inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700">
            Caregiver Portal
          </span>
          <h1 className="text-3xl font-bold text-slate-900">Health Monitor</h1>
          <p className="mt-1 text-sm text-slate-500">
            Review the latest recorded readings and log measurements for a connected elder.
          </p>
        </div>

        {linkedElders.length > 0 && (
          <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
            <span className="pl-2 text-xs font-bold text-slate-500">Select elder</span>
            <select
              aria-label="Select elder"
              value={selectedElderId}
              disabled={saving}
              onChange={(event) => {
                const elderId = event.target.value;
                setSelectedElderId(elderId);
                setActiveElderId(elderId || null);
                setForm(initialForm);
                setSaveMessage('');
                setSaveError('');
              }}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
            >
              {linkedElders.map((elder) => (
                <option key={elder.uid} value={elder.elderId || ''}>
                  {elder.fullName}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>

      {loading ? (
        <div className="py-12 text-center text-sm text-slate-500" role="status">Loading connected elders…</div>
      ) : loadError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800" role="alert">
          {loadError}
        </div>
      ) : linkedElders.length === 0 ? (
        <div className="space-y-3 rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-sm">
          <span className="material-symbols-outlined text-5xl text-slate-300">monitor_heart</span>
          <h2 className="text-base font-semibold text-slate-700">No connected elders</h2>
          <p className="mx-auto max-w-md text-sm text-slate-500">
            Connect with an elder before reviewing or recording their health readings.
          </p>
        </div>
      ) : !elderDataIsReady ? (
        <div className="py-12 text-center text-sm text-slate-500" role="status">
          Loading health records for {selectedElder?.fullName || 'the selected elder'}…
        </div>
      ) : (
        <div className="space-y-6">
          <section className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{selectedElder?.fullName || 'Resident'}</h2>
              <p className="mt-1 font-mono text-xs text-slate-500">Elder ID: {selectedElderId}</p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800">
              <span className="material-symbols-outlined text-base">edit_note</span>
              Manual readings are not live watch data
            </span>
          </section>

          <section
            aria-label="Watch connection status"
            className={`flex items-center gap-3 rounded-2xl border p-4 ${
              activeWearable?.connectionStatus === 'connected'
                ? 'border-emerald-200 bg-emerald-50'
                : activeWearable?.connectionStatus === 'syncing'
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-slate-200 bg-slate-50'
            }`}
          >
            <span className={`material-symbols-outlined ${
              activeWearable?.connectionStatus === 'connected'
                ? 'text-emerald-700'
                : activeWearable?.connectionStatus === 'syncing'
                  ? 'text-amber-700'
                  : 'text-slate-500'
            }`}>
              {watchesLoading ? 'hourglass_top' : activeWearable ? 'watch' : watchesError ? 'error' : 'watch_off'}
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                {watchesLoading
                  ? 'Checking watch connection…'
                  : watchesError
                    ? 'Watch status unavailable'
                    : activeWearable
                      ? `${activeWearable.watchName} — ${activeWearable.connectionStatus === 'syncing' ? 'Syncing' : 'Connected'}`
                      : 'No smart watch connected'}
              </h2>
              <p className="mt-0.5 text-xs text-slate-600">
                {activeWearable?.lastSeen
                  ? `Last seen ${new Date(activeWearable.lastSeen).toLocaleString()}. Manual readings below remain separately labeled.`
                  : 'Manual readings below are saved separately and are never represented as watch-streamed data.'}
              </p>
            </div>
          </section>

          <section aria-label="Latest recorded vitals" className="grid gap-4 sm:grid-cols-3">
            {([
              { type: 'heart_rate', metric: latestVitals?.heartRate },
              { type: 'spo2', metric: latestVitals?.spo2 },
              { type: 'sleep_hours', metric: latestVitals?.sleep },
            ] as const).map(({ type, metric }) => {
              const details = metricDetails[type];
              return (
                <article key={type} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{details.label}</div>
                  {metric ? (
                    <>
                      <p className="mt-2 text-3xl font-bold text-slate-900">
                        {metric.value} <span className="text-sm font-medium text-slate-500">{details.unit}</span>
                      </p>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                        <span className={`rounded-md px-2 py-1 font-semibold ${
                          metric.source === 'watch'
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {metric.source === 'watch' ? 'Watch reading' : metric.source === 'manual' ? 'Manual entry' : 'Recorded reading'}
                        </span>
                        <time dateTime={metric.recordedAt}>{new Date(metric.recordedAt).toLocaleString()}</time>
                      </div>
                    </>
                  ) : (
                    <p className="mt-2 text-2xl font-semibold text-slate-300">—</p>
                  )}
                </article>
              );
            })}
          </section>

          <form
            className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            onSubmit={(event) => void handleSubmit(event)}
          >
            <div>
              <h2 className="text-xl font-bold text-slate-900">Record a health reading</h2>
              <p className="mt-1 text-sm text-slate-500">
                Choose a measurement and enter the value you observed for {selectedElder?.fullName || 'this elder'}.
                It will be saved to this elder&apos;s health history as manual data.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm font-semibold text-slate-700">
                <span>Measurement</span>
                <select
                  value={form.type}
                  disabled={saving}
                  onChange={(event) => {
                    setForm({ ...form, type: event.target.value as ManualMetricType });
                    setSaveError('');
                    setSaveMessage('');
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                >
                  {Object.entries(metricDetails).map(([type, details]) => (
                    <option key={type} value={type}>{details.label}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5 text-sm font-semibold text-slate-700">
                <span>Value ({selectedMetric.unit})</span>
                <input
                  required
                  type="number"
                  inputMode="decimal"
                  min={selectedMetric.min}
                  max={selectedMetric.max}
                  step={form.type === 'sleep_hours' ? '0.1' : '1'}
                  value={form.value}
                  disabled={saving}
                  onChange={(event) => {
                    setForm({ ...form, value: event.target.value });
                    setSaveError('');
                    setSaveMessage('');
                  }}
                  placeholder={`Enter ${selectedMetric.label.toLowerCase()}`}
                  className="w-full rounded-xl border border-slate-300 px-3 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                />
              </label>
            </div>

            <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
              <span>Note <span className="font-normal text-slate-500">(optional)</span></span>
              <textarea
                rows={2}
                value={form.note}
                disabled={saving}
                onChange={(event) => setForm({ ...form, note: event.target.value })}
                placeholder="Add context, such as when it was measured"
                className="w-full resize-y rounded-xl border border-slate-300 px-3 py-3 font-normal focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
              />
            </label>

            <p className="text-xs text-slate-500">
              Allowed range: {selectedMetric.min}–{selectedMetric.max} {selectedMetric.unit}. This entry will be marked manual and will not appear as a watch-streamed measurement.
            </p>

            {saveError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
                {saveError}{error ? ` ${error}` : ''}
              </div>
            )}
            {saveMessage && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status" aria-live="polite">
                {saveMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={saving || !elderDataIsReady}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 font-bold text-white transition-colors hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto"
            >
              <span className="material-symbols-outlined text-lg">{saving ? 'hourglass_top' : 'save'}</span>
              {saving ? 'Saving reading…' : 'Save manual reading'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
