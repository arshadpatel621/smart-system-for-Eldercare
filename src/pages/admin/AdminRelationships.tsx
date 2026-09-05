import { useEffect, useState } from 'react';
import { getAllRelationships } from '../../services/relationshipService';
import type { Relationship } from '../../types/relationship';

export default function AdminRelationships() {
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRels() {
      try {
        const data = await getAllRelationships();
        setRelationships(data);
      } catch (err) {
        console.error('Failed to load relationships:', err);
      } finally {
        setLoading(false);
      }
    }
    void loadRels();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <header>
        <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-2">
          Admin Portal
        </span>
        <h1 className="text-3xl font-bold text-slate-900">Caregiver ↔ Elder Relationship Registry</h1>
        <p className="text-sm text-slate-500 mt-1">Platform authorization links established between Caregivers and Elders.</p>
      </header>

      <div className="rounded-3xl bg-white p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
        <h2 className="text-xl font-bold text-slate-900">Active Authorization Links ({relationships.length})</h2>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-400">Loading relationship registry...</div>
        ) : relationships.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            No relationships registered in the platform yet.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {relationships.map((rel) => (
              <div key={rel.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-mono text-[10px] text-slate-400">ID: {rel.id}</span>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 uppercase">
                    {rel.status}
                  </span>
                </div>
                <div className="text-sm font-bold text-slate-900">
                  Elder ID: <span className="font-mono text-amber-700">{rel.elderId}</span>
                </div>
                <div className="text-xs text-slate-500 font-mono">
                  Caregiver UID: {rel.caregiverUid.slice(0, 12)}...
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
