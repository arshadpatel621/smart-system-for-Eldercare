import { useState } from 'react';
import { useCameraManager } from '../hooks/useCameraManager';
import {
  BRAND_LABELS, LOCATION_LABELS,
  type CameraPublicRecord, type CameraBrand, type CameraLocation,
  type CreateCameraInput, type ProbeResult,
  discoverCamerasOnLAN, type DiscoveredCamera,
  detectCameraViaAgent, type AgentDetectResult, type DiagnosticStage
} from '../services/camera';

const BRANDS = Object.entries(BRAND_LABELS) as [CameraBrand, string][];
const LOCATIONS = Object.entries(LOCATION_LABELS) as [CameraLocation, string][];

const emptyForm = (): CreateCameraInput => ({
  name: '', brand: 'cpplus', location: 'living_room',
  ipAddress: '', port: 554, onvifPort: 80,
  username: 'admin', password: '', customRtspPath: '',
});

const STAGE_LABELS: Record<DiagnosticStage, string> = {
  ip_reachability: '1. IP Reachability',
  onvif_detection: '2. ONVIF Detection',
  onvif_authentication: '3. ONVIF Authentication (WS-Security)',
  media_profile: '4. Media Profile Discovery',
  rtsp_detection: '5. RTSP Stream URI (ONVIF GetStreamUri)',
  rtsp_test: '6. RTSP Protocol Test (OPTIONS ➔ DESCRIBE ➔ SDP video)'
};

function DiagnosticStagesPanel({ result }: { result: AgentDetectResult }) {
  const overallSuccess = result.success;
  const isHostReachable = result.host_reachable ?? (result.stages?.ip_reachability?.status === 'success');

  const bannerColorClass = overallSuccess
    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
    : isHostReachable
    ? 'bg-amber-50 border-amber-200 text-amber-800'
    : 'bg-rose-50 border-rose-200 text-rose-800';

  const bannerTitle = overallSuccess
    ? 'Camera Verified & Connected Successfully'
    : isHostReachable
    ? 'Host Reachable — Services Not Confirmed'
    : 'Camera Host Unreachable';

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3 animate-in fade-in duration-300">
      <div className={`flex items-center gap-3 rounded-xl p-3.5 border ${bannerColorClass}`}>
        <span className="material-symbols-outlined text-2xl shrink-0">
          {overallSuccess ? 'check_circle' : isHostReachable ? 'info' : 'error'}
        </span>
        <div>
          <h4 className="font-bold text-sm">{bannerTitle}</h4>
          <p className="text-xs mt-0.5 opacity-90">{result.message}</p>
        </div>
      </div>

      <div className="space-y-2 text-xs">
        {(Object.keys(STAGE_LABELS) as DiagnosticStage[]).map((stageKey) => {
          const detail = result.stages[stageKey] || { status: 'not_run', message: '' };
          let icon = 'radio_button_unchecked';
          let colorClass = 'text-slate-400 border-slate-200 bg-slate-100';

          if (detail.status === 'success') {
            icon = 'check_circle';
            colorClass = 'text-emerald-700 border-emerald-200 bg-emerald-50';
          } else if (detail.status === 'failed') {
            icon = 'cancel';
            colorClass = 'text-rose-700 border-rose-200 bg-rose-50';
          } else if (detail.status === 'skipped') {
            icon = 'block';
            colorClass = 'text-slate-400 border-slate-200 bg-slate-100/60';
          }

          return (
            <div key={stageKey} className={`flex items-start gap-2.5 rounded-xl border p-2.5 ${colorClass}`}>
              <span className="material-symbols-outlined text-base shrink-0 mt-0.5">{icon}</span>
              <div className="flex-1">
                <span className="font-bold block">{STAGE_LABELS[stageKey]}</span>
                {detail.message && <span className="opacity-80 text-[11px] block mt-0.5">{detail.message}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {result.streamUri && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs">
          <span className="text-blue-600 font-bold block mb-1">RTSP Stream Endpoint (Masked)</span>
          <code className="font-mono text-[11px] text-blue-900 break-all">{result.streamUri}</code>
        </div>
      )}
    </div>
  );
}

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

      <div className={`flex items-center gap-3 rounded-xl p-3 bg-${statusColor}-50 border border-${statusColor}-200`}>
        <span className={`material-symbols-outlined text-${statusColor}-600`}>
          {result.success ? 'check_circle' : 'error'}
        </span>
        <div>
          <p className={`font-bold text-${statusColor}-700`}>{statusText}</p>
          {result.errorMessage && <p className="text-xs text-slate-600 mt-0.5">{result.errorMessage}</p>}
        </div>
      </div>
    </div>
  );
}

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
  const [testing, setTesting] = useState(false);
  const [detectResult, setDetectResult] = useState<AgentDetectResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const isEdit = !!(initial as any).__isEdit;

  const field = (key: keyof CreateCameraInput, value: any) =>
    setForm((f) => ({ ...f, [key]: value }));

  const labelCls = 'block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider';
  const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all';

  const handleTestAndDetect = async () => {
    setTesting(true);
    setDetectResult(null);
    setTestError(null);

    try {
      const res = await detectCameraViaAgent({
        ipAddress: form.ipAddress,
        username: form.username,
        password: form.password,
        port: form.port ?? 554,
        onvifPort: form.onvifPort ?? 80,
        customRtspPath: form.customRtspPath ?? '',
      });
      setDetectResult(res);
    } catch (err: any) {
      setTestError(err.message ?? 'Local Camera Agent is not running on http://127.0.0.1:8000');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">{isEdit ? 'Edit Camera' : '+ Add Camera Manually'}</h2>
            <button onClick={onClose} className="rounded-full p-1 hover:bg-white/20 transition-colors">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <p className="text-blue-100 text-sm mt-1">
            {isEdit ? 'Update camera configuration.' : 'Enter camera details and test connection via Local Agent.'}
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Required Information</h3>
            
            <div>
              <label className={labelCls}>Camera Name *</label>
              <input className={inputCls} placeholder="e.g. Living Room Camera" value={form.name}
                onChange={(e) => field('name', e.target.value)} />
            </div>

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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>IP Address *</label>
                <input className={inputCls} placeholder="e.g. 192.168.29.63" value={form.ipAddress}
                  onChange={(e) => field('ipAddress', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Username *</label>
                <input className={inputCls} placeholder="admin" value={form.username}
                  onChange={(e) => field('username', e.target.value)} />
              </div>
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

          <details className="group border border-slate-200 rounded-2xl p-4 bg-slate-50/50">
            <summary className="font-bold text-xs text-slate-600 cursor-pointer flex items-center justify-between uppercase tracking-wider">
              <span>Advanced Settings (Optional Ports & RTSP Path)</span>
              <span className="material-symbols-outlined text-slate-400 group-open:rotate-180 transition-transform">expand_more</span>
            </summary>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <label className={labelCls}>ONVIF Port</label>
                <input type="number" className={inputCls} placeholder="80" value={form.onvifPort ?? 80}
                  onChange={(e) => field('onvifPort', Number(e.target.value))} />
              </div>
              <div>
                <label className={labelCls}>RTSP Port</label>
                <input type="number" className={inputCls} placeholder="554" value={form.port ?? 554}
                  onChange={(e) => field('port', Number(e.target.value))} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Custom RTSP Path (Explicit Fallback Only)</label>
                <input className={inputCls} placeholder="Leave empty — ONVIF GetStreamUri used automatically" value={form.customRtspPath ?? ''}
                  onChange={(e) => field('customRtspPath', e.target.value)} />
              </div>
            </div>
          </details>

          <div className="space-y-3 pt-2">
            <button
              type="button"
              disabled={testing || !form.ipAddress || !form.username}
              onClick={() => void handleTestAndDetect()}
              className="flex items-center justify-center gap-2 w-full rounded-2xl border-2 border-blue-600 bg-blue-50 py-3 text-sm font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-all shadow-sm"
            >
              {testing ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                  Executing 6-Stage Camera Probe...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">fact_check</span>
                  Test & Detect Camera
                </>
              )}
            </button>

            {testError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm shrink-0">error</span>
                <span>{testError}</span>
              </div>
            )}

            {detectResult && <DiagnosticStagesPanel result={detectResult} />}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-6 py-4 flex justify-end gap-3 bg-white">
          <button onClick={onClose}
            className="rounded-xl border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button disabled={saving || !form.name || !form.ipAddress || !form.username || (!isEdit && !form.password)}
            onClick={() => void onSave(form)}
            className="rounded-xl bg-blue-600 px-6 py-2 text-sm font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center gap-2">
            {saving && <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>}
            {isEdit ? 'Save Changes' : 'Save Camera'}
          </button>
        </div>
      </div>
    </div>
  );
}

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

function Toggle({ checked, loading, onChange }: { checked: boolean; loading: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} disabled={loading}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${checked ? 'bg-emerald-500' : 'bg-slate-300'}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

function CameraDiscoveryTab({ agentStatus, onAddClick }: { agentStatus: 'checking' | 'online' | 'offline'; onAddClick: (ip?: string) => void }) {
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<DiscoveredCamera[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);

  const startScan = async () => {
    setScanning(true); setError(null); setResults([]); setScanned(false);
    try {
      const devices = await discoverCamerasOnLAN();
      setResults(devices);
    } catch (err: any) {
      setError(err.message ?? 'Discovery failed');
    } finally {
      setScanning(false); setScanned(true);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {agentStatus === 'offline' ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50/80 p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-100 flex items-center justify-center mx-auto text-rose-600">
            <span className="material-symbols-outlined text-3xl">lan_disconnect</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-rose-900">VitalCare Camera Agent is not running.</h3>
            <p className="text-sm text-rose-700 mt-1 max-w-md mx-auto">
              ONVIF WS-Discovery uses UDP multicast and requires the local agent to run on your local network.
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-rose-200 p-4 max-w-lg mx-auto text-left space-y-2 shadow-sm">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Start Local Camera Agent:</span>
            <code className="block bg-slate-900 text-emerald-400 font-mono text-xs p-3 rounded-xl">
              python camera-agent/agent.py
            </code>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50 p-8 text-center space-y-5">
          <div className="w-20 h-20 rounded-3xl bg-white shadow-md flex items-center justify-center mx-auto">
            <span className={`material-symbols-outlined text-4xl text-blue-600 ${scanning ? 'animate-pulse' : ''}`}>
              wifi_find
            </span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {scanning ? 'Scanning network via Local Agent...' : 'Scan LAN for ONVIF Cameras'}
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              Sends a UDP multicast WS-Discovery probe (239.255.255.250:3702) via <code>http://127.0.0.1:8000</code>
            </p>
          </div>
          <button
            onClick={() => void startScan()}
            disabled={scanning}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-8 py-3.5 text-base font-bold text-white shadow-lg hover:bg-blue-700 disabled:opacity-60 transition-all">
            {scanning
              ? <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
              : <span className="material-symbols-outlined text-xl">radar</span>}
            {scanning ? 'Scanning...' : 'Start Network Scan'}
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-rose-500">error</span>
          <p className="text-sm text-rose-700">{error}</p>
        </div>
      )}

      {scanned && !scanning && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-800">
              {results.length > 0
                ? `Found ${results.length} ONVIF device${results.length !== 1 ? 's' : ''}`
                : 'No devices found'}
            </h2>
            <span className="text-xs text-slate-400">
              Scanned at {new Date().toLocaleTimeString()}
            </span>
          </div>

          {results.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-slate-200 py-16 text-center">
              <span className="material-symbols-outlined text-4xl text-slate-300 block mb-3">signal_wifi_off</span>
              <p className="text-slate-500 font-semibold">No ONVIF cameras responded to multicast probe</p>
              <p className="text-slate-400 text-sm mt-2 max-w-md mx-auto">
                Ensure cameras are connected to your local network. You can also add a camera manually using its IP address.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {results.map((device) => (
                <div key={device.ipAddress}
                  className="rounded-3xl border border-slate-200 bg-white shadow-sm p-5 space-y-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                      <span className="material-symbols-outlined text-emerald-600">videocam</span>
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{device.ipAddress}</p>
                      <p className="text-xs text-slate-500">ONVIF Device Service</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 block">IP Address</span>
                      <span className="font-mono font-semibold text-slate-700">{device.ipAddress}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">ONVIF Port</span>
                      <span className="font-semibold text-slate-700">{device.onvifPort}</span>
                    </div>
                  </div>

                  <button onClick={() => onAddClick(device.ipAddress)}
                    className="flex items-center justify-center gap-2 w-full rounded-xl border border-blue-200 bg-blue-50 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100 transition-colors">
                    <span className="material-symbols-outlined text-sm">add_circle</span>
                    Connect Camera
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 space-y-2">
        <h3 className="font-bold text-amber-800 flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">tips_and_updates</span>
          Troubleshooting Tips
        </h3>
        <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
          <li>Ensure Local Camera Agent is running: <code>python camera-agent/agent.py</code></li>
          <li>Ensure cameras are on the same local subnet as the agent</li>
          <li>If automatic scan misses a camera, click "+ Add Camera Manually" to test its IP address directly</li>
        </ul>
      </div>
    </div>
  );
}

export default function CameraManagement() {
  const {
    cameras, loading, error, testingId, probeResult,
    deletingId, togglingId, agentStatus, checkAgent, refresh,
    addCamera, editCamera, removeCamera, toggle, runTest,
    clearError, clearProbe,
  } = useCameraManager();

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<CameraPublicRecord | null>(null);
  const [initialIp, setInitialIp] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [probeTargetId, setProbeTargetId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'cameras' | 'discover'>('cameras');

  const openAdd = (ip: string = '') => { setEditTarget(null); setInitialIp(ip); setShowModal(true); };
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
            Two-path camera connection system featuring automatic ONVIF discovery and 6-stage protocol diagnostics.
          </p>

          {/* Agent Status Badge Banner */}
          <div className="mt-4 inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold border shadow-sm">
            {agentStatus === 'online' ? (
              <span className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border-emerald-200">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                VitalCare Local Agent Active (http://127.0.0.1:8000)
              </span>
            ) : agentStatus === 'checking' ? (
              <span className="flex items-center gap-2 text-slate-600 bg-slate-100 border-slate-200">
                <span className="material-symbols-outlined text-xs animate-spin">progress_activity</span>
                Checking Local Agent Status...
              </span>
            ) : (
              <span className="flex items-center gap-2 text-amber-700 bg-amber-50 border-amber-200">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                VitalCare Camera Agent: Offline
                <button onClick={() => void checkAgent()} className="underline ml-2 hover:text-amber-900">
                  Re-check
                </button>
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-3 shrink-0">
          <button onClick={() => void refresh()}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
            <span className="material-symbols-outlined text-sm">refresh</span>
            Refresh
          </button>
          <button onClick={() => openAdd()}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition-all">
            <span className="material-symbols-outlined text-sm">add</span>
            + Add Camera Manually
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

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-px">
        {[
          { id: 'cameras', label: 'Cameras', icon: 'videocam' },
          { id: 'discover', label: 'Discover Cameras', icon: 'wifi_find' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'discover' && (
        <CameraDiscoveryTab agentStatus={agentStatus} onAddClick={(ip) => openAdd(ip || '')} />
      )}

      {activeTab === 'cameras' && (
        <>
          {loading && (
            <div className="flex items-center justify-center py-20 gap-3 text-slate-500">
              <span className="material-symbols-outlined animate-spin text-2xl text-blue-500">progress_activity</span>
              Loading cameras...
            </div>
          )}

          {!loading && cameras.length === 0 && (
            <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 py-20 text-center">
              <span className="material-symbols-outlined text-5xl text-slate-300 block mb-4">videocam_off</span>
              <p className="text-slate-500 font-semibold text-lg">No cameras configured yet</p>
              <p className="text-slate-400 text-sm mt-1 mb-6">Connect your first IP camera via ONVIF scan or manual entry</p>
              <button onClick={() => openAdd()}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition-all">
                <span className="material-symbols-outlined text-sm">add</span>
                Add First Camera
              </button>
            </div>
          )}

          {!loading && cameras.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {cameras.map((cam) => (
                <div key={cam.id}
                  className="group rounded-3xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-all overflow-hidden">
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
                  </div>

                  {probeTargetId === cam.id && probeResult && (
                    <div className="px-5 pb-4">
                      <ProbePanel result={probeResult} onClose={() => { setProbeTargetId(null); clearProbe(); }} />
                    </div>
                  )}

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
        </>
      )}

      {showModal && (
        <CameraFormModal
          initial={editTarget ? { ...editTarget, password: '', __isEdit: true } as any : { ...emptyForm(), ipAddress: initialIp }}
          onSave={handleSave}
          onClose={closeModal}
          saving={saving}
        />
      )}

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
