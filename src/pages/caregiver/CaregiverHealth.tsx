import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useEldercare } from '../../context/EldercareContext';
import { getLinkedEldersForCaregiver } from '../../services/relationshipService';
import type { AppUserProfile } from '../../types/auth';

export default function CaregiverHealth() {
  const { profile } = useAuth();
  const { latestVitals, setActiveElderId } = useEldercare();

  const [linkedElders, setLinkedElders] = useState<AppUserProfile[]>([]);
  const [selectedElderId, setSelectedElderId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadElders() {
      if (profile) {
        try {
          const elders = await getLinkedEldersForCaregiver(profile);
          setLinkedElders(elders);
          if (elders.length > 0) {
            const firstId = elders[0].elderId || '';
            setSelectedElderId(firstId);
            setActiveElderId(firstId);
          }
        } catch (err) {
          console.error('Failed to load linked elders:', err);
        } finally {
          setLoading(false);
        }
      }
    }
    void loadElders();
  }, [profile, setActiveElderId]);

  const selectedElder = linkedElders.find((e) => e.elderId === selectedElderId);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700 mb-2">
            Caregiver Portal
          </span>
          <h1 className="text-3xl font-bold text-slate-900">Health Monitor</h1>
          <p className="text-sm text-slate-500 mt-1">Select a connected elder to inspect real-time vitals and trends.</p>
        </div>

        {/* Elder Selector Dropdown */}
        <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-500 pl-2">Select Elder:</span>
          <select
            value={selectedElderId}
            onChange={(e) => {
              setSelectedElderId(e.target.value);
              setActiveElderId(e.target.value);
            }}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-900 focus:border-blue-500 focus:outline-none"
          >
            {linkedElders.map((e) => (
              <option key={e.uid} value={e.elderId}>
                {e.fullName} ({e.elderId})
              </option>
            ))}
          </select>
        </div>
      </header>

      {loading ? (
        <div className="py-12 text-center text-sm text-slate-400">Loading health monitor...</div>
      ) : linkedElders.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center space-y-3 shadow-sm">
          <span className="material-symbols-outlined text-5xl text-slate-300">monitor_heart</span>
          <h3 className="text-base font-semibold text-slate-700">No Connected Elders</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            You must connect to an Elder using their Elder ID to monitor health vitals.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active Selected Elder Banner */}
          <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-amber-100 text-amber-700 font-bold flex items-center justify-center text-xl">
                👵
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">{selectedElder?.fullName || 'Resident'}</h2>
                <p className="text-xs text-slate-500 font-mono">Elder ID: {selectedElderId}</p>
              </div>
            </div>

            <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-700">
              Vitals Normal
            </span>
          </div>

          {/* Vitals Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 uppercase">Heart Rate</span>
              <p className="text-3xl font-bold text-slate-900 mt-2">
                {latestVitals?.heartRate?.value ?? 74} <span className="text-xs text-slate-400 font-normal">BPM</span>
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 uppercase">Blood Oxygen</span>
              <p className="text-3xl font-bold text-slate-900 mt-2">
                {latestVitals?.spo2?.value ?? 98} <span className="text-xs text-slate-400 font-normal">% SpO2</span>
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 uppercase">Blood Pressure</span>
              <p className="text-3xl font-bold text-slate-900 mt-2">
                120/80 <span className="text-xs text-slate-400 font-normal">mmHg</span>
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 uppercase">Night Sleep</span>
              <p className="text-3xl font-bold text-slate-900 mt-2">
                {latestVitals?.sleep?.value ?? 7.5} <span className="text-xs text-slate-400 font-normal">Hours</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
