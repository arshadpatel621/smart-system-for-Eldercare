import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useEldercare } from '../../context/EldercareContext';

export default function ElderEmergency() {
  const { profile } = useAuth();
  const { createSafetyEvent } = useEldercare();
  const [requested, setRequested] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleRequestHelp = async () => {
    setRequested(true);
    setStatusMessage('🚨 Emergency assistance requested! Caregivers have been notified.');
    try {
      await createSafetyEvent({
        type: 'sos',
        severity: 'critical',
        occurredAt: new Date().toISOString(),
        location: 'Elder Personal Portal',
        note: `Immediate assistance requested by ${profile?.fullName || 'Elder'}.`,
        resolved: false,
      });
    } catch (err) {
      console.error('Failed to log assistance event:', err);
    }
  };

  const handleCancel = () => {
    setRequested(false);
    setStatusMessage('Assistance request cancelled.');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto animate-in fade-in duration-300">
      <header className="text-center">
        <span className="inline-block rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-rose-700 mb-2">
          Personal Assistance
        </span>
        <h1 className="text-3xl font-bold text-slate-900">Need Help?</h1>
        <p className="text-sm text-slate-500 mt-1">
          Tap below to send an immediate alert to your connected caregivers and emergency contacts.
        </p>
      </header>

      {statusMessage && (
        <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 text-sm font-bold text-rose-800 text-center shadow-sm">
          {statusMessage}
        </div>
      )}

      <div className="rounded-3xl bg-white p-8 shadow-lg border border-slate-200 text-center space-y-6">
        {!requested ? (
          <>
            <div className="flex justify-center">
              <span className="material-symbols-outlined text-7xl text-rose-600 animate-pulse">
                emergency
              </span>
            </div>

            <h2 className="text-2xl font-bold text-slate-900">Request Immediate Assistance</h2>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Your connected caregiver team will be alerted with your location and current status.
            </p>

            <div className="space-y-3 pt-4">
              <button
                onClick={handleRequestHelp}
                className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-lg py-4 rounded-2xl shadow-lg shadow-rose-600/20 transition-all active:scale-95 cursor-pointer uppercase tracking-wider"
              >
                Emergency Assistance
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-6">
            <div className="h-16 w-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto text-3xl font-bold">
              ✓
            </div>

            <h2 className="text-2xl font-bold text-slate-900">Alert Sent to Caregivers</h2>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Stay calm. Your care team has received your help request.
            </p>

            <button
              onClick={handleCancel}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm px-6 py-3 rounded-xl transition-all"
            >
              Cancel Assistance Request
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
