import { useState, useEffect, useRef, useCallback, type PointerEvent as ReactPointerEvent } from 'react';
import { useCamera } from '../hooks/useCamera';
import type { CameraRecording } from '../services/camera';

interface CameraPlayerProps {
  cameraId: string;
  autoConnect?: boolean;
}

type TrackedPerson = {
  trackId: number | null;
  confidence: number;
  state: 'green' | 'yellow' | 'red';
  reason: string;
  box: [number, number, number, number];
  keypoints?: [number, number, number][];
  activity?: string;
  activityConfidence?: number;
};

type DetectionSnapshot = {
  cameraId: string;
  frameWidth: number;
  frameHeight: number;
  persons: TrackedPerson[];
  receivedAt: number;
};

const SKELETON_CONNECTIONS: { from: number; to: number; color: string }[] = [
  // Head and neck
  { from: 0, to: 1, color: '#ffd166' }, { from: 0, to: 2, color: '#ffd166' },
  { from: 1, to: 3, color: '#ffd166' }, { from: 2, to: 4, color: '#ffd166' },
  { from: 0, to: 5, color: '#58e1d1' }, { from: 0, to: 6, color: '#58e1d1' },
  // Shoulders and torso
  { from: 5, to: 6, color: '#58e1d1' }, { from: 5, to: 11, color: '#58e1d1' },
  { from: 6, to: 12, color: '#58e1d1' }, { from: 11, to: 12, color: '#58e1d1' },
  // Arms
  { from: 5, to: 7, color: '#ff9f43' }, { from: 7, to: 9, color: '#ff9f43' },
  { from: 6, to: 8, color: '#45c4f2' }, { from: 8, to: 10, color: '#45c4f2' },
  // Legs
  { from: 11, to: 13, color: '#b49aff' }, { from: 13, to: 15, color: '#b49aff' },
  { from: 12, to: 14, color: '#86d17b' }, { from: 14, to: 16, color: '#86d17b' },
];

const KEYPOINT_COLORS = [
  '#ffd166', '#ffd166', '#ffd166', '#ffd166', '#ffd166',
  '#ff9f43', '#45c4f2', '#ff9f43', '#45c4f2', '#ff9f43', '#45c4f2',
  '#b49aff', '#86d17b', '#b49aff', '#86d17b', '#b49aff', '#86d17b',
];

const isFallActivity = (activity?: string) => activity === 'FALL' || activity === 'FALLEN';

/**
 * CameraPlayer component handles the streaming video display, PTZ directional
 * controls, and a recording panel with a live countdown timer.
 * Direction buttons and recording controls are always visible beneath the feed.
 */
export function CameraPlayer({ cameraId, autoConnect = false }: CameraPlayerProps) {
  const {
    status,
    loading,
    error,
    start,
    stop,
    triggerPTZ,
    streamUrl,
    actionSuccess,
    capabilities,
    webSocketStatus,
    gotoPreset,
    setMotionTracking,
    setNightVision,
    talk,
    snapshot,
    record,
    stopRecording: stopCameraRecording,
    loadRecordings,
    recordingUrl,
    recordingDownloadUrl,
  } = useCamera(cameraId);

  const [imgError, setImgError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeTab, setActiveTab] = useState<'live' | 'playback' | 'ptz'>('live');
  const [detections, setDetections] = useState<DetectionSnapshot | null>(null);
  const [clock, setClock] = useState(Date.now());

  useEffect(() => {
    setDetections(null);
  }, [cameraId]);

  useEffect(() => {
    const handleDetection = (event: Event) => {
      const { detail } = event as CustomEvent<{
        type?: string;
        cameraId?: string;
        details?: Record<string, unknown>;
      }>;
      if (detail.cameraId !== cameraId || !detail.details) return;

      const { frameWidth, frameHeight, persons } = detail.details;
      if (
        detail.type !== 'person_detection_update' ||
        typeof frameWidth !== 'number' ||
        typeof frameHeight !== 'number' ||
        !Array.isArray(persons)
      ) {
        return;
      }

      setDetections({
        cameraId,
        frameWidth,
        frameHeight,
        persons: persons as TrackedPerson[],
        receivedAt: Date.now(),
      });
    };

    window.addEventListener('eldercare-camera-alert', handleDetection);
    return () => window.removeEventListener('eldercare-camera-alert', handleDetection);
  }, [cameraId]);

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Recording state ────────────────────────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordDuration, setRecordDuration] = useState(30); // user-chosen duration
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRecordingIdRef = useRef<string | null>(null);
  const [recordings, setRecordings] = useState<CameraRecording[]>([]);
  const [selectedRecordingId, setSelectedRecordingId] = useState<string | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  const refreshRecordings = useCallback(async () => {
    const savedRecordings = await loadRecordings();
    setRecordings(savedRecordings);
    setSelectedRecordingId((current) =>
      current && savedRecordings.some((item) => item.id === current)
        ? current
        : savedRecordings[0]?.id ?? null,
    );
  }, [loadRecordings]);

  useEffect(() => {
    let active = true;
    setRecordings([]);
    setSelectedRecordingId(null);
    setRecordingError(null);
    void loadRecordings()
      .then((savedRecordings) => {
        if (!active) return;
        setRecordings(savedRecordings);
        setSelectedRecordingId(savedRecordings[0]?.id ?? null);
      })
      .catch((err: unknown) => {
        if (active) {
          setRecordingError(err instanceof Error ? err.message : 'Could not load recordings.');
        }
      });
    return () => {
      active = false;
    };
  }, [cameraId, loadRecordings]);

  const stopRecording = useCallback(async () => {
    const recordingId = activeRecordingIdRef.current;
    if (!recordingId) return;
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }

    try {
      const completed = await stopCameraRecording(recordingId);
      activeRecordingIdRef.current = null;
      setIsRecording(false);
      setRecordSeconds(0);
      setRecordingError(null);
      setSelectedRecordingId(completed.id);
      await refreshRecordings();
    } catch (err: unknown) {
      setRecordingError(err instanceof Error ? err.message : 'Could not finalize the recording.');
    }
  }, [refreshRecordings, stopCameraRecording]);

  const startRecording = useCallback(async () => {
    if (activeRecordingIdRef.current) return;
    try {
      const started = await record(recordDuration);
      activeRecordingIdRef.current = started.id;
      setIsRecording(true);
      setRecordSeconds(0);
      setRecordingError(null);
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds((previous) => {
          const next = previous + 1;
          if (next >= started.durationSeconds) {
            if (recordTimerRef.current) clearInterval(recordTimerRef.current);
            recordTimerRef.current = null;
            void stopRecording();
            return started.durationSeconds;
          }
          return next;
        });
      }, 1000);
    } catch (err: unknown) {
      setRecordingError(err instanceof Error ? err.message : 'Could not start the recording.');
    }
  }, [record, recordDuration, stopRecording]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      const recordingId = activeRecordingIdRef.current;
      if (recordingId) {
        void stopCameraRecording(recordingId).catch((err: unknown) => {
          console.error('Could not stop the camera recording when leaving the player.', err);
        });
      }
    };
  }, [cameraId, stopCameraRecording]);

  // Reset image error state when camera status changes
  useEffect(() => {
    if (status?.status === 'ONLINE') {
      setImgError(false);
    }
  }, [status?.status]);

  const handleImageError = () => {
    console.error(`Stream frame rendering error on ${cameraId}`);
    setImgError(true);
  };

  const handleReload = () => {
    setReloadKey((prev) => prev + 1);
    setImgError(false);
  };

  const isOnline = status?.status === 'ONLINE';
  const isConnecting = status?.status === 'CONNECTING';
  const isOffline = status?.status === 'OFFLINE' || !status;
  const isError = status?.status === 'ERROR';
  const shouldAttachStream = isOnline || (autoConnect && !isError);
  const showConnecting = isConnecting || (autoConnect && !isOnline && !isError);
  useEffect(() => {
    if ((!isOnline && !(autoConnect && !isError)) || !imgError) return;

    const retryTimer = window.setTimeout(() => {
      setReloadKey((key) => key + 1);
      setImgError(false);
    }, 4000);

    return () => window.clearTimeout(retryTimer);
  }, [autoConnect, imgError, isError, isOnline]);

  const ptzEnabled = isOnline && capabilities?.supportsPTZ === true;
  const beginPtzMove = (action: 'left' | 'right' | 'up' | 'down' | 'zoom_in' | 'zoom_out') =>
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      void triggerPTZ(action);
    };
  const endPtzMove = () => void triggerPTZ('stop');
  const recEnabled = isOnline && capabilities?.supportsRecording === true;
  const detectionIsFresh = Boolean(detections && clock - detections.receivedAt < 3000);
  const statusCounts = detections?.persons.reduce(
    (counts, person) => {
      counts[person.state] += 1;
      return counts;
    },
    { green: 0, yellow: 0, red: 0 },
  );
  const confirmedFallPersons = detectionIsFresh
    ? detections?.persons.filter((person) => person.state === 'red') ?? []
    : [];
  const possibleFallPersons = detectionIsFresh
    ? detections?.persons.filter((person) =>
        person.state === 'yellow' && (isFallActivity(person.activity) || /possible fall/i.test(person.reason)),
      ) ?? []
    : [];
  const fallBanner = confirmedFallPersons.length > 0
    ? { confirmed: true, persons: confirmedFallPersons }
    : possibleFallPersons.length > 0
      ? { confirmed: false, persons: possibleFallPersons }
      : null;

  // Format seconds → MM:SS
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="flex flex-col space-y-4">
      {/* ── Aspect Video Stream Canvas ─────────────────────────────────────── */}
      <div className="relative aspect-video w-full overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 shadow-xl group">
        {/* ONLINE Video Stream */}
        {shouldAttachStream && !imgError && (
          <img
            key={`${streamUrl}-${reloadKey}`}
            src={streamUrl}
            alt={`${status?.name || 'Camera'} feed`}
            className="h-full w-full object-cover"
            onError={handleImageError}
          />
        )}

        {isOnline && !imgError && detectionIsFresh && detections && (
          <svg
            aria-label="Live AI person detection overlays"
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox={`0 0 ${detections.frameWidth} ${detections.frameHeight}`}
            preserveAspectRatio="xMidYMid slice"
          >
            {detections.persons.map((person, index) => {
              const [x1, y1, x2, y2] = person.box;
              const activityLabel = person.activity ? ` · ${person.activity}` : '';
              const confPct = Math.round((person.activityConfidence ?? person.confidence) * 100);
              const confirmedFall = person.state === 'red';
              const possibleFall = person.state === 'yellow' && (isFallActivity(person.activity) || /possible fall/i.test(person.reason));
              const boxColor = confirmedFall ? '#ff3548' : possibleFall ? '#ffc247' : '#3be477';
              const personLabel = confirmedFall
                ? `FALL DETECTED · ${person.trackId === null ? 'Person' : `ID ${person.trackId}`}`
                : possibleFall
                  ? `POSSIBLE FALL · ${person.trackId === null ? 'Person' : `ID ${person.trackId}`}`
                  : `${person.trackId === null ? 'Person' : `ID ${person.trackId}`}${activityLabel} · ${confPct}%`;
              const strokeW = 3.5;
              const pointRadius = 5;
              const labelFontSize = 16;
              const labelWidth = Math.max(112, personLabel.length * 9 + 18);
              const labelY = Math.max(25, y1 - 8);

              return (
                <g key={`${person.trackId ?? 'untracked'}-${index}`}>
                  {Array.isArray(person.keypoints) && person.keypoints.length === 17 && (
                    <>
                      {SKELETON_CONNECTIONS.map(({ from, to, color }, lineIndex) => {
                        const pa = person.keypoints![from];
                        const pb = person.keypoints![to];
                        if (!pa || !pb || pa[2] < 0.2 || pb[2] < 0.2) return null;
                        return (
                          <g key={`${lineIndex}-${from}-${to}`}>
                            <line
                              x1={pa[0]}
                              y1={pa[1]}
                              x2={pb[0]}
                              y2={pb[1]}
                              stroke="#07111c"
                              strokeWidth={strokeW + 3}
                              vectorEffect="non-scaling-stroke"
                              strokeLinecap="round"
                              opacity="0.9"
                            />
                            <line
                              x1={pa[0]}
                              y1={pa[1]}
                              x2={pb[0]}
                              y2={pb[1]}
                              stroke={color}
                              strokeWidth={strokeW}
                              vectorEffect="non-scaling-stroke"
                              strokeLinecap="round"
                              opacity={Math.min(1, 0.55 + Math.min(pa[2], pb[2]) * 0.45)}
                            />
                          </g>
                        );
                      })}
                      {person.keypoints.map((kp, kpIndex) => (
                        kp[2] >= 0.2 ? (
                          <g key={`kp-${kpIndex}`}>
                            <circle
                              cx={kp[0]}
                              cy={kp[1]}
                              r={pointRadius + 2}
                              fill="#07111c"
                              opacity="0.9"
                              vectorEffect="non-scaling-stroke"
                            />
                            <circle
                              cx={kp[0]}
                              cy={kp[1]}
                              r={pointRadius}
                              fill={KEYPOINT_COLORS[kpIndex]}
                              stroke="#ffffff"
                              strokeWidth="1.5"
                              vectorEffect="non-scaling-stroke"
                            />
                            <circle
                              cx={kp[0]}
                              cy={kp[1]}
                              r="1.4"
                              fill="#ffffff"
                              vectorEffect="non-scaling-stroke"
                            />
                          </g>
                        ) : null
                      ))}
                    </>
                  )}
                  <rect
                    x={x1}
                    y={y1}
                    width={Math.max(1, x2 - x1)}
                    height={Math.max(1, y2 - y1)}
                    fill="none"
                    stroke="#07111c"
                    strokeWidth="7"
                    vectorEffect="non-scaling-stroke"
                    opacity="0.9"
                  />
                  <rect
                    x={x1}
                    y={y1}
                    width={Math.max(1, x2 - x1)}
                    height={Math.max(1, y2 - y1)}
                    rx="2"
                    fill="none"
                    stroke={boxColor}
                    strokeWidth="3.5"
                    vectorEffect="non-scaling-stroke"
                  />
                  <rect
                    x={x1}
                    y={labelY - 23}
                    width={Math.min(labelWidth, Math.max(112, detections.frameWidth - x1))}
                    height="23"
                    rx="3"
                    fill={boxColor}
                    opacity="0.96"
                  />
                  <text
                    x={x1 + 9}
                    y={labelY - 7}
                    textAnchor="start"
                    fill="#07111c"
                    fontSize={labelFontSize}
                    fontWeight="700"
                  >
                    {personLabel}
                  </text>
                </g>
              );
            })}
          </svg>
        )}

        {isOnline && !imgError && fallBanner && (
          <div
            role="status"
            aria-live="assertive"
            className={`pointer-events-none absolute left-4 top-4 z-20 flex max-w-[calc(100%-2rem)] items-center gap-3 border-l-4 px-4 py-3 text-white shadow-xl ${
              fallBanner.confirmed
                ? 'border-rose-200 bg-rose-700/95'
                : 'border-amber-100 bg-amber-600/95'
            }`}
          >
            <span className="material-symbols-outlined shrink-0 text-2xl" aria-hidden="true">
              {fallBanner.confirmed ? 'warning' : 'error'}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-black uppercase tracking-wide sm:text-base">
                {fallBanner.confirmed ? 'Fall event detected' : 'Possible fall'}
              </span>
              <span className="block truncate text-xs font-semibold text-white/90">
                {fallBanner.persons.map((person) =>
                  person.trackId === null ? 'Person' : `Person ${person.trackId}`,
                ).join(', ')}
                {fallBanner.confirmed ? ' · Verify immediately' : ' · Monitoring'}
              </span>
            </span>
          </div>
        )}

        {/* CONNECTING State Overlay */}
        {showConnecting && !imgError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 text-white z-10 space-y-4">
            <span className="material-symbols-outlined text-4xl animate-spin text-blue-400">
              progress_activity
            </span>
            <div className="text-center">
              <p className="font-bold">Waiting for camera video...</p>
              <p className="text-xs text-slate-400 mt-1">The backend clears this when it receives the first complete frame.</p>
            </div>
            {!autoConnect && (
              <button
                onClick={() => void stop()}
                className="mt-2 rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-xs font-semibold hover:bg-white/10 transition-colors"
              >
                Cancel Connection
              </button>
            )}
          </div>
        )}

        {/* ERROR State Overlay */}
        {isError && !isConnecting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 text-white z-10 space-y-4 px-6 text-center">
            <div className="rounded-full bg-rose-950/80 border border-rose-800 p-4 text-rose-400">
              <span className="material-symbols-outlined text-4xl">error</span>
            </div>
            <div className="max-w-md">
              <p className="font-bold text-lg text-rose-300">Camera Stream Error</p>
              <p className="text-xs text-rose-200/90 mt-2 font-mono bg-rose-950/40 p-2.5 rounded-xl border border-rose-900/60 break-words">
                {status?.error || 'Failed to establish RTSP connection with camera.'}
              </p>
              {status?.reconnectAttempts !== undefined && status.reconnectAttempts > 0 && (
                <p className="text-[11px] text-slate-400 mt-2">
                  Reconnection attempts: {status?.reconnectAttempts} (retry delay capped at 30 seconds)
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => void start()}
                disabled={loading}
                className="rounded-full bg-rose-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-rose-600/30 hover:bg-rose-500 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">refresh</span>
                {loading ? 'Retrying...' : 'Retry Connection'}
              </button>
              <button
                onClick={() => void stop()}
                className="rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-xs font-semibold hover:bg-white/10 transition-colors"
              >
                Dismiss / Stop
              </button>
            </div>
          </div>
        )}

        {/* OFFLINE State Overlay */}
        {isOffline && !isConnecting && !isError && !autoConnect && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-white z-10 space-y-4">
            <div className="rounded-full bg-slate-900 border border-slate-800 p-4 text-slate-400">
              <span className="material-symbols-outlined text-5xl">videocam_off</span>
            </div>
            <div className="text-center px-4">
              <p className="font-bold text-lg text-slate-300">Camera Stream is Offline</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Press Connect to start reading the camera&apos;s RTSP feed and broadcast live
              </p>
            </div>
            <button
              onClick={() => void start()}
              disabled={loading}
              className="rounded-full bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-500/20 hover:scale-105 transition-all disabled:opacity-50"
            >
              {loading ? 'Initializing...' : 'Connect Camera'}
            </button>
          </div>
        )}

        {/* IMAGE LOADING / TRANSCODING DELAY State Overlay */}
        {(isOnline || (autoConnect && !isError)) && imgError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 text-white z-10 space-y-4">
            <span className="material-symbols-outlined text-4xl text-amber-400 animate-pulse">sensors</span>
            <div className="text-center px-4">
              <p className="font-bold">Awaiting Stream Buffer...</p>
              <p className="text-xs text-slate-400 mt-1">FFmpeg process started. Syncing first frames</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleReload}
                className="rounded-full bg-white px-5 py-2 text-xs font-bold text-slate-900 hover:bg-slate-200 transition-colors"
              >
                Sync Stream
              </button>
              <button
                onClick={() => void stop()}
                className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold hover:bg-white/10 transition-colors"
              >
                Disconnect
              </button>
            </div>
          </div>
        )}

        {/* Live / Playback status pill */}
        {isOnline && !imgError && (
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2 rounded-full bg-slate-900/60 backdrop-blur-md border border-white/10 px-3 py-1.5 text-xs text-white">
            <span className={`h-2 w-2 rounded-full ${activeTab === 'playback' ? 'bg-purple-500' : 'bg-emerald-500 animate-pulse'}`} />
            <span className="font-medium tracking-wide">{activeTab === 'playback' ? 'PLAYBACK' : 'LIVE'}</span>
            <span className="text-white/40" aria-hidden="true">|</span>
            <span
              className={`h-2 w-2 rounded-full ${
                webSocketStatus === 'connected'
                  ? 'bg-emerald-400'
                  : webSocketStatus === 'connecting'
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-rose-400'
              }`}
              aria-hidden="true"
            />
            <span className="font-medium">Signal {webSocketStatus}</span>
          </div>
        )}

        {isOnline && !imgError && (
          <div className="absolute top-4 right-4 z-10 rounded-full border border-white/10 bg-slate-900/70 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur-md">
            {detectionIsFresh && statusCounts
              ? `AI LIVE · ${detections?.persons.length ?? 0} PERSON${detections?.persons.length === 1 ? '' : 'S'} · ${statusCounts.red} FALL`
              : 'AI DETECTION OFFLINE'}
          </div>
        )}

        {/* Recording badge overlay — shown while recording */}
        {isRecording && (
          <div className="absolute top-4 right-4 z-10 flex items-center gap-2 rounded-full bg-red-600/90 backdrop-blur-md border border-red-400/40 px-3 py-1.5 text-xs text-white font-bold animate-pulse">
            <span className="h-2 w-2 rounded-full bg-white" />
            REC {fmt(recordSeconds)} / {fmt(recordDuration)}
          </div>
        )}
      </div>

      {/* ── Primary Controls (Always Visible) ─────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-slate-50 px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-slate-700">Stream Source:</span>
        </div>
        <div className="flex gap-2">
          {isOnline ? (
            <button
              onClick={() => void stop()}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-full bg-slate-900 px-5 py-2 text-sm font-bold text-white shadow-md hover:bg-slate-800 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">stop</span>
              Stop Camera
            </button>
          ) : (
            <button
              onClick={() => void start()}
              disabled={loading || (autoConnect && !isError)}
              className="flex items-center gap-1.5 rounded-full bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">play_arrow</span>
              {isError ? 'Retry Connection' : autoConnect ? 'Connecting...' : 'Start Camera'}
            </button>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          ALWAYS-VISIBLE: Direction Controls + Recording Panel
         ══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ── PTZ Direction Pad ──────────────────────────────────────────── */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-blue-500 text-[18px]">gamepad</span>
              Directional Control (PTZ)
            </h3>
            {!ptzEnabled && (
              <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-2 py-1 rounded-full">
                {isOnline ? 'PTZ not available' : 'Camera offline'}
              </span>
            )}
          </div>

          {/* D-pad grid */}
          <div className="flex flex-col items-center gap-2">
            <div className="grid grid-cols-3 gap-2">
              {/* Row 1 */}
              <div />
              <button
                disabled={!ptzEnabled}
                onPointerDown={beginPtzMove('up')}
                onPointerUp={endPtzMove}
                onPointerCancel={endPtzMove}
                title="Pan Up"
                style={{ touchAction: 'none' }}
                className="flex items-center justify-center bg-slate-50 hover:bg-blue-50 active:bg-blue-100 border border-slate-200 hover:border-blue-300 text-slate-600 hover:text-blue-600 active:scale-90 transition-all rounded-2xl h-14 w-14 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-2xl font-bold">keyboard_arrow_up</span>
              </button>
              <div />

              {/* Row 2 */}
              <button
                disabled={!ptzEnabled}
                onPointerDown={beginPtzMove('left')}
                onPointerUp={endPtzMove}
                onPointerCancel={endPtzMove}
                title="Pan Left"
                style={{ touchAction: 'none' }}
                className="flex items-center justify-center bg-slate-50 hover:bg-blue-50 active:bg-blue-100 border border-slate-200 hover:border-blue-300 text-slate-600 hover:text-blue-600 active:scale-90 transition-all rounded-2xl h-14 w-14 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-2xl font-bold">keyboard_arrow_left</span>
              </button>
              <button
                disabled={!ptzEnabled}
                onClick={() => void triggerPTZ('stop')}
                title="Stop Movement"
                className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 active:scale-90 text-white rounded-2xl h-14 w-14 shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <span className="material-symbols-outlined text-lg">stop</span>
              </button>
              <button
                disabled={!ptzEnabled}
                onPointerDown={beginPtzMove('right')}
                onPointerUp={endPtzMove}
                onPointerCancel={endPtzMove}
                title="Pan Right"
                style={{ touchAction: 'none' }}
                className="flex items-center justify-center bg-slate-50 hover:bg-blue-50 active:bg-blue-100 border border-slate-200 hover:border-blue-300 text-slate-600 hover:text-blue-600 active:scale-90 transition-all rounded-2xl h-14 w-14 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-2xl font-bold">keyboard_arrow_right</span>
              </button>

              {/* Row 3 */}
              <div />
              <button
                disabled={!ptzEnabled}
                onPointerDown={beginPtzMove('down')}
                onPointerUp={endPtzMove}
                onPointerCancel={endPtzMove}
                title="Pan Down"
                style={{ touchAction: 'none' }}
                className="flex items-center justify-center bg-slate-50 hover:bg-blue-50 active:bg-blue-100 border border-slate-200 hover:border-blue-300 text-slate-600 hover:text-blue-600 active:scale-90 transition-all rounded-2xl h-14 w-14 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-2xl font-bold">keyboard_arrow_down</span>
              </button>
              <div />
            </div>

            {/* Zoom row */}
            <div className="flex gap-3 mt-2 w-full max-w-[224px]">
              <button
                disabled={!ptzEnabled}
                onPointerDown={beginPtzMove('zoom_in')}
                onPointerUp={endPtzMove}
                onPointerCancel={endPtzMove}
                title="Zoom In"
                style={{ touchAction: 'none' }}
                className="flex flex-1 items-center justify-center gap-1 py-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-700 hover:text-emerald-700 text-xs font-bold rounded-xl shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors active:scale-95"
              >
                <span className="material-symbols-outlined text-[16px]">zoom_in</span> Zoom +
              </button>
              <button
                disabled={!ptzEnabled}
                onPointerDown={beginPtzMove('zoom_out')}
                onPointerUp={endPtzMove}
                onPointerCancel={endPtzMove}
                title="Zoom Out"
                style={{ touchAction: 'none' }}
                className="flex flex-1 items-center justify-center gap-1 py-2.5 bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-300 text-slate-700 hover:text-amber-700 text-xs font-bold rounded-xl shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors active:scale-95"
              >
                <span className="material-symbols-outlined text-[16px]">zoom_out</span> Zoom −
              </button>
            </div>

            <button
              disabled={!ptzEnabled}
              onClick={() => void triggerPTZ('home')}
              title="Return Home"
              className="px-3 py-1.5 text-[11px] font-bold rounded-xl bg-slate-50 border border-slate-200 hover:bg-blue-50 hover:border-blue-200 text-slate-600 hover:text-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Home
            </button>

            {/* Quick preset shortcuts */}
            <div className="flex gap-2 flex-wrap justify-center w-full mt-1">
              {['Home', 'Bed', 'Door', 'Window'].map((preset) => (
                <button
                  key={preset}
                  disabled={!isOnline || !capabilities?.supportsPresets}
                  onClick={() => void gotoPreset(preset.toLowerCase())}
                  className="px-3 py-1.5 text-[11px] font-bold rounded-xl bg-slate-50 border border-slate-200 hover:bg-blue-50 hover:border-blue-200 text-slate-600 hover:text-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Recording Panel ────────────────────────────────────────────── */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-rose-500 text-[18px]">radio_button_checked</span>
              Recording
            </h3>
            {isRecording && (
              <span className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded-full animate-pulse">
                ● REC {fmt(recordSeconds)} / {fmt(recordDuration)}
              </span>
            )}
          </div>

          {/* Duration selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Duration
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[15, 30, 60, 120].map((sec) => (
                <button
                  key={sec}
                  disabled={isRecording}
                  onClick={() => setRecordDuration(sec)}
                  className={`py-2 text-xs font-bold rounded-xl border transition-colors ${
                    recordDuration === sec
                      ? 'bg-rose-600 border-rose-600 text-white shadow-md shadow-rose-200'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {sec < 60 ? `${sec}s` : `${sec / 60}m`}
                </button>
              ))}
            </div>
          </div>

          {/* Progress bar while recording */}
          {isRecording && (
            <div className="space-y-1.5">
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full transition-all duration-1000"
                  style={{ width: `${Math.min((recordSeconds / recordDuration) * 100, 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 text-center">
                Recording in progress — {recordDuration - recordSeconds}s remaining
              </p>
            </div>
          )}

          {/* Record / Stop button */}
          <button
            disabled={!recEnabled || loading}
            onClick={isRecording ? stopRecording : () => void startRecording()}
            className={`w-full py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] ${
              isRecording
                ? 'bg-slate-800 hover:bg-slate-700 text-white shadow-slate-300'
                : 'bg-red-600 hover:bg-red-700 text-white shadow-red-200 disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {isRecording ? 'stop_circle' : 'radio_button_checked'}
            </span>
            {isRecording ? `Stop Recording (${recordDuration - recordSeconds}s left)` : 'Start Recording'}
          </button>
          {recordingError && (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {recordingError}
            </p>
          )}

          {/* Snapshot + Talk row */}
          <div className="flex gap-2">
            <button
              disabled={!isOnline || !capabilities?.supportsSnapshot}
              onClick={() => void snapshot()}
              className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-slate-50 border border-slate-200 hover:bg-blue-50 hover:border-blue-200 text-slate-700 hover:text-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">photo_camera</span>
              Snapshot
            </button>
            <button
              disabled={!isOnline || !capabilities?.supportsTalk}
              onClick={() => void talk()}
              className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-slate-50 border border-slate-200 hover:bg-purple-50 hover:border-purple-200 text-slate-700 hover:text-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">record_voice_over</span>
              Talk
            </button>
          </div>

          {/* Smart features: Motion tracking + Night vision */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Smart Features</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                disabled={!isOnline || !capabilities?.supportsTracking}
                onClick={() => void setMotionTracking(true)}
                className="py-2 text-[11px] font-bold rounded-xl bg-slate-50 border border-slate-200 hover:bg-emerald-50 hover:border-emerald-200 text-slate-600 hover:text-emerald-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-[14px]">radar</span> Track ON
              </button>
              <button
                disabled={!isOnline || !capabilities?.supportsTracking}
                onClick={() => void setMotionTracking(false)}
                className="py-2 text-[11px] font-bold rounded-xl bg-slate-50 border border-slate-200 hover:bg-rose-50 hover:border-rose-200 text-slate-600 hover:text-rose-700 disabled:opacity-40 transition-colors flex items-center justify-center"
              >
                Track OFF
              </button>
              <button
                disabled={!isOnline || !capabilities?.supportsNightVision}
                onClick={() => void setNightVision(true)}
                className="py-2 text-[11px] font-bold rounded-xl bg-slate-50 border border-slate-200 hover:bg-indigo-50 hover:border-indigo-200 text-slate-600 hover:text-indigo-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-[14px]">dark_mode</span> NV ON
              </button>
              <button
                disabled={!isOnline || !capabilities?.supportsNightVision}
                onClick={() => void setNightVision(false)}
                className="py-2 text-[11px] font-bold rounded-xl bg-slate-50 border border-slate-200 hover:bg-amber-50 hover:border-amber-200 text-slate-600 hover:text-amber-700 disabled:opacity-40 transition-colors flex items-center justify-center"
              >
                NV OFF
              </button>
            </div>
          </div>

          <div className="space-y-3 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Completed recordings
              </h4>
              <button
                type="button"
                onClick={() => void refreshRecordings().catch((err: unknown) => {
                  setRecordingError(err instanceof Error ? err.message : 'Could not refresh recordings.');
                })}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                Refresh
              </button>
            </div>
            {recordings.length === 0 ? (
              <p className="text-xs text-slate-400">No completed recordings yet.</p>
            ) : (
              <ul className="max-h-36 space-y-2 overflow-y-auto">
                {recordings.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setSelectedRecordingId(item.id)}
                      className="min-w-0 flex-1 text-left"
                      title={item.id}
                    >
                      <span className="block truncate text-xs font-semibold text-slate-700">
                        {new Date(item.createdAt).toLocaleString()}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {(item.sizeBytes / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </button>
                    <a
                      href={recordingDownloadUrl(item.id)}
                      download
                      className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-blue-700 hover:bg-blue-50"
                    >
                      Download
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {selectedRecordingId && (
              <video
                key={selectedRecordingId}
                src={recordingUrl(selectedRecordingId)}
                controls
                preload="metadata"
                className="w-full rounded-xl bg-black"
                aria-label="Completed camera recording playback"
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs (Playback / Advanced PTZ still accessible) ────────────────── */}
      <div className="flex gap-2 border-b border-slate-200 pb-px">
        {([
          { id: 'live', label: 'Live View', icon: 'videocam' },
          { id: 'playback', label: 'Camera Playback', icon: 'history' },
          { id: 'ptz', label: 'Advanced PTZ', icon: 'settings_remote' },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Playback Tab */}
      {activeTab === 'playback' && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col gap-6">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-purple-500">history</span>
            Historical Playback
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>00:00</span>
              <span>12:00</span>
              <span>23:59</span>
            </div>
            <div className="h-4 w-full bg-slate-100 rounded-full relative overflow-hidden">
               <div className="absolute left-0 top-0 h-full w-[45%] bg-purple-200"></div>
               <div className="absolute left-[45%] top-0 h-full w-2 bg-purple-500 rounded-full cursor-pointer shadow-md"></div>
            </div>
            <div className="flex justify-center gap-4 mt-4">
              <button className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 text-slate-700"><span className="material-symbols-outlined">fast_rewind</span></button>
              <button className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 text-slate-700"><span className="material-symbols-outlined">play_arrow</span></button>
              <button className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 text-slate-700"><span className="material-symbols-outlined">fast_forward</span></button>
            </div>
          </div>
        </div>
      )}

      {/* Advanced PTZ Tab — full expanded view */}
      {activeTab === 'ptz' && isOnline && capabilities && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col gap-6">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-500">settings_remote</span>
            Advanced PTZ & Controls
          </h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Full D-Pad */}
            <div className="flex flex-col items-center bg-slate-50 p-6 rounded-3xl border border-slate-200 gap-6">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider w-full text-center">Directional Control</h4>
              <div className="grid grid-cols-3 grid-rows-3 gap-3">
                <div />
                <button disabled={!capabilities.supportsPTZ} onPointerDown={beginPtzMove('up')} onPointerUp={endPtzMove} onPointerCancel={endPtzMove} style={{ touchAction: 'none' }} className="flex items-center justify-center bg-white shadow-sm border border-slate-200 text-slate-600 hover:text-blue-600 active:scale-95 transition-all rounded-xl h-14 w-14 disabled:opacity-50">
                  <span className="material-symbols-outlined font-bold text-2xl">keyboard_arrow_up</span>
                </button>
                <div />
                <button disabled={!capabilities.supportsPTZ} onPointerDown={beginPtzMove('left')} onPointerUp={endPtzMove} onPointerCancel={endPtzMove} style={{ touchAction: 'none' }} className="flex items-center justify-center bg-white shadow-sm border border-slate-200 text-slate-600 hover:text-blue-600 active:scale-95 transition-all rounded-xl h-14 w-14 disabled:opacity-50">
                  <span className="material-symbols-outlined font-bold text-2xl">keyboard_arrow_left</span>
                </button>
                <button disabled={!capabilities.supportsPTZ} onClick={() => void triggerPTZ('stop')} title="Stop Movement" className="flex items-center justify-center bg-white shadow-sm border border-slate-200 text-slate-600 hover:text-red-600 active:scale-95 transition-all rounded-xl h-14 w-14 disabled:opacity-50">
                  <span className="material-symbols-outlined text-xl">stop</span>
                </button>
                <button disabled={!capabilities.supportsPTZ} onPointerDown={beginPtzMove('right')} onPointerUp={endPtzMove} onPointerCancel={endPtzMove} style={{ touchAction: 'none' }} className="flex items-center justify-center bg-white shadow-sm border border-slate-200 text-slate-600 hover:text-blue-600 active:scale-95 transition-all rounded-xl h-14 w-14 disabled:opacity-50">
                  <span className="material-symbols-outlined font-bold text-2xl">keyboard_arrow_right</span>
                </button>
                <div />
                <button disabled={!capabilities.supportsPTZ} onPointerDown={beginPtzMove('down')} onPointerUp={endPtzMove} onPointerCancel={endPtzMove} style={{ touchAction: 'none' }} className="flex items-center justify-center bg-white shadow-sm border border-slate-200 text-slate-600 hover:text-blue-600 active:scale-95 transition-all rounded-xl h-14 w-14 disabled:opacity-50">
                  <span className="material-symbols-outlined font-bold text-2xl">keyboard_arrow_down</span>
                </button>
                <div />
              </div>

              <div className="flex gap-4 w-full px-4">
                <button disabled={!capabilities.supportsPTZ} onClick={() => void triggerPTZ('home')} className="flex-1 py-2.5 bg-white shadow-sm hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl border border-slate-200 disabled:opacity-50 transition-colors">Home</button>
              </div>

              <div className="flex gap-4 w-full px-4">
                <button disabled={!capabilities.supportsPTZ} onPointerDown={beginPtzMove('zoom_in')} onPointerUp={endPtzMove} onPointerCancel={endPtzMove} style={{ touchAction: 'none' }} title="Zoom In" className="flex flex-1 items-center justify-center py-2.5 bg-white shadow-sm hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl border border-slate-200 disabled:opacity-50 transition-colors">
                  <span className="material-symbols-outlined text-[18px] mr-1">zoom_in</span> Zoom In
                </button>
                <button disabled={!capabilities.supportsPTZ} onPointerDown={beginPtzMove('zoom_out')} onPointerUp={endPtzMove} onPointerCancel={endPtzMove} style={{ touchAction: 'none' }} title="Zoom Out" className="flex flex-1 items-center justify-center py-2.5 bg-white shadow-sm hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl border border-slate-200 disabled:opacity-50 transition-colors">
                  <span className="material-symbols-outlined text-[18px] mr-1">zoom_out</span> Zoom Out
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {/* Presets */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Presets</h4>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                  {['Home', 'Bed', 'Door', 'Window', 'Kitchen'].map(preset => (
                    <button
                      key={preset}
                      disabled={!capabilities.supportsPresets}
                      onClick={() => void gotoPreset(preset.toLowerCase())}
                      title={capabilities.supportsPresets ? `Go to ${preset}` : 'Feature not supported by this camera'}
                      className="py-2 px-3 bg-slate-50 hover:bg-blue-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 disabled:opacity-50 disabled:hover:bg-slate-50 transition-colors"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Features */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Smart Features</h4>
                <div className="grid grid-cols-2 gap-2">
                  <button disabled={!capabilities.supportsTracking} onClick={() => void setMotionTracking(true)} className="py-2 bg-slate-50 hover:bg-blue-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 disabled:opacity-50 transition-colors flex items-center justify-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">radar</span> Track ON
                  </button>
                  <button disabled={!capabilities.supportsTracking} onClick={() => void setMotionTracking(false)} className="py-2 bg-slate-50 hover:bg-rose-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 disabled:opacity-50 transition-colors flex items-center justify-center">
                    Track OFF
                  </button>
                  <button disabled={!capabilities.supportsNightVision} onClick={() => void setNightVision(true)} className="py-2 bg-slate-50 hover:bg-blue-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 disabled:opacity-50 transition-colors flex items-center justify-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">dark_mode</span> NV ON
                  </button>
                  <button disabled={!capabilities.supportsNightVision} onClick={() => void setNightVision(false)} className="py-2 bg-slate-50 hover:bg-rose-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 disabled:opacity-50 transition-colors flex items-center justify-center">
                    NV OFF
                  </button>
                </div>
              </div>

              {/* Media Actions */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</h4>
                <div className="flex flex-col gap-2">
                  <button disabled={!capabilities.supportsTalk} onClick={() => void talk()} className="w-full py-2 bg-slate-50 hover:bg-blue-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">record_voice_over</span> Talk / Alarm
                  </button>
                  <div className="flex gap-2">
                    <button disabled={!capabilities.supportsSnapshot} onClick={() => void snapshot()} className="flex-1 py-2 bg-slate-50 hover:bg-blue-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 disabled:opacity-50 transition-colors flex items-center justify-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">photo_camera</span> Snap
                    </button>
                    <button
                      disabled={!capabilities.supportsRecording || isRecording}
                      onClick={() => void startRecording()}
                      className="flex-1 py-2 bg-slate-50 hover:bg-rose-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[16px]">radio_button_checked</span>
                      {isRecording ? `Rec ${fmt(recordSeconds)}` : 'Rec'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Local Error Warning */}
      {error && (
        <div className="rounded-2xl bg-rose-50 border border-rose-100 p-4 text-sm text-rose-700 shadow-sm animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2 font-bold">
            <span className="material-symbols-outlined text-lg">error</span>
            Action Failed
          </div>
          <p className="mt-1 text-xs">{error}</p>
        </div>
      )}

      {/* Action Success Toast */}
      {actionSuccess && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-sm text-emerald-700 shadow-sm animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2 font-bold">
            <span className="material-symbols-outlined text-lg">check_circle</span>
            Success
          </div>
          <p className="mt-1 text-xs">{actionSuccess}</p>
        </div>
      )}
    </div>
  );
}
