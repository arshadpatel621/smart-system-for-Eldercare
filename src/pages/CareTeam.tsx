import { useState } from 'react';
import { useEldercare } from '../context/EldercareContext';
import { useAuth } from '../context/AuthContext';

export default function CareTeam() {
  const { data, createContact, deleteContact, createMedicalReport, removeMedicalReport } = useEldercare();
  const { profile } = useAuth();

  const [activeTab, setActiveTab] = useState<'caregivers' | 'doctors' | 'reports' | 'activity'>('caregivers');
  
  // Add Member Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addType, setAddType] = useState<'caregiver' | 'doctor'>('caregiver');
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [relation, setRelation] = useState('');
  const [phone, setPhone] = useState('');
  const [notifyOnEmergency, setNotifyOnEmergency] = useState(true);

  // Upload Report Modal State
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTitle, setReportTitle] = useState('');
  const [reportCategory, setReportCategory] = useState('Cardiology');
  const [reportFileName, setReportFileName] = useState('');
  const [reportFileSize, setReportFileSize] = useState('1.5 MB');

  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (!data) {
    return <div className="text-slate-500 p-8 text-center">Loading care team...</div>;
  }

  const caregivers = data.contacts.filter(
    (c) => c.role.toLowerCase() !== 'doctor' && c.role.toLowerCase() !== 'physician'
  );
  const doctors = data.contacts.filter(
    (c) => c.role.toLowerCase() === 'doctor' || c.role.toLowerCase() === 'physician'
  );

  const reports = data.reports || [];

  const openAddModal = (type: 'caregiver' | 'doctor') => {
    setAddType(type);
    setName('');
    setRole(type === 'doctor' ? 'Doctor / Physician' : 'Primary Caregiver');
    setRelation(type === 'doctor' ? 'Cardiologist' : 'Family Contact');
    setPhone('');
    setNotifyOnEmergency(type === 'caregiver');
    setShowAddModal(true);
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    setSaving(true);
    try {
      await createContact({
        name: name.trim(),
        role: role.trim() || (addType === 'doctor' ? 'Doctor' : 'Caregiver'),
        relation: relation.trim() || (addType === 'doctor' ? 'Medical Specialist' : 'Family Contact'),
        phone: phone.trim(),
        notifyOnEmergency,
      });
      setShowAddModal(false);
    } catch (err) {
      console.error('Failed to add care team contact:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMember = async (contactId: string, contactName: string) => {
    if (!window.confirm(`Are you sure you want to delete ${contactName} from the care team?`)) return;
    setDeletingId(contactId);
    try {
      await deleteContact(contactId);
    } catch (err) {
      console.error('Failed to delete contact:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReportFileName(file.name);
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      setReportFileSize(`${sizeMb} MB`);
      if (!reportTitle) {
        setReportTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleUploadReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTitle.trim()) return;

    setSaving(true);
    try {
      await createMedicalReport({
        title: reportTitle.trim(),
        category: reportCategory,
        fileSize: reportFileSize || '1.2 MB',
        uploadedAt: new Date().toISOString(),
        uploadedBy: profile?.fullName || 'Resident',
      });
      setShowReportModal(false);
      setReportTitle('');
      setReportFileName('');
    } catch (err) {
      console.error('Failed to upload medical report:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteReport = async (reportId: string, title: string) => {
    if (!window.confirm(`Delete report "${title}"?`)) return;
    try {
      await removeMedicalReport(reportId);
    } catch (err) {
      console.error('Failed to delete report:', err);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-slate-900">Care Team & Medical Reports</h1>
          <p className="text-slate-500 mt-2 font-semibold text-sm">
            Manage personal caregivers, doctors, emergency contact numbers, and store medical health documents.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => openAddModal('caregiver')}
            className="flex items-center gap-1.5 rounded-2xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-500 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-sm">person_add</span>
            + Add Caregiver
          </button>

          <button
            onClick={() => openAddModal('doctor')}
            className="flex items-center gap-1.5 rounded-2xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-purple-500 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-sm">medical_services</span>
            + Add Doctor
          </button>

          <button
            onClick={() => setShowReportModal(true)}
            className="flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-500 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-sm">upload_file</span>
            + Upload Report
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        {[
          { id: 'caregivers', label: `Caregivers (${caregivers.length})`, icon: 'group' },
          { id: 'doctors', label: `Doctors & Physicians (${doctors.length})`, icon: 'stethoscope' },
          { id: 'reports', label: `Medical Reports (${reports.length})`, icon: 'description' },
          { id: 'activity', label: 'Activity Timeline', icon: 'history' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold transition-colors ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="pt-2">
        {/* Caregivers Tab */}
        {activeTab === 'caregivers' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Connected Caregivers</h2>
              <button
                onClick={() => openAddModal('caregiver')}
                className="text-xs font-bold text-blue-600 hover:underline"
              >
                + Add New Caregiver
              </button>
            </div>

            {caregivers.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center space-y-3">
                <span className="material-symbols-outlined text-5xl text-slate-300">group_add</span>
                <p className="text-slate-600 font-bold text-sm">No caregivers listed yet.</p>
                <button
                  onClick={() => openAddModal('caregiver')}
                  className="rounded-2xl bg-blue-600 text-white px-5 py-2 text-xs font-bold"
                >
                  Add Caregiver
                </button>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {caregivers.map((contact) => (
                  <div key={contact.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between space-y-4 relative group">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-700 font-bold text-xl uppercase">
                          {contact.name.charAt(0)}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full">
                            {contact.relation}
                          </span>
                          <button
                            onClick={() => handleDeleteMember(contact.id, contact.name)}
                            disabled={deletingId === contact.id}
                            title="Delete Caregiver"
                            className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors"
                          >
                            <span className="material-symbols-outlined text-lg">delete</span>
                          </button>
                        </div>
                      </div>

                      <h3 className="text-xl font-bold text-slate-900">{contact.name}</h3>
                      <div className="text-xs text-slate-500 font-semibold mt-0.5">{contact.role}</div>

                      <div className="mt-4 space-y-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-2 font-mono font-bold text-slate-800">
                          <span className="material-symbols-outlined text-base text-slate-400">call</span>
                          {contact.phone}
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${contact.notifyOnEmergency ? 'text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full' : 'text-slate-400'}`}>
                        {contact.notifyOnEmergency ? '🚨 Emergency Contact' : 'Info Contact'}
                      </span>

                      <a
                        href={`tel:${contact.phone}`}
                        className="rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 text-xs font-bold transition-all"
                      >
                        Call
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Doctors Tab */}
        {activeTab === 'doctors' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Attending Doctors & Physicians</h2>
              <button
                onClick={() => openAddModal('doctor')}
                className="text-xs font-bold text-purple-600 hover:underline"
              >
                + Add New Doctor
              </button>
            </div>

            {doctors.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center space-y-3">
                <span className="material-symbols-outlined text-5xl text-slate-300">stethoscope</span>
                <p className="text-slate-600 font-bold text-sm">No medical doctors added yet.</p>
                <button
                  onClick={() => openAddModal('doctor')}
                  className="rounded-2xl bg-purple-600 text-white px-5 py-2 text-xs font-bold"
                >
                  Add Doctor
                </button>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {doctors.map((contact) => (
                  <div key={contact.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between space-y-4 relative group">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-700 font-bold text-xl uppercase">
                          👨‍⚕️
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-purple-600 bg-purple-50 border border-purple-100 px-2.5 py-1 rounded-full">
                            {contact.relation}
                          </span>
                          <button
                            onClick={() => handleDeleteMember(contact.id, contact.name)}
                            disabled={deletingId === contact.id}
                            title="Remove / Delete Doctor"
                            className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors"
                          >
                            <span className="material-symbols-outlined text-lg">delete</span>
                          </button>
                        </div>
                      </div>

                      <h3 className="text-xl font-bold text-slate-900">{contact.name}</h3>
                      <div className="text-xs text-purple-700 font-bold mt-0.5">{contact.role}</div>

                      <div className="mt-4 space-y-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-2 font-mono font-bold text-slate-800">
                          <span className="material-symbols-outlined text-base text-slate-400">call</span>
                          {contact.phone}
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                      <a
                        href={`tel:${contact.phone}`}
                        className="flex-1 text-center bg-purple-600 hover:bg-purple-500 text-white py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
                      >
                        Call Doctor
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="space-y-6 max-w-4xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Stored Medical & Health Reports</h2>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  Secure storage for cardiology assessments, lab results, prescriptions, and daily logs.
                </p>
              </div>

              <button
                onClick={() => setShowReportModal(true)}
                className="flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-500 transition-all"
              >
                <span className="material-symbols-outlined text-sm">upload_file</span>
                + Upload / Add Report
              </button>
            </div>

            {reports.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center space-y-3">
                <span className="material-symbols-outlined text-5xl text-slate-300">folder_open</span>
                <p className="text-slate-600 font-bold text-sm">No health reports uploaded yet.</p>
                <button
                  onClick={() => setShowReportModal(true)}
                  className="rounded-2xl bg-emerald-600 text-white px-5 py-2 text-xs font-bold"
                >
                  Upload First Medical Report
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {reports.map((report) => (
                  <div
                    key={report.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border border-slate-200 bg-white hover:border-emerald-300 transition-all shadow-sm gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0">
                        <span className="material-symbols-outlined text-2xl">picture_as_pdf</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-900 text-base">{report.title}</h3>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                            {report.category}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-3">
                          <span>📅 {new Date(report.uploadedAt).toLocaleDateString()}</span>
                          <span>📦 {report.fileSize}</span>
                          {report.uploadedBy && <span>👤 Added by {report.uploadedBy}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          alert(`Downloading "${report.title}" (${report.fileSize})...`);
                        }}
                        className="flex items-center gap-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors"
                      >
                        <span className="material-symbols-outlined text-base">download</span>
                        Download
                      </a>

                      <button
                        onClick={() => handleDeleteReport(report.id, report.title)}
                        title="Delete Medical Report"
                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded-xl hover:bg-rose-50 transition-colors"
                      >
                        <span className="material-symbols-outlined text-xl">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && (
          <div className="max-w-3xl relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
             {[
               { title: 'Morning Check-in', user: 'Sarah (Caregiver)', time: '08:00 AM Today', note: 'Resident woke up in good spirits. Assisted with morning routine and breakfast.', icon: 'how_to_reg', color: 'emerald' },
               { title: 'Medication Administered', user: 'Sarah (Caregiver)', time: '08:30 AM Today', note: 'Lisinopril and morning vitamins taken with food.', icon: 'medication', color: 'blue' },
               { title: 'Physical Therapy Session', user: 'Mark (PT)', time: '02:00 PM Yesterday', note: 'Completed full set of leg exercises. Mobility is improving.', icon: 'directions_walk', color: 'purple' },
             ].map((activity, i) => (
               <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active mb-8">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-${activity.color}-100 text-${activity.color}-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10`}>
                    <span className="material-symbols-outlined text-[18px]">{activity.icon}</span>
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-2xl border border-slate-100 bg-white shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2">
                      <div className="font-bold text-slate-800">{activity.title}</div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{activity.time}</div>
                    </div>
                    <div className="text-xs font-bold text-slate-600 mb-2">{activity.user}</div>
                    <div className="text-sm text-slate-500">{activity.note}</div>
                  </div>
               </div>
             ))}
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600">
                  {addType === 'doctor' ? 'medical_services' : 'person_add'}
                </span>
                Add New {addType === 'doctor' ? 'Doctor' : 'Caregiver'}
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 transition-colors"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder={addType === 'doctor' ? 'e.g. Dr. Robert Smith' : 'e.g. Sarah Jenkins'}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="e.g. +1 555-0192"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-mono text-slate-900 focus:border-blue-500 focus:outline-none"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Role / Title
                </label>
                <input
                  type="text"
                  placeholder={addType === 'doctor' ? 'e.g. Doctor / Physician' : 'e.g. Primary Caregiver'}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Specialty / Relationship
                </label>
                <input
                  type="text"
                  placeholder={addType === 'doctor' ? 'e.g. Cardiologist' : 'e.g. Family Contact'}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
                  value={relation}
                  onChange={(e) => setRelation(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="notifyEmergency"
                  checked={notifyOnEmergency}
                  onChange={(e) => setNotifyOnEmergency(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="notifyEmergency" className="text-xs text-slate-700 font-semibold cursor-pointer">
                  Notify on Emergency Alerts (Fall / SOS)
                </label>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 rounded-2xl border border-slate-200 bg-white py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !name.trim() || !phone.trim()}
                  className={`flex-1 rounded-2xl text-white py-3 text-xs font-bold transition-all shadow-md disabled:opacity-50 ${
                    addType === 'doctor' ? 'bg-purple-600 hover:bg-purple-500' : 'bg-blue-600 hover:bg-blue-500'
                  }`}
                >
                  {saving ? 'Saving...' : `Save ${addType === 'doctor' ? 'Doctor' : 'Caregiver'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Medical Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600">upload_file</span>
                Upload Medical Report
              </h2>
              <button
                onClick={() => setShowReportModal(false)}
                className="text-slate-400 hover:text-slate-700 transition-colors"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <form onSubmit={handleUploadReport} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Report Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cardiology Assessment - June 2026"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Medical Category
                </label>
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                  value={reportCategory}
                  onChange={(e) => setReportCategory(e.target.value)}
                >
                  <option value="Cardiology">Cardiology</option>
                  <option value="Laboratory">Laboratory & Blood Work</option>
                  <option value="Wellness">Wellness & Vitals Summary</option>
                  <option value="General">General Checkup</option>
                  <option value="Prescription">Prescription Document</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Select Document File (PDF / Image / Doc)
                </label>
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center bg-slate-50/50 hover:bg-slate-50 transition-colors">
                  <input
                    type="file"
                    id="reportFile"
                    accept=".pdf,.doc,.docx,.jpg,.png"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label htmlFor="reportFile" className="cursor-pointer space-y-1 block">
                    <span className="material-symbols-outlined text-3xl text-emerald-600 block">cloud_upload</span>
                    <span className="text-xs font-bold text-slate-700 block">
                      {reportFileName ? reportFileName : 'Click to choose file from computer'}
                    </span>
                    <span className="text-[10px] text-slate-400 block">PDF, DOC, DOCX, PNG, JPG up to 10MB</span>
                  </label>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="flex-1 rounded-2xl border border-slate-200 bg-white py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !reportTitle.trim()}
                  className="flex-1 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white py-3 text-xs font-bold transition-all shadow-md disabled:opacity-50"
                >
                  {saving ? 'Saving Report...' : 'Save & Store Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
