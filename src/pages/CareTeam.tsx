import { useState } from 'react';
import { useEldercare } from '../context/EldercareContext';

export default function CareTeam() {
  const { data } = useEldercare();
  const [activeTab, setActiveTab] = useState<'caregivers' | 'doctors' | 'reports' | 'activity'>('caregivers');

  if (!data) {
    return <div className="text-slate-500">Loading care team...</div>;
  }

  const caregivers = data.contacts.filter(c => c.role.toLowerCase() !== 'doctor' && c.role.toLowerCase() !== 'physician');
  const doctors = data.contacts.filter(c => c.role.toLowerCase() === 'doctor' || c.role.toLowerCase() === 'physician');

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <header>
        <h1 className="text-4xl font-bold text-slate-800">Care Team</h1>
        <p className="text-slate-500 mt-2">
          Manage contacts, medical professionals, access health reports, and view caretaker check-ins.
        </p>
      </header>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        {[
          { id: 'caregivers', label: 'Caregivers', icon: 'group' },
          { id: 'doctors', label: 'Doctors', icon: 'stethoscope' },
          { id: 'reports', label: 'Reports', icon: 'description' },
          { id: 'activity', label: 'Activity Timeline', icon: 'history' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold transition-colors ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="pt-2">
        {activeTab === 'caregivers' && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {caregivers.length === 0 ? <p className="text-slate-500">No caregivers found.</p> : null}
            {caregivers.map((contact) => (
              <div key={contact.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-xl uppercase">
                      {contact.name.charAt(0)}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-1 rounded-md">{contact.relation}</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-800">{contact.name}</h3>
                  <div className="text-sm text-slate-500 mt-1">{contact.role}</div>
                  <div className="mt-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <span className="material-symbols-outlined text-[18px] text-slate-400">call</span>
                      {contact.phone}
                    </div>
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className={`text-xs font-bold uppercase tracking-widest ${contact.notifyOnEmergency ? 'text-rose-500' : 'text-slate-400'}`}>
                    {contact.notifyOnEmergency ? 'Emergency Contact' : 'Info Only'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'doctors' && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {doctors.length === 0 ? <p className="text-slate-500">No doctors found.</p> : null}
            {doctors.map((contact) => (
              <div key={contact.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-purple-700 font-bold text-xl uppercase">
                      {contact.name.charAt(0)}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-purple-600 bg-purple-50 px-2 py-1 rounded-md">{contact.relation}</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-800">{contact.name}</h3>
                  <div className="text-sm text-slate-500 mt-1">{contact.role}</div>
                  <div className="mt-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <span className="material-symbols-outlined text-[18px] text-slate-400">call</span>
                      {contact.phone}
                    </div>
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100 flex gap-2">
                  <button className="flex-1 bg-purple-50 text-purple-700 py-2 rounded-xl text-sm font-bold hover:bg-purple-100 transition-colors">Message</button>
                  <button className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors">Call</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm max-w-3xl">
            <h2 className="text-xl font-bold text-slate-800 mb-6">Available Health Reports</h2>
            <div className="space-y-4">
              {[
                { title: 'Monthly Wellness Summary - June', date: 'Jul 1, 2026', size: '2.4 MB' },
                { title: 'Cardiology Assessment', date: 'Jun 15, 2026', size: '1.1 MB' },
                { title: 'Weekly Vitals Log', date: 'Jun 7, 2026', size: '0.8 MB' },
              ].map((report, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-slate-50 hover:border-blue-200 transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center text-red-600">
                      <span className="material-symbols-outlined">picture_as_pdf</span>
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{report.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{report.date} • {report.size}</div>
                    </div>
                  </div>
                  <button className="text-blue-600 p-2 rounded-xl hover:bg-blue-50 transition-colors">
                    <span className="material-symbols-outlined">download</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="max-w-3xl relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
             {[
               { title: 'Morning Check-in', user: 'Sarah (Caregiver)', time: '08:00 AM Today', note: 'Resident woke up in good spirits. Assisted with morning routine and breakfast.', icon: 'how_to_reg', color: 'emerald' },
               { title: 'Medication Administered', user: 'Sarah (Caregiver)', time: '08:30 AM Today', note: 'Lisinopril and morning vitamins taken with food.', icon: 'medication', color: 'blue' },
               { title: 'Physical Therapy Session', user: 'Mark (PT)', time: '02:00 PM Yesterday', note: 'Completed full set of leg exercises. Mobility is improving.', icon: 'directions_walk', color: 'purple' },
             ].map((activity, i) => (
               <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active mb-8">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-${activity.color}-100 text-${activity.color}-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10`}>
                    <span className="material-symbols-outlined text-[18px]">{activity.icon}</span>
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-2xl border border-slate-100 bg-white shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2">
                      <div className="font-bold text-slate-800">{activity.title}</div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{activity.time}</div>
                    </div>
                    <div className="text-xs font-bold text-slate-600 mb-2">{activity.user}</div>
                    <div className="text-sm text-slate-500">{activity.note}</div>
                  </div>
               </div>
             ))}
          </div>
        )}
      </div>
    </div>
  );
}
