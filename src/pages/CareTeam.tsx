import { useEldercare } from '../context/EldercareContext';

export default function CareTeam() {
  const { data, derivedAlerts } = useEldercare();

  if (!data) {
    return <div className="text-slate-500">Loading care team...</div>;
  }

  const criticalAlerts = derivedAlerts.filter((alert) => alert.severity === 'critical' && !alert.acknowledged);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <header>
        <h1 className="text-4xl font-bold text-primary">Care Team and Notifications</h1>
        <p className="text-slate-500">
          Emergency contacts, notification recipients, and alert status live in Firebase alongside resident health data.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-primary">Care contacts</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {data.contacts.map((contact) => (
              <div key={contact.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
                <div className="text-xl font-bold text-slate-800">{contact.name}</div>
                <div className="mt-1 text-sm text-slate-500">{contact.relation} | {contact.role}</div>
                <div className="mt-1 text-sm text-slate-500">{contact.phone}</div>
                <div className="mt-3 text-xs font-bold uppercase tracking-widest text-slate-400">
                  {contact.notifyOnEmergency ? 'Receives emergency alerts' : 'Info only'}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-primary">Notification queue</h2>
            <div className="mt-4 rounded-2xl bg-red-50 p-4">
              <div className="text-sm font-bold uppercase tracking-widest text-red-700">Critical alerts waiting</div>
              <div className="mt-2 text-4xl font-black text-red-900">{criticalAlerts.length}</div>
            </div>
            <p className="mt-4 text-sm text-slate-500">
              The next backend step is a Firebase Cloud Function that watches alert documents and sends FCM, SMS, or WhatsApp messages to these contacts.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-primary">Backend routing idea</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="rounded-2xl bg-slate-50 p-4"><code>alerts/&#123;alertId&#125;</code> written by rule engine or camera detection</div>
              <div className="rounded-2xl bg-slate-50 p-4">Cloud Function reads `contacts` and sends notifications</div>
              <div className="rounded-2xl bg-slate-50 p-4">Caretaker app acknowledges the alert and updates the document</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
