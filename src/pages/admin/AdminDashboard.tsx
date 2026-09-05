import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { getAllRelationships } from '../../services/relationshipService';
import type { AppUserProfile } from '../../types/auth';
import type { Relationship } from '../../types/relationship';

export default function AdminDashboard() {
  const [users, setUsers] = useState<AppUserProfile[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);

  useEffect(() => {
    async function loadAdminOverview() {
      try {
        const rels = await getAllRelationships();
        setRelationships(rels);

        if (db) {
          const userSnap = await getDocs(collection(db, 'users'));
          const loadedUsers = userSnap.docs.map((d) => d.data() as AppUserProfile);
          setUsers(loadedUsers);
        } else {
          const cachedKeys = Object.keys(localStorage).filter((k) => k.startsWith('eldercare-user-profile:'));
          const localUsers: AppUserProfile[] = [];
          for (const key of cachedKeys) {
            try {
              const u = JSON.parse(localStorage.getItem(key) || '{}') as AppUserProfile;
              if (u.uid) localUsers.push(u);
            } catch {
              // ignore
            }
          }
          setUsers(localUsers);
        }
      } catch (err) {
        console.error('Failed to load admin data:', err);
      }
    }
    void loadAdminOverview();
  }, []);

  const eldersCount = users.filter((u) => u.role === 'elder').length;
  const caregiversCount = users.filter((u) => u.role === 'caregiver').length;
  const adminsCount = users.filter((u) => u.role === 'admin').length;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* System Overview Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
        <div>
          <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-2">
            System Administration
          </span>
          <h1 className="text-3xl font-bold text-slate-900">
            Platform Command Center
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            System-wide operational oversight, user management, and platform analytics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800">
            🛡️ System Privileged Access
          </span>
        </div>
      </div>

      {/* System Overview Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Total Users</span>
            <span className="material-symbols-outlined text-slate-400">group</span>
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900">{users.length}</p>
          <p className="text-[11px] text-slate-400 mt-1">{adminsCount} Admin accounts</p>
        </div>

        <div className="rounded-2xl bg-amber-50/50 p-5 border border-amber-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800 uppercase">Elders</span>
            <span className="material-symbols-outlined text-amber-600">elderly</span>
          </div>
          <p className="mt-2 text-3xl font-bold text-amber-950">{eldersCount}</p>
        </div>

        <div className="rounded-2xl bg-blue-50/50 p-5 border border-blue-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-800 uppercase">Caregivers</span>
            <span className="material-symbols-outlined text-blue-600">medical_services</span>
          </div>
          <p className="mt-2 text-3xl font-bold text-blue-950">{caregiversCount}</p>
        </div>

        <div className="rounded-2xl bg-teal-50/50 p-5 border border-teal-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-teal-800 uppercase">Active Relationships</span>
            <span className="material-symbols-outlined text-teal-600">link</span>
          </div>
          <p className="mt-2 text-3xl font-bold text-teal-950">{relationships.length}</p>
        </div>
      </div>

      {/* Quick Navigation to Admin Sub-Modules */}
      <div className="grid gap-6 md:grid-cols-4">
        <Link
          to="/admin/users"
          className="group rounded-3xl bg-white p-6 shadow-sm border border-slate-200 transition-all hover:-translate-y-1 hover:border-blue-300"
        >
          <span className="material-symbols-outlined text-3xl text-blue-600 mb-2 block">manage_accounts</span>
          <h3 className="font-bold text-slate-900 group-hover:text-blue-600 text-base">User Management</h3>
          <p className="text-xs text-slate-500 mt-1">Directory & role permissions.</p>
        </Link>

        <Link
          to="/admin/residents"
          className="group rounded-3xl bg-white p-6 shadow-sm border border-slate-200 transition-all hover:-translate-y-1 hover:border-amber-300"
        >
          <span className="material-symbols-outlined text-3xl text-amber-600 mb-2 block">elderly</span>
          <h3 className="font-bold text-slate-900 group-hover:text-amber-600 text-base">Resident Directory</h3>
          <p className="text-xs text-slate-500 mt-1">Authorized Elder profiles.</p>
        </Link>

        <Link
          to="/admin/devices"
          className="group rounded-3xl bg-white p-6 shadow-sm border border-slate-200 transition-all hover:-translate-y-1 hover:border-indigo-300"
        >
          <span className="material-symbols-outlined text-3xl text-indigo-600 mb-2 block">devices</span>
          <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 text-base">Device Registry</h3>
          <p className="text-xs text-slate-500 mt-1">System-wide device health.</p>
        </Link>

        <Link
          to="/admin/monitoring"
          className="group rounded-3xl bg-white p-6 shadow-sm border border-slate-200 transition-all hover:-translate-y-1 hover:border-emerald-300"
        >
          <span className="material-symbols-outlined text-3xl text-emerald-600 mb-2 block">monitor_heart</span>
          <h3 className="font-bold text-slate-900 group-hover:text-emerald-600 text-base">System Monitoring</h3>
          <p className="text-xs text-slate-500 mt-1">Platform service status.</p>
        </Link>
      </div>
    </div>
  );
}
