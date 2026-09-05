import DeviceManagement from '../DeviceManagement';

export default function CaregiverDevices() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4 text-xs text-blue-900 font-bold flex items-center gap-2">
        <span className="material-symbols-outlined text-lg text-blue-600">devices</span>
        Caregiver Device Management — Full Hardware Registry, Smartwatch & Camera Configuration
      </div>

      <DeviceManagement />
    </div>
  );
}
