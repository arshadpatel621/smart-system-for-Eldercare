/**
 * camera.service.ts
 * Core business logic for the Camera Module.
 *
 * Responsibilities:
 *  - CRUD operations (delegated to CameraRepository)
 *  - FFmpeg stream lifecycle (start, stop, reconnect, multiplex)
 *  - Connection probing and metadata updates
 *  - PTZ CGI command dispatch
 *  - Real-time status broadcasting hook (WebSocket)
 *  - AI stream consumer info generation
 *
 * The service is INDEPENDENT of the AI service — AI reads stream URLs
 * but never interacts with this service directly.
 */

import { spawn, ChildProcess } from 'child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { Response } from 'express';
import type {
  CameraRecord,
  CameraStatus,
  CameraPublicRecord,
  CreateCameraDto,
  UpdateCameraDto,
  ProbeResult,
  PTZDirection,
  AIStreamConsumer,
  DiscoveredCamera,
} from './camera.types';
import type { CameraRepository } from './camera.types';
import { getDecryptedPassword, getDecryptedRtspPath } from './camera.repository';
import { probeCamera } from './camera.probe';
import { discoverCamerasOnLAN } from './camera.discovery';
import {
  getBrandProfile,
  resolveRtspPath,
  buildRtspUrl,
  buildRedactedRtspUrl,
} from './brand.profiles';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(level: 'info' | 'warn' | 'error', camId: string, msg: string, detail?: unknown) {
  const ts = new Date().toISOString();
  const prefix = `[${ts}] [${level.toUpperCase()}] [Cam:${camId}]`;
  if (level === 'error') console.error(prefix, msg, detail ?? '');
  else if (level === 'warn') console.warn(prefix, msg, detail ?? '');
  else console.log(prefix, msg, detail ?? '');
}

/**
 * Strips sensitive fields and returns a safe public record for the frontend.
 * Passwords, RTSP URLs, and encrypted values are NEVER exposed.
 */
function toPublic(record: CameraRecord): CameraPublicRecord {
  const {
    passwordEncrypted: _pw,
    rtspUrlEncrypted: _rtsp,
    discoveredRtspPath: _path,
    ...rest
  } = record;
  return {
    ...rest,
    hasCustomRtspPath: !!record.rtspUrlEncrypted,
  };
}

// ─── CameraService ────────────────────────────────────────────────────────────

export class CameraService {
  /** FFmpeg child processes keyed by camera ID */
  private processes = new Map<string, ChildProcess>();
  /** MJPEG stream listeners keyed by camera ID */
  private listeners = new Map<string, Set<Response>>();
  /** Runtime statuses keyed by camera ID */
  private statuses = new Map<string, CameraStatus>();
  /** Reconnect attempt counters */
  private reconnectAttempts = new Map<string, number>();
  /** Active timers (reconnect + idle) */
  private timers = new Map<string, NodeJS.Timeout>();
  /** WebSocket status broadcast callback */
  private onStatusChangeCb: ((status: CameraStatus) => void) | null = null;

  constructor(private readonly repo: CameraRepository) {}

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Called on server startup. Auto-starts streams for enabled cameras.
   */
  async initialize(): Promise<void> {
    const cameras = await this.repo.findAll();
    const enabled = cameras.filter((c) => c.enabled);
    log('info', 'system', `Initializing: ${enabled.length} enabled camera(s) of ${cameras.length} total`);

    // Initialize status maps
    for (const cam of cameras) {
      this.listeners.set(cam.id, new Set());
      this.reconnectAttempts.set(cam.id, 0);
      this.statuses.set(cam.id, this.buildStatus(cam, 'OFFLINE'));
    }

    // Start enabled camera streams
    for (const cam of enabled) {
      this.startStream(cam);
    }
  }

  /** Registers WebSocket status change callback */
  onStatusChange(cb: (status: CameraStatus) => void) {
    this.onStatusChangeCb = cb;
  }

  // ─── CRUD Operations ───────────────────────────────────────────────────────

  async getCameras(): Promise<CameraPublicRecord[]> {
    const records = await this.repo.findAll();
    return records.map(toPublic);
  }

  async getCameraById(id: string): Promise<CameraPublicRecord> {
    const record = await this.repo.findById(id);
    if (!record) throw new Error(`Camera not found: ${id}`);
    return toPublic(record);
  }

  async createCamera(dto: CreateCameraDto): Promise<CameraPublicRecord> {
    const record = await this.repo.create(dto);
    // Initialize runtime state for new camera
    this.listeners.set(record.id, new Set());
    this.reconnectAttempts.set(record.id, 0);
    this.statuses.set(record.id, this.buildStatus(record, 'OFFLINE'));
    log('info', record.id, `Camera created: ${record.name}`);
    return toPublic(record);
  }

  async updateCamera(id: string, dto: UpdateCameraDto): Promise<CameraPublicRecord> {
    const record = await this.repo.update(id, dto);
    log('info', id, `Camera updated: ${record.name}`);
    return toPublic(record);
  }

  async deleteCamera(id: string): Promise<void> {
    // Stop stream first if running
    this.stopStream(id);
    await this.repo.delete(id);
    this.listeners.delete(id);
    this.statuses.delete(id);
    this.reconnectAttempts.delete(id);
    log('info', id, `Camera deleted`);
  }

  async toggleCamera(id: string, enabled: boolean): Promise<CameraPublicRecord> {
    const record = await this.repo.setEnabled(id, enabled);

    if (enabled) {
      log('info', id, 'Camera enabled — starting stream');
      this.startStream(record);
    } else {
      log('info', id, 'Camera disabled — stopping stream');
      this.stopStream(id);
      this.updateStatus(id, 'OFFLINE', undefined);
    }

    return toPublic(record);
  }

  // ─── Status ────────────────────────────────────────────────────────────────

  async getAllStatuses(): Promise<CameraStatus[]> {
    return Array.from(this.statuses.values());
  }

  async getCameraStatus(id: string): Promise<CameraStatus> {
    const status = this.statuses.get(id);
    if (!status) throw new Error(`No status found for camera: ${id}`);
    return status;
  }

  // ─── Connection Probe ──────────────────────────────────────────────────────

  async testConnection(id: string): Promise<ProbeResult> {
    const record = await this.repo.findById(id);
    if (!record) throw new Error(`Camera not found: ${id}`);

    const password = getDecryptedPassword(record);
    const customRtspPath = getDecryptedRtspPath(record);

    log('info', id, `Running connection probe for ${record.ipAddress}`);

    const result = await probeCamera(
      record.ipAddress,
      record.brand,
      record.port,
      record.onvifPort,
      record.username,
      password,    // Decrypted in memory, never logged or returned
      customRtspPath
    );

    // Persist discovered metadata back into the database
    if (result.success || result.onvifAvailable) {
      await this.repo.updateMetadata(id, {
        model: result.model,
        firmware: result.firmware,
        serialNumber: result.serialNumber,
        onvifVersion: result.onvifVersion,
        discoveredRtspPath: result.discoveredRtspPath,
        resolution: result.resolution,
        fps: result.fps,
        lastConnected: result.success ? result.testedAt : undefined,
        healthStatus: result.success ? 'healthy' : 'offline',
      });
    }

    log('info', id, `Probe complete. RTSP: ${result.rtspAvailable}, ONVIF: ${result.onvifAvailable}`);
    return result;
  }

  // ─── LAN Discovery ─────────────────────────────────────────────────────────

  async discoverCameras(): Promise<DiscoveredCamera[]> {
    log('info', 'system', 'Starting LAN camera discovery...');
    return discoverCamerasOnLAN();
  }

  // ─── Stream Management ─────────────────────────────────────────────────────

  /**
   * Adds an HTTP Response as a streaming client.
   * Auto-starts the FFmpeg process if not running.
   */
  async addStreamListener(id: string, res: Response): Promise<void> {
    const record = await this.repo.findById(id);
    if (!record) throw new Error(`Camera not found: ${id}`);
    if (!record.enabled) throw new Error(`Camera ${record.name} is disabled`);

    if (!this.listeners.has(id)) this.listeners.set(id, new Set());
    const listeners = this.listeners.get(id)!;

    // Write MJPEG multipart headers
    res.writeHead(200, {
      'Content-Type': 'multipart/x-mixed-replace; boundary=--ffmpegboundary',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'Pragma': 'no-cache',
    });

    listeners.add(res);
    log('info', id, `Stream client connected. Total: ${listeners.size}`);

    // Start stream if not already running
    if (!this.processes.has(id)) {
      this.startStream(record);
    }

    res.on('close', () => {
      listeners.delete(res);
      log('info', id, `Stream client disconnected. Remaining: ${listeners.size}`);

      // Stop after 8s idle delay (allows for quick page refresh)
      if (listeners.size === 0) {
        const t = setTimeout(() => {
          if ((this.listeners.get(id)?.size ?? 0) === 0) {
            log('info', id, 'No clients remain — stopping idle stream');
            this.stopStream(id);
            this.updateStatus(id, 'OFFLINE', undefined);
          }
        }, 8000);
        this.timers.set(`${id}_idle`, t);
      }
    });
  }

  // ─── FFmpeg Process Management ─────────────────────────────────────────────

  private async startStream(record: CameraRecord): Promise<void> {
    this.clearTimer(record.id, 'idle');
    this.clearTimer(record.id, 'reconnect');

    const password = getDecryptedPassword(record);
    const customRtspPath = getDecryptedRtspPath(record);
    const profile = getBrandProfile(record.brand);

    let ffmpegArgs: string[];

    // Mock mode for development (no real camera required)
    if (record.ipAddress === 'mock' || record.ipAddress === '0.0.0.0') {
      ffmpegArgs = [
        '-f', 'lavfi',
        '-i', `testsrc=size=1280x720:rate=15,drawtext=text='${record.name} | MOCK':x=20:y=20:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.5,drawtext=text='%{localtime}':x=20:y=60:fontsize=18:fontcolor=white`,
        '-f', 'mpjpeg', '-q:v', '5', '-boundary_tag', 'ffmpegboundary', '-',
      ];
    } else {
      // Resolve RTSP path: custom > discovered > brand default
      const rtspPath = customRtspPath
        ?? record.discoveredRtspPath
        ?? resolveRtspPath(profile.rtspPathTemplates[0], 1);

      const rtspUrl = buildRtspUrl(record.ipAddress, record.port, record.username, password, rtspPath);
      const redacted = buildRedactedRtspUrl(record.ipAddress, record.port, record.username, rtspPath);
      log('info', record.id, `Starting RTSP stream: ${redacted}`);

      ffmpegArgs = [
        '-rtsp_transport', 'tcp',
        '-i', rtspUrl,
        '-f', 'mpjpeg',
        '-q:v', '5',
        '-r', '15',
        '-boundary_tag', 'ffmpegboundary',
        '-',
      ];
    }

    this.updateStatus(record.id, 'CONNECTING', undefined);

    const proc = spawn(ffmpegInstaller.path, ffmpegArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    this.processes.set(record.id, proc);

    // Broadcast MJPEG frames to all connected clients
    proc.stdout.on('data', (chunk: Buffer) => {
      const listeners = this.listeners.get(record.id);
      if (!listeners) return;
      for (const res of listeners) {
        try { res.write(chunk); } catch { listeners.delete(res); }
      }
      // Mark ONLINE on first frame
      const st = this.statuses.get(record.id);
      if (st?.status !== 'ONLINE') {
        this.updateStatus(record.id, 'ONLINE', undefined, new Date().toISOString());
        this.reconnectAttempts.set(record.id, 0);
      }
    });

    // Parse resolution and FPS from stderr
    proc.stderr.on('data', (chunk: Buffer) => {
      const output = chunk.toString();
      const st = this.statuses.get(record.id);
      if (!st) return;

      let changed = false;
      const resMatch = output.match(/(\d{3,4}x\d{3,4})/);
      if (resMatch && st.resolution !== resMatch[1]) {
        st.resolution = resMatch[1]; changed = true;
      }
      const fpsMatch = output.match(/(\d+(?:\.\d+)?)\s*(?:fps|tbr)/i);
      if (fpsMatch) {
        const fps = Math.round(parseFloat(fpsMatch[1]));
        if (st.fps !== fps) { st.fps = fps; changed = true; }
      }
      if (changed && this.onStatusChangeCb) this.onStatusChangeCb(st);
    });

    proc.on('close', (code) => {
      log('warn', record.id, `FFmpeg closed with code ${code}`);
      this.processes.delete(record.id);
      const st = this.statuses.get(record.id);
      if (st && st.status !== 'OFFLINE') {
        this.scheduleReconnect(record);
      }
    });

    proc.on('error', (err) => {
      log('error', record.id, 'FFmpeg process error', err.message);
    });
  }

  private stopStream(id: string): void {
    const proc = this.processes.get(id);
    if (proc) {
      proc.kill('SIGTERM');
      this.processes.delete(id);
      log('info', id, 'FFmpeg process terminated');
    }
    this.clearTimer(id, 'idle');
    this.clearTimer(id, 'reconnect');
  }

  private scheduleReconnect(record: CameraRecord): void {
    const listeners = this.listeners.get(record.id);
    if (!listeners || listeners.size === 0) {
      log('info', record.id, 'No listeners — skipping reconnect');
      this.updateStatus(record.id, 'OFFLINE', undefined);
      return;
    }

    const attempts = (this.reconnectAttempts.get(record.id) ?? 0) + 1;
    this.reconnectAttempts.set(record.id, attempts);
    const delay = Math.min(Math.pow(2, attempts) * 1000, 30000); // Max 30s

    log('warn', record.id, `Scheduling reconnect #${attempts} in ${delay / 1000}s`);
    this.updateStatus(record.id, 'CONNECTING', `Reconnecting... attempt ${attempts} (in ${delay / 1000}s)`);

    const t = setTimeout(async () => {
      const latest = await this.repo.findById(record.id);
      if (latest?.enabled) {
        log('info', record.id, `Reconnect attempt #${attempts}`);
        this.startStream(latest);
      }
    }, delay);

    this.timers.set(`${record.id}_reconnect`, t);
  }

  // ─── PTZ Control ───────────────────────────────────────────────────────────

  async controlPTZ(id: string, action: PTZDirection, speed: number = 5): Promise<{ success: boolean; message: string }> {
    const record = await this.repo.findById(id);
    if (!record) throw new Error(`Camera not found: ${id}`);

    log('info', id, `PTZ: ${action} (speed ${speed})`);

    if (record.ipAddress === 'mock' || record.ipAddress === '0.0.0.0') {
      return { success: true, message: `Simulated PTZ ${action}` };
    }

    const password = getDecryptedPassword(record);
    const cgiActionMap: Record<PTZDirection, string> = {
      left:  `Left&arg1=0&arg2=${speed}&arg3=0`,
      right: `Right&arg1=0&arg2=${speed}&arg3=0`,
      up:    `Up&arg1=0&arg2=${speed}&arg3=0`,
      down:  `Down&arg1=0&arg2=${speed}&arg3=0`,
      home:  `GotoPreset&arg1=0&arg2=1&arg3=0`,
    };

    const cgiAction = cgiActionMap[action];
    const url = `http://${record.ipAddress}/cgi-bin/ptz.cgi?action=start&channel=1&code=${cgiAction}`;
    const authHeader = `Basic ${Buffer.from(`${record.username}:${password}`).toString('base64')}`;

    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3000);
      const res = await fetch(url, { headers: { Authorization: authHeader }, signal: ctrl.signal });
      clearTimeout(t);

      if (res.ok && action !== 'home') {
        // Stop continuous movement after 500ms
        setTimeout(async () => {
          const stopUrl = url.replace('action=start', 'action=stop');
          await fetch(stopUrl, { headers: { Authorization: authHeader } }).catch(() => {});
        }, 500);
      }

      return { success: res.ok, message: res.ok ? `Camera moved ${action}` : `HTTP ${res.status}` };
    } catch (err: any) {
      log('error', id, `PTZ command failed`, err.message);
      return { success: false, message: `PTZ failed: ${err.message}` };
    }
  }

  // ─── AI Service Helpers ────────────────────────────────────────────────────

  /**
   * Returns stream info for AI consumers.
   * AI services can READ this information but NEVER write back to the camera.
   */
  async getAIStreamConsumer(id: string): Promise<AIStreamConsumer> {
    const status = this.statuses.get(id);
    if (!status) throw new Error(`Camera not found: ${id}`);
    const apiBase = process.env.API_BASE_URL ?? 'http://localhost:5000';
    return {
      cameraId: id,
      streamEndpoint: `${apiBase}/api/cameras/${id}/stream`,
      websocketEndpoint: apiBase.replace(/^http/, 'ws'),
      frameRate: status.fps ?? 15,
      resolution: status.resolution ?? 'unknown',
    };
  }

  // ─── Internal Helpers ──────────────────────────────────────────────────────

  private buildStatus(record: CameraRecord, status: CameraStatus['status']): CameraStatus {
    return {
      id: record.id,
      name: record.name,
      location: record.location,
      brand: record.brand,
      status,
      ipAddress: record.ipAddress,
      resolution: record.resolution ?? 'N/A',
      fps: record.fps ?? 0,
      connectionTime: null,
      reconnectAttempts: 0,
    };
  }

  private updateStatus(id: string, status: CameraStatus['status'], error?: string, connectionTime?: string): void {
    const st = this.statuses.get(id);
    if (!st) return;
    st.status = status;
    st.error = error;
    if (connectionTime) st.connectionTime = connectionTime;
    if (status === 'OFFLINE') { st.connectionTime = null; st.fps = 0; st.resolution = 'N/A'; }
    this.onStatusChangeCb?.(st);
  }

  private clearTimer(id: string, type: 'idle' | 'reconnect'): void {
    const key = `${id}_${type}`;
    const t = this.timers.get(key);
    if (t) { clearTimeout(t); this.timers.delete(key); }
  }
}
