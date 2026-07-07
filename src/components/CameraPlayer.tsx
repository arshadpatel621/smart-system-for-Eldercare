import { useState, useEffect } from 'react';
import { useCamera } from '../hooks/useCamera';

interface CameraPlayerProps {
  cameraId: string;
}

/**
 * CameraPlayer component handles the streaming video display and PTZ navigation controls.
 * Uses HTTP MJPEG multipart streaming and custom WebSocket status synchronization.
 */
export function CameraPlayer({ cameraId }: CameraPlayerProps) {
  const {
    status,
    loading,
    error,
    ptzLoading,
    start,
    stop,
    triggerPTZ,
    streamUrl,
  } = useCamera(cameraId);

  const [imgError, setImgError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

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

  return (
    <div className="flex flex-col space-y-4">
      {/* Aspect Video Stream Canvas */}
      <div className="relative aspect-video w-full overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 shadow-xl group">
        {/* ONLINE Video Stream */}
        {isOnline && !imgError && (
          <img
            key={`${streamUrl}-${reloadKey}`}
            src={streamUrl}
            alt={`${status?.name || 'Camera'} feed`}
            className="h-full w-full object-cover"
            onError={handleImageError}
          />
        )}

        {/* CONNECTING State Overlay */}
        {(isConnecting || (isOnline && loading)) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 text-white z-10 space-y-4">
            <span className="material-symbols-outlined text-4xl animate-spin text-blue-400">
              progress_activity
            </span>
            <div className="text-center">
              <p className="font-bold">Establishing RTSP Connection...</p>
              <p className="text-xs text-slate-400 mt-1">Transcoding H.264 video streams on-the-fly</p>
            </div>
            <button
              onClick={() => void stop()}
              className="mt-2 rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-xs font-semibold hover:bg-white/10 transition-colors"
            >
              Cancel Connection
            </button>
          </div>
        )}

        {/* OFFLINE State Overlay */}
        {isOffline && !isConnecting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-white z-10 space-y-4">
            <div className="rounded-full bg-slate-900 border border-slate-800 p-4 text-slate-400">
              <span className="material-symbols-outlined text-5xl">
                videocam_off
              </span>
            </div>
            <div className="text-center px-4">
              <p className="font-bold text-lg text-slate-300">Camera Stream is Offline</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Press Connect to start reading the camera's RTSP feed and broadcast live
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

        {/* IMAGE LOADING / TRANCODING DELAY State Overlay */}
        {isOnline && imgError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 text-white z-10 space-y-4">
            <span className="material-symbols-outlined text-4xl text-amber-400 animate-pulse">
              sensors
            </span>
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

        {/* Floating Quick Status Indicator Tag */}
        {isOnline && !imgError && (
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2 rounded-full bg-slate-900/60 backdrop-blur-md border border-white/10 px-3 py-1.5 text-xs text-white">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-medium tracking-wide">LIVE</span>
          </div>
        )}

        {/* Glassmorphism PTZ Joystick Pad Overlay */}
        {isOnline && !imgError && (
          <div className="absolute bottom-4 right-4 z-10 opacity-60 hover:opacity-100 transition-opacity duration-300">
            <div className="grid grid-cols-3 grid-rows-3 gap-1 bg-slate-950/60 backdrop-blur-md p-2 rounded-full border border-white/10 w-28 h-28">
              <div />
              <button
                disabled={ptzLoading}
                onClick={() => void triggerPTZ('up')}
                className="flex items-center justify-center text-white/80 hover:text-blue-400 disabled:opacity-30 active:scale-75 transition-all rounded-full hover:bg-white/15"
                title="Pan Up"
              >
                <span className="material-symbols-outlined font-bold text-xl">keyboard_arrow_up</span>
              </button>
              <div />

              <button
                disabled={ptzLoading}
                onClick={() => void triggerPTZ('left')}
                className="flex items-center justify-center text-white/80 hover:text-blue-400 disabled:opacity-30 active:scale-75 transition-all rounded-full hover:bg-white/15"
                title="Tilt Left"
              >
                <span className="material-symbols-outlined font-bold text-xl">keyboard_arrow_left</span>
              </button>
              <button
                disabled={ptzLoading}
                onClick={() => void triggerPTZ('home')}
                className="flex items-center justify-center text-white bg-white/10 hover:bg-blue-600/30 hover:text-blue-400 disabled:opacity-30 active:scale-75 transition-all rounded-full"
                title="Return to Home"
              >
                <span className="material-symbols-outlined text-md">home</span>
              </button>
              <button
                disabled={ptzLoading}
                onClick={() => void triggerPTZ('right')}
                className="flex items-center justify-center text-white/80 hover:text-blue-400 disabled:opacity-30 active:scale-75 transition-all rounded-full hover:bg-white/15"
                title="Tilt Right"
              >
                <span className="material-symbols-outlined font-bold text-xl">keyboard_arrow_right</span>
              </button>

              <div />
              <button
                disabled={ptzLoading}
                onClick={() => void triggerPTZ('down')}
                className="flex items-center justify-center text-white/80 hover:text-blue-400 disabled:opacity-30 active:scale-75 transition-all rounded-full hover:bg-white/15"
                title="Pan Down"
              >
                <span className="material-symbols-outlined font-bold text-xl">keyboard_arrow_down</span>
              </button>
              <div />
            </div>
          </div>
        )}
      </div>

      {/* Controller Buttons Card */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-slate-50 px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-slate-700">Camera Feed Controls:</span>
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
              disabled={loading}
              className="flex items-center gap-1.5 rounded-full bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">play_arrow</span>
              Start Camera
            </button>
          )}
        </div>
      </div>

      {/* Local Error Warning */}
      {error && (
        <div className="rounded-2xl bg-rose-50 border border-rose-100 p-4 text-sm text-rose-700">
          <div className="flex items-center gap-2 font-bold">
            <span className="material-symbols-outlined text-lg">error</span>
            Action Failed
          </div>
          <p className="mt-1 text-xs">{error}</p>
        </div>
      )}
    </div>
  );
}
