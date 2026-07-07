/**
 * camera.types.ts
 * Central type definitions for the Camera Module.
 * All types are designed for multi-brand, multi-camera deployments.
 */

// ─── Brand & Location ────────────────────────────────────────────────────────

export type CameraBrand =
  | 'cpplus'
  | 'dahua'
  | 'hikvision'
  | 'tplink_tapo'
  | 'ezviz'
  | 'onvif'
  | 'rtsp';

export type CameraLocation =
  | 'living_room'
  | 'bedroom'
  | 'kitchen'
  | 'bathroom'
  | 'entrance'
  | 'garden'
  | 'hallway'
  | 'dining_room'
  | 'other';

// ─── Camera Configuration (persisted in DB) ──────────────────────────────────

/**
 * Full camera record as stored in the repository.
 * Password is always stored encrypted.
 * rtspUrl is stored encrypted if provided.
 */
export interface CameraRecord {
  id: string;
  name: string;
  brand: CameraBrand;
  location: CameraLocation;
  ipAddress: string;
  port: number;             // Primary RTSP port (default 554)
  onvifPort: number;        // ONVIF HTTP port (default 80)
  username: string;
  passwordEncrypted: string; // AES-256-CBC encrypted
  rtspUrlEncrypted?: string; // Custom RTSP path, encrypted if provided
  enabled: boolean;
  // Metadata discovered during connection test
  model?: string;
  firmware?: string;
  serialNumber?: string;
  onvifVersion?: string;
  discoveredRtspPath?: string;  // Resolved RTSP path (not full URL, just path)
  resolution?: string;
  fps?: number;
  lastConnected?: string;       // ISO timestamp
  healthStatus: 'healthy' | 'degraded' | 'offline' | 'unknown';
  createdAt: string;            // ISO timestamp
  updatedAt: string;            // ISO timestamp
}

/**
 * Data shape for creating a new camera (from frontend form).
 * Password arrives as plain text and is encrypted server-side.
 */
export interface CreateCameraDto {
  name: string;
  brand: CameraBrand;
  location: CameraLocation;
  ipAddress: string;
  port?: number;
  onvifPort?: number;
  username: string;
  password: string;           // Plain text — encrypted before storage
  customRtspPath?: string;    // e.g. /cam/realmonitor?channel=1&subtype=0
}

/**
 * Data shape for updating an existing camera.
 * All fields optional — only provided fields are updated.
 */
export interface UpdateCameraDto {
  name?: string;
  brand?: CameraBrand;
  location?: CameraLocation;
  ipAddress?: string;
  port?: number;
  onvifPort?: number;
  username?: string;
  password?: string;          // Plain text if provided — re-encrypted
  customRtspPath?: string;
  enabled?: boolean;
}

// ─── Camera Status (real-time, not persisted) ─────────────────────────────────

export type StreamStatus = 'ONLINE' | 'OFFLINE' | 'CONNECTING' | 'ERROR';

export interface CameraStatus {
  id: string;
  name: string;
  location: CameraLocation;
  brand: CameraBrand;
  status: StreamStatus;
  ipAddress: string;
  resolution: string;
  fps: number;
  connectionTime: string | null;  // ISO timestamp
  reconnectAttempts: number;
  error?: string;
}

// ─── Safe public view (credentials stripped) ──────────────────────────────────

/**
 * Safe camera data returned to frontend — passwords and RTSP URLs are NEVER exposed.
 */
export interface CameraPublicRecord {
  id: string;
  name: string;
  brand: CameraBrand;
  location: CameraLocation;
  ipAddress: string;
  port: number;
  onvifPort: number;
  username: string;
  hasCustomRtspPath: boolean;   // true/false only — never the actual path
  enabled: boolean;
  model?: string;
  firmware?: string;
  serialNumber?: string;
  onvifVersion?: string;
  resolution?: string;
  fps?: number;
  lastConnected?: string;
  healthStatus: CameraRecord['healthStatus'];
  createdAt: string;
  updatedAt: string;
}

// ─── Connection Probe Results ─────────────────────────────────────────────────

export interface PortScanResult {
  port: number;
  open: boolean;
  label: string;  // e.g. 'RTSP', 'ONVIF HTTP', 'HTTPS'
}

export interface ProbeResult {
  success: boolean;
  ipAddress: string;
  brand: CameraBrand;
  // Port availability
  portsScanned: PortScanResult[];
  rtspAvailable: boolean;
  onvifAvailable: boolean;
  // Discovered details
  discoveredRtspPath?: string;    // e.g. /Streaming/Channels/101
  onvifVersion?: string;
  manufacturer?: string;
  model?: string;
  firmware?: string;
  serialNumber?: string;
  resolution?: string;
  fps?: number;
  // Connection outcome
  authError: boolean;
  timeout: boolean;
  networkUnreachable: boolean;
  errorMessage?: string;
  testedAt: string;               // ISO timestamp
}

// ─── ONVIF Auto-Discovery ─────────────────────────────────────────────────────

export interface DiscoveredCamera {
  ipAddress: string;
  manufacturer?: string;
  model?: string;
  onvifVersion?: string;
  rtspAvailable: boolean;
  discoveredRtspPath?: string;
  onvifPort: number;
  discoveredAt: string;
}

// ─── PTZ ─────────────────────────────────────────────────────────────────────

export type PTZDirection = 'left' | 'right' | 'up' | 'down' | 'home';

export interface PTZCommand {
  action: PTZDirection;
  speed?: number;  // 1–10, default 5
}

// ─── AI Hook (Future Modules) ─────────────────────────────────────────────────

/**
 * Defines what an external AI service consumer can access.
 * The AI service reads the stream URL but NEVER controls the camera.
 */
export interface AIStreamConsumer {
  cameraId: string;
  streamEndpoint: string;    // e.g. http://localhost:5000/api/cameras/:id/stream
  websocketEndpoint: string; // e.g. ws://localhost:5000
  frameRate: number;
  resolution: string;
}

export type AIEventType =
  | 'fall_detected'
  | 'inactivity_detected'
  | 'person_detected'
  | 'face_recognized'
  | 'smoke_detected'
  | 'intrusion_detected';

export interface AIEvent {
  type: AIEventType;
  cameraId: string;
  timestamp: string;
  confidence: number;        // 0.0 – 1.0
  details?: Record<string, unknown>;
}

// ─── Repository Interface (Database-agnostic contract) ────────────────────────

/**
 * CameraRepository defines the contract for data persistence.
 * Swap implementations to change storage backends (JSON → Postgres → Firebase).
 */
export interface CameraRepository {
  findAll(): Promise<CameraRecord[]>;
  findById(id: string): Promise<CameraRecord | null>;
  create(dto: CreateCameraDto): Promise<CameraRecord>;
  update(id: string, dto: UpdateCameraDto): Promise<CameraRecord>;
  delete(id: string): Promise<void>;
  setEnabled(id: string, enabled: boolean): Promise<CameraRecord>;
  updateMetadata(id: string, metadata: Partial<Pick<CameraRecord,
    'model' | 'firmware' | 'serialNumber' | 'onvifVersion' |
    'discoveredRtspPath' | 'resolution' | 'fps' | 'lastConnected' | 'healthStatus'
  >>): Promise<CameraRecord>;
}
