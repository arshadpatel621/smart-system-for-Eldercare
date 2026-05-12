import { useEldercare } from '../context/EldercareContext';

export default function Safety() {
  const { data, derivedAlerts, createSafetyEvent, confirmAlert } = useEldercare();

  if (!data) {
    return <div className="text-slate-500">Loading safety view...</div>;
  }

  const unresolvedEvents = data.safetyEvents.filter((event) => !event.resolved);

  return (
    <div className="animate-in fade-in duration-500 bg-surface min-h-screen pb-24">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white/90 px-6 py-4 backdrop-blur">
        <div>
          <h1 className="text-2xl font-bold text-error">Emergency and Safety</h1>
          <p className="text-sm text-slate-500">Camera events, SOS actions, alert routing, and caretaker response status.</p>
        </div>
        <button
          onClick={() =>
            void createSafetyEvent({
              type: 'sos',
              severity: 'critical',
              occurredAt: new Date().toISOString(),
              location: 'Resident app',
              note: 'Manual SOS trigger from the safety screen.',
              resolved: false,
            })
          }
          className="rounded-full bg-error px-6 py-3 font-bold text-white shadow-lg"
        >
          Trigger SOS
        </button>
      </header>

      <div className="mx-auto max-w-6xl space-y-8 p-6">
        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-red-100 bg-red-50 p-6">
            <h2 className="text-2xl font-bold text-red-900">Active alerts</h2>
            <div className="mt-4 space-y-3">
              {derivedAlerts.slice(0, 6).map((alert) => (
                <div key={alert.id} className="rounded-2xl border border-white/60 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-bold text-slate-800">{alert.title}</div>
                      <p className="mt-1 text-sm text-slate-500">{alert.message}</p>
                    </div>
                    {!alert.acknowledged ? (
                      <button
                        onClick={() => void confirmAlert(alert)}
                        className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700"
                      >
                        Acknowledge
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-primary">Emergency contacts</h2>
            <div className="mt-4 space-y-3">
              {data.contacts.map((contact) => (
                <div key={contact.id} className="rounded-2xl bg-slate-50 p-4">
                  <div className="font-bold text-slate-800">{contact.name}</div>
                  <div className="text-sm text-slate-500">{contact.role}</div>
                  <div className="text-sm text-slate-500">{contact.phone}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          <button
            onClick={() =>
              void createSafetyEvent({
                type: 'fall',
                severity: 'critical',
                occurredAt: new Date().toISOString(),
                location: 'Bedroom',
                note: 'Manual fall test event for caretaker workflow.',
                resolved: false,
              })
            }
            className="rounded-3xl bg-error p-6 text-left text-white shadow-xl"
          >
            <div className="text-3xl font-black">Fall detected</div>
            <div className="mt-2 text-sm text-red-100">Creates a critical event and alert for the care team.</div>
          </button>
          <button
            onClick={() =>
              void createSafetyEvent({
                type: 'unusual_behavior',
                severity: 'warning',
                occurredAt: new Date().toISOString(),
                location: 'Kitchen',
                note: 'Resident stayed near stove area longer than normal.',
                resolved: false,
              })
            }
            className="rounded-3xl bg-orange-500 p-6 text-left text-white shadow-xl"
          >
            <div className="text-3xl font-black">Unusual behavior</div>
            <div className="mt-2 text-sm text-orange-50">Use this until the camera AI writes the same event automatically.</div>
          </button>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-bold uppercase tracking-widest text-slate-400">Open incidents</div>
            <div className="mt-2 text-4xl font-black text-primary">{unresolvedEvents.length}</div>
            <div className="mt-2 text-sm text-slate-500">These records become your caretaker notification source in Firebase.</div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-primary">Safety history</h2>
          <div className="mt-5 space-y-3">
            {data.safetyEvents
              .slice()
              .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())
              .map((event) => (
                <div key={event.id} className="grid gap-2 rounded-2xl bg-slate-50 p-4 md:grid-cols-[auto_1fr_auto] md:items-center">
                  <div className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${event.severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                    {event.severity}
                  </div>
                  <div>
                    <div className="font-bold capitalize text-slate-800">{event.type.replace('_', ' ')}</div>
                    <div className="text-sm text-slate-500">{event.location} • {event.note}</div>
                  </div>
                  <div className="text-sm text-slate-500">{new Date(event.occurredAt).toLocaleString()}</div>
                </div>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}
