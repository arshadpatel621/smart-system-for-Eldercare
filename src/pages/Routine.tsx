import { useState } from 'react';
import { useEldercare } from '../context/EldercareContext';

function todayIsoAt(time: string) {
  const today = new Date().toISOString().slice(0, 10);
  return `${today}T${time}:00`;
}

export default function Routine() {
  const { data, recommendations, takeMedication, createMedication, createMetric } = useEldercare();
  const [medicationForm, setMedicationForm] = useState({
    name: '',
    dosage: '',
    schedule: '',
    instructions: '',
  });

  if (!data) {
    return <div className="text-slate-500">Loading routine...</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-4xl font-bold text-primary">Routine and Medication</h1>
        <p className="text-slate-500">
          Reminders, adherence tracking, hydration, and daily wellness suggestions are managed here.
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-primary">Today's medication schedule</h2>
          <div className="mt-5 space-y-4">
            {data.medications.map((medication) =>
              medication.schedule.map((time) => {
                const scheduledFor = todayIsoAt(time);
                const taken = data.medicationLogs.some(
                  (log) => log.medicationId === medication.id && log.scheduledFor.startsWith(scheduledFor),
                );
                return (
                  <div key={`${medication.id}-${time}`} className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-lg font-bold text-slate-800">{medication.name}</div>
                      <div className="text-sm text-slate-500">{medication.dosage} • {time}</div>
                      <div className="text-sm text-slate-500">{medication.instructions}</div>
                    </div>
                    <button
                      disabled={taken}
                      onClick={() => void takeMedication(medication.id, scheduledFor)}
                      className={`rounded-xl px-5 py-3 font-bold ${taken ? 'bg-slate-200 text-slate-500' : 'bg-secondary text-white'}`}
                    >
                      {taken ? 'Taken' : 'Mark taken'}
                    </button>
                  </div>
                );
              }),
            )}
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-primary">Quick logs</h2>
            <div className="mt-4 grid gap-3">
              <button
                onClick={() =>
                  void createMetric({
                    type: 'hydration',
                    value: 0.25,
                    unit: 'liters',
                    source: 'manual',
                    note: 'Quick water log',
                    recordedAt: new Date().toISOString(),
                  })
                }
                className="rounded-2xl bg-blue-50 px-4 py-4 text-left font-bold text-blue-700"
              >
                Log 250 ml water
              </button>
              <button
                onClick={() =>
                  void createMetric({
                    type: 'mood',
                    value: 4,
                    unit: '/5',
                    source: 'manual',
                    note: 'Feeling steady',
                    recordedAt: new Date().toISOString(),
                  })
                }
                className="rounded-2xl bg-green-50 px-4 py-4 text-left font-bold text-green-700"
              >
                Log mood as stable
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-primary">Add medication</h2>
            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void createMedication({
                  name: medicationForm.name,
                  dosage: medicationForm.dosage,
                  schedule: medicationForm.schedule.split(',').map((item) => item.trim()).filter(Boolean),
                  instructions: medicationForm.instructions,
                  active: true,
                });
                setMedicationForm({ name: '', dosage: '', schedule: '', instructions: '' });
              }}
            >
              <input className="w-full rounded-xl border border-slate-200 px-4 py-3" placeholder="Medication name" value={medicationForm.name} onChange={(event) => setMedicationForm({ ...medicationForm, name: event.target.value })} />
              <input className="w-full rounded-xl border border-slate-200 px-4 py-3" placeholder="Dosage" value={medicationForm.dosage} onChange={(event) => setMedicationForm({ ...medicationForm, dosage: event.target.value })} />
              <input className="w-full rounded-xl border border-slate-200 px-4 py-3" placeholder="Schedule times, comma separated (08:00,20:00)" value={medicationForm.schedule} onChange={(event) => setMedicationForm({ ...medicationForm, schedule: event.target.value })} />
              <textarea className="min-h-20 w-full rounded-xl border border-slate-200 px-4 py-3" placeholder="Instructions" value={medicationForm.instructions} onChange={(event) => setMedicationForm({ ...medicationForm, instructions: event.target.value })} />
              <button className="w-full rounded-xl bg-primary px-4 py-3 font-bold text-white">Save medication</button>
            </form>
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-primary">AI care suggestions</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {recommendations.map((item) => (
            <div key={item.id} className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-400">{item.priority} priority</div>
              <div className="mt-1 text-lg font-bold text-slate-800">{item.title}</div>
              <p className="mt-2 text-sm text-slate-500">{item.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
