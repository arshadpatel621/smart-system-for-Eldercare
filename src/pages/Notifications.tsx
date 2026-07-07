import { useState } from 'react';

export default function Notifications() {
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'system'>('all');

  const notifications = [
    { id: 1, type: 'critical', title: 'Fall Detected', message: 'AI detected a potential fall in Living Room.', time: '10 mins ago', read: false },
    { id: 2, type: 'warning', title: 'Heart Rate Spike', message: 'Spike to 110 bpm during rest.', time: '2 hours ago', read: true },
    { id: 3, type: 'info', title: 'Medication Taken', message: 'Morning medication logged successfully.', time: '5 hours ago', read: true },
    { id: 4, type: 'system', title: 'Camera Disconnected', message: 'Kitchen camera went offline.', time: '1 day ago', read: true },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-slate-800">Notifications</h1>
          <p className="text-slate-500 mt-2">System alerts, AI events, and health reminders.</p>
        </div>
        <button className="text-blue-600 font-bold hover:bg-blue-50 px-4 py-2 rounded-xl transition-colors">
          Mark all as read
        </button>
      </header>

      <div className="flex gap-2 border-b border-slate-200 pb-px">
        {['all', 'unread', 'system'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab as any)}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-all capitalize ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            {tab}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {notifications.map(n => (
          <div key={n.id} className={`p-5 rounded-2xl border flex gap-4 ${n.read ? 'bg-white border-slate-200' : 'bg-blue-50/50 border-blue-200'}`}>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
              n.type === 'critical' ? 'bg-rose-100 text-rose-600' :
              n.type === 'warning' ? 'bg-amber-100 text-amber-600' :
              n.type === 'system' ? 'bg-slate-100 text-slate-600' :
              'bg-emerald-100 text-emerald-600'
            }`}>
              <span className="material-symbols-outlined text-xl">
                {n.type === 'critical' ? 'warning' : n.type === 'warning' ? 'monitor_heart' : n.type === 'system' ? 'router' : 'info'}
              </span>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className={`font-bold ${n.read ? 'text-slate-700' : 'text-slate-900'}`}>{n.title}</h3>
                <span className="text-xs text-slate-400 font-semibold">{n.time}</span>
              </div>
              <p className="text-sm text-slate-500 mt-1">{n.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
