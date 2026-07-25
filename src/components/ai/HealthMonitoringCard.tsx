export interface HealthMonitoringCardProps {
  status: 'idle' | 'thinking' | 'completed';
  healthScore?: number;
  confidence?: number;
  heartRate?: number;
  heartRateStatus?: string;
  spo2?: number;
  spo2Status?: string;
  bloodPressure?: string;
  bloodPressureStatus?: string;
  temperature?: number;
  temperatureStatus?: string;
  respiratoryRate?: number;
  stress?: number;
  hydration?: string;
  summary?: string;
}

export function HealthMonitoringCard({
  status,
  healthScore = 87,
  confidence = 98.4,
  heartRate = 76,
  heartRateStatus = 'Normal',
  spo2 = 97,
  spo2Status = 'Normal',
  bloodPressure = '128/82',
  bloodPressureStatus = 'Normal',
  temperature = 36.8,
  temperatureStatus = 'Normal',
  respiratoryRate = 18,
  stress = 34,
  hydration = 'Good',
  summary = 'All vital signs are currently stable and within expected thresholds.',
}: HealthMonitoringCardProps) {
  const getVitalStatusColor = (vStatus: string) => {
    switch (vStatus.toLowerCase()) {
      case 'normal':
        return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      case 'warning':
      case 'caution':
        return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'critical':
      case 'danger':
        return 'text-rose-600 bg-rose-50 border-rose-200';
      default:
        return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  if (status === 'thinking') {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md border-t-4 border-t-blue-500 animate-pulse transition-all duration-300">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-50 p-3 text-blue-600 relative">
              <span className="text-2xl block animate-spin">⏳</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Health Monitoring Agent</h3>
              <p className="text-xs text-slate-500 mt-1">Analyzing vital signs...</p>
            </div>
          </div>
          <span className="rounded-full bg-blue-50 text-blue-700 px-3 py-1 text-xs font-bold animate-pulse">
            Thinking...
          </span>
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 flex items-center justify-between">
            <div className="h-6 w-2/3 bg-slate-200 rounded animate-pulse" />
            <div className="h-6 w-12 bg-slate-200 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-slate-50 rounded-2xl border border-slate-100 p-4 flex flex-col justify-between">
                <div className="h-3 w-1/2 bg-slate-200 rounded animate-pulse" />
                <div className="h-6 w-1/3 bg-slate-300 rounded animate-pulse mt-2" />
              </div>
            ))}
          </div>
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
              <span className="text-2xl block">❤️</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-700">Health Monitoring Agent</h3>
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
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md border-t-4 border-t-emerald-500 transition-all duration-300 hover:shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-gradient-to-br from-emerald-50 to-emerald-100 p-3 text-emerald-600">
            <span className="text-2xl block">❤️</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-900">Health Monitoring Agent</h3>
              <span className="text-emerald-500 text-sm">✓</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Real-time vital signs analysis</p>
          </div>
        </div>
        <span className="rounded-full bg-emerald-50 text-emerald-700 px-3 py-1.5 text-xs font-bold border border-emerald-100 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Completed
        </span>
      </div>

      {/* Health Score & Confidence Header */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-2xl bg-gradient-to-br from-blue-50/50 to-indigo-50/50 p-4 border border-blue-100/50 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Health Score</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-3xl font-black text-blue-700">{healthScore}</span>
            <span className="text-sm text-slate-500 font-bold">/100</span>
          </div>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-purple-50/50 to-indigo-50/50 p-4 border border-purple-100/50 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Confidence Level</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-3xl font-black text-purple-700">{confidence}%</span>
          </div>
        </div>
      </div>

      {/* Vital Signs Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {/* Heart Rate */}
        <div className="rounded-2xl bg-slate-50/70 p-3 border border-slate-100 hover:border-slate-200 transition-colors">
          <div className="flex items-center gap-1.5 text-slate-500 mb-1.5">
            <span className="text-sm">💓</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Heart Rate</span>
          </div>
          <p className="text-xl font-bold text-slate-900">{heartRate} <span className="text-xs font-normal text-slate-500">bpm</span></p>
          <span className={`inline-block text-[9px] font-bold rounded px-1.5 py-0.5 border mt-1.5 ${getVitalStatusColor(heartRateStatus)}`}>
            {heartRateStatus}
          </span>
        </div>

        {/* SpO2 */}
        <div className="rounded-2xl bg-slate-50/70 p-3 border border-slate-100 hover:border-slate-200 transition-colors">
          <div className="flex items-center gap-1.5 text-slate-500 mb-1.5">
            <span className="text-sm">💨</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">SpO₂</span>
          </div>
          <p className="text-xl font-bold text-slate-900">{spo2}%</p>
          <span className={`inline-block text-[9px] font-bold rounded px-1.5 py-0.5 border mt-1.5 ${getVitalStatusColor(spo2Status)}`}>
            {spo2Status}
          </span>
        </div>

        {/* Blood Pressure */}
        <div className="rounded-2xl bg-slate-50/70 p-3 border border-slate-100 hover:border-slate-200 transition-colors">
          <div className="flex items-center gap-1.5 text-slate-500 mb-1.5">
            <span className="text-sm">🩺</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Blood Pres.</span>
          </div>
          <p className="text-base font-bold text-slate-900 mt-1 leading-none">{bloodPressure} <span className="text-[10px] font-normal text-slate-500">mmHg</span></p>
          <span className={`inline-block text-[9px] font-bold rounded px-1.5 py-0.5 border mt-2 ${getVitalStatusColor(bloodPressureStatus)}`}>
            {bloodPressureStatus}
          </span>
        </div>

        {/* Temperature */}
        <div className="rounded-2xl bg-slate-50/70 p-3 border border-slate-100 hover:border-slate-200 transition-colors">
          <div className="flex items-center gap-1.5 text-slate-500 mb-1.5">
            <span className="text-sm">🌡️</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Temp.</span>
          </div>
          <p className="text-xl font-bold text-slate-900">{temperature}°C</p>
          <span className={`inline-block text-[9px] font-bold rounded px-1.5 py-0.5 border mt-1.5 ${getVitalStatusColor(temperatureStatus)}`}>
            {temperatureStatus}
          </span>
        </div>
      </div>

      {/* Additional Vitals */}
      <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50/40 rounded-2xl border border-slate-100">
        <div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Respiratory</p>
          <p className="text-sm font-bold text-slate-700 mt-0.5">{respiratoryRate} /min</p>
        </div>
        <div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Stress Level</p>
          <p className="text-sm font-bold text-slate-700 mt-0.5">{stress}%</p>
        </div>
        <div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Hydration</p>
          <p className="text-sm font-bold text-slate-700 mt-0.5">{hydration}</p>
        </div>
      </div>

      {/* Summary Paragraph */}
      <div className="mt-4 pt-3 border-t border-slate-100">
        <p className="text-xs text-slate-600 italic leading-relaxed">
          <strong>Agent Insights:</strong> {summary}
        </p>
      </div>
    </div>
  );
}
