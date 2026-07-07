import { useState } from 'react';
import { useCameraManager } from '../hooks/useCameraManager';
import {
  BRAND_LABELS, LOCATION_LABELS,
  type CameraPublicRecord, type CameraBrand, type CameraLocation,
  type CreateCameraInput, type ProbeResult,
} from '../services/camera';

// ─── Brand & Location Options ─────────────────────────────────────────────────

const BRANDS = Object.entries(BRAND_LABELS) as [CameraBrand, string][];
const LOCATIONS = Object.entries(LOCATION_LABELS) as [CameraLocation, string][];

// ─── Empty Form State ─────────────────────────────────────────────────────────

const emptyForm = (): CreateCameraInput => ({
  name: '', brand: 'cpplus', location: 'living_room',
  ipAddress: '', port: 554, onvifPort: 80,
  username: 'admin', password: '', customRtspPath: '',
});

// ─── Probe Result Panel ───────────────────────────────────────────────────────

function ProbePanel({ result, onClose }: { result: ProbeResult; onClose: () => void }) {
  const statusColor = result.success ? 'emerald' : result.authError ? 'amber' : 'rose';
  const statusText = result.success ? 'Connection Successful' : result.authError ? 'Authentication Failed' : result.networkUnreachable ? 'Host Unreachable' : result.timeout ? 'Connection Timed Out' : 'Connection Failed';

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-slate-800 flex items-center gap-2">
          <span className="material-symbols-outlined text-lg">network_check</span>
          Connection Diagnostics
        </h4>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      </div>

      {/* Overall Status */}
      <div className={`flex items-center gap-3 rounded-xl p-3 bg-${statusColor}-50 border border-${statusColor}-200`}>
        <span className={`material-symbols-outlined text-${statusColor}-600`}>
          {result.success ? 'check_circle' : 'error'}
        </span>
        <div>
          <p className={`font-bold text-${statusColor}-700`}>{statusText}</p>
          {result.errorMessage && <p className="text-xs text-slate-600 mt-0.5">{result.errorMessage}</p>}
        </div>
      </div>

      {/* Capabilities */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'RTSP Stream', ok: result.rtspAvailable, icon: 'videocam' },
          { label: 'ONVIF Protocol', ok: result.onvifAvailable, icon: 'settings_input_antenna' },
        ].map(({ label, ok, icon }) => (
          <div key={label} className={`flex items-center gap-2 rounded-xl p-3 ${ok ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-100 border border-slate-200'}`}>
            <span className={`material-symbols-outlined text-sm ${ok ? 'text-emerald-600' : 'text-slate-400'}`}>{icon}</span>
            <span className={`text-sm font-semibold ${ok ? 'text-emerald-700' : 'text-slate-500'}`}>{label}</span>
            <span className={`ml-auto text-xs font-bold ${ok ? 'text-emerald-600' : 'text-slate-400'}`}>{ok ? 'OK' : 'N/A'}</span>
          </div>
        ))}
      </div>

      {/* Port Scan Results */}
      <div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Port Scan</p>
        <div className="grid grid-cols-3 gap-2">
          {result.portsScanned.map((p) => (
            <div key={p.port} className={`rounded-lg p-2 text-center text-xs ${p.open ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-100 border border-slate-200'}`}>
              <p className={`font-bold ${p.open ? 'text-emerald-700' : 'text-slate-400'}`}>{p.port}</p>
              <p className={`text-[10px] ${p.open ? 'text-emerald-600' : 'text-slate-400'}`}>{p.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Discovered Metadata */}
      {(result.model || result.resolution || result.discoveredRtspPath) && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          {result.manufacturer && <div><span className="text-slate-400">Manufacturer</span><p className="font-semibold">{result.manufacturer}</p></div>}
          {result.model && <div><span className="text-slate-400">Model</span><p className="font-semibold">{result.model}</p></div>}
          {result.firmware && <div><span className="text-slate-400">Firmware</span><p className="font-semibold">{result.firmware}</p></div>}
          {result.resolution && <div><span className="text-slate-400">Resolution</span><p className="font-semibold">{result.resolution} @ {result.fps}fps</p></div>}
          {result.onvifStreamUri && <div className="col-span-2"><span className="text-slate-400">ONVIF Stream URI</span><p className="font-mono text-xs break-all">{result.onvifStreamUri}</p></div>}
          {(!result.onvifStreamUri && result.discoveredRtspPath) && <div className="col-span-2"><span className="text-slate-400">RTSP Path</span><p className="font-mono text-xs break-all">{result.discoveredRtspPath}</p></div>}
        </div>
      )}
    </div>
  );
}

// ─── Camera Form Modal ────────────────────────────────────────────────────────

function CameraFormModal({
  initial, onSave, onClose, saving,
}: {
  initial: CreateCameraInput;
  onSave: (data: CreateCameraInput) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<CreateCameraInput>(initial);
  const [showPassword, setShowPassword] = useState(false);
  const isEdit = !!(initial as any).__isEdit;

  const field = (key: keyof CreateCameraInput, value: any) =>
    setForm((f) => ({ ...f, [key]: value }));

  const labelCls = 'block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider';
  const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">{isEdit ? 'Edit Camera' : 'Add New Camera'}</h2>
            <button onClick={onClose} className="rounded-full p-1 hover:bg-white/20 transition-colors">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <p className="text-blue-100 text-sm mt-1">
            {isEdit ? 'Update camera configuration.' : 'Configure your IP camera connection details.'}
          </p>
        </div>

        {/* Form */}
        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-4">
          {/* Name */}
          <div>
            <label className={labelCls}>Camera Name *</label>
            <input className={inputCls} placeholder="e.g. Living Room Main" value={form.name}
              onChange={(e) => field('name', e.target.value)} />
          </div>

          {/* Brand + Location */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Camera Brand *</label>
              <select className={inputCls} value={form.brand} onChange={(e) => field('brand', e.target.value)}>
                {BRANDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Location *</label>
              <select className={inputCls} value={form.location} onChange={(e) => field('location', e.target.value)}>
                {LOCATIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          {/* IP + Port + ONVIF Port */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>IP Address *</label>
              <input className={inputCls} placeholder="192.168.1.100" value={form.ipAddress}
                onChange={(e) => field('ipAddress', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>RTSP Port</label>
              <input type="number" className={inputCls} value={form.port ?? 554}
                onChange={(e) => field('port', Number(e.target.value))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Username *</label>
              <input className={inputCls} placeholder="admin" value={form.username}
                onChange={(e) => field('username', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>{isEdit ? 'New Password (leave blank to keep)' : 'Password *'}</label>
              <div className="relative">
                <input className={`${inputCls} pr-10`} type={showPassword ? 'text' : 'password'}
                  placeholder={isEdit ? '••••••••' : 'Camera password'}
                  value={form.password} onChange={(e) => field('password', e.target.value)} />
                <button type="button" onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                  <span className="material-symbols-outlined text-sm">{showPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* ONVIF Port */}
          <div>
            <label className={labelCls}>ONVIF Port (optional)</label>
            <input type="number" className={inputCls} placeholder="80" value={form.onvifPort ?? 80}
              onChange={(e) => field('onvifPort', Number(e.target.value))} />
          </div>

          {/* Custom RTSP Path */}
          <div>
            <label className={labelCls}>Custom RTSP Path (optional)</label>
            <input className={inputCls}
              placeholder="Leave empty — auto-detected from brand"
              value={form.customRtspPath ?? ''}
              onChange={(e) => field('customRtspPath', e.target.value)} />
            <p className="text-xs text-slate-400 mt-1">
              e.g. <code>/cam/realmonitor?channel=1&subtype=0</code> — only needed if auto-detection fails
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose}
            className="rounded-xl border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button disabled={saving || !form.name || !form.ipAddress || !form.username || (!isEdit && !form.password)}
            onClick={() => void onSave(form)}
            className="rounded-xl bg-blue-600 px-6 py-2 text-sm font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center gap-2">
            {saving && <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>}
            {isEdit ? 'Save Changes' : 'Add Camera'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Health Badge ─────────────────────────────────────────────────────────────

function HealthBadge({ status }: { status: CameraPublicRecord['healthStatus'] }) {
  const map = {
    healthy:  { color: 'emerald', label: 'Healthy' },
    degraded: { color: 'amber',   label: 'Degraded' },
    offline:  { color: 'rose',    label: 'Offline' },
    unknown:  { color: 'slate',   label: 'Unknown' },
  };
  const { color, label } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-${color}-50 text-${color}-700 border border-${color}-200`}>
      <span className={`h-1.5 w-1.5 rounded-full bg-${color}-500`} />
      {label}
    </span>
  );
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────

function Toggle({ checked, loading, onChange }: { checked: boolean; loading: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} disabled={loading}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${checked ? 'bg-emerald-500' : 'bg-slate-300'}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CameraManagement() {
  const {
    cameras, loading, error, testingId, probeResult,
    deletingId, togglingId, refresh,
    addCamera, editCamera, removeCamera, toggle, runTest,
    clearError, clearProbe,
  } = useCameraManager();

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<CameraPublicRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [probeTargetId, setProbeTargetId] = useState<string | null>(null);

  const openAdd = () => { setEditTarget(null); setShowModal(true); };
  const openEdit = (cam: CameraPublicRecord) => { setEditTarget(cam); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditTarget(null); };

  const handleSave = async (data: CreateCameraInput) => {
    setSaving(true);
    let ok = false;
    if (editTarget) {
      ok = await editCamera(editTarget.id, {
        ...data,
        password: data.password || undefined,
      });
    } else {
      ok = await addCamera(data);
    }
    setSaving(false);
    if (ok) closeModal();
  };

  const handleTest = async (id: string) => {
    setProbeTargetId(id);
    await runTest(id);
  };

  const handleDelete = async (id: string) => {
    const ok = await removeCamera(id);
    if (ok) setConfirmDelete(null);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold text-slate-800">Camera Management</h1>
          <p className="text-slate-500 mt-2 max-w-xl">
            Add, configure, and manage IP cameras. Credentials are encrypted and never exposed.
            Auto-detection resolves RTSP paths for CP Plus, Dahua, Hikvision, Tapo, and EZVIZ.
          </p>
        </div>
        <div className="flex gap-3 shrink-0">
          <button onClick={() => void refresh()}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
            <span className="material-symbols-outlined text-sm">refresh</span>
            Refresh
          </button>
          <button onClick={openAdd}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition-all">
            <span className="material-symbols-outlined text-sm">add</span>
            Add Camera
          </button>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 flex items-center justify-between">
          <p className="text-sm text-rose-700 font-medium">{error}</p>
          <button onClick={clearError} className="text-rose-400 hover:text-rose-700">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20 gap-3 text-slate-500">
          <span className="material-symbols-outlined animate-spin text-2xl text-blue-500">progress_activity</span>
          Loading cameras...
        </div>
      )}

      {/* Empty State */}
      {!loading && cameras.length === 0 && (
        <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 py-20 text-center">
          <span className="material-symbols-outlined text-5xl text-slate-300 block mb-4">videocam_off</span>
          <p className="text-slate-500 font-semibold text-lg">No cameras configured yet</p>
          <p className="text-slate-400 text-sm mt-1 mb-6">Add your first IP camera to get started</p>
          <button onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition-all">
            <span className="material-symbols-outlined text-sm">add</span>
            Add First Camera
          </button>
        </div>
      )}

      {/* Camera Grid */}
      {!loading && cameras.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cameras.map((cam) => (
            <div key={cam.id}
              className="group rounded-3xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-all overflow-hidden">
              {/* Card Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cam.enabled ? 'bg-blue-100' : 'bg-slate-100'}`}>
                    <span className={`material-symbols-outlined text-lg ${cam.enabled ? 'text-blue-600' : 'text-slate-400'}`}>
                      {cam.enabled ? 'videocam' : 'videocam_off'}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 leading-tight">{cam.name}</h3>
                    <p className="text-xs text-slate-500">{BRAND_LABELS[cam.brand]} · {LOCATION_LABELS[cam.location]}</p>
                  </div>
                </div>
                <Toggle
                  checked={cam.enabled}
                  loading={togglingId === cam.id}
                  onChange={() => void toggle(cam.id, !cam.enabled)}
                />
              </div>

              {/* Metadata Grid */}
              <div className="px-5 py-4 grid grid-cols-2 gap-y-3 text-xs">
                <div>
                  <span className="text-slate-400 block">IP Address</span>
                  <span className="font-semibold text-slate-700 font-mono">{cam.ipAddress}:{cam.port}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Health</span>
                  <HealthBadge status={cam.healthStatus} />
                </div>
                {cam.model && (
                  <div>
                    <span className="text-slate-400 block">Model</span>
                    <span className="font-semibold text-slate-700">{cam.model}</span>
                  </div>
                )}
                {cam.resolution && (
                  <div>
                    <span className="text-slate-400 block">Stream</span>
                    <span className="font-semibold text-slate-700">{cam.resolution} @ {cam.fps}fps</span>
                  </div>
                )}
                {cam.lastConnected && (
                  <div className="col-span-2">
                    <span className="text-slate-400 block">Last Connected</span>
                    <span className="font-semibold text-slate-700">{new Date(cam.lastConnected).toLocaleString()}</span>
                  </div>
                )}
                {cam.hasCustomRtspPath && (
                  <div className="col-span-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 text-indigo-600 px-2 py-0.5 text-[10px] font-semibold border border-indigo-200">
                      <span className="material-symbols-outlined text-[10px]">link</span>
                      Custom RTSP path
                    </span>
                  </div>
                )}
              </div>

              {/* Probe Results (inline, only for this card) */}
              {probeTargetId === cam.id && probeResult && (
                <div className="px-5 pb-4">
                  <ProbePanel result={probeResult} onClose={() => { setProbeTargetId(null); clearProbe(); }} />
                </div>
              )}

              {/* Actions */}
              <div className="border-t border-slate-100 px-5 py-3 flex items-center gap-2">
                <button
                  onClick={() => void handleTest(cam.id)}
                  disabled={testingId === cam.id}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors">
                  {testingId === cam.id
                    ? <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                    : <span className="material-symbols-outlined text-sm">network_check</span>}
                  {testingId === cam.id ? 'Testing...' : 'Test'}
                </button>
                <button onClick={() => openEdit(cam)}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                  <span className="material-symbols-outlined text-sm">edit</span>
                  Edit
                </button>
                <button onClick={() => setConfirmDelete(cam.id)}
                  className="ml-auto flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors">
                  <span className="material-symbols-outlined text-sm">delete</span>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Camera Form Modal */}
      {showModal && (
        <CameraFormModal
          initial={editTarget ? { ...editTarget, password: '', __isEdit: true } as any : emptyForm()}
          onSave={handleSave}
          onClose={closeModal}
          saving={saving}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-rose-600">delete</span>
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Delete Camera?</h3>
                <p className="text-sm text-slate-500">This will stop the stream and remove all configuration.</p>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button
                disabled={deletingId === confirmDelete}
                onClick={() => void handleDelete(confirmDelete)}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {deletingId === confirmDelete && <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
