import { useState } from 'react';
import { useDeviceManager } from '../hooks/useDeviceManager';
import { useCameraManager } from '../hooks/useCameraManager';
import { useWatchManager } from '../hooks/useWatchManager';
import { AddDeviceWizard } from '../components/AddDeviceWizard';
import CameraManagement from './CameraManagement';
import WatchManagement from './WatchManagement';
import type { Device } from '../types/device';
import { BRAND_LABELS as CAMERA_BRANDS } from '../services/camera';
import { useEldercare } from '../context/EldercareContext';

export default function DeviceManagement() {
  const { data, activeElderId } = useEldercare();
  const residentId = activeElderId || data?.profile?.id || 'demo-resident';
  const residentName = data?.profile?.fullName ?? 'Resident';

  const {
    devices,
    loading: devicesLoading,
    error: devicesError,
    refresh: refreshDevices,
    removeDevice,
    connectDevice,
    disconnectDevice,
    addDevice,
  } = useDeviceManager(residentId);

  const {
    cameras,
    loading: camerasLoading,
    error: camerasError,
    removeCamera,
  } = useCameraManager();

  const {
    watches,
    loading: watchesLoading,
    error: watchesError,
    refresh: refreshWatches,
    removeWatch,
  } = useWatchManager(residentId);

  const [activeTab, setActiveTab] = useState<'devices' | 'cameras' | 'watches'>('devices');
  const [showAddWizard, setShowAddWizard] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  const handleSaveDevice = async (deviceInput: any) => {
    setSaving(true);
    const success = await addDevice(deviceInput);
    setSaving(false);
    return success;
  };

  const loading = devicesLoading || camerasLoading || watchesLoading;

  // Normalized devices for the All Devices table — fully guarded against undefined attributes
  const allDevices = [
     ...(devices || []).map(d => {
        const rawCategory = d.category || (d as any).source || 'sensor';
        const categoryStr = typeof rawCategory === 'string' ? rawCategory.replace('_', ' ') : 'sensor';
        const rawStatus = d.status || ((d as any).connected ? 'connected' : 'disconnected');
        return {
           id: d.id,
           name: d.model || (d as any).name || 'Connected Device',
           brand: d.brand || (d as any).notes || 'Generic',
           category: categoryStr,
           status: rawStatus,
           battery: typeof d.battery === 'number' ? d.battery : (d as any).batteryLevel,
           icon: d.category === 'wearable' ? 'watch' : d.category === 'medical_device' ? 'monitor_heart' : 'sensors',
           type: 'device' as const,
           raw: d
        };
     }),
     ...(watches || []).map(w => ({
        id: w.id,
        name: w.watchName || 'Smart Watch',
        brand: w.bluetoothName || (w as any).brand || 'Bluetooth BLE',
        category: 'smart watch',
        status: w.connectionStatus || 'disconnected',
        battery: w.battery,
        icon: 'watch',
        type: 'watch' as const,
        raw: w
     })),
     ...(cameras || []).map(c => ({
        id: c.id,
        name: c.name || 'IP Camera',
        brand: (c.brand && CAMERA_BRANDS[c.brand]) || c.brand || 'Generic Camera',
        category: 'camera',
        status: c.healthStatus === 'healthy' ? 'connected' : c.healthStatus === 'offline' ? 'disconnected' : 'degraded',
        battery: undefined,
        icon: 'videocam',
        type: 'camera' as const,
        raw: c
     }))
  ];

  const connectedCount = allDevices.filter(d => d.status === 'connected' || d.status === 'healthy').length;
  const offlineCount = allDevices.length - connectedCount;
  const camerasCount = (cameras || []).length;
  const watchesCount = (watches || []).length;

  const activeError = devicesError || watchesError || camerasError;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold text-slate-800">Device Management</h1>
          <p className="text-slate-500 mt-2 max-w-xl">
            Manage all connected wearables, medical devices, sensors, and cameras for {residentName}.
          </p>
        </div>
        <button onClick={() => setShowAddWizard(true)}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-indigo-700 transition-all">
          <span className="material-symbols-outlined text-sm">add</span>
          Add Device
        </button>
      </header>

      {/* Non-intrusive status notice if service fallback occurs */}
      {activeError && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs font-medium text-amber-900 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-amber-600">warning</span>
            Service notice: {activeError}. Operating in local cache mode.
          </span>
          <button
            onClick={() => {
              void refreshDevices();
              void refreshWatches();
            }}
            className="font-bold underline text-amber-950 hover:text-amber-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
         <SummaryCard icon="devices" label="Total Devices" count={allDevices.length} color="text-indigo-600" bg="bg-indigo-50" />
         <SummaryCard icon="watch" label="Smart Watches" count={watchesCount} color="text-emerald-600" bg="bg-emerald-50" />
         <SummaryCard icon="videocam" label="Cameras" count={camerasCount} color="text-blue-600" bg="bg-blue-50" />
         <SummaryCard icon="error" label="Offline / Issues" count={offlineCount} color="text-amber-600" bg="bg-amber-50" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-px">
        {[
          { id: 'devices', label: 'All Devices', icon: 'devices_other' },
          { id: 'cameras', label: 'Legacy Cameras', icon: 'videocam' },
          { id: 'watches', label: 'Smart Watches', icon: 'watch' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'cameras' && (
        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
           <CameraManagement />
        </div>
      )}

      {activeTab === 'watches' && (
         <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
            <WatchManagement />
         </div>
      )}

      {activeTab === 'devices' && (
         <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            {loading ? (
               <div className="p-12 text-center text-slate-500 animate-pulse font-bold">Loading devices...</div>
            ) : allDevices.length === 0 ? (
               <div className="p-16 text-center">
                  <span className="material-symbols-outlined text-6xl text-slate-200 block mb-4">devices_off</span>
                  <p className="text-slate-500 font-bold">No devices configured</p>
                  <button onClick={() => setShowAddWizard(true)} className="mt-4 text-indigo-600 font-bold hover:underline">Add your first device</button>
               </div>
            ) : (
               <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                     <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                        <tr>
                           <th className="px-6 py-4">Device Name</th>
                           <th className="px-6 py-4">Category</th>
                           <th className="px-6 py-4">Status</th>
                           <th className="px-6 py-4">Battery</th>
                           <th className="px-6 py-4">Resident</th>
                           <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                        {allDevices.map(device => (
                           <tr key={device.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-4">
                                 <div className="font-bold text-slate-800">{device.name}</div>
                                 <div className="text-slate-500 text-xs">{device.brand}</div>
                              </td>
                              <td className="px-6 py-4">
                                 <div className="flex items-center gap-1.5 text-slate-600">
                                    <span className="material-symbols-outlined text-[16px]">
                                       {device.icon}
                                    </span>
                                    <span className="capitalize">{device.category}</span>
                                 </div>
                              </td>
                              <td className="px-6 py-4">
                                 {(() => {
                                   const statusStr = (device.status || 'disconnected').toString();
                                   const isConn = statusStr === 'connected' || statusStr === 'healthy' || statusStr === 'optimal';
                                   const isDegraded = statusStr === 'degraded' || statusStr === 'warning' || statusStr === 'attention';
                                   const formatted = statusStr.charAt(0).toUpperCase() + statusStr.slice(1);
                                   return (
                                     <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${isConn ? 'bg-emerald-50 text-emerald-700' : isDegraded ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>
                                       <span className={`w-1.5 h-1.5 rounded-full ${isConn ? 'bg-emerald-500' : isDegraded ? 'bg-amber-500' : 'bg-rose-500'}`}></span>
                                       {formatted}
                                     </div>
                                   );
                                 })()}
                              </td>
                              <td className="px-6 py-4">
                                 <div className="flex items-center gap-1 text-slate-600">
                                    <span className="material-symbols-outlined text-[16px]">battery_full</span>
                                    {device.battery ? `${device.battery}%` : '--'}
                                 </div>
                              </td>
                              <td className="px-6 py-4 text-slate-600 font-medium">
                                 {residentName}
                              </td>
                              <td className="px-6 py-4 text-right">
                                 <div className="flex items-center justify-end gap-2">
                                    {device.type === 'device' && (
                                       <button onClick={() => setSelectedDevice(device.raw)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="View Details">
                                          <span className="material-symbols-outlined text-[20px]">visibility</span>
                                       </button>
                                    )}
                                    {device.type !== 'camera' && (
                                       device.status === 'connected' ? (
                                          <button onClick={() => { if (device.type === 'device') disconnectDevice(device.id); }} className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors" title="Disconnect">
                                             <span className="material-symbols-outlined text-[20px]">link_off</span>
                                          </button>
                                       ) : (
                                          <button onClick={() => { if (device.type === 'device') connectDevice(device.id); }} className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors" title="Connect">
                                             <span className="material-symbols-outlined text-[20px]">link</span>
                                          </button>
                                       )
                                    )}
                                    <button onClick={() => {
                                       if (device.type === 'device') removeDevice(device.id);
                                       if (device.type === 'watch') removeWatch(device.id);
                                       if (device.type === 'camera') removeCamera(device.id);
                                    }} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors" title="Remove">
                                       <span className="material-symbols-outlined text-[20px]">delete</span>
                                    </button>
                                 </div>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            )}
         </div>
      )}

      {showAddWizard && (
        <AddDeviceWizard 
           saving={saving}
           onClose={() => setShowAddWizard(false)}
           onSave={handleSaveDevice}
        />
      )}

      {selectedDevice && (
         <DeviceDetailsDrawer device={selectedDevice} onClose={() => setSelectedDevice(null)} residentName={residentName} />
      )}
    </div>
  );
}

// ─── Summary Card Component ──────────────────────────────────────────────────

function SummaryCard({ icon, label, count, color, bg }: any) {
   return (
      <div className="bg-white border border-slate-200 rounded-3xl p-5 flex items-center gap-4 shadow-sm">
         <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${bg} ${color}`}>
            <span className="material-symbols-outlined text-2xl">{icon}</span>
         </div>
         <div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">{label}</p>
            <p className={`text-2xl font-black ${color}`}>{count}</p>
         </div>
      </div>
   );
}

// ─── Device Details Drawer ───────────────────────────────────────────────────

function DeviceDetailsDrawer({ device, onClose, residentName }: { device: Device; onClose: () => void; residentName: string }) {
   return (
      <div className="fixed inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-sm">
         <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right-8 duration-300">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
               <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400">devices</span>
                  Device Details
               </h2>
               <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <span className="material-symbols-outlined text-slate-500">close</span>
               </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
               <div className="text-center">
                  <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-3 ${device.status === 'connected' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                     <span className="material-symbols-outlined text-4xl">
                        {device.category === 'wearable' ? 'watch' : device.category === 'medical_device' ? 'monitor_heart' : 'sensors'}
                     </span>
                  </div>
                  <h3 className="text-2xl font-bold text-slate-800">{device.model}</h3>
                  <p className="text-slate-500 font-medium">{device.brand}</p>
                  <div className={`inline-flex mt-3 items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${device.status === 'connected' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                     {device.status === 'connected' ? 'Connected' : 'Offline'}
                  </div>
               </div>

               <div className="bg-slate-50 rounded-2xl p-5 space-y-4 border border-slate-100">
                  <DetailRow label="ID" value={device.id} copyable />
                  <DetailRow label="Category" value={(device.category || 'device').toString().replace('_', ' ')} capitalize />
                  <DetailRow label="Connection" value={device.connectionType || 'bluetooth'} uppercase />
                  <DetailRow label="Assigned To" value={residentName} />
                  
                  {device.macAddress && <DetailRow label="MAC Address" value={device.macAddress} monospace />}
                  {device.serialNumber && <DetailRow label="Serial Number" value={device.serialNumber} monospace />}
                  {device.networkProtocol && <DetailRow label="Protocol" value={device.networkProtocol} uppercase />}
                  {device.location && <DetailRow label="Location" value={device.location} />}
                  
                  <DetailRow label="Last Sync" value={device.lastSync ? new Date(device.lastSync).toLocaleString() : 'Never'} />
               </div>

               <div>
                  <h4 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wider">Supported Metrics</h4>
                  <div className="flex flex-wrap gap-2">
                     {(device.supportedMetrics || []).length === 0 ? (
                        <span className="text-sm text-slate-400 italic">No metrics exported</span>
                     ) : (
                        (device.supportedMetrics || []).map(m => (
                           <span key={String(m)} className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold capitalize">
                              {typeof m === 'string' ? m.replace('_', ' ') : String(m)}
                           </span>
                        ))
                     )}
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
}

function DetailRow({ label, value, copyable, uppercase, capitalize, monospace }: any) {
   return (
      <div className="flex justify-between items-center py-1 border-b border-slate-200/50 last:border-0">
         <span className="text-sm text-slate-500 font-medium">{label}</span>
         <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold text-slate-800 ${uppercase ? 'uppercase' : ''} ${capitalize ? 'capitalize' : ''} ${monospace ? 'font-mono' : ''}`}>
               {value}
            </span>
            {copyable && (
               <button onClick={() => navigator.clipboard.writeText(value)} className="text-slate-400 hover:text-indigo-600 transition-colors">
                  <span className="material-symbols-outlined text-[16px]">content_copy</span>
               </button>
            )}
         </div>
      </div>
   );
}
