import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ElderIdCard from '../../components/common/ElderIdCard';
import { useAuth } from '../../context/AuthContext';
import { useEldercare } from '../../context/EldercareContext';
import { getLinkedCaregiversForElder } from '../../services/relationshipService';
import type { AppUserProfile } from '../../types/auth';

export default function ElderDashboard() {
  const { profile } = useAuth();
  const { data, latestVitals, takeMedication } = useEldercare();
  const [caregivers, setCaregivers] = useState<AppUserProfile[]>([]);
  const [loadingCaregivers, setLoadingCaregivers] = useState(true);
  const [actingMedId, setActingMedId] = useState<string | null>(null);

  const medications = data?.medications || [];
  const medicationLogs = data?.medicationLogs || [];

  const isDemo = Boolean(profile?.uid?.startsWith('guest-') || profile?.uid === 'guest-user');
  const heartRate = latestVitals?.heartRate?.value ? `${latestVitals.heartRate.value}` : (isDemo ? '72' : '--');
  const spo2 = latestVitals?.spo2?.value ? `${latestVitals.spo2.value}` : (isDemo ? '98' : '--');
  const sleepHours = latestVitals?.sleep?.value ? `${latestVitals.sleep.value}` : (isDemo ? '7.5' : '--');
  const steps = latestVitals?.steps?.value ? `${latestVitals.steps.value}` : (isDemo ? '3420' : '--');

  useEffect(() => {
    async function loadCaregivers() {
      if (profile?.uid) {
        try {
          const linked = await getLinkedCaregiversForElder(profile.uid);
          setCaregivers(linked);
        } catch (err) {
          console.error('Failed to load linked caregivers:', err);
        } finally {
          setLoadingCaregivers(false);
        }
      }
    }
    void loadCaregivers();
  }, [profile?.uid]);

  const handleTakeMed = async (medId: string, scheduledFor: string) => {
    setActingMedId(medId);
    try {
      await takeMedication(medId, scheduledFor);
    } catch (err) {
      console.error('Failed to mark medication:', err);
    } finally {
      setActingMedId(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
        <div>
          <span className="inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700 mb-2">
            Elder Portal
          </span>
          <h1 className="text-3xl font-bold text-slate-900">
            Good Morning, {profile?.fullName || 'Resident'} 👋
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Here's your personal health overview and today's schedule.
          </p>
        </div>

        <Link
          to="/elder/emergency"
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 hover:bg-rose-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-rose-600/20 transition-all active:scale-95"
        >
          <span className="material-symbols-outlined text-lg">emergency</span> Emergency / Help
        </Link>
      </div>

      {/* Prominent Elder ID Card */}
      {profile?.elderId ? (
        <ElderIdCard elderId={profile.elderId} />
      ) : profile?.role === 'elder' ? (
        <div className="relative overflow-hidden rounded-3xl border border-blue-200 bg-blue-50/60 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 font-bold animate-pulse">
              <span className="material-symbols-outlined">badge</span>
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900">Your Shareable Elder ID</h3>
              <p className="text-xs text-slate-500">Setting up your secure Shareable Elder ID...</p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Today's Personal Health Summary */}
      <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-rose-500">favorite</span> Today's Health Summary
          </h2>
          <Link to="/elder/health" className="text-xs font-bold text-blue-600 hover:underline">
            View Full Vitals →
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-rose-50/50 p-4 border border-rose-100">
            <span className="text-xs font-semibold text-rose-700 uppercase">Heart Rate</span>
            <p className="text-2xl font-bold text-slate-900 mt-1">{heartRate} <span className="text-xs text-slate-500 font-normal">BPM</span></p>
          </div>

          <div className="rounded-2xl bg-blue-50/50 p-4 border border-blue-100">
            <span className="text-xs font-semibold text-blue-700 uppercase">Blood Oxygen</span>
            <p className="text-2xl font-bold text-slate-900 mt-1">{spo2} <span className="text-xs text-slate-500 font-normal">% SpO2</span></p>
          </div>

          <div className="rounded-2xl bg-indigo-50/50 p-4 border border-indigo-100">
            <span className="text-xs font-semibold text-indigo-700 uppercase">Night Sleep</span>
            <p className="text-2xl font-bold text-slate-900 mt-1">{sleepHours} <span className="text-xs text-slate-500 font-normal">Hours</span></p>
          </div>

          <div className="rounded-2xl bg-emerald-50/50 p-4 border border-emerald-100">
            <span className="text-xs font-semibold text-emerald-700 uppercase">Daily Activity</span>
            <p className="text-2xl font-bold text-slate-900 mt-1">{steps} <span className="text-xs text-slate-500 font-normal">Steps</span></p>
          </div>
        </div>
      </div>

      {/* Elder Portal Features Quick Action Grid */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          to="/elder/live-monitor"
          className="group rounded-3xl bg-white p-6 shadow-sm border border-slate-200 transition-all hover:-translate-y-1 hover:border-blue-300"
        >
          <span className="material-symbols-outlined text-3xl text-blue-600 mb-2 block">videocam</span>
          <h3 className="font-bold text-slate-900 group-hover:text-blue-600 text-base">Live Camera Monitor</h3>
          <p className="text-xs text-slate-500 mt-1">View personal room camera feed & status.</p>
        </Link>

        <Link
          to="/elder/devices"
          className="group rounded-3xl bg-white p-6 shadow-sm border border-slate-200 transition-all hover:-translate-y-1 hover:border-indigo-300"
        >
          <span className="material-symbols-outlined text-3xl text-indigo-600 mb-2 block">devices</span>
          <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 text-base">Device Management</h3>
          <p className="text-xs text-slate-500 mt-1">Manage smartwatches, sensors & sync.</p>
        </Link>

        <Link
          to="/elder/ai-insights"
          className="group rounded-3xl bg-white p-6 shadow-sm border border-slate-200 transition-all hover:-translate-y-1 hover:border-amber-300"
        >
          <span className="material-symbols-outlined text-3xl text-amber-600 mb-2 block">psychology</span>
          <h3 className="font-bold text-slate-900 group-hover:text-amber-600 text-base">AI Health Insights</h3>
          <p className="text-xs text-slate-500 mt-1">Personal wellness suggestions & observations.</p>
        </Link>
      </div>

      {/* Today's Personal Routine */}
      <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">event_repeat</span> Today's Routine
          </h2>
          <Link to="/elder/routine" className="text-xs font-bold text-blue-600 hover:underline">
            View Schedule →
          </Link>
        </div>

        {medications.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl">
            No medications or routine items scheduled for today.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {medications.slice(0, 4).map((med) => {
              const scheduledFor = med.schedule[0] || '09:00 AM';
              const isTaken = medicationLogs.some(
                (log) => log.medicationId === med.id && log.status === 'taken'
              );

              return (
                <div key={med.id} className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 bg-slate-50">
                  <div>
                    <div className="font-bold text-slate-900 text-sm">{med.name}</div>
                    <div className="text-xs text-slate-500">{med.dosage} • {scheduledFor}</div>
                  </div>

                  {isTaken ? (
                    <span className="rounded-xl bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                      ✓ Taken
                    </span>
                  ) : (
                    <button
                      onClick={() => void handleTakeMed(med.id, scheduledFor)}
                      disabled={actingMedId === med.id}
                      className="rounded-xl bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-1.5 text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                    >
                      {actingMedId === med.id ? 'Saving...' : 'Mark Taken'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Connected Caregivers */}
      <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <span className="material-symbols-outlined text-blue-600">group</span> My Connected Caregivers
        </h2>

        {loadingCaregivers ? (
          <div className="py-6 text-center text-xs text-slate-400">Loading caregivers...</div>
        ) : caregivers.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            No caregivers linked yet. Share your Elder ID above to connect.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {caregivers.map((cg) => (
              <div key={cg.uid} className="flex items-center gap-3 p-4 rounded-2xl border border-slate-200 bg-slate-50">
                <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center">
                  👨‍⚕️
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-sm">{cg.fullName}</div>
                  <div className="text-xs text-slate-500">{cg.email}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
