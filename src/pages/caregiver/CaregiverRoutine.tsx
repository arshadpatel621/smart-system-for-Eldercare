import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useEldercare } from '../../context/EldercareContext';
import { getLinkedEldersForCaregiver } from '../../services/relationshipService';
import type { AppUserProfile } from '../../types/auth';

export default function CaregiverRoutine() {
  const { profile } = useAuth();
  const { data } = useEldercare();
  const [linkedElders, setLinkedElders] = useState<AppUserProfile[]>([]);
  const [selectedElderId, setSelectedElderId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const medications = data?.medications || [];

  useEffect(() => {
    async function loadElders() {
      if (profile) {
        try {
          const elders = await getLinkedEldersForCaregiver(profile);
          setLinkedElders(elders);
          if (elders.length > 0) {
            setSelectedElderId(elders[0].elderId || '');
          }
        } catch (err) {
          console.error('Failed to load linked elders:', err);
        } finally {
          setLoading(false);
        }
      }
    }
    void loadElders();
  }, [profile]);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700 mb-2">
            Caregiver Portal
          </span>
          <h1 className="text-3xl font-bold text-slate-900">Elder Routine & Medications</h1>
          <p className="text-sm text-slate-500 mt-1">Review and manage daily prescription schedules for linked elders.</p>
        </div>

        {/* Elder Selector */}
        <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-500 pl-2">Select Elder:</span>
          <select
            value={selectedElderId}
            onChange={(e) => setSelectedElderId(e.target.value)}
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
        <div className="py-12 text-center text-sm text-slate-400">Loading routine...</div>
      ) : linkedElders.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center space-y-3 shadow-sm">
          <span className="material-symbols-outlined text-5xl text-slate-300">event_repeat</span>
          <h3 className="text-base font-semibold text-slate-700">No Connected Elders</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Connect to an Elder using their Elder ID to manage their prescription schedule.
          </p>
        </div>
      ) : (
        <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200 space-y-6">
          <h2 className="text-xl font-bold text-slate-900">Scheduled Medications & Activities</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            {medications.map((med) => (
              <div key={med.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-base">{med.name}</h3>
                  <span className="rounded-full bg-blue-100 text-blue-700 px-2.5 py-0.5 text-[10px] font-bold">
                    Active Prescription
                  </span>
                </div>
                <p className="text-xs text-slate-600">Dosage: {med.dosage}</p>
                <p className="text-xs text-slate-500">Scheduled: {med.schedule.join(', ')}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
