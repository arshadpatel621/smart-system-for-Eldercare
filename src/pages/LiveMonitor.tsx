import { useEffect, useState, useCallback } from 'react';
import { useEldercare } from '../context/EldercareContext';
import { CameraPlayer } from '../components/CameraPlayer';
import { CameraStatus } from '../components/CameraStatus';
import { fetchCameras, fetchAllStatuses, type CameraPublicRecord, type CameraStatus as CameraStatusType } from '../services/camera';

type DetectionPerson = {
  trackId: number | null;
  confidence: number;
  state: 'green' | 'yellow' | 'red';
  reason: string;
};

type DetectionSnapshot = {
  cameraId: string;
  timestamp: string;
  persons: DetectionPerson[];
};

/**
 * LiveMonitor renders the unified surveillance feed, health status parameters,
 * camera tabs switcher, and incident alert logging workflows.
 * Only enabled cameras are listed.
 */
export default function LiveMonitor() {
  const { createSafetyEvent } = useEldercare();
  const [cameras, setCameras] = useState<CameraPublicRecord[]>([]);
  const [statuses, setStatuses] = useState<Record<string, CameraStatusType>>({});
  const [activeCameraId, setActiveCameraId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [aiEvents, setAiEvents] = useState<Array<{ type: string; cameraId: string; timestamp: string }>>([]);
  const [detectionSnapshot, setDetectionSnapshot] = useState<DetectionSnapshot | null>(null);
  const [clock, setClock] = useState(Date.now());

  // Plays a warning siren sound using browser-native synthesizer
  const playAlertSiren = useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioContextClass();

      // Tone 1
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(660, audioCtx.currentTime);
      gain1.gain.setValueAtTime(0.2, audioCtx.currentTime);
      osc1.start();
      osc1.stop(audioCtx.currentTime + 0.4);

      // Tone 2 after 150ms
      setTimeout(() => {
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(880, audioCtx.currentTime);
        gain2.gain.setValueAtTime(0.2, audioCtx.currentTime);
        osc2.start();
        osc2.stop(audioCtx.currentTime + 0.4);
      }, 150);

    } catch (soundErr) {
      console.warn('Native beep playback rejected:', soundErr);
    }
  }, []);

  // Loads list of ENABLED cameras only
  const loadCameras = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchCameras();
      // Only show enabled cameras in Live Monitor
      const enabled = list.filter((c) => c.enabled);
      setCameras(enabled);
      if (enabled.length > 0) {
        setActiveCameraId(enabled[0].id);
      }

      const statusList = await fetchAllStatuses();
      const statusMap = statusList.reduce((acc, curr) => {
        acc[curr.id] = curr;
        return acc;
      }, {} as Record<string, CameraStatusType>);
      setStatuses(statusMap);
    } catch (err) {
      console.error('[LiveMonitor] Failed to load cameras or statuses:', err);
      setError('Unable to contact backend server. Verify Express server is running on port 5000.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCameras();
  }, [loadCameras]);

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Listen to WebSocket pushed updates
  useEffect(() => {
    const handleCameraAlert = (e: Event) => {
      const customEvent = e as CustomEvent;
      const eventDetails = customEvent.detail;

      if (eventDetails.type === 'person_detection_update') {
        const details = eventDetails.details;
        if (details && Array.isArray(details.persons)) {
          setDetectionSnapshot({
            cameraId: eventDetails.cameraId,
            timestamp: eventDetails.timestamp || new Date().toISOString(),
            persons: details.persons as DetectionPerson[],
          });
        }
        return;
      }

      const isCriticalAlert = eventDetails.type === 'fall' || eventDetails.type === 'fall_detected';
      const isInactivityAlert = eventDetails.type === 'inactivity' || eventDetails.type === 'inactivity_detected';

      // Auto play notification sound only for critical emergency events
      if (isCriticalAlert) {
        playAlertSiren();
      }

      // Display alert banner locally
      setAiEvents((prev) => [
        {
          type: eventDetails.type,
          cameraId: eventDetails.cameraId,
          timestamp: eventDetails.timestamp || new Date().toISOString(),
        },
        ...prev.slice(0, 4),
      ]);

      // Automatically register the event in Firestore (persisted database) for safety incidents
      if (isCriticalAlert || isInactivityAlert) {
        const trackId = eventDetails.details?.trackId;
        void createSafetyEvent({
          type: isCriticalAlert ? 'fall' : 'inactivity',
          severity: isCriticalAlert ? 'critical' : 'warning',
          occurredAt: eventDetails.timestamp || new Date().toISOString(),
          location: eventDetails.cameraId,
          note: isCriticalAlert
            ? `AI fall alert for tracked person ${trackId ?? 'unknown'}; verify the live feed immediately.`
            : `Real-time AI notification: ${eventDetails.type.toUpperCase()} alert triggered automatically.`,
          resolved: false,
        });
      }
    };

    window.addEventListener('eldercare-camera-alert', handleCameraAlert);
    return () => window.removeEventListener('eldercare-camera-alert', handleCameraAlert);
  }, [createSafetyEvent, playAlertSiren]);

  // Trigger manual event logging for simulation
  const logSimulatedEvent = async (type: 'fall' | 'inactivity') => {
    const activeCamera = cameras.find((c) => c.id === activeCameraId);
    await createSafetyEvent({
      type,
      severity: type === 'fall' ? 'critical' : 'warning',
      occurredAt: new Date().toISOString(),
      location: activeCamera ? activeCamera.name : 'Live Monitor Camera',
      note:
        type === 'fall'
          ? 'Simulated fall logged manually from live camera monitor page.'
          : 'Simulated inactivity logged manually from live camera monitor page.',
      resolved: false,
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-4xl font-bold text-slate-800">Live Camera Monitor</h1>
        <p className="text-slate-500 mt-2">
          Manage and control connected PTZ camera streams. Real-time notifications and AI inference frames will automatically post events below.
        </p>
      </header>

      {error && (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800 flex items-center justify-between">
          <div>
            <p className="font-bold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-lg">cloud_off</span>
              Server Unreachable
            </p>
            <p className="text-xs text-rose-600 mt-1">{error}</p>
          </div>
          <button
            onClick={() => void loadCameras()}
            className="rounded-full bg-rose-600 text-white px-4 py-1.5 text-xs font-bold hover:bg-rose-700 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      )}

      {loading && !error && (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <span className="material-symbols-outlined animate-spin text-4xl text-blue-600">
            progress_activity
          </span>
          <p className="text-sm font-semibold text-slate-500">Retrieving camera lists...</p>
        </div>
      )}

      {!loading && !error && cameras.length === 0 && (
        <div className="rounded-3xl bg-slate-50 border border-slate-200 p-12 text-center">
          <span className="material-symbols-outlined text-5xl text-slate-300 block mb-4">videocam_off</span>
          <p className="text-slate-600 font-semibold text-lg">No enabled cameras</p>
          <p className="text-slate-400 text-sm mt-2 mb-6">
            Go to <strong>Camera Management</strong> to add and enable cameras.
          </p>
          <a
            href="/cameras"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition-all"
          >
            <span className="material-symbols-outlined text-sm">video_settings</span>
            Manage Cameras
          </a>
        </div>
      )}

      {!loading && !error && cameras.length > 0 && (
        <div className="space-y-6">
          {/* Camera Tabs Switcher */}
          <div className="flex gap-2 border-b border-slate-200 pb-px">
            {cameras.map((cam) => {
              const isActive = cam.id === activeCameraId;
              return (
                <button
                  key={cam.id}
                  onClick={() => {
                    setActiveCameraId(cam.id);
                    setDetectionSnapshot(null);
                  }}
                  className={`px-6 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                    isActive
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span className="material-symbols-outlined text-md">videocam</span>
                  {cam.name}
                </button>
              );
            })}
          </div>

          <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            {/* Live Feed Screen Component */}
            <CameraPlayer cameraId={activeCameraId} />

            {/* Status Panel & Incident Testing Sidebars */}
            <div className="space-y-6">
              {/* Dynamic Status Metric Card */}
              <CameraStatus
                status={statuses[activeCameraId] || {
                  id: activeCameraId,
                  name: cameras.find((c) => c.id === activeCameraId)?.name || 'Camera',
                  location: cameras.find((c) => c.id === activeCameraId)?.location || 'other',
                  brand: cameras.find((c) => c.id === activeCameraId)?.brand || 'rtsp',
                  status: 'OFFLINE',
                  ipAddress: cameras.find((c) => c.id === activeCameraId)?.ipAddress || '0.0.0.0',
                  resolution: 'N/A',
                  fps: 0,
                  connectionTime: null,
                  reconnectAttempts: 0,
                }}
              />

              <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" aria-live="polite">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-700">
                    <span className="material-symbols-outlined text-lg text-blue-600">person_search</span>
                    Live AI detection
                  </h2>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                    detectionSnapshot?.cameraId === activeCameraId && clock - Date.parse(detectionSnapshot.timestamp) < 3000
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}>
                    {detectionSnapshot?.cameraId === activeCameraId && clock - Date.parse(detectionSnapshot.timestamp) < 3000
                      ? 'LIVE'
                      : 'WAITING'}
                  </span>
                </div>
                {detectionSnapshot?.cameraId === activeCameraId && clock - Date.parse(detectionSnapshot.timestamp) < 3000 ? (
                  detectionSnapshot.persons.length > 0 ? (
                    <div className="space-y-2">
                      {detectionSnapshot.persons.map((person, index) => {
                        const styles = person.state === 'red'
                          ? 'border-rose-200 bg-rose-50 text-rose-800'
                          : person.state === 'yellow'
                            ? 'border-amber-200 bg-amber-50 text-amber-800'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-800';
                        return (
                          <div key={`${person.trackId ?? 'untracked'}-${index}`} className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${styles}`}>
                            <div>
                              <p className="text-xs font-bold">
                                {person.trackId === null ? 'Person' : `Person ${person.trackId}`} · {person.state.toUpperCase()}
                              </p>
                              <p className="mt-0.5 text-[10px] opacity-80">{person.reason}</p>
                            </div>
                            <span
                              className="shrink-0 text-xs font-bold"
                              title="Person detector confidence; not a calibrated fall probability"
                            >
                              DET {Math.round(person.confidence * 100)}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">No people currently detected.</p>
                  )
                ) : (
                  <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                    AI feed not reporting. Start the camera agent to enable person and fall detection.
                  </p>
                )}
              </section>

              {/* Real-time AI Event Alerts Logs */}
              {aiEvents.length > 0 && (
                <div className="rounded-3xl border border-rose-200 bg-rose-50/50 p-6 shadow-sm space-y-3">
                  <h3 className="text-sm font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-lg animate-pulse">warning</span>
                    AI Events Detected
                  </h3>
                  <div className="space-y-2">
                    {aiEvents.map((evt, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs bg-white border border-rose-100 p-2.5 rounded-xl">
                        <div>
                          <span className="font-bold text-rose-700 capitalize">{evt.type}</span>
                          <span className="text-slate-500 ml-1">detected in {evt.cameraId}</span>
                        </div>
                        <span className="text-slate-400 text-[10px]">
                          {new Date(evt.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Simulation Incident Testing Module */}
              <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-2xl font-bold text-slate-800">Incident Testing</h2>
                <p className="text-xs text-slate-500">
                  Simulate events to verify alert notifications and database write triggers.
                </p>
                <div className="space-y-2">
                  <button
                    onClick={() => void logSimulatedEvent('fall')}
                    className="w-full rounded-2xl bg-red-600 hover:bg-red-700 px-4 py-3 font-bold text-white shadow-md active:scale-98 transition-transform text-sm"
                  >
                    Trigger Fall Alert
                  </button>
                  <button
                    onClick={() => void logSimulatedEvent('inactivity')}
                    className="w-full rounded-2xl bg-orange-500 hover:bg-orange-600 px-4 py-3 font-bold text-white shadow-md active:scale-98 transition-transform text-sm"
                  >
                    Trigger Inactivity Alert
                  </button>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 text-xs text-slate-600 leading-relaxed">
                  The local YOLO pose agent streams detection updates to this dashboard. Red fall alerts are sent immediately and should be verified by a caregiver; model scores are not a substitute for clinical judgment.
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
