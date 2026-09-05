import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useEldercare } from '../context/EldercareContext';
import type { EditableProfileFields } from '../lib/userStore';

type Tab = 'overview' | 'personal' | 'role' | 'security';

const ROLE_COLOR: Record<string, string> = {
  admin: 'bg-violet-100 text-violet-700',
  caregiver: 'bg-emerald-100 text-emerald-700',
  elder: 'bg-sky-100 text-sky-700',
};

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator',
  caregiver: 'Caregiver',
  elder: 'Resident / Elder',
};

const STATUS_COLOR: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  inactive: 'bg-rose-100 text-rose-700',
  pending: 'bg-amber-100 text-amber-700',
};

function Avatar({ name, size = 'lg' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const sizeClass = size === 'lg' ? 'w-24 h-24 text-3xl' : size === 'md' ? 'w-16 h-16 text-xl' : 'w-10 h-10 text-sm';
  return (
    <div className={`${sizeClass} rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black shadow-lg shrink-0`}>
      {initials || '?'}
    </div>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value?: string | number | null; mono?: boolean }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
      <span className={`text-sm font-semibold text-slate-800 ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
        <span className="material-symbols-outlined text-blue-600 text-xl">{icon}</span>
        <h3 className="font-bold text-slate-800 text-base">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function PermissionRow({ label, granted = true }: { label: string; granted?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
      <span className="text-sm text-slate-700">{label}</span>
      <span className={`flex items-center gap-1 text-xs font-bold ${granted ? 'text-emerald-600' : 'text-slate-400'}`}>
        <span className="material-symbols-outlined text-base">{granted ? 'check_circle' : 'cancel'}</span>
        {granted ? 'Granted' : 'Restricted'}
      </span>
    </div>
  );
}

export default function AccountProfile() {
  const navigate = useNavigate();
  const { profile, role, loading, error, updateProfile, logout } = useAuth();
  const { data } = useEldercare();

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [editMode, setEditMode] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [form, setForm] = useState<Partial<EditableProfileFields>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (profile) {
      setForm({
        fullName: profile.fullName,
        phone: profile.phone ?? '',
        address: profile.address ?? '',
        organization: profile.organization ?? '',
        qualifications: profile.qualifications ?? '',
        certifications: profile.certifications ?? '',
        specialization: profile.specialization ?? '',
        experienceYears: profile.experienceYears,
        joiningDate: profile.joiningDate ?? '',
      });
    }
  }, [profile]);

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <span className="material-symbols-outlined text-4xl mr-3">lock</span>
        <span className="font-semibold">Profile not available. Please sign in.</span>
      </div>
    );
  }

  const joinedDate = profile.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';

  const accountStatus = profile.status ?? 'active';
  const isGuest = profile.uid === 'guest-user';
  const caregiverId = `CG-${profile.uid.slice(0, 6).toUpperCase()}`;
  const elderId = `EL-${profile.uid.slice(0, 6).toUpperCase()}`;

  const handleSave = async () => {
    await updateProfile(form);
    setSaveMsg('Profile updated successfully.');
    setEditMode(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSaveMsg(''), 4000);
  };

  const handlePasswordReset = async () => {
    if (!auth || !profile.email) return;
    try {
      await sendPasswordResetEmail(auth, profile.email);
      setResetMsg(`Password reset email sent to ${profile.email}`);
    } catch {
      setResetMsg('Failed to send reset email. Try again.');
    }
  };

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: 'person' },
    { id: 'personal', label: 'Personal Info', icon: 'edit_note' },
    { id: 'role', label: `${ROLE_LABEL[role ?? 'admin']} Info`, icon: 'badge' },
    { id: 'security', label: 'Security', icon: 'shield' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-5xl mx-auto">

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-800">My Account</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your profile, preferences, and security settings.</p>
        </div>
        {isGuest && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">
            ⚠️ Guest Mode — changes won&apos;t be saved
          </div>
        )}
      </div>

      {/* Profile Hero Card */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-blue-600 to-indigo-700" />
        <div className="px-6 pb-6 -mt-12">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="border-4 border-white rounded-full shadow-lg">
              <Avatar name={profile.fullName} size="lg" />
            </div>
            <div className="flex-1 pt-2 sm:pt-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 className="text-2xl font-black text-slate-800">{profile.fullName}</h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${ROLE_COLOR[role ?? 'admin']}`}>
                  {ROLE_LABEL[role ?? 'admin']}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${STATUS_COLOR[accountStatus]}`}>
                  ● {accountStatus}
                </span>
              </div>
              <p className="text-slate-500 text-sm">{profile.email}</p>
              {profile.phone && <p className="text-slate-500 text-sm">{profile.phone}</p>}
            </div>
            <button
              onClick={() => { setEditMode(true); setActiveTab('personal'); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors shrink-0"
            >
              <span className="material-symbols-outlined text-base">edit</span>
              Edit Profile
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-2xl p-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span className="material-symbols-outlined text-base">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}
      {saveMsg && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-base">check_circle</span>
          {saveMsg}
        </div>
      )}

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div className="grid gap-6 md:grid-cols-2">
          <SectionCard title="Account Details" icon="account_circle">
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Full Name" value={profile.fullName} />
              <InfoRow label="Email" value={profile.email} />
              <InfoRow label="Phone" value={profile.phone || '—'} />
              <InfoRow label="Role" value={ROLE_LABEL[role ?? 'admin']} />
              <InfoRow label="Status" value={accountStatus} />
              <InfoRow label="Joined" value={joinedDate} />
              {profile.organization && <InfoRow label="Organization" value={profile.organization} />}
              {profile.address && <InfoRow label="Address" value={profile.address} />}
            </div>
          </SectionCard>

          <SectionCard title="Sign-In Method" icon="key">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
              <span className="material-symbols-outlined text-2xl text-slate-500">
                {profile.authProvider === 'google' ? 'g_mobiledata' : 'email'}
              </span>
              <div>
                <p className="font-bold text-slate-800 text-sm capitalize">{profile.authProvider} Authentication</p>
                <p className="text-xs text-slate-500">{profile.email}</p>
              </div>
              <span className="ml-auto text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">Active</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <InfoRow label="Account ID" value={profile.uid.slice(0, 12) + '...'} mono />
              <InfoRow label="Elder ID" value={profile.elderId} mono />
            </div>
          </SectionCard>

          <SectionCard title="Quick Actions" icon="bolt">
            <div className="grid gap-2">
              {[
                { label: 'Edit Profile', icon: 'edit', action: () => { setEditMode(true); setActiveTab('personal'); } },
                { label: 'Security Settings', icon: 'shield', action: () => setActiveTab('security') },
                ...(role !== 'elder' ? [{ label: 'View Resident', icon: 'elderly', action: () => navigate('/profile') }] : []),
                { label: 'View Dashboard', icon: 'dashboard', action: () => navigate('/') },
              ].map(({ label, icon, action }) => (
                <button
                  key={label}
                  onClick={action}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-sm font-semibold text-slate-700 text-left"
                >
                  <span className="material-symbols-outlined text-base text-blue-600">{icon}</span>
                  {label}
                  <span className="material-symbols-outlined text-base text-slate-400 ml-auto">chevron_right</span>
                </button>
              ))}
            </div>
          </SectionCard>

          {data && (
            <SectionCard title="Resident Summary" icon="monitor_heart">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 mb-3">
                <span className="material-symbols-outlined text-blue-600">elderly</span>
                <div>
                  <p className="font-bold text-slate-800 text-sm">{data.profile.fullName}</p>
                  <p className="text-xs text-slate-500">Age {data.profile.age} · {data.profile.gender} · {data.profile.bloodGroup}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl">
                  <p className="text-slate-500 font-semibold">Conditions</p>
                  <p className="font-bold text-slate-800 mt-1">{data.profile.conditions.join(', ') || '—'}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl">
                  <p className="text-slate-500 font-semibold">Allergies</p>
                  <p className="font-bold text-slate-800 mt-1">{data.profile.allergies.join(', ') || '—'}</p>
                </div>
              </div>
            </SectionCard>
          )}
        </div>
      )}

      {/* ── PERSONAL INFO TAB ── */}
      {activeTab === 'personal' && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-800 text-lg">Personal Information</h3>
            {!editMode ? (
              <button
                onClick={() => setEditMode(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 text-blue-700 text-sm font-bold hover:bg-blue-100 transition-colors"
              >
                <span className="material-symbols-outlined text-base">edit</span>
                Edit
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setEditMode(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={loading}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-60">
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {[
              { key: 'fullName', label: 'Full Name', type: 'text', placeholder: 'Your full name' },
              { key: 'phone', label: 'Phone Number', type: 'tel', placeholder: '+91 XXXXX XXXXX' },
              { key: 'address', label: 'Address', type: 'text', placeholder: 'Your address' },
              { key: 'organization', label: 'Organization / Care Center', type: 'text', placeholder: 'Organization name' },
            ].map(({ key, label, type, placeholder }) => (
              <div key={key} className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</label>
                <input
                  type={type}
                  disabled={!editMode}
                  placeholder={placeholder}
                  value={(form as Record<string, string>)[key] ?? ''}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 bg-slate-50 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            ))}

            {/* Read-only fields */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Email Address</label>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 bg-slate-100">
                <span className="text-sm text-slate-500 flex-1">{profile.email}</span>
                <span className="material-symbols-outlined text-slate-400 text-base">lock</span>
              </div>
              <p className="text-xs text-slate-400">Email cannot be changed here</p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Account Role</label>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 bg-slate-100">
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${ROLE_COLOR[role ?? 'admin']}`}>
                  {ROLE_LABEL[role ?? 'admin']}
                </span>
                <span className="material-symbols-outlined text-slate-400 text-base ml-auto">lock</span>
              </div>
              <p className="text-xs text-slate-400">Role is managed by administrators</p>
            </div>
          </div>

          {/* Caregiver professional fields */}
          {role === 'caregiver' && (
            <div className="mt-6 pt-6 border-t border-slate-100">
              <h4 className="font-bold text-slate-700 mb-4 text-sm uppercase tracking-wide">Professional Details</h4>
              <div className="grid md:grid-cols-2 gap-5">
                {[
                  { key: 'qualifications', label: 'Qualifications', placeholder: 'e.g. BSc Nursing, GNM' },
                  { key: 'certifications', label: 'Certifications', placeholder: 'e.g. First Aid, CPR' },
                  { key: 'specialization', label: 'Specialization', placeholder: 'e.g. Geriatric Care' },
                ].map(({ key, label, placeholder }) => (
                  <div key={key} className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</label>
                    <input
                      type="text"
                      disabled={!editMode}
                      placeholder={placeholder}
                      value={(form as Record<string, string>)[key] ?? ''}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 bg-slate-50 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                ))}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Experience (Years)</label>
                  <input
                    type="number" min={0} max={50}
                    disabled={!editMode}
                    placeholder="Years of experience"
                    value={form.experienceYears ?? ''}
                    onChange={(e) => setForm({ ...form, experienceYears: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 bg-slate-50 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Joining Date</label>
                  <input
                    type="date"
                    disabled={!editMode}
                    value={form.joiningDate ?? ''}
                    onChange={(e) => setForm({ ...form, joiningDate: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 bg-slate-50 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ROLE INFO TAB ── */}
      {activeTab === 'role' && (
        <div className="grid gap-6 md:grid-cols-2">
          {role === 'admin' && (
            <>
              <SectionCard title="Administrator Details" icon="admin_panel_settings">
                <div className="grid grid-cols-2 gap-4">
                  <InfoRow label="Admin ID" value={`ADM-${profile.uid.slice(0, 6).toUpperCase()}`} mono />
                  <InfoRow label="Role" value="Administrator" />
                  <InfoRow label="Account Status" value={accountStatus} />
                  <InfoRow label="Member Since" value={joinedDate} />
                  {profile.organization && <InfoRow label="Organization" value={profile.organization} />}
                </div>
              </SectionCard>
              <SectionCard title="Permissions" icon="verified_user">
                <PermissionRow label="User Management" />
                <PermissionRow label="Caregiver Management" />
                <PermissionRow label="Elderly Management" />
                <PermissionRow label="Health Data Access" />
                <PermissionRow label="AI Insights & Reports" />
                <PermissionRow label="Camera & Device Mgmt" />
                <PermissionRow label="System Settings" />
                <PermissionRow label="Emergency Controls" />
              </SectionCard>
              <SectionCard title="Admin Actions" icon="manage_accounts">
                <div className="grid gap-2">
                  {[
                    { label: 'Manage Resident Profile', path: '/profile', icon: 'elderly' },
                    { label: 'Manage Care Team', path: '/team', icon: 'group' },
                    { label: 'View AI Insights', path: '/insights', icon: 'psychology' },
                    { label: 'Device Management', path: '/devices', icon: 'devices' },
                    { label: 'System Settings', path: '/settings', icon: 'settings' },
                    { label: 'Emergency Center', path: '/emergency', icon: 'emergency' },
                  ].map(({ label, path, icon }) => (
                    <button key={path} onClick={() => navigate(path)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-sm font-semibold text-slate-700 text-left">
                      <span className="material-symbols-outlined text-base text-blue-600">{icon}</span>
                      {label}
                      <span className="material-symbols-outlined text-base text-slate-400 ml-auto">chevron_right</span>
                    </button>
                  ))}
                </div>
              </SectionCard>
            </>
          )}

          {role === 'caregiver' && (
            <>
              <SectionCard title="Caregiver Details" icon="medical_services">
                <div className="grid grid-cols-2 gap-4">
                  <InfoRow label="Caregiver ID" value={caregiverId} mono />
                  <InfoRow label="Employment Status" value="Active" />
                  <InfoRow label="Member Since" value={joinedDate} />
                  <InfoRow label="Assigned Elder" value={profile.elderId} mono />
                  {profile.experienceYears && <InfoRow label="Experience" value={`${profile.experienceYears} years`} />}
                  {profile.specialization && <InfoRow label="Specialization" value={profile.specialization} />}
                  {profile.qualifications && <InfoRow label="Qualifications" value={profile.qualifications} />}
                  {profile.certifications && <InfoRow label="Certifications" value={profile.certifications} />}
                  {profile.joiningDate && <InfoRow label="Joining Date" value={new Date(profile.joiningDate).toLocaleDateString('en-IN')} />}
                </div>
              </SectionCard>
              {data && (
                <SectionCard title="Assigned Resident" icon="elderly">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50">
                    <span className="material-symbols-outlined text-blue-600 text-2xl">person</span>
                    <div>
                      <p className="font-bold text-slate-800">{data.profile.fullName}</p>
                      <p className="text-xs text-slate-500">Age {data.profile.age} · {data.profile.gender} · {data.profile.bloodGroup}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div className="bg-slate-50 p-3 rounded-xl">
                      <p className="text-xs text-slate-500 font-semibold">Active Medications</p>
                      <p className="text-xl font-black text-slate-800">{data.medications.filter(m => m.active).length}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl">
                      <p className="text-xs text-slate-500 font-semibold">Care Contacts</p>
                      <p className="text-xl font-black text-slate-800">{data.contacts.length}</p>
                    </div>
                  </div>
                  <button onClick={() => navigate('/profile')}
                    className="w-full mt-2 py-2.5 rounded-xl border border-blue-200 text-blue-700 text-sm font-bold hover:bg-blue-50 transition-colors">
                    View Resident Profile
                  </button>
                </SectionCard>
              )}
              <SectionCard title="Quick Actions" icon="bolt">
                <div className="grid gap-2">
                  {[
                    { label: 'View Health Monitor', path: '/health', icon: 'monitor_heart' },
                    { label: 'Manage Routine', path: '/routine', icon: 'event_repeat' },
                    { label: 'Care Team', path: '/team', icon: 'group' },
                    { label: 'AI Insights', path: '/insights', icon: 'psychology' },
                  ].map(({ label, path, icon }) => (
                    <button key={path} onClick={() => navigate(path)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-sm font-semibold text-slate-700 text-left">
                      <span className="material-symbols-outlined text-base text-blue-600">{icon}</span>
                      {label}
                      <span className="material-symbols-outlined text-base text-slate-400 ml-auto">chevron_right</span>
                    </button>
                  ))}
                </div>
              </SectionCard>
            </>
          )}

          {role === 'elder' && (
            <>
              <SectionCard title="My Details" icon="person">
                <div className="grid grid-cols-2 gap-4">
                  <InfoRow label="Resident ID" value={elderId} mono />
                  <InfoRow label="Account Status" value={accountStatus} />
                  <InfoRow label="Member Since" value={joinedDate} />
                  <InfoRow label="Assigned ID" value={profile.elderId} mono />
                  {data && <InfoRow label="Age" value={`${data.profile.age} years`} />}
                  {data && <InfoRow label="Blood Group" value={data.profile.bloodGroup} />}
                </div>
              </SectionCard>
              {data && data.contacts.length > 0 && (
                <SectionCard title="Emergency Contacts" icon="emergency">
                  {data.contacts.map((c) => (
                    <div key={c.id} className="flex items-start gap-3 py-3 border-b border-slate-50 last:border-0">
                      <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-rose-600 text-base">person</span>
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{c.name}</p>
                        <p className="text-xs text-slate-500">{c.relation} · {c.role}</p>
                        <a href={`tel:${c.phone}`} className="text-xs font-bold text-blue-600">{c.phone}</a>
                      </div>
                      {c.notifyOnEmergency && (
                        <span className="ml-auto text-xs font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-full">SOS</span>
                      )}
                    </div>
                  ))}
                </SectionCard>
              )}
              {data && (
                <SectionCard title="My Care Summary" icon="favorite">
                  <div className="space-y-3">
                    <div className="bg-slate-50 p-3 rounded-xl">
                      <p className="text-xs font-bold text-slate-500 uppercase mb-2">Active Medications</p>
                      {data.medications.filter(m => m.active).map(med => (
                        <div key={med.id} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                          <div>
                            <p className="text-sm font-bold text-slate-800">{med.name}</p>
                            <p className="text-xs text-slate-500">{med.dosage}</p>
                          </div>
                          <span className="text-xs text-blue-600 font-bold">{med.schedule.join(', ')}</span>
                        </div>
                      ))}
                    </div>
                    {data.profile.careNotes && (
                      <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl">
                        <p className="text-xs font-bold text-amber-700 uppercase mb-1">Care Notes</p>
                        <p className="text-xs text-amber-800">{data.profile.careNotes}</p>
                      </div>
                    )}
                  </div>
                  <button onClick={() => navigate('/health')}
                    className="w-full mt-2 py-2.5 rounded-xl border border-blue-200 text-blue-700 text-sm font-bold hover:bg-blue-50 transition-colors">
                    View My Health Data
                  </button>
                </SectionCard>
              )}
            </>
          )}
        </div>
      )}

      {/* ── SECURITY TAB ── */}
      {activeTab === 'security' && (
        <div className="grid gap-6 md:grid-cols-2">
          <SectionCard title="Password & Authentication" icon="lock">
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50">
                <p className="font-bold text-slate-800 text-sm">Sign-in Method</p>
                <p className="text-xs text-slate-500 mt-0.5 capitalize">{profile.authProvider} Authentication</p>
              </div>
              {profile.authProvider === 'password' ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-500">
                    Click below to receive a password reset link at <strong>{profile.email}</strong>.
                  </p>
                  <button onClick={handlePasswordReset}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors">
                    <span className="material-symbols-outlined text-base">mail</span>
                    Send Password Reset Email
                  </button>
                  {resetMsg && (
                    <p className={`text-xs font-semibold rounded-xl px-3 py-2 ${resetMsg.includes('Failed') ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                      {resetMsg}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  You signed in with Google. Password is managed by your Google account.
                </p>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Account Information" icon="info">
            <div className="grid gap-4">
              <InfoRow label="Account ID" value={profile.uid} mono />
              <InfoRow label="Created" value={joinedDate} />
              <InfoRow label="Auth Provider" value={profile.authProvider} />
              <InfoRow label="Email" value={profile.email} />
            </div>
          </SectionCard>

          <SectionCard title="Sign Out" icon="logout">
            <p className="text-sm text-slate-500">
              You will be signed out of this device. Your data remains safe in the cloud.
            </p>
            <button
              onClick={async () => { await logout(); navigate('/login'); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 transition-colors"
            >
              <span className="material-symbols-outlined text-base">logout</span>
              Sign Out
            </button>
          </SectionCard>
        </div>
      )}
    </div>
  );
}
