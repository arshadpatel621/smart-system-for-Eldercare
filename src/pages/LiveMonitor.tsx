import { useEffect, useRef, useState } from 'react';
import { useEldercare } from '../context/EldercareContext';

export default function LiveMonitor() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { createSafetyEvent } = useEldercare();
  const [status, setStatus] = useState('Camera offline');
  const [error, setError] = useState('');

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setStatus('Camera live');
      setError('');
    } catch (cameraError) {
      setError(cameraError instanceof Error ? cameraError.message : 'Unable to access camera');
    }
  };

  const logEvent = async (type: 'fall' | 'inactivity') => {
    await createSafetyEvent({
      type,
      severity: type === 'fall' ? 'critical' : 'warning',
      occurredAt: new Date().toISOString(),
      location: 'Living room camera',
      note:
        type === 'fall'
          ? 'Manual fallback event logged from live camera page.'
          : 'Manual inactivity event logged while validating monitoring flow.',
      resolved: false,
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-4xl font-bold text-primary">Live Camera Monitor</h1>
        <p className="text-slate-500">
          This page validates the end-to-end camera workflow. Replace manual event buttons with MediaPipe or TensorFlow fall detection next.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 shadow-xl">
          <video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full object-cover" />
          <div className="flex items-center justify-between bg-slate-900 px-6 py-4 text-white">
            <span className="font-bold">{status}</span>
            <button
              onClick={() => void startCamera()}
              className="rounded-full bg-white px-5 py-2 text-sm font-bold text-slate-900"
            >
              Start camera
            </button>
          </div>
        </div>

        <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-primary">Incident testing</h2>
          <button
            onClick={() => void logEvent('fall')}
            className="w-full rounded-2xl bg-error px-4 py-3 font-bold text-white"
          >
            Trigger fall alert
          </button>
          <button
            onClick={() => void logEvent('inactivity')}
            className="w-full rounded-2xl bg-orange-500 px-4 py-3 font-bold text-white"
          >
            Trigger inactivity alert
          </button>
          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            Use Firebase alerts plus caretaker notifications as the backend path. Real AI detection should write these same event documents automatically.
          </div>
          {error ? <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
        </div>
      </section>
    </div>
  );
}
