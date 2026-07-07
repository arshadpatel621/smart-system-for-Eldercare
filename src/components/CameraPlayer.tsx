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
    start,
    stop,
    triggerPTZ,
    streamUrl,
    actionSuccess,
    capabilities,
    gotoPreset,
    setMotionTracking,
    setNightVision,
    talk,
    snapshot,
    record,
  } = useCamera(cameraId);

  const [imgError, setImgError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeTab, setActiveTab] = useState<'live' | 'playback' | 'ptz'>('live');

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
            <span className={`h-2 w-2 rounded-full ${activeTab === 'playback' ? 'bg-purple-500' : 'bg-emerald-500 animate-pulse'}`} />
            <span className="font-medium tracking-wide">{activeTab === 'playback' ? 'PLAYBACK' : 'LIVE'}</span>
          </div>
        )}
      </div>

      {/* Primary Controls (Always Visible) */}
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
              disabled={loading}
              className="flex items-center gap-1.5 rounded-full bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">play_arrow</span>
              Start Camera
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-px">
        {[
          { id: 'live', label: 'Live View', icon: 'videocam' },
          { id: 'playback', label: 'Camera Playback', icon: 'history' },
          { id: 'ptz', label: 'PTZ Control', icon: 'gamepad' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
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

      {/* PTZ Control Tab */}
      {activeTab === 'ptz' && isOnline && capabilities && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col gap-6">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-500">settings_remote</span>
            PTZ & Advanced Controls
          </h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* PTZ Joystick */}
            <div className="flex flex-col items-center bg-slate-50 p-6 rounded-3xl border border-slate-200 gap-6">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider w-full text-center">Directional Control</h4>
              <div className="grid grid-cols-3 grid-rows-3 gap-3">
                <div />
                <button
                  disabled={!capabilities.supportsPTZ}
                  onPointerDown={() => void triggerPTZ('up')}
                  onPointerUp={() => void triggerPTZ('stop')}
                  onPointerLeave={() => void triggerPTZ('stop')}
                  className="flex items-center justify-center bg-white shadow-sm border border-slate-200 text-slate-600 hover:text-blue-600 active:scale-95 transition-all rounded-xl h-14 w-14 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined font-bold text-2xl">keyboard_arrow_up</span>
                </button>
                <div />

                <button
                  disabled={!capabilities.supportsPTZ}
                  onPointerDown={() => void triggerPTZ('left')}
                  onPointerUp={() => void triggerPTZ('stop')}
                  onPointerLeave={() => void triggerPTZ('stop')}
                  className="flex items-center justify-center bg-white shadow-sm border border-slate-200 text-slate-600 hover:text-blue-600 active:scale-95 transition-all rounded-xl h-14 w-14 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined font-bold text-2xl">keyboard_arrow_left</span>
                </button>
                <div className="flex items-center justify-center text-slate-300">
                  <span className="material-symbols-outlined text-sm">circle</span>
                </div>
                <button
                  disabled={!capabilities.supportsPTZ}
                  onPointerDown={() => void triggerPTZ('right')}
                  onPointerUp={() => void triggerPTZ('stop')}
                  onPointerLeave={() => void triggerPTZ('stop')}
                  className="flex items-center justify-center bg-white shadow-sm border border-slate-200 text-slate-600 hover:text-blue-600 active:scale-95 transition-all rounded-xl h-14 w-14 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined font-bold text-2xl">keyboard_arrow_right</span>
                </button>

                <div />
                <button
                  disabled={!capabilities.supportsPTZ}
                  onPointerDown={() => void triggerPTZ('down')}
                  onPointerUp={() => void triggerPTZ('stop')}
                  onPointerLeave={() => void triggerPTZ('stop')}
                  className="flex items-center justify-center bg-white shadow-sm border border-slate-200 text-slate-600 hover:text-blue-600 active:scale-95 transition-all rounded-xl h-14 w-14 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined font-bold text-2xl">keyboard_arrow_down</span>
                </button>
                <div />
              </div>

              <div className="flex gap-4 w-full px-4">
                <button
                  disabled={!capabilities.supportsPTZ}
                  onClick={() => void triggerPTZ('home')}
                  className="flex-1 py-2.5 bg-white shadow-sm hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl border border-slate-200 disabled:opacity-50 transition-colors"
                >
                  Home
                </button>
                <button
                  disabled={!capabilities.supportsPTZ}
                  onClick={() => void triggerPTZ('stop')}
                  className="flex-1 py-2.5 bg-white shadow-sm hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl border border-slate-200 disabled:opacity-50 transition-colors"
                >
                  Stop
                </button>
              </div>

              <div className="flex gap-4 w-full px-4">
                <button
                  disabled={!capabilities.supportsPTZ}
                  onPointerDown={() => void triggerPTZ('zoom_in')}
                  onPointerUp={() => void triggerPTZ('stop')}
                  onPointerLeave={() => void triggerPTZ('stop')}
                  className="flex flex-1 items-center justify-center py-2.5 bg-white shadow-sm hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl border border-slate-200 disabled:opacity-50 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px] mr-1">zoom_in</span> Zoom In
                </button>
                <button
                  disabled={!capabilities.supportsPTZ}
                  onPointerDown={() => void triggerPTZ('zoom_out')}
                  onPointerUp={() => void triggerPTZ('stop')}
                  onPointerLeave={() => void triggerPTZ('stop')}
                  className="flex flex-1 items-center justify-center py-2.5 bg-white shadow-sm hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl border border-slate-200 disabled:opacity-50 transition-colors"
                >
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
                    <button
                      disabled={!capabilities.supportsTracking}
                      onClick={() => void setMotionTracking(true)}
                      className="py-2 bg-slate-50 hover:bg-blue-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[16px]">radar</span> Track ON
                    </button>
                    <button
                      disabled={!capabilities.supportsTracking}
                      onClick={() => void setMotionTracking(false)}
                      className="py-2 bg-slate-50 hover:bg-rose-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 disabled:opacity-50 transition-colors flex items-center justify-center"
                    >
                      Track OFF
                    </button>
                    <button
                      disabled={!capabilities.supportsNightVision}
                      onClick={() => void setNightVision(true)}
                      className="py-2 bg-slate-50 hover:bg-blue-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[16px]">dark_mode</span> NV ON
                    </button>
                    <button
                      disabled={!capabilities.supportsNightVision}
                      onClick={() => void setNightVision(false)}
                      className="py-2 bg-slate-50 hover:bg-rose-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 disabled:opacity-50 transition-colors flex items-center justify-center"
                    >
                      NV OFF
                    </button>
                </div>
              </div>

              {/* Media Actions */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</h4>
                <div className="flex flex-col gap-2">
                  <button
                    disabled={!capabilities.supportsTalk}
                    onClick={() => void talk()}
                    className="w-full py-2 bg-slate-50 hover:bg-blue-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[16px]">record_voice_over</span> Talk / Alarm
                  </button>
                  <div className="flex gap-2">
                    <button
                      disabled={!capabilities.supportsSnapshot}
                      onClick={() => void snapshot()}
                      className="flex-1 py-2 bg-slate-50 hover:bg-blue-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[16px]">photo_camera</span> Snap
                    </button>
                    <button
                      disabled={!capabilities.supportsRecording}
                      onClick={() => void record(30)}
                      className="flex-1 py-2 bg-slate-50 hover:bg-rose-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[16px]">videocam</span> Rec
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
