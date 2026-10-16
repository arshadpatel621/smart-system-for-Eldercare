import { useState } from 'react';
import { useEldercare } from '../context/EldercareContext';

export default function Notifications() {
  const { derivedAlerts, confirmAlert } = useEldercare();
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'system'>('all');

  const filteredNotifications = derivedAlerts.filter((item) => {
    if (activeTab === 'unread') return !item.acknowledged;
    if (activeTab === 'system') return item.source === 'device' || item.source === 'safety';
    return true;
  });

  const handleMarkAllRead = async () => {
    const unread = derivedAlerts.filter((a) => !a.acknowledged);
    await Promise.all(unread.map((a) => confirmAlert(a)));
  };

  const getTimeAgo = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-slate-800">Notifications</h1>
          <p className="text-slate-500 mt-2">Real-time alerts, safety events, and care recommendations.</p>
        </div>
        <button
          onClick={() => void handleMarkAllRead()}
          className="text-blue-600 font-bold hover:bg-blue-50 px-4 py-2 rounded-xl transition-colors text-sm"
        >
          Mark all as read
        </button>
      </header>

      <div className="flex gap-2 border-b border-slate-200 pb-px">
        {(['all', 'unread', 'system'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-all capitalize ${
              activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filteredNotifications.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center space-y-3">
            <span className="material-symbols-outlined text-5xl text-slate-300">notifications_none</span>
            <h3 className="text-base font-semibold text-slate-700">No Notifications</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              There are no notifications matching the current filter. Health alarms and system events will appear here in real time.
            </p>
          </div>
        ) : (
          filteredNotifications.map((n) => (
            <div
              key={n.id}
              className={`p-5 rounded-2xl border flex gap-4 transition-all ${
                n.acknowledged ? 'bg-white border-slate-200 opacity-80' : 'bg-blue-50/50 border-blue-200 shadow-sm'
              }`}
            >
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                  n.severity === 'critical'
                    ? 'bg-rose-100 text-rose-600'
                    : n.severity === 'warning'
                    ? 'bg-amber-100 text-amber-600'
                    : n.source === 'device'
                    ? 'bg-slate-100 text-slate-600'
                    : 'bg-emerald-100 text-emerald-600'
                }`}
              >
                <span className="material-symbols-outlined text-xl">
                  {n.severity === 'critical'
                    ? 'warning'
                    : n.severity === 'warning'
                    ? 'monitor_heart'
                    : n.source === 'device'
                    ? 'router'
                    : 'info'}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className={`font-bold ${n.acknowledged ? 'text-slate-700' : 'text-slate-900'}`}>{n.title}</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 font-semibold">{getTimeAgo(n.createdAt)}</span>
                    {!n.acknowledged && (
                      <button
                        onClick={() => void confirmAlert(n)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-100/70 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors"
                      >
                        Acknowledge
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-slate-500 mt-1">{n.message}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
