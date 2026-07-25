export interface StatusBadgeProps {
  status: 'idle' | 'loading' | 'success' | 'error';
  label?: string;
}

export function AgentStatusBadge({ status, label }: StatusBadgeProps) {
  const statusConfig = {
    idle: {
      bgColor: 'bg-slate-100',
      textColor: 'text-slate-600',
      dotColor: 'bg-slate-400',
      text: 'Ready'
    },
    loading: {
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-600',
      dotColor: 'bg-blue-400 animate-pulse',
      text: 'Processing'
    },
    success: {
      bgColor: 'bg-emerald-100',
      textColor: 'text-emerald-600',
      dotColor: 'bg-emerald-400',
      text: 'Complete'
    },
    error: {
      bgColor: 'bg-red-100',
      textColor: 'text-red-600',
      dotColor: 'bg-red-400',
      text: 'Error'
    }
  };

  const config = statusConfig[status];

  return (
    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 ${config.bgColor}`}>
      <div className={`w-2 h-2 rounded-full ${config.dotColor}`} />
      <span className={`text-xs font-semibold ${config.textColor}`}>
        {label || config.text}
      </span>
    </div>
  );
}
