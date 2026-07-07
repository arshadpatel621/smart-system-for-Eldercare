import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useEldercare } from '../context/EldercareContext';

export default function Settings() {
  const { profile } = useAuth();
  const { enableBrowserNotifications } = useEldercare();
  const [status, setStatus] = useState('');
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'security'>('profile');

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-4xl font-bold text-slate-800">Settings</h1>
        <p className="text-slate-500 mt-2">Manage your account, preferences, and security settings.</p>
      </header>

      <div className="flex flex-col md:flex-row gap-8">
        <aside className="w-full md:w-64 shrink-0 space-y-2">
          {[
            { id: 'profile', icon: 'person', label: 'My Profile' },
            { id: 'preferences', icon: 'settings', label: 'Preferences' },
            { id: 'security', icon: 'shield', label: 'Security' }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all text-left ${
                activeTab === tab.id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
              }`}>
              <span className="material-symbols-outlined">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </aside>

        <div className="flex-1 space-y-6">
          {activeTab === 'profile' && (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <h2 className="text-2xl font-bold text-slate-800 mb-6">Profile Information</h2>
              <div className="flex items-center gap-6 mb-8">
                <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-4xl font-bold">
                  {profile?.fullName?.charAt(0) || 'U'}
                </div>
                <div>
                  <button className="px-4 py-2 bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 rounded-xl transition-colors text-sm">
                    Change Avatar
                  </button>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Full Name</label>
                  <input type="text" className="w-full rounded-xl border border-slate-200 px-4 py-3 bg-slate-50 text-slate-800" value={profile?.fullName || ''} readOnly />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email Address</label>
                  <input type="email" className="w-full rounded-xl border border-slate-200 px-4 py-3 bg-slate-50 text-slate-800" value={profile?.email || ''} readOnly />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Role</label>
                  <input type="text" className="w-full rounded-xl border border-slate-200 px-4 py-3 bg-slate-50 text-slate-800 capitalize" value={profile?.role || ''} readOnly />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Assigned Elder ID</label>
                  <input type="text" className="w-full rounded-xl border border-slate-200 px-4 py-3 bg-slate-50 text-slate-800" value={profile?.elderId || ''} readOnly />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <h2 className="text-2xl font-bold text-slate-800 mb-6">System Preferences</h2>
              
              <div className="space-y-6 border-b border-slate-100 pb-6 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-800">Browser Notifications</h3>
                    <p className="text-sm text-slate-500">Enable push notifications for critical alerts.</p>
                  </div>
                  <button
                    onClick={async () => {
                      await enableBrowserNotifications();
                      setStatus('Notification permission requested.');
                    }}
                    className="rounded-xl bg-blue-100 text-blue-700 px-4 py-2 font-bold hover:bg-blue-200 transition-colors"
                  >
                    Enable
                  </button>
                </div>
                {status && <div className="rounded-xl bg-emerald-50 text-emerald-700 p-3 text-sm font-semibold">{status}</div>}
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-800">Dark Mode</h3>
                    <p className="text-sm text-slate-500">Toggle dark appearance.</p>
                  </div>
                  <div className="w-12 h-6 rounded-full bg-slate-200 relative">
                    <div className="w-4 h-4 rounded-full bg-white absolute top-1 left-1 shadow-sm"></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm space-y-6">
              <h2 className="text-2xl font-bold text-slate-800 mb-6">Security Settings</h2>
              
              <div>
                <h3 className="font-bold text-slate-800 mb-2">Change Password</h3>
                <p className="text-sm text-slate-500 mb-4">We'll send a password reset link to your email.</p>
                <button className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                  Send Reset Link
                </button>
              </div>

              <div className="pt-6 border-t border-slate-100">
                <h3 className="font-bold text-rose-600 mb-2">Sign Out</h3>
                <p className="text-sm text-slate-500 mb-4">Sign out of your account on this device.</p>
                <button className="rounded-xl bg-rose-100 text-rose-700 px-4 py-2 font-bold hover:bg-rose-200 transition-colors">
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
