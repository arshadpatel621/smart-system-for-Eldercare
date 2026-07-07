import { useEldercare } from '../context/EldercareContext';

function todayIsoAt(time: string) {
  const today = new Date().toISOString().slice(0, 10);
  return `${today}T${time}:00`;
}

export default function Routine() {
  const { data, takeMedication, createMetric } = useEldercare();

  if (!data) {
    return <div className="text-slate-500">Loading routine...</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-4xl font-bold text-slate-800">Daily Routine</h1>
        <p className="text-slate-500 mt-2">
          Medications, meals, hydration, exercises, and appointments for {data.profile.fullName}.
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <span className="material-symbols-outlined text-rose-500 bg-rose-50 p-2 rounded-xl">medication</span>
              <h2 className="text-2xl font-bold text-slate-800">Medication Schedule</h2>
            </div>
            <div className="space-y-3">
              {data.medications.length === 0 ? (
                <p className="text-slate-500 text-sm">No active medications.</p>
              ) : (
                data.medications.map((medication) =>
                  medication.schedule.map((time) => {
                    const scheduledFor = todayIsoAt(time);
                    const taken = data.medicationLogs.some(
                      (log) => log.medicationId === medication.id && log.scheduledFor.startsWith(scheduledFor),
                    );
                    return (
                      <div key={`${medication.id}-${time}`} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-slate-50">
                        <div className="flex items-center gap-4">
                          <div className={`w-3 h-3 rounded-full ${taken ? 'bg-emerald-400' : 'bg-amber-400'}`}></div>
                          <div>
                            <div className="text-slate-800 font-bold">{medication.name} <span className="text-sm font-normal text-slate-500">({medication.dosage})</span></div>
                            <div className="text-xs text-slate-500 mt-1">{time} • {medication.instructions}</div>
                          </div>
                        </div>
                        <button
                          disabled={taken}
                          onClick={() => void takeMedication(medication.id, scheduledFor)}
                          className={`px-4 py-2 text-sm font-bold rounded-xl transition-colors ${taken ? 'bg-slate-200 text-slate-500' : 'bg-primary text-white hover:bg-blue-800'}`}
                        >
                          {taken ? 'Taken' : 'Mark Taken'}
                        </button>
                      </div>
                    );
                  }),
                )
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <span className="material-symbols-outlined text-amber-500 bg-amber-50 p-2 rounded-xl">restaurant</span>
              <h2 className="text-2xl font-bold text-slate-800">Meal Schedule</h2>
            </div>
            <div className="space-y-3">
              {[
                { name: 'Breakfast', time: '08:30', desc: 'Oatmeal with berries', status: 'completed' },
                { name: 'Lunch', time: '13:00', desc: 'Grilled chicken salad', status: 'pending' },
                { name: 'Dinner', time: '18:30', desc: 'Baked salmon and asparagus', status: 'pending' }
              ].map((meal, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-slate-50">
                  <div className="flex items-center gap-4">
                     <div className={`w-3 h-3 rounded-full ${meal.status === 'completed' ? 'bg-emerald-400' : 'bg-slate-300'}`}></div>
                     <div>
                       <div className="text-slate-800 font-bold">{meal.name} <span className="text-xs font-normal text-slate-500 bg-slate-200 px-2 py-0.5 rounded ml-2">{meal.time}</span></div>
                       <div className="text-xs text-slate-500 mt-1">{meal.desc}</div>
                     </div>
                  </div>
                  <button className={`px-4 py-2 text-sm font-bold rounded-xl transition-colors ${meal.status === 'completed' ? 'bg-slate-200 text-slate-500' : 'border border-slate-300 text-slate-700 hover:bg-slate-100'}`}>
                    {meal.status === 'completed' ? 'Completed' : 'Complete'}
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <span className="material-symbols-outlined text-emerald-500 bg-emerald-50 p-2 rounded-xl">directions_walk</span>
              <h2 className="text-2xl font-bold text-slate-800">Exercise & Therapy</h2>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 rounded-2xl border border-emerald-100 bg-emerald-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                  <div>
                    <div className="text-emerald-900 font-bold">Morning Walk</div>
                    <div className="text-xs text-emerald-700 mt-1">15 minutes around the garden</div>
                  </div>
                </div>
                <span className="text-sm font-bold text-emerald-600 bg-emerald-100 px-3 py-1 rounded-lg">Completed</span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-slate-50">
                <div className="flex items-center gap-4">
                  <div className="w-3 h-3 rounded-full bg-slate-300"></div>
                  <div>
                    <div className="text-slate-800 font-bold">Physical Therapy</div>
                    <div className="text-xs text-slate-500 mt-1">Leg raises (3 sets of 10)</div>
                  </div>
                </div>
                <button className="border border-slate-300 text-slate-700 hover:bg-slate-100 px-4 py-2 text-sm font-bold rounded-xl transition-colors">Start</button>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-blue-500 bg-blue-50 p-2 rounded-xl">water_drop</span>
                <h2 className="text-xl font-bold text-slate-800">Hydration</h2>
              </div>
              <span className="text-sm font-bold text-blue-600">1.25L / 2.0L</span>
            </div>
            <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden">
               <div className="h-full bg-blue-400 w-[62%]"></div>
            </div>
            <div className="mt-6 flex gap-2">
              <button
                onClick={() => void createMetric({ type: 'hydration', value: 0.25, unit: 'liters', source: 'manual', note: 'Quick water log', recordedAt: new Date().toISOString() })}
                className="flex-1 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold py-3 rounded-xl transition-colors text-sm"
              >
                + 250ml
              </button>
              <button
                onClick={() => void createMetric({ type: 'hydration', value: 0.50, unit: 'liters', source: 'manual', note: 'Quick water log', recordedAt: new Date().toISOString() })}
                className="flex-1 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold py-3 rounded-xl transition-colors text-sm"
              >
                + 500ml
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <span className="material-symbols-outlined text-purple-500 bg-purple-50 p-2 rounded-xl">calendar_month</span>
              <h2 className="text-xl font-bold text-slate-800">Appointments</h2>
            </div>
            <div className="p-4 rounded-2xl border border-purple-100 bg-purple-50/30">
              <div className="text-sm font-bold text-purple-900">Dr. Smith (Cardiology)</div>
              <div className="text-xs text-purple-700 mt-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">event</span>
                Thursday, 10:00 AM
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Task Completion Log</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5"><span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span></div>
                <div>
                  <div className="text-sm font-bold text-slate-700">Morning Walk</div>
                  <div className="text-xs text-slate-400">09:15 AM</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5"><span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span></div>
                <div>
                  <div className="text-sm font-bold text-slate-700">Breakfast</div>
                  <div className="text-xs text-slate-400">08:45 AM</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5"><span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span></div>
                <div>
                  <div className="text-sm font-bold text-slate-700">Lisinopril (10mg)</div>
                  <div className="text-xs text-slate-400">08:00 AM</div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
