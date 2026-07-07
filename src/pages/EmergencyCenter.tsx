export default function EmergencyCenter() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-4xl font-bold text-slate-800">Emergency Center</h1>
        <p className="text-slate-500 mt-2">Emergency protocols, SOS, and active incident tracking.</p>
      </header>
      
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-3xl bg-rose-600 p-8 text-white text-center shadow-xl shadow-rose-600/20">
          <span className="material-symbols-outlined text-6xl block mb-4">emergency</span>
          <h2 className="text-2xl font-bold mb-2">Trigger SOS Protocol</h2>
          <p className="text-rose-100 mb-8 max-w-sm mx-auto">This will immediately notify all emergency contacts, care team members, and dial local emergency services if configured.</p>
          <button className="bg-white text-rose-600 font-bold text-xl px-12 py-4 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-transform uppercase tracking-wider">
            Trigger SOS
          </button>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-blue-600">contact_phone</span>
              Primary Emergency Contacts
            </h3>
            <div className="space-y-3">
              {[
                { name: 'Dr. Sarah Wilson', role: 'Primary Physician', phone: '555-0100' },
                { name: 'Michael Smith', role: 'Family (Son)', phone: '555-0102' }
              ].map(contact => (
                <div key={contact.name} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <div>
                    <div className="font-bold text-slate-700">{contact.name}</div>
                    <div className="text-xs text-slate-500">{contact.role}</div>
                  </div>
                  <button className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center hover:bg-blue-200 transition-colors">
                    <span className="material-symbols-outlined text-sm">call</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-amber-600">history</span>
              Recent Incidents
            </h3>
            <div className="text-center py-6">
              <span className="material-symbols-outlined text-4xl text-slate-300 block mb-2">task_alt</span>
              <p className="text-slate-500 font-medium">No recent incidents in the past 30 days.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
