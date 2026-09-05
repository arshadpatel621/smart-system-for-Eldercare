import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { AppUserProfile } from '../../types/auth';

export default function AdminResidents() {
  const [elders, setElders] = useState<AppUserProfile[]>([]);
  const [selectedElder, setSelectedElder] = useState<AppUserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadElders() {
      try {
        if (db) {
          const q = query(collection(db, 'users'), where('role', '==', 'elder'));
          const snap = await getDocs(q);
          setElders(snap.docs.map((d) => d.data() as AppUserProfile));
        } else {
          const cachedKeys = Object.keys(localStorage).filter((k) => k.startsWith('eldercare-user-profile:'));
          const localElders: AppUserProfile[] = [];
          for (const key of cachedKeys) {
            try {
              const u = JSON.parse(localStorage.getItem(key) || '{}') as AppUserProfile;
              if (u.role === 'elder') localElders.push(u);
            } catch {}
          }
          setElders(localElders);
        }
      } catch (err) {
        console.error('Failed to load elders:', err);
      } finally {
        setLoading(false);
      }
    }
    void loadElders();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <header>
        <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-2">
          Admin Portal
        </span>
        <h1 className="text-3xl font-bold text-slate-900">System Resident Directory</h1>
        <p className="text-sm text-slate-500 mt-1">Platform-wide elder directory and authorized profile overview.</p>
      </header>

      {loading ? (
        <div className="py-12 text-center text-sm text-slate-400">Loading resident directory...</div>
      ) : (
        <div className="grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">All Registered Residents</h2>
            <div className="space-y-3">
              {elders.map((elder) => (
                <div
                  key={elder.uid}
                  onClick={() => setSelectedElder(elder)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    selectedElder?.uid === elder.uid
                      ? 'border-blue-500 bg-blue-50/50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                      👵
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{elder.fullName}</div>
                      <div className="font-mono text-xs text-slate-500">ID: {elder.elderId}</div>
                    </div>
                  </div>

                  <span className="text-xs font-bold text-blue-600">Select →</span>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5">
            {selectedElder ? (
              <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200 space-y-4 sticky top-24">
                <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">
                  Resident Overview: {selectedElder.fullName}
                </h3>
                <div className="space-y-2 text-xs text-slate-600">
                  <p><span className="text-slate-400 font-medium">Elder ID:</span> <span className="font-mono font-bold text-slate-800">{selectedElder.elderId}</span></p>
                  <p><span className="text-slate-400 font-medium">Email:</span> {selectedElder.email}</p>
                  <p><span className="text-slate-400 font-medium">Account Status:</span> <span className="text-emerald-600 font-bold uppercase">{selectedElder.status}</span></p>
                  <p><span className="text-slate-400 font-medium">Registered:</span> {new Date(selectedElder.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
                Select a resident from the list to view explicit Elder overview data.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
