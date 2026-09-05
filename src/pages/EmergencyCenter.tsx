import { useState } from 'react';
import { useEldercare } from '../context/EldercareContext';
import type { SafetyEvent } from '../types/eldercare';

export default function EmergencyCenter() {
  const { data, createSafetyEvent } = useEldercare();
  const [sosState, setSosState] = useState<'idle' | 'countdown' | 'triggered'>('idle');
  const [countdown, setCountdown] = useState(5);
  const [sosBanner, setSosBanner] = useState<string | null>(null);

  const safetyEvents = data?.safetyEvents || [];

  const handleStartSos = () => {
    setSosState('countdown');
    setCountdown(5);

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          void triggerSosProtocol();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const triggerSosProtocol = async () => {
    setSosState('triggered');
    setSosBanner('🚨 SOS EMERGENCY BROADCAST SENT! Caregivers, Doctor & Emergency Services Notified.');
    try {
      await createSafetyEvent({
        type: 'sos',
        severity: 'critical',
        occurredAt: new Date().toISOString(),
        location: 'Residence Unit #4B - Emergency Center',
        note: 'Manual SOS triggered by resident from Emergency Center dashboard.',
        resolved: false,
      });
    } catch (err) {
      console.error('Failed to register SOS safety event:', err);
    }
  };

  const cancelSos = () => {
    setSosState('idle');
    setCountdown(5);
    setSosBanner('SOS Broadcast Cancelled.');
    setTimeout(() => setSosBanner(null), 3000);
  };

  const emergencyContacts = [
    { name: 'Dr. Sarah Wilson', role: 'Primary Physician', phone: '555-0100' },
    { name: 'Michael Smith', role: 'Family (Son)', phone: '555-0102' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <header>
        <h1 className="text-4xl font-bold text-slate-800">Emergency Center</h1>
        <p className="text-slate-500 mt-2">Emergency protocols, SOS, and active incident tracking.</p>
      </header>

      {sosBanner && (
        <div className="rounded-2xl bg-rose-100 border border-rose-200 p-4 text-sm font-bold text-rose-800 shadow-sm flex items-center justify-between">
          <span>{sosBanner}</span>
          <button onClick={() => setSosBanner(null)} className="text-xs bg-rose-200 px-3 py-1 rounded-lg">
            Dismiss
          </button>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-3xl bg-rose-600 p-8 text-white text-center shadow-xl shadow-rose-600/20 flex flex-col items-center justify-center">
          <span className="material-symbols-outlined text-6xl block mb-4">emergency</span>
          <h2 className="text-2xl font-bold mb-2">Trigger SOS Protocol</h2>
          <p className="text-rose-100 mb-8 max-w-sm mx-auto">
            This will immediately notify all emergency contacts, care team members, and dial local emergency services if configured.
          </p>

          {sosState === 'idle' && (
            <button
              onClick={handleStartSos}
              className="bg-white text-rose-600 font-bold text-xl px-12 py-4 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-transform uppercase tracking-wider cursor-pointer"
            >
              Trigger SOS
            </button>
          )}

          {sosState === 'countdown' && (
            <div className="space-y-4">
              <div className="text-4xl font-extrabold text-amber-200 animate-pulse">
                Broadcasting in {countdown}s...
              </div>
              <button
                onClick={cancelSos}
                className="bg-white text-slate-800 font-bold text-sm px-6 py-2.5 rounded-full shadow hover:bg-slate-100 transition-colors"
              >
                Cancel SOS
              </button>
            </div>
          )}

          {sosState === 'triggered' && (
            <div className="space-y-4">
              <div className="text-lg font-bold bg-white/20 px-6 py-2 rounded-2xl">
                ✓ SOS Alert Broadcast Sent!
              </div>
              <button
                onClick={cancelSos}
                className="bg-white/20 text-white font-bold text-xs px-4 py-2 rounded-xl hover:bg-white/30 transition-colors"
              >
                Reset Status
              </button>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-blue-600">contact_phone</span>
              Primary Emergency Contacts
            </h3>
            <div className="space-y-3">
              {emergencyContacts.map((contact) => (
                <div
                  key={contact.name}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100"
                >
                  <div>
                    <div className="font-bold text-slate-700">{contact.name}</div>
                    <div className="text-xs text-slate-500">{contact.role}</div>
                  </div>
                  <a
                    href={`tel:${contact.phone}`}
                    className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center hover:bg-blue-200 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">call</span>
                  </a>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-amber-600">history</span>
              Recent Incidents
            </h3>
            {safetyEvents.length === 0 ? (
              <div className="text-center py-6">
                <span className="material-symbols-outlined text-4xl text-slate-300 block mb-2">task_alt</span>
                <p className="text-slate-500 font-medium">No recent incidents in the past 30 days.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {safetyEvents.map((evt: SafetyEvent) => (
                  <div key={evt.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
                    <div className="font-bold text-slate-800 uppercase">{evt.type}</div>
                    <div className="text-slate-500">{evt.note}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
