export interface EmergencyAlertEvent {
  time: string;
  event: string;
  status: 'stable' | 'warning' | 'critical';
}

export interface EmergencyCardProps {
  status: 'idle' | 'thinking' | 'completed';
  isEmergency: boolean;
  severity: 'none' | 'warning' | 'critical';
  conditions?: string[];
  requiredAction?: string;
  alertTimeline?: EmergencyAlertEvent[];
}

export function EmergencyCard({
  status,
  isEmergency = false,
  severity = 'none',
  conditions = [],
  requiredAction = 'No immediate action required. Resident is stable.',
  alertTimeline = [
    { time: '10:00 AM', event: 'Vitals baseline checked', status: 'stable' },
    { time: '12:30 PM', event: 'Smartwatch sync completed', status: 'stable' },
    { time: '02:00 PM', event: 'Activity level check - normal', status: 'stable' },
  ],
}: EmergencyCardProps) {
  const getSeverityBadge = (sev: string) => {
    switch (sev.toLowerCase()) {
      case 'none':
        return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'warning':
        return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'critical':
        return 'text-rose-700 bg-rose-50 border-rose-200';
      default:
        return 'text-slate-700 bg-slate-50 border-slate-200';
    }
  };

  const getTimelineDotColor = (s: string) => {
    switch (s.toLowerCase()) {
      case 'stable':
        return 'bg-emerald-500 ring-emerald-100';
      case 'warning':
        return 'bg-amber-500 ring-amber-100';
      case 'critical':
        return 'bg-rose-500 ring-rose-100';
      default:
        return 'bg-slate-400 ring-slate-100';
    }
  };

  const cardBorder = isEmergency || severity === 'critical' ? 'border-t-rose-500' : 'border-t-emerald-500';

  if (status === 'thinking') {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md border-t-4 border-t-blue-500 animate-pulse transition-all duration-300">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-50 p-3 text-blue-600">
              <span className="text-2xl block animate-spin">⏳</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Emergency Agent</h3>
              <p className="text-xs text-slate-500 mt-1">Checking emergency indicators...</p>
            </div>
          </div>
          <span className="rounded-full bg-blue-50 text-blue-700 px-3 py-1 text-xs font-bold animate-pulse">
            Thinking...
          </span>
        </div>
        <div className="space-y-4">
          <div className="h-28 bg-slate-50 border border-slate-100 rounded-2xl animate-pulse" />
          <div className="h-16 bg-slate-50 border border-slate-100 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (status === 'idle') {
    return (
      <div className="rounded-3xl border border-slate-200 bg-slate-50/55 p-6 border-t-4 border-t-slate-300 transition-all duration-300">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3 opacity-50">
            <div className="rounded-full bg-slate-100 p-3 text-slate-500">
              <span className="text-2xl block">🚨</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-700">Emergency Agent</h3>
              <p className="text-xs text-slate-400 mt-1 font-medium">Awaiting analysis trigger</p>
            </div>
          </div>
          <span className="rounded-full bg-slate-100 text-slate-500 px-3 py-1 text-xs font-bold">
            Idle
          </span>
        </div>
        <div className="text-center py-10">
          <p className="text-sm text-slate-400">Click "Analyze Health Data" to invoke this agent.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-3xl border border-slate-200 bg-white p-6 shadow-md border-t-4 ${cardBorder} transition-all duration-300 hover:shadow-lg`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className={`rounded-full p-3 ${
            isEmergency || severity === 'critical'
              ? 'bg-rose-50 text-rose-600'
              : 'bg-emerald-50 text-emerald-600'
          }`}>
            <span className="text-2xl block">🚨</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-900">Emergency Agent</h3>
              <span className={isEmergency || severity === 'critical' ? 'text-rose-500 text-sm' : 'text-emerald-500 text-sm'}>✓</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Real-time fail-safe monitoring</p>
          </div>
        </div>
        <span className="rounded-full bg-emerald-50 text-emerald-700 px-3 py-1.5 text-xs font-bold border border-emerald-100 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Active
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Status Display */}
        <div className="space-y-4">
          <div className={`rounded-2xl border p-5 text-center relative overflow-hidden ${
            isEmergency || severity === 'critical'
              ? 'bg-rose-50/50 border-rose-200 text-rose-800'
              : 'bg-emerald-50/50 border-emerald-200 text-emerald-800'
          }`}>
            {isEmergency || severity === 'critical' ? (
              <>
                <span className="text-4xl block mb-2 animate-bounce">⚠️</span>
                <span className="text-xs font-bold uppercase tracking-wider text-rose-600">CRITICAL STATE</span>
                <h4 className="text-2xl font-black mt-1">EMERGENCY DETECTED</h4>
              </>
            ) : (
              <>
                <span className="text-4xl block mb-2">💚</span>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">SYSTEM SECURE</span>
                <h4 className="text-2xl font-black mt-1">NO EMERGENCY</h4>
              </>
            )}
            <div className="mt-3 flex items-center justify-center gap-2">
              <span className={`text-[10px] font-bold border rounded-md px-2 py-0.5 uppercase ${getSeverityBadge(severity)}`}>
                Severity: {severity}
              </span>
            </div>
          </div>

          {/* Required Actions */}
          <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Required Protocol</span>
            <p className="text-xs text-slate-700 mt-1 font-semibold leading-relaxed">
              {requiredAction}
            </p>
            {conditions && conditions.length > 0 && (
              <div className="mt-3 pt-2 border-t border-slate-150">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Triggering Conditions</span>
                <div className="flex flex-wrap gap-1">
                  {conditions.map((c, i) => (
                    <span key={i} className="text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-100 rounded px-1.5 py-0.5">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Alert Timeline */}
        <div className="rounded-2xl bg-slate-50/40 p-4 border border-slate-100 flex flex-col">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Alert Activity Timeline</span>
          <div className="relative border-l border-slate-200 ml-2 pl-4 space-y-4 flex-1">
            {alertTimeline.map((item, idx) => (
              <div key={idx} className="relative">
                {/* Dot */}
                <div className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full ring-4 ${getTimelineDotColor(item.status)}`} />
                <div className="text-[9px] text-slate-400 font-bold">{item.time}</div>
                <div className="text-xs font-semibold text-slate-700 mt-0.5">{item.event}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
