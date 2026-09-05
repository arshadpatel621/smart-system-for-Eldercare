import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getLinkedEldersForCaregiver } from '../../services/relationshipService';
import type { AppUserProfile } from '../../types/auth';

export default function CaregiverDashboard() {
  const { profile } = useAuth();
  const [linkedElders, setLinkedElders] = useState<AppUserProfile[]>([]);
  const [loading, setLoading] = useState(true);

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
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
        <div>
          <span className="inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700 mb-2">
            Caregiver Portal
          </span>
          <h1 className="text-3xl font-bold text-slate-900">
            Good Morning, {profile?.fullName || 'Caregiver'} 👋
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Operational dashboard monitoring your connected elder residents.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/caregiver/elders"
            className="rounded-2xl bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 text-xs font-bold shadow-md shadow-blue-600/20 transition-all flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">link</span> Connect Elder
          </Link>
        </div>
      </div>

      {/* Connected Elders Cards Section */}
      <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600">elderly</span> My Linked Elders
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Active elder residents connected to your caregiver monitoring portal.
            </p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-100">
            {linkedElders.length} Active Link{linkedElders.length === 1 ? '' : 's'}
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-400">Loading linked elders...</div>
        ) : linkedElders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center space-y-3 bg-slate-50">
            <span className="material-symbols-outlined text-4xl text-slate-400">elderly</span>
            <h3 className="text-base font-semibold text-slate-700">No Elders Connected Yet</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Go to <Link to="/caregiver/elders" className="text-blue-600 font-bold hover:underline">My Elders</Link> and enter an Elder ID (e.g. <code>ELD-7K4P92</code>) to connect.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {linkedElders.map((elder) => (
              <div
                key={elder.uid}
                className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 p-6 transition-all hover:border-blue-300 hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 font-bold text-xl">
                      👵
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 border border-emerald-200">
                      Stable
                    </span>
                  </div>

                  <h3 className="mt-4 text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                    {elder.fullName}
                  </h3>

                  <div className="mt-2 space-y-1.5 text-xs text-slate-600">
                    <p className="font-mono text-slate-800">
                      <span className="text-slate-400 font-sans">Elder ID:</span> {elder.elderId}
                    </p>
                    <p><span className="text-slate-400">Risk Level:</span> <span className="font-bold text-emerald-600">Low</span></p>
                    <p><span className="text-slate-400">Devices:</span> 3 Online</p>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between gap-2">
                  <Link
                    to="/caregiver/health"
                    className="flex-1 text-center rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 py-2 text-xs font-bold text-blue-700 transition-all"
                  >
                    View Health
                  </Link>
                  <Link
                    to="/caregiver/live-monitor"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all"
                  >
                    Camera
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Action Navigation Grid */}
      <div className="grid gap-6 md:grid-cols-4">
        <Link
          to="/caregiver/health"
          className="group rounded-3xl bg-white p-6 shadow-sm border border-slate-200 transition-all hover:-translate-y-1 hover:border-blue-300"
        >
          <span className="material-symbols-outlined text-3xl text-rose-500 mb-2 block">monitor_heart</span>
          <h3 className="font-bold text-slate-900 group-hover:text-blue-600 text-base">Health Monitor</h3>
          <p className="text-xs text-slate-500 mt-1">Review vitals for linked Elders.</p>
        </Link>

        <Link
          to="/caregiver/live-monitor"
          className="group rounded-3xl bg-white p-6 shadow-sm border border-slate-200 transition-all hover:-translate-y-1 hover:border-blue-300"
        >
          <span className="material-symbols-outlined text-3xl text-blue-500 mb-2 block">videocam</span>
          <h3 className="font-bold text-slate-900 group-hover:text-blue-600 text-base">Live Monitor</h3>
          <p className="text-xs text-slate-500 mt-1">Authorized room video feeds.</p>
        </Link>

        <Link
          to="/caregiver/routine"
          className="group rounded-3xl bg-white p-6 shadow-sm border border-slate-200 transition-all hover:-translate-y-1 hover:border-blue-300"
        >
          <span className="material-symbols-outlined text-3xl text-indigo-500 mb-2 block">event_repeat</span>
          <h3 className="font-bold text-slate-900 group-hover:text-blue-600 text-base">Elder Routine</h3>
          <p className="text-xs text-slate-500 mt-1">Medication & daily schedules.</p>
        </Link>

        <Link
          to="/caregiver/emergency"
          className="group rounded-3xl bg-white p-6 shadow-sm border border-slate-200 transition-all hover:-translate-y-1 hover:border-rose-300"
        >
          <span className="material-symbols-outlined text-3xl text-rose-600 mb-2 block">emergency</span>
          <h3 className="font-bold text-slate-900 group-hover:text-rose-600 text-base">Emergency Center</h3>
          <p className="text-xs text-slate-500 mt-1">Active alerts for linked Elders.</p>
        </Link>
      </div>
    </div>
  );
}
