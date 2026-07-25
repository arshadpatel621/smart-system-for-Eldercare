export interface RiskItem {
  name: string;
  percentage: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  factors?: string[];
}

export interface RiskPredictionCardProps {
  status: 'idle' | 'thinking' | 'completed';
  overallRisk?: 'low' | 'medium' | 'high' | 'critical';
  risks?: RiskItem[];
}

export function RiskPredictionCard({
  status,
  overallRisk = 'medium',
  risks = [
    { name: 'Fall Risk', percentage: 24, level: 'low', factors: ['Stable gait', 'No recent slips'] },
    { name: 'Heart Risk', percentage: 15, level: 'low', factors: ['Normal heart rate variability', 'Stable blood pressure'] },
    { name: 'Stroke Risk', percentage: 12, level: 'low', factors: ['Consistent blood pressure', 'Active movement'] },
    { name: 'Dehydration Risk', percentage: 18, level: 'low', factors: ['Adequate fluid intake today'] },
    { name: 'Cognitive Risk', percentage: 32, level: 'low', factors: ['Active routine', 'Engages in daily tasks'] },
    { name: 'Nutrition Risk', percentage: 28, level: 'low', factors: ['Balanced diet', 'Soft meals taken'] },
  ],
}: RiskPredictionCardProps) {
  const getRiskLevelBadge = (level: string) => {
    switch (level.toLowerCase()) {
      case 'low':
        return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'medium':
        return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'high':
        return 'text-orange-700 bg-orange-50 border-orange-200';
      case 'critical':
        return 'text-rose-700 bg-rose-50 border-rose-200';
      default:
        return 'text-slate-700 bg-slate-50 border-slate-200';
    }
  };

  const getRiskProgressBarColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'low':
        return 'bg-emerald-500';
      case 'medium':
        return 'bg-amber-500';
      case 'high':
        return 'bg-orange-500';
      case 'critical':
        return 'bg-rose-500';
      default:
        return 'bg-slate-400';
    }
  };

  const overallRiskConfig = {
    low: { text: 'text-emerald-700 bg-emerald-50 border-emerald-200', border: 'border-t-emerald-500' },
    medium: { text: 'text-amber-700 bg-amber-50 border-amber-200', border: 'border-t-amber-500' },
    high: { text: 'text-orange-700 bg-orange-50 border-orange-200', border: 'border-t-orange-500' },
    critical: { text: 'text-rose-700 bg-rose-50 border-rose-200', border: 'border-t-rose-500' },
  };

  const config = overallRiskConfig[overallRisk] || overallRiskConfig.medium;

  if (status === 'thinking') {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md border-t-4 border-t-blue-500 animate-pulse transition-all duration-300">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-50 p-3 text-blue-600">
              <span className="text-2xl block animate-spin">⏳</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Risk Prediction Agent</h3>
              <p className="text-xs text-slate-500 mt-1">Estimating preventive risks...</p>
            </div>
          </div>
          <span className="rounded-full bg-blue-50 text-blue-700 px-3 py-1 text-xs font-bold animate-pulse">
            Thinking...
          </span>
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-14 bg-slate-50 rounded-2xl border border-slate-100 p-3 flex flex-col justify-between">
              <div className="flex justify-between">
                <div className="h-3 w-1/4 bg-slate-200 rounded animate-pulse" />
                <div className="h-3 w-12 bg-slate-300 rounded animate-pulse" />
              </div>
              <div className="h-2 w-full bg-slate-200 rounded animate-pulse mt-2" />
            </div>
          ))}
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
              <span className="text-2xl block">🛡️</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-700">Risk Prediction Agent</h3>
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
    <div className={`rounded-3xl border border-slate-200 bg-white p-6 shadow-md border-t-4 ${config.border} transition-all duration-300 hover:shadow-lg`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-gradient-to-br from-blue-50 to-blue-100 p-3 text-blue-600">
            <span className="text-2xl block">🛡️</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-900">Risk Prediction Agent</h3>
              <span className="text-blue-500 text-sm">✓</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">AI-powered safety analytics</p>
          </div>
        </div>
        <span className="rounded-full bg-blue-50 text-blue-700 px-3 py-1.5 text-xs font-bold border border-blue-100 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          Completed
        </span>
      </div>

      {/* Overall Status Banner */}
      <div className={`rounded-2xl border p-4 mb-5 flex items-center justify-between ${config.text}`}>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Composite Risk Profile</p>
          <h4 className="text-lg font-black mt-0.5">
            {overallRisk.toUpperCase()} LEVEL RISK
          </h4>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold">Active Monitoring Enabled</p>
        </div>
      </div>

      {/* Risks Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {risks.map((risk, index) => (
          <div
            key={index}
            className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4 hover:border-slate-200 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700">{risk.name}</span>
              <span className="text-sm font-black text-slate-900">{risk.percentage}%</span>
            </div>
            {/* Progress Bar */}
            <div className="w-full h-2 rounded-full bg-slate-150 overflow-hidden bg-slate-200/70">
              <div
                className={`h-full ${getRiskProgressBarColor(risk.level)} transition-all duration-700`}
                style={{ width: `${Math.min(risk.percentage, 100)}%` }}
              />
            </div>
            {/* Badge & Info */}
            <div className="flex items-center justify-between mt-2.5">
              <span className={`text-[9px] font-bold rounded px-1.5 py-0.5 border uppercase ${getRiskLevelBadge(risk.level)}`}>
                {risk.level}
              </span>
              {risk.factors && risk.factors.length > 0 && (
                <span className="text-[10px] text-slate-400 font-medium truncate max-w-[120px]" title={risk.factors.join(', ')}>
                  {risk.factors[0]}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
