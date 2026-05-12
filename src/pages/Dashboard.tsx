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
    { label: 'Resident profile', path: '/profile', roles: roleAccess.all },
    { label: 'Live monitor', path: '/camera', roles: roleAccess.careTeam },
    { label: 'Care team', path: '/team', roles: roleAccess.careTeam },
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
            <div className="text-sm font-bold uppercase tracking-widest text-slate-400">Priority alert</div>
            {primaryAlert ? (
              <>
                <h2 className="mt-2 text-xl font-bold text-primary">{primaryAlert.title}</h2>
                <p className="mt-2 text-sm text-slate-500">{primaryAlert.message}</p>
                <button
                  onClick={() => navigate('/sos')}
                  className="mt-4 rounded-xl border border-primary px-5 py-3 font-bold text-primary"
                >
                  Review safety
                </button>
              </>
            ) : (
              <p className="mt-2 text-slate-500">No urgent issues detected.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-primary">Today's care suggestions</h2>
            <button onClick={() => navigate('/insights')} className="text-sm font-bold text-primary">
              View all
            </button>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {recommendations.slice(0, 4).map((item) => (
              <div key={item.id} className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-widest text-slate-400">{item.category}</div>
                <div className="mt-1 text-lg font-bold text-slate-800">{item.title}</div>
                <p className="mt-2 text-sm text-slate-500">{item.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-primary">Quick actions</h2>
          <div className="mt-5 grid gap-3">
            {quickLinks.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="rounded-2xl bg-slate-50 px-4 py-4 text-left font-bold text-slate-700 transition hover:bg-slate-100"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
