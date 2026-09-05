import LiveMonitor from '../LiveMonitor';

export default function ElderLiveMonitor() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4 text-xs text-blue-900 font-bold flex items-center gap-2">
        <span className="material-symbols-outlined text-lg text-blue-600">videocam</span>
        Elder Personal Live Camera Monitor — Complete PTZ Movement Controls & Auto-Tracking Enabled
      </div>

      <LiveMonitor />
    </div>
  );
}
