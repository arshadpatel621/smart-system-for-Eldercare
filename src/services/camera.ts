/**
 * src/services/camera.ts
 * Frontend API client for the Camera Module.
 * Communicates with the Express backend REST endpoints.
 * Credentials are NEVER stored or handled on the frontend.
 */

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5000';

// ─── Shared Types (mirroring server — no credentials) ─────────────────────────

export type CameraBrand = 'cpplus' | 'dahua' | 'hikvision' | 'tplink_tapo' | 'ezviz' | 'onvif' | 'rtsp';
export type CameraLocation = 'living_room' | 'bedroom' | 'kitchen' | 'bathroom' | 'entrance' | 'garden' | 'hallway' | 'dining_room' | 'other';
export type StreamStatus = 'ONLINE' | 'OFFLINE' | 'CONNECTING' | 'ERROR';
export type PTZDirection = 'left' | 'right' | 'up' | 'down' | 'home' | 'stop' | 'zoom_in' | 'zoom_out';

export const BRAND_LABELS: Record<CameraBrand, string> = {
  cpplus: 'CP Plus', dahua: 'Dahua', hikvision: 'Hikvision',
  tplink_tapo: 'TP-Link Tapo', ezviz: 'EZVIZ',
  onvif: 'Generic ONVIF', rtsp: 'Generic RTSP',
};

export const LOCATION_LABELS: Record<CameraLocation, string> = {
  living_room: 'Living Room', bedroom: 'Bedroom', kitchen: 'Kitchen',
  bathroom: 'Bathroom', entrance: 'Entrance / Door', garden: 'Garden / Outdoor',
  hallway: 'Hallway', dining_room: 'Dining Room', other: 'Other',
};

export interface CameraPublicRecord {
  id: string;
  name: string;
  brand: CameraBrand;
  location: CameraLocation;
  ipAddress: string;
  port: number;
  onvifPort: number;
  username: string;
  hasCustomRtspPath: boolean;
  enabled: boolean;
  model?: string;
  firmware?: string;
  serialNumber?: string;
  onvifVersion?: string;
  resolution?: string;
  fps?: number;
  lastConnected?: string;
  healthStatus: 'healthy' | 'degraded' | 'offline' | 'unknown';
  createdAt: string;
  updatedAt: string;
}

export interface CameraStatus {
  id: string;
  name: string;
  location: CameraLocation;
  brand: CameraBrand;
  status: StreamStatus;
  ipAddress: string;
  resolution: string;
  fps: number;
  connectionTime: string | null;
  reconnectAttempts: number;
  error?: string;
}

export interface CameraCapabilities {
  supportsPTZ: boolean;
  supportsTracking: boolean;
  supportsNightVision: boolean;
  supportsTalk: boolean;
  supportsRecording: boolean;
  supportsSnapshot: boolean;
  supportsPresets: boolean;
}

export interface CreateCameraInput {
  name: string;
  brand: CameraBrand;
  location: CameraLocation;
  ipAddress: string;
  port?: number;
  onvifPort?: number;
  username: string;
  password: string;
  customRtspPath?: string;
}

export interface UpdateCameraInput extends Partial<CreateCameraInput> {
  enabled?: boolean;
}

export interface PortScanResult { port: number; open: boolean; label: string; }
export interface ProbeResult {
  success: boolean; ipAddress: string; brand: CameraBrand;
  portsScanned: PortScanResult[];
  rtspAvailable: boolean; onvifAvailable: boolean;
  discoveredRtspPath?: string;  // path only, stored for future streaming
  onvifStreamUri?: string;      // masked full RTSP URI from ONVIF GetStreamUri (display only)
  onvifVersion?: string;
  manufacturer?: string; model?: string; firmware?: string; serialNumber?: string;
  resolution?: string; fps?: number;
  authError: boolean; timeout: boolean; networkUnreachable: boolean;
  errorMessage?: string; testedAt: string;
}

export interface DiscoveredCamera {
  ipAddress: string; manufacturer?: string; model?: string;
  onvifVersion?: string; rtspAvailable: boolean;
  discoveredRtspPath?: string; onvifPort: number; discoveredAt: string;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `API error ${res.status}`);
  return json as T;
}

// ─── Camera CRUD ──────────────────────────────────────────────────────────────

export const fetchCameras = () =>
  apiFetch<CameraPublicRecord[]>('/api/cameras');

export const fetchCamera = (id: string) =>
  apiFetch<CameraPublicRecord>(`/api/cameras/${id}`);

export const createCamera = (input: CreateCameraInput) =>
  apiFetch<CameraPublicRecord>('/api/cameras', { method: 'POST', body: JSON.stringify(input) });

export const updateCamera = (id: string, input: UpdateCameraInput) =>
  apiFetch<CameraPublicRecord>(`/api/cameras/${id}`, { method: 'PUT', body: JSON.stringify(input) });

export const deleteCamera = (id: string) =>
  apiFetch<{ success: boolean }>(`/api/cameras/${id}`, { method: 'DELETE' });

export const toggleCamera = (id: string, enabled: boolean) =>
  apiFetch<CameraPublicRecord>(`/api/cameras/${id}/toggle`, { method: 'POST', body: JSON.stringify({ enabled }) });

// ─── Probe & Discovery ────────────────────────────────────────────────────────

export const AGENT_BASE = 'http://127.0.0.1:8000';

export type DiagnosticStage =
  | 'ip_reachability'
  | 'onvif_detection'
  | 'onvif_authentication'
  | 'media_profile'
  | 'rtsp_detection'
  | 'rtsp_test';

export type StageStatus = 'success' | 'failed' | 'skipped' | 'not_run';

export interface StageDetail {
  status: StageStatus;
  message: string;
}

export interface AgentDetectResult {
  success: boolean;
  ip: string;
  host_reachable?: boolean;
  open_ports?: number[];
  onvif: boolean;
  rtsp: boolean;
  stage: DiagnosticStage;
  streamUri?: string;
  manufacturer?: string;
  model?: string;
  firmware?: string;
  message: string;
  stages: Record<DiagnosticStage, StageDetail>;
}

export interface AgentHealthStatus {
  status: 'online' | 'offline';
  agent: string;
  version: string;
  bound: string;
}

export const checkAgentStatus = async (): Promise<AgentHealthStatus | null> => {
  try {
    const res = await fetch(`${AGENT_BASE}/health`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};

export const discoverViaAgent = async (): Promise<DiscoveredCamera[]> => {
  const res = await fetch(`${AGENT_BASE}/discover`, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error('VitalCare Local Camera Agent is not running');
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? 'Agent discovery failed');
  return (json.devices ?? []).map((d: any) => ({
    ipAddress: d.ip,
    onvifPort: d.onvifPort ?? 80,
    discoveredAt: d.discoveredAt ?? new Date().toISOString(),
    rtspAvailable: true,
  }));
};

export const detectCameraViaAgent = async (input: {
  ipAddress: string;
  username: string;
  password?: string;
  port?: number;
  onvifPort?: number;
  customRtspPath?: string;
}): Promise<AgentDetectResult> => {
  const res = await fetch(`${AGENT_BASE}/detect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ip: input.ipAddress,
      username: input.username,
      password: input.password ?? '',
      port: input.port ?? 554,
      onvifPort: input.onvifPort ?? 80,
      customRtspPath: input.customRtspPath ?? '',
    }),
  });
  if (!res.ok) throw new Error(`Agent detection request failed (${res.status})`);
  return await res.json();
};

export const testCameraConnection = (id: string) =>
  apiFetch<ProbeResult>(`/api/cameras/${id}/test`, { method: 'POST' });

export const discoverCamerasOnLAN = async (): Promise<DiscoveredCamera[]> => {
  const agent = await checkAgentStatus();
  if (agent) {
    return discoverViaAgent();
  }
  return apiFetch<DiscoveredCamera[]>('/api/cameras/discover');
};

// ─── Status & Streaming ───────────────────────────────────────────────────────

export const fetchAllStatuses = () =>
  apiFetch<CameraStatus[]>('/api/cameras/statuses');

export const fetchCameraStatus = (id: string) =>
  apiFetch<CameraStatus>(`/api/cameras/${id}/status`);

export const moveCamera = (id: string, action: PTZDirection, speed = 5) =>
  apiFetch<{ message: string }>(`/api/cameras/${id}/ptz`, { method: 'POST', body: JSON.stringify({ action, speed }) });

export const fetchCameraCapabilities = (id: string) =>
  apiFetch<CameraCapabilities>(`/api/cameras/${id}/capabilities`);

export const moveCameraPreset = (id: string, preset: string) =>
  apiFetch<{ message: string }>(`/api/cameras/${id}/preset`, { method: 'POST', body: JSON.stringify({ preset }) });

export const toggleMotionTracking = (id: string, enabled: boolean) =>
  apiFetch<{ message: string }>(`/api/cameras/${id}/tracking`, { method: 'POST', body: JSON.stringify({ enabled }) });

export const toggleNightVision = (id: string, enabled: boolean) =>
  apiFetch<{ message: string }>(`/api/cameras/${id}/nightvision`, { method: 'POST', body: JSON.stringify({ enabled }) });

export const triggerTalk = (id: string) =>
  apiFetch<{ message: string }>(`/api/cameras/${id}/talk`, { method: 'POST' });

export const captureSnapshot = (id: string) =>
  apiFetch<{ message: string }>(`/api/cameras/${id}/snapshot`, { method: 'POST' });

export const recordVideo = (id: string, duration?: number) =>
  apiFetch<{ message: string }>(`/api/cameras/${id}/record`, { method: 'POST', body: JSON.stringify({ duration }) });

export const getStreamUrl = (id: string) => `${API_BASE}/api/cameras/${id}/stream`;
export const getWebSocketUrl = () => API_BASE.replace(/^http/, 'ws');
