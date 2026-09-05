import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  connectCaregiverToElder,
  getLinkedEldersForCaregiver,
} from '../../services/relationshipService';
import type { AppUserProfile } from '../../types/auth';

export default function CaregiverElders() {
  const { profile } = useAuth();
  const [inputElderId, setInputElderId] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [linkedElders, setLinkedElders] = useState<AppUserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const loadElders = async () => {
    if (profile) {
      try {
        const elders = await getLinkedEldersForCaregiver(profile);
        setLinkedElders(elders);
      } catch (err) {
        console.error('Failed to load linked elders:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadElders();
  }, [profile]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.uid) return;

    setFeedback(null);
    setConnecting(true);

    try {
      const res = await connectCaregiverToElder(profile.uid, inputElderId);
      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        setInputElderId('');
        await loadElders();
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to connect to Elder.' });
    } finally {
      setConnecting(false);
    }
  };

  const filteredElders = linkedElders.filter(
    (e) =>
      e.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.elderId && e.elderId.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <header>
        <span className="inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700 mb-2">
          Caregiver Portal
        </span>
        <h1 className="text-3xl font-bold text-slate-900">My Connected Elders</h1>
        <p className="text-sm text-slate-500 mt-1">Manage relationships and connect to elder resident profiles.</p>
      </header>

      {/* Connect to an Elder Form Card */}
      <div className="rounded-3xl bg-white p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 font-bold text-xl">
              <span className="material-symbols-outlined">link</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900">Connect to an Elder</h2>
          </div>
          <p className="text-xs text-slate-500">
            Enter the shareable <strong>Elder ID</strong> (e.g. <code>ELD-7K4P92</code>) provided by the resident to establish a secure monitoring link.
          </p>
        </div>

        {feedback && (
          <div
            className={`rounded-2xl border p-4 text-sm font-medium transition-all ${
              feedback.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-rose-200 bg-rose-50 text-rose-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span>{feedback.message}</span>
              <button onClick={() => setFeedback(null)} className="font-bold text-xs hover:opacity-80 ml-4">
                Dismiss
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleConnect} className="flex flex-col sm:flex-row items-stretch gap-4 max-w-xl">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Enter Elder ID (e.g. ELD-7K4P92)"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-slate-900 uppercase placeholder:normal-case placeholder:font-sans placeholder:text-slate-400 focus:border-blue-500 focus:outline-none transition-all"
              value={inputElderId}
              onChange={(e) => setInputElderId(e.target.value.toUpperCase())}
              required
            />
          </div>

          <button
            type="submit"
            disabled={connecting || !inputElderId.trim()}
            className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500 transition-all disabled:opacity-50 active:scale-95"
          >
            {connecting ? 'Validating...' : 'Connect Elder'}
          </button>
        </form>
      </div>

      {/* Connected Elders Directory */}
      <div className="rounded-3xl bg-white p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600">elderly</span> Active Care Connections
            </h2>
            <p className="text-xs text-slate-500 mt-1">Elders currently linked to your caregiver account.</p>
          </div>

          <input
            type="text"
            placeholder="Search elder name or Elder ID..."
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none w-64"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-sm">Loading connected elders...</div>
        ) : filteredElders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center space-y-3 bg-slate-50">
            <span className="material-symbols-outlined text-4xl text-slate-400">elderly</span>
            <h3 className="text-base font-semibold text-slate-700">No Elders Match Filter</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Use the form above to connect to an elder using their unique Elder ID.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredElders.map((elder) => (
              <div key={elder.uid} className="rounded-2xl border border-slate-200 bg-slate-50 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 font-bold text-xl">
                    👵
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 border border-emerald-200">
                    Active Link
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-slate-900">{elder.fullName}</h3>
                  <p className="font-mono text-xs text-slate-600 mt-1">
                    <span className="text-slate-400 font-sans">Elder ID:</span> {elder.elderId}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-2">
                  <Link
                    to="/caregiver/health"
                    className="flex-1 text-center rounded-xl bg-blue-600 hover:bg-blue-500 text-white py-2 text-xs font-bold transition-all shadow-sm"
                  >
                    View Vitals
                  </Link>
                  <Link
                    to="/caregiver/live-monitor"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all"
                  >
                    Camera
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
