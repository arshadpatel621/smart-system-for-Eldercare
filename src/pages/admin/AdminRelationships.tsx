import { useEffect, useState } from 'react';
import { getRelationshipRegistry } from '../../services/relationshipService';
import type { RelationshipRegistryEntry } from '../../types/relationship';

function formatConnectionDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unavailable' : date.toLocaleString();
}

export default function AdminRelationships() {
  const [relationships, setRelationships] = useState<RelationshipRegistryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRels() {
      try {
        const data = await getRelationshipRegistry();
        setRelationships(data);
      } catch (err) {
        console.error('Failed to load relationships:', err);
        setLoadError(err instanceof Error ? err.message : 'Failed to load relationships.');
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
        <h2 className="text-xl font-bold text-slate-900">Caregiver–Elder Connections ({relationships.length})</h2>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-400">Loading relationship registry...</div>
        ) : loadError ? (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            Could not load the relationship registry: {loadError}
          </div>
        ) : relationships.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            No relationships registered in the platform yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs text-slate-600">
              <thead className="bg-slate-50 uppercase tracking-wider text-[10px] text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Caregiver</th>
                  <th className="p-3.5">Elder</th>
                  <th className="p-3.5">Connection status</th>
                  <th className="p-3.5">Connected on</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {relationships.map((rel) => (
                  <tr key={rel.id} className="hover:bg-slate-50">
                    <td className="p-3.5">
                      <div className="font-semibold text-slate-900">{rel.caregiverName}</div>
                      <div className="mt-1 break-all font-mono text-[10px] text-slate-500">
                        Caregiver ID: {rel.caregiverUid}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-semibold text-slate-900">{rel.elderName}</div>
                      <div className="mt-1 font-mono text-[10px] text-amber-700">
                        Elder ID: {rel.elderId}
                      </div>
                      <div className="mt-1 break-all font-mono text-[10px] text-slate-500">
                        Elder account ID: {rel.elderUid}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase border ${
                        rel.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {rel.status}
                      </span>
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      {formatConnectionDate(rel.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
