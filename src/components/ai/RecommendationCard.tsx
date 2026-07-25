export interface RecommendationItem {
  category: string;
  recommendation: string;
  priority: 'low' | 'medium' | 'high';
  rationale: string;
}

export interface RecommendationCardProps {
  status: 'idle' | 'thinking' | 'completed';
  recommendations?: RecommendationItem[];
}

export function RecommendationCard({
  status,
  recommendations = [
    { category: 'Hydration', recommendation: 'Increase water intake by 250ml', priority: 'medium', rationale: 'Maintain optimal hydration level' },
    { category: 'Activity', recommendation: 'Take a 15 minute walk after 5 PM', priority: 'low', rationale: 'Promote circulation and joint mobility' },
    { category: 'Vitals', recommendation: 'Check blood pressure again in 4 hours', priority: 'medium', rationale: 'Monitor evening pressure levels' },
    { category: 'Medication', recommendation: 'Take scheduled Lisinopril at 08:00 PM', priority: 'high', rationale: 'Ensure blood pressure maintenance' },
    { category: 'Sleep', recommendation: 'Avoid caffeine after 4 PM', priority: 'low', rationale: 'Improve sleep efficiency and deep sleep cycles' }
  ],
}: RecommendationCardProps) {
  const getPriorityBadge = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return 'text-rose-700 bg-rose-50 border-rose-200';
      case 'medium':
        return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'low':
        return 'text-blue-700 bg-blue-50 border-blue-200';
      default:
        return 'text-slate-700 bg-slate-50 border-slate-200';
    }
  };

  const getPriorityDot = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return 'bg-rose-500';
      case 'medium':
        return 'bg-amber-500';
      case 'low':
        return 'bg-blue-500';
      default:
        return 'bg-slate-400';
    }
  };

  if (status === 'thinking') {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md border-t-4 border-t-blue-500 animate-pulse transition-all duration-300">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-50 p-3 text-blue-600">
              <span className="text-2xl block animate-spin">⏳</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Recommendation Agent</h3>
              <p className="text-xs text-slate-500 mt-1">Formulating care plan...</p>
            </div>
          </div>
          <span className="rounded-full bg-blue-50 text-blue-700 px-3 py-1 text-xs font-bold animate-pulse">
            Thinking...
          </span>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-slate-50 rounded-2xl border border-slate-100 p-4 animate-pulse flex flex-col justify-between">
              <div className="h-4 w-1/3 bg-slate-200 rounded" />
              <div className="h-3 w-3/4 bg-slate-350 rounded mt-2" />
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
              <span className="text-2xl block">💡</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-700">Recommendation Agent</h3>
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
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md border-t-4 border-t-amber-500 transition-all duration-300 hover:shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-gradient-to-br from-amber-50 to-amber-100 p-3 text-amber-600">
            <span className="text-2xl block">💡</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-900">Recommendation Agent</h3>
              <span className="text-amber-500 text-sm">✓</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Clinical preventive strategies</p>
          </div>
        </div>
        <span className="rounded-full bg-amber-50 text-amber-700 px-3 py-1.5 text-xs font-bold border border-amber-100 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          Completed
        </span>
      </div>

      {/* Recommendations List */}
      <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
        {recommendations.map((rec, idx) => (
          <div
            key={idx}
            className="rounded-2xl border border-slate-100 bg-slate-50/30 p-4 hover:bg-slate-50 transition-all hover:border-slate-200"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">
                  {rec.category}
                </span>
                <h4 className="text-sm font-bold text-slate-800 mt-0.5">
                  {rec.recommendation}
                </h4>
                <p className="text-xs text-slate-500 mt-1 italic">
                  <strong>Rationale:</strong> {rec.rationale}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[9px] font-black border flex items-center gap-1.5 uppercase shrink-0 ${getPriorityBadge(rec.priority)}`}>
                <span className={`w-1 h-1 rounded-full ${getPriorityDot(rec.priority)}`} />
                {rec.priority}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
