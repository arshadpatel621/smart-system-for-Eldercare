import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useEldercare } from '../context/EldercareContext';

export default function Settings() {
  const { profile } = useAuth();
  const { enableBrowserNotifications } = useEldercare();
  const [status, setStatus] = useState('');

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-4xl font-bold text-primary">Settings</h1>
        <p className="text-slate-500">Basic account and notification preferences for the current signed-in user.</p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-primary">Account</h2>
          <div className="mt-5 space-y-3 text-sm text-slate-600">
            <div className="rounded-2xl bg-slate-50 p-4">Name: {profile?.fullName ?? '-'}</div>
            <div className="rounded-2xl bg-slate-50 p-4">Email: {profile?.email ?? '-'}</div>
            <div className="rounded-2xl bg-slate-50 p-4">Role: {profile?.role ?? '-'}</div>
            <div className="rounded-2xl bg-slate-50 p-4">Assigned elder: {profile?.elderId ?? '-'}</div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-primary">Notifications</h2>
          <p className="mt-3 text-sm text-slate-500">Enable browser notifications for critical alerts and SOS events.</p>
          <button
            onClick={async () => {
              await enableBrowserNotifications();
              setStatus('Browser notification permission request sent.');
            }}
            className="mt-5 rounded-2xl bg-primary px-5 py-3 font-bold text-white"
          >
            Enable browser alerts
          </button>
          {status ? <div className="mt-4 rounded-2xl bg-green-50 p-4 text-sm text-green-700">{status}</div> : null}
        </div>
      </section>
    </div>
  );
}
