import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { AppUserProfile } from '../../types/auth';

export default function AdminUsers() {
  const [users, setUsers] = useState<AppUserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  useEffect(() => {
    async function loadUsers() {
      try {
        if (db) {
          const userSnap = await getDocs(collection(db, 'users'));
          setUsers(userSnap.docs.map((d) => d.data() as AppUserProfile));
        } else {
          const cachedKeys = Object.keys(localStorage).filter((k) => k.startsWith('eldercare-user-profile:'));
          const localUsers: AppUserProfile[] = [];
          for (const key of cachedKeys) {
            try {
              const u = JSON.parse(localStorage.getItem(key) || '{}') as AppUserProfile;
              if (u.uid) localUsers.push(u);
            } catch {}
          }
          setUsers(localUsers);
        }
      } catch (err) {
        console.error('Failed to load users:', err);
      } finally {
        setLoading(false);
      }
    }
    void loadUsers();
  }, []);

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.elderId && u.elderId.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <header>
        <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-2">
          Admin Portal
        </span>
        <h1 className="text-3xl font-bold text-slate-900">User Account Directory</h1>
        <p className="text-sm text-slate-500 mt-1">Platform user accounts, role permissions, and access status.</p>
      </header>

      <div className="rounded-3xl bg-white p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <input
            type="text"
            placeholder="Search by name, email, or Elder ID..."
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none w-64"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-none"
          >
            <option value="all">All Roles</option>
            <option value="elder">Elders Only</option>
            <option value="caregiver">Caregivers Only</option>
            <option value="admin">Admins Only</option>
          </select>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-400">Loading user registry...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 uppercase tracking-wider text-[10px] text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-3.5">User</th>
                  <th className="p-3.5">Role</th>
                  <th className="p-3.5">Identifier</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => (
                  <tr key={u.uid} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5 font-medium text-slate-900">
                      <div>{u.fullName}</div>
                      <div className="text-[11px] text-slate-400 font-normal">{u.email}</div>
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                          u.role === 'elder'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : u.role === 'caregiver'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono">
                      {u.role === 'elder' ? u.elderId || 'N/A' : u.role === 'caregiver' ? `${u.linkedElderIds?.length || 0} Elders` : 'System Admin'}
                    </td>
                    <td className="p-3.5">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
                        <span className="h-2 w-2 rounded-full bg-emerald-500"></span> Active
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-400">
                      {new Date(u.createdAt).toLocaleDateString()}
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
