import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useEldercare } from '../../context/EldercareContext';
import { getLinkedEldersForCaregiver } from '../../services/relationshipService';
import type { AppUserProfile } from '../../types/auth';

export default function CaregiverEmergency() {
  const { profile } = useAuth();
  const { data } = useEldercare();
  const [linkedElders, setLinkedElders] = useState<AppUserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const safetyEvents = data?.safetyEvents || [];

  useEffect(() => {
    async function loadElders() {
      if (profile) {
        try {
          const elders = await getLinkedEldersForCaregiver(profile);
          setLinkedElders(elders);
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
      <header>
        <span className="inline-block rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-rose-700 mb-2">
          Caregiver Portal
        </span>
        <h1 className="text-3xl font-bold text-slate-900">Caregiver Emergency Response</h1>
        <p className="text-sm text-slate-500 mt-1">Real-time emergency events and fall alerts for your linked elders.</p>
      </header>

      {loading ? (
        <div className="py-12 text-center text-sm text-slate-400">Loading emergency events...</div>
      ) : linkedElders.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center space-y-3 shadow-sm">
          <span className="material-symbols-outlined text-5xl text-slate-300">emergency</span>
          <h3 className="text-base font-semibold text-slate-700">No Connected Elders</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            You must connect to an Elder using their Elder ID to receive emergency alerts.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-rose-600">notifications_active</span>
              Active Incident Response Center
            </h2>

            {safetyEvents.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl">
                No active emergencies or fall events detected for linked elders. System is stable.
              </div>
            ) : (
              <div className="space-y-4">
                {safetyEvents.map((evt) => (
                  <div key={evt.id} className="p-5 rounded-2xl border border-rose-200 bg-rose-50/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-rose-600 text-white font-bold px-3 py-0.5 text-xs uppercase">
                        CRITICAL ALERT
                      </span>
                      <span className="text-xs text-slate-500">{new Date(evt.occurredAt).toLocaleTimeString()}</span>
                    </div>

                    <div>
                      <h3 className="font-bold text-slate-900 text-base capitalize">{evt.type.replace('_', ' ')} Detected</h3>
                      <p className="text-xs text-slate-600 mt-1">Location: {evt.location} — {evt.note}</p>
                    </div>

                    <div className="pt-2 flex items-center gap-3">
                      <button className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-sm">
                        Acknowledge & Respond
                      </button>
                      <button className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs px-4 py-2 rounded-xl transition-all">
                        Escalate to 911
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
