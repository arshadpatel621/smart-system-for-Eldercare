import { useState } from 'react';
import { discoverCamerasOnLAN, type DiscoveredCamera } from '../services/camera';

export default function CameraDiscovery() {
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<DiscoveredCamera[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);

  const startScan = async () => {
    setScanning(true); setError(null); setResults([]); setScanned(false);
    try {
      const devices = await discoverCamerasOnLAN();
      setResults(devices);
    } catch (err: any) {
      setError(err.message ?? 'Discovery failed');
    } finally {
      setScanning(false); setScanned(true);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <header>
        <h1 className="text-4xl font-bold text-slate-800">Auto Discovery</h1>
        <p className="text-slate-500 mt-2 max-w-xl">
          Scans your local network using ONVIF WS-Discovery to find IP cameras automatically.
          No credentials required to discover — configure each camera after detection.
        </p>
      </header>

      {/* Scan Button */}
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50 p-8 text-center space-y-5">
        <div className="w-20 h-20 rounded-3xl bg-white shadow-md flex items-center justify-center mx-auto">
          <span className={`material-symbols-outlined text-4xl text-blue-600 ${scanning ? 'animate-pulse' : ''}`}>
            wifi_find
          </span>
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            {scanning ? 'Scanning your network...' : 'Scan LAN for ONVIF Cameras'}
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            {scanning
              ? 'Broadcasting WS-Discovery probe. This takes ~5 seconds.'
              : 'Sends a UDP multicast probe to 239.255.255.250:3702 (ONVIF standard)'}
          </p>
        </div>
        <button
          onClick={() => void startScan()}
          disabled={scanning}
          className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-8 py-3.5 text-base font-bold text-white shadow-lg hover:bg-blue-700 disabled:opacity-60 transition-all">
          {scanning
            ? <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
            : <span className="material-symbols-outlined text-xl">radar</span>}
          {scanning ? 'Scanning...' : 'Start Network Scan'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-rose-500">error</span>
          <p className="text-sm text-rose-700">{error}</p>
        </div>
      )}

      {/* Results */}
      {scanned && !scanning && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-800">
              {results.length > 0
                ? `Found ${results.length} device${results.length !== 1 ? 's' : ''}`
                : 'No devices found'}
            </h2>
            <span className="text-xs text-slate-400">
              Scanned at {new Date().toLocaleTimeString()}
            </span>
          </div>

          {results.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-slate-200 py-16 text-center">
              <span className="material-symbols-outlined text-4xl text-slate-300 block mb-3">signal_wifi_off</span>
              <p className="text-slate-500 font-semibold">No ONVIF cameras detected on this network</p>
              <p className="text-slate-400 text-sm mt-2 max-w-md mx-auto">
                Ensure cameras are powered on and connected to the same network as this server.
                Some cameras may require ONVIF to be enabled in their web settings.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {results.map((device) => (
                <div key={device.ipAddress}
                  className="rounded-3xl border border-slate-200 bg-white shadow-sm p-5 space-y-4 hover:shadow-md transition-shadow">
                  {/* Device Header */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                      <span className="material-symbols-outlined text-emerald-600">videocam</span>
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{device.model ?? 'Unknown Camera'}</p>
                      <p className="text-xs text-slate-500">{device.manufacturer ?? 'Unknown Brand'}</p>
                    </div>
                    {device.rtspAvailable && (
                      <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        RTSP
                      </span>
                    )}
                  </div>

                  {/* Details */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 block">IP Address</span>
                      <span className="font-mono font-semibold text-slate-700">{device.ipAddress}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">ONVIF Port</span>
                      <span className="font-semibold text-slate-700">{device.onvifPort}</span>
                    </div>
                    {device.onvifVersion && (
                      <div>
                        <span className="text-slate-400 block">ONVIF</span>
                        <span className="font-semibold text-slate-700">v{device.onvifVersion}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-slate-400 block">Discovered</span>
                      <span className="font-semibold text-slate-700">
                        {new Date(device.discoveredAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>

                  {/* Add to Management Link */}
                  <a href="/cameras"
                    className="flex items-center justify-center gap-2 w-full rounded-xl border border-blue-200 bg-blue-50 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100 transition-colors">
                    <span className="material-symbols-outlined text-sm">add_circle</span>
                    Add this camera
                  </a>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Tips */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 space-y-2">
        <h3 className="font-bold text-amber-800 flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">tips_and_updates</span>
          Troubleshooting Tips
        </h3>
        <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
          <li>Ensure cameras and this server are on the same network subnet</li>
          <li>Enable ONVIF in your camera's web interface under Network → ONVIF settings</li>
          <li>Some routers block UDP multicast — check firewall rules for port 3702</li>
          <li>If a camera is not detected, you can still add it manually using its IP address</li>
        </ul>
      </div>
    </div>
  );
}
