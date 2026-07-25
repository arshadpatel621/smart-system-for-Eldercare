import type { AIAnalysisResponse } from '../../types/aiReport';

interface OverallSummaryCardProps {
  data: AIAnalysisResponse;
  loading?: boolean;
}

export function OverallSummaryCard({ data, loading }: OverallSummaryCardProps) {
  const healthScore = data.healthSummary?.complianceMetrics?.medicationAdherence ?? 0;
  const overallRisk = data.overallRiskLevel ?? 'medium';
  const medicationAdherence = data.healthSummary?.complianceMetrics?.medicationAdherence ?? 0;
  const activityLevel = data.healthSummary?.complianceMetrics?.activityLevel ?? 0;
  const sleepQuality = data.healthSummary?.complianceMetrics?.sleepQuality ?? 0;

  const metrics = [
    {
      label: 'Medication Adherence',
      value: medicationAdherence,
      color: 'from-blue-500 to-cyan-500',
      icon: '💊'
    },
    {
      label: 'Activity Level',
      value: activityLevel,
      color: 'from-emerald-500 to-teal-500',
      icon: '🏃'
    },
    {
      label: 'Sleep Quality',
      value: sleepQuality,
      color: 'from-indigo-500 to-purple-500',
      icon: '😴'
    }
  ];

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low':
        return { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' };
      case 'medium':
        return { text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' };
      case 'high':
        return { text: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' };
      case 'critical':
        return { text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' };
      default:
        return { text: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' };
    }
  };

  const riskColor = getRiskColor(overallRisk);

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg border-t-4 border-t-indigo-500">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="h-6 w-40 animate-pulse rounded-lg bg-slate-200" />
            <div className="h-4 w-32 animate-pulse rounded-lg bg-slate-100" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg border-t-4 border-t-indigo-500 backdrop-blur-sm bg-opacity-95">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-gradient-to-br from-indigo-100 to-blue-100 p-3">
            <span className="text-2xl">📊</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Overall Summary</h3>
            <p className="text-xs text-slate-500 mt-1">Health status at a glance</p>
          </div>
        </div>
      </div>

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* Health Score */}
        <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 p-4">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2">
            Health Score
          </p>
          <p className="text-3xl font-bold text-blue-600">{healthScore}</p>
          <p className="text-xs text-slate-500 mt-1">Overall wellness</p>
        </div>

        {/* Overall Risk */}
        <div className={`rounded-2xl border ${riskColor.border} ${riskColor.bg} p-4`}>
          <p className={`text-xs font-semibold ${riskColor.text} uppercase tracking-wider mb-2`}>
            Overall Risk
          </p>
          <p className={`text-3xl font-bold ${riskColor.text}`}>
            {overallRisk.charAt(0).toUpperCase() + overallRisk.slice(1)}
          </p>
          <p className="text-xs text-slate-500 mt-1">Current level</p>
        </div>

        {/* Status */}
        <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
            Resident Status
          </p>
          <p className={`text-lg font-bold ${
            data.healthSummary?.overallStatus === 'stable'
              ? 'text-emerald-600'
              : data.healthSummary?.overallStatus === 'caution'
                ? 'text-amber-600'
                : 'text-red-600'
          }`}>
            {data.healthSummary?.overallStatus ? data.healthSummary.overallStatus.charAt(0).toUpperCase() + data.healthSummary.overallStatus.slice(1) : 'Unknown'}
          </p>
          <p className="text-xs text-slate-500 mt-1">Current condition</p>
        </div>
      </div>

      {/* Compliance Metrics */}
      <div className="grid grid-cols-3 gap-4">
        {metrics.map((metric, idx) => {
          return (
            <div key={idx} className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  {metric.label}
                </p>
                <span className="text-lg">{metric.icon}</span>
              </div>

              {/* Metric Value */}
              <p className="text-2xl font-bold text-slate-900 mb-2">{metric.value}%</p>

              {/* Progress Bar */}
              <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${metric.color} transition-all duration-500`}
                  style={{ width: `${Math.min(metric.value, 100)}%` }}
                />
              </div>

              {/* Status Text */}
              <p className="text-xs text-slate-500 mt-2">
                {metric.value >= 80
                  ? '✓ Excellent'
                  : metric.value >= 60
                    ? '✓ Good'
                    : metric.value >= 40
                      ? '⚠ Fair'
                      : '⚠ Low'}
              </p>
            </div>
          );
        })}
      </div>

      {/* Latest Analysis Info */}
      <div className="mt-6 pt-6 border-t border-slate-200">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-500 mb-1">Latest Analysis</p>
            <p className="text-sm font-semibold text-slate-900">
              {data.timestamp ? new Date(data.timestamp).toLocaleString() : 'Not yet analyzed'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Next Check-in</p>
            <p className="text-sm font-semibold text-slate-900">In 4 hours</p>
          </div>
        </div>
      </div>
    </div>
  );
}
