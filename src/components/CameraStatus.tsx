import { useEffect, useState } from 'react';
import { CameraStatus as CameraStatusType } from '../services/camera';

interface CameraStatusProps {
  status: CameraStatusType | null;
}

/**
 * Renders the camera status summary card.
 * Computes active streaming duration dynamically.
 */
export function CameraStatus({ status }: CameraStatusProps) {
  const [duration, setDuration] = useState<string>('N/A');

  // Hook to calculate stream active timer
  useEffect(() => {
    if (!status || !status.connectionTime || status.status !== 'ONLINE') {
      setDuration('N/A');
      return;
    }

    const tick = () => {
      const start = new Date(status.connectionTime!).getTime();
      const now = new Date().getTime();
      const diffMs = now - start;

      if (diffMs < 0) {
        setDuration('0s');
        return;
      }

      const secs = Math.floor(diffMs / 1000) % 60;
      const mins = Math.floor(diffMs / 60000) % 60;
      const hrs = Math.floor(diffMs / 3600000);

      const tokens: string[] = [];
      if (hrs > 0) tokens.push(`${hrs}h`);
      if (mins > 0 || hrs > 0) tokens.push(`${mins}m`);
      tokens.push(`${secs}s`);

      setDuration(tokens.join(' '));
    };

    tick();
    const interval = setInterval(tick, 1000);

    return () => clearInterval(interval);
  }, [status]);

  if (!status) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm animate-pulse space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2 w-1/2">
            <div className="h-5 bg-slate-200 rounded w-3/4" />
            <div className="h-3 bg-slate-200 rounded w-1/2" />
          </div>
          <div className="h-6 bg-slate-200 rounded-full w-20" />
        </div>
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
          <div className="space-y-1"><div className="h-3 bg-slate-200 rounded w-1/2" /><div className="h-4 bg-slate-200 rounded w-3/4" /></div>
          <div className="space-y-1"><div className="h-3 bg-slate-200 rounded w-1/2" /><div className="h-4 bg-slate-200 rounded w-3/4" /></div>
        </div>
      </div>
    );
  }

  const statusBadgeClasses: Record<string, string> = {
    ONLINE: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    CONNECTING: 'text-amber-600 bg-amber-50 border-amber-200',
    OFFLINE: 'text-rose-600 bg-rose-50 border-rose-200',
    ERROR: 'text-rose-700 bg-rose-100 border-rose-300',
  };

  const statusDotClasses: Record<string, string> = {
    ONLINE: 'bg-emerald-500',
    CONNECTING: 'bg-amber-500',
    OFFLINE: 'bg-rose-500',
    ERROR: 'bg-rose-700',
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-800">{status.name}</h3>
          <p className="text-xs text-slate-500">IP: {status.ipAddress}</p>
        </div>
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${
            statusBadgeClasses[status.status]
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full mr-1.5 ${
              status.status === 'CONNECTING' ? 'animate-ping' : ''
            } ${statusDotClasses[status.status]}`}
          />
          {status.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-y-3 gap-x-4 pt-2 border-t border-slate-100 text-sm">
        <div>
          <span className="text-slate-400 block text-xs">Resolution</span>
          <span className="font-semibold text-slate-700">{status.resolution || 'N/A'}</span>
        </div>
        <div>
          <span className="text-slate-400 block text-xs">Frame Rate</span>
          <span className="font-semibold text-slate-700">{status.fps ? `${status.fps} FPS` : '0 FPS'}</span>
        </div>
        <div>
          <span className="text-slate-400 block text-xs">Active Duration</span>
          <span className="font-semibold text-slate-700">{duration}</span>
        </div>
        <div>
          <span className="text-slate-400 block text-xs">Stream Protocol</span>
          <span className="font-semibold text-slate-700">RTSP over TCP</span>
        </div>
      </div>

      {status.error && (
        <div className="mt-2 text-xs bg-rose-50 text-rose-600 p-2.5 rounded-xl border border-rose-100 break-words">
          <strong>Connection Message:</strong> {status.error}
        </div>
      )}
    </div>
  );
}
