import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEldercare } from '../context/EldercareContext';
import { hasRoleAccess, roleAccess } from '../lib/access';

function getNextMedication(data: NonNullable<ReturnType<typeof useEldercare>['data']>) {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const items = data.medications
    .filter((medication) => medication.active)
    .flatMap((medication) =>
      medication.schedule.map((time) => ({
        medication,
        time,
        iso: `${today}T${time}:00`,
      })),
    )
    .filter((entry) => {
      const alreadyTaken = data.medicationLogs.some(
        (log) => log.medicationId === entry.medication.id && log.scheduledFor.startsWith(entry.iso),
      );
      return !alreadyTaken;
    })
    .sort((left, right) => new Date(left.iso).getTime() - new Date(right.iso).getTime());

  return items.find((entry) => new Date(entry.iso).getTime() >= now.getTime()) ?? items[0];
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { data, latestVitals, derivedAlerts, recommendations, storageMode } = useEldercare();

  if (!data || !latestVitals) {
    return <div className="text-slate-500">Loading dashboard...</div>;
  }

  const nextMedication = getNextMedication(data);
  const unacknowledged = derivedAlerts.filter((alert) => !alert.acknowledged);
  const primaryAlert = unacknowledged[0];

  const quickLinks = [
    { label: 'Health monitor', path: '/health', roles: roleAccess.all },
    { label: 'Live monitor', path: '/camera', roles: roleAccess.careTeam },
    { label: 'Care team', path: '/team', roles: roleAccess.careTeam },
    { label: 'Routine log', path: '/routine', roles: roleAccess.all },
    { label: 'Emergency protocols', path: '/emergency', roles: roleAccess.all },
  ].filter((item) => hasRoleAccess(role, item.roles));

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="rounded-3xl bg-primary p-6 text-white shadow-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-blue-100">Resident status</p>
            <h1 className="mt-2 text-4xl font-black">{data.profile.fullName}</h1>
            <p className="mt-2 max-w-2xl text-blue-100">
              Firebase-backed elder profile, reminders, safety events, and smartwatch sync are now wired into the app.
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 px-5 py-4 text-right backdrop-blur">
            <div className="text-sm uppercase tracking-widest text-blue-100">{storageMode} mode</div>
            <div className="mt-1 text-2xl font-bold">{unacknowledged.length} active alerts</div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="grid gap-6 lg:col-span-8 md:grid-cols-2">
          {[
            ['Heart rate', `${latestVitals.heartRate?.value ?? '--'} bpm`, 'favorite'],
            ['SpO2', `${latestVitals.spo2?.value ?? '--'}%`, 'bloodtype'],
            ['Steps', `${latestVitals.steps?.value ?? '--'}`, 'directions_walk'],
            ['Sleep', `${latestVitals.sleep?.value ?? '--'} hrs`, 'dark_mode'],
          ].map(([label, value, icon]) => (
            <div key={label} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold uppercase tracking-widest text-slate-400">{label}</div>
                  <div className="mt-2 text-4xl font-black text-primary">{value}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 text-primary">
                  <span className="material-symbols-outlined text-3xl">{icon}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-6 lg:col-span-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-bold uppercase tracking-widest text-slate-400">Next medication</div>
            {nextMedication ? (
              <>
                <h2 className="mt-2 text-2xl font-bold text-primary">{nextMedication.medication.name}</h2>
                <p className="mt-1 text-slate-500">{nextMedication.medication.dosage} • {nextMedication.time}</p>
                <button
                  onClick={() => navigate('/routine')}
                  className="mt-4 rounded-xl bg-secondary px-5 py-3 font-bold text-white"
                >
                  Open routine
                </button>
              </>
            ) : (
              <p className="mt-2 text-slate-500">All medications are logged for today.</p>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-bold uppercase tracking-widest text-slate-400">Emergency status</div>
            {primaryAlert ? (
              <>
                <h2 className="mt-2 text-xl font-bold text-error">{primaryAlert.title}</h2>
                <p className="mt-2 text-sm text-slate-500">{primaryAlert.message}</p>
                <button
                  onClick={() => navigate('/emergency')}
                  className="mt-4 w-full rounded-xl border border-error px-5 py-3 font-bold text-error hover:bg-error/10 transition-colors"
                >
                  Review emergency
                </button>
              </>
            ) : (
              <p className="mt-2 text-slate-500 flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-500">check_circle</span>
                No urgent issues detected.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Camera Summary */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">Camera summary</h2>
              <span className="material-symbols-outlined text-slate-400">videocam</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl">
                <p className="text-xs font-bold text-slate-500 uppercase">Online</p>
                <p className="text-2xl font-black text-emerald-600">3</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl">
                <p className="text-xs font-bold text-slate-500 uppercase">Offline</p>
                <p className="text-2xl font-black text-rose-600">0</p>
              </div>
            </div>
          </div>
          <button onClick={() => navigate('/cameras')} className="mt-6 w-full text-sm font-bold text-primary hover:bg-slate-50 py-2 rounded-xl border border-slate-200 transition-colors">
            Manage Cameras
          </button>
        </div>

        {/* AI Alerts Summary */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">AI Alerts Today</h2>
              <span className="material-symbols-outlined text-slate-400">psychology</span>
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600">Fall Detection</span>
                <span className="font-bold text-emerald-500">0 Events</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600">Motion Alerts</span>
                <span className="font-bold text-amber-500">4 Events</span>
              </div>
            </div>
          </div>
          <button onClick={() => navigate('/insights')} className="mt-6 w-full text-sm font-bold text-primary hover:bg-slate-50 py-2 rounded-xl border border-slate-200 transition-colors">
            View Analytics
          </button>
        </div>

        {/* Quick Actions */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-800">Quick actions</h2>
          <div className="mt-4 grid gap-2">
            {quickLinks.slice(0, 4).map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-bold text-slate-700 transition hover:bg-slate-50 flex items-center justify-between"
              >
                {item.label}
                <span className="material-symbols-outlined text-sm text-slate-400">chevron_right</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-800">Recent notifications</h2>
            <button onClick={() => navigate('/notifications')} className="text-sm font-bold text-primary">
              View all
            </button>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {recommendations.slice(0, 4).map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex justify-between items-start">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-primary bg-blue-100 px-2 py-1 rounded-md">{item.category}</div>
                  <span className="text-xs text-slate-400">Just now</span>
                </div>
                <div className="mt-3 text-sm font-bold text-slate-800">{item.title}</div>
                <p className="mt-1 text-xs text-slate-500 line-clamp-2">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
