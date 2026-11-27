
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

import { spawn, spawnSync, ChildProcess, ChildProcessByStdio } from 'child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { Response } from 'express';
import { Writable, Readable } from 'stream';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
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
import {
  discoverOnvifPtz,
  OnvifPtzConfiguration,
  sendOnvifPtzCommand,
} from './camera.onvif.ptz';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(level: 'info' | 'warn' | 'error', camId: string, msg: string, detail?: unknown) {
  const ts = new Date().toISOString();
  const prefix = `[${ts}] [${level.toUpperCase()}] [Cam:${camId}]`;
  if (level === 'error') console.error(prefix, msg, detail ?? '');
  else if (level === 'warn') console.warn(prefix, msg, detail ?? '');
  else console.log(prefix, msg, detail ?? '');
}

const MAX_RECORDING_BUFFER_BYTES = 12_000_000;
const MAX_JPEG_FRAME_BYTES = 5_000_000;
const STREAM_DIAGNOSTIC_INTERVAL_MS = 15_000;
const STREAM_HEALTH_CHECK_INTERVAL_MS = envInt('STREAM_HEALTH_CHECK_INTERVAL_MS', 5_000);
/**
 * Separate startup grace period (no first frame yet) from the post-first-frame
 * stall timeout. A cold RTSP start needs time for TCP connect + DESCRIBE +
 * probe + first keyframe, especially on weak WiFi; killing too early causes a
 * zero-frame reconnect loop. (STREAM_STALL_TIMEOUT_MS previously conflated both.)
 */
const STREAM_STARTUP_TIMEOUT_MS = envInt('STREAM_STARTUP_TIMEOUT_MS', 30_000);
/** If no first frame over RTSP-TCP within this window, fall back to UDP faster. */
const RTSP_TCP_FALLBACK_MS = envInt('RTSP_TCP_FALLBACK_MS', 12_000);
const STREAM_STALL_TIMEOUT_MS = envInt('STREAM_STALL_TIMEOUT_MS', 12_000);
/** Frames older than this are considered stale; FPS is reported as 0. */
const STREAM_FPS_IDLE_MS = envInt('STREAM_FPS_IDLE_MS', 2_000);
/** Grace period after SIGTERM before escalating to SIGKILL when killing FFmpeg. */
const FFMPEG_KILL_GRACE_MS = envInt('FFMPEG_KILL_GRACE_MS', 1_500);
/** RTSP socket I/O timeout passed to FFmpeg `-stimeout`, in microseconds. */
const RTSP_SOCKET_TIMEOUT_US = envInt('RTSP_SOCKET_TIMEOUT_US', 15_000_000);
/** Reconnect backoff: bounded exponential with cap. */
const RECONNECT_INITIAL_DELAY_MS = envInt('RECONNECT_INITIAL_DELAY_MS', 2_000);
const RECONNECT_MAX_DELAY_MS = envInt('RECONNECT_MAX_DELAY_MS', 30_000);
const MAX_RECONNECT_ATTEMPTS = envInt('MAX_RECONNECT_ATTEMPTS', 5);
/** Reset reconnect streak after a stream is stable for this long. */
const RECONNECT_STABLE_RESET_MS = envInt('RECONNECT_STABLE_RESET_MS', 60_000);
/** Output transcoding targets (reliability-first defaults for 2560x1440@20 input). */
const STREAM_OUTPUT_FPS = envInt('STREAM_OUTPUT_FPS', 15);
const STREAM_MAX_WIDTH = envInt('STREAM_MAX_WIDTH', 1280);
const STREAM_JPEG_QUALITY = envInt('STREAM_JPEG_QUALITY', 5);
/** Small input buffer to smooth packet loss; NOT a large latency queue. */
const STREAM_MAX_DELAY_US = envInt('STREAM_MAX_DELAY_US', 500_000);
const STREAM_ANALYZE_DURATION_US = envInt('STREAM_ANALYZE_DURATION_US', 4_000_000);
const STREAM_PROBE_SIZE = envInt('STREAM_PROBE_SIZE', 2_000_000);
const STREAM_THREADS = envInt('STREAM_THREADS', 2);
const MJPEG_BOUNDARY = 'myboundary';
const JPEG_START_MARKER = Buffer.from([0xff, 0xd8]);

function defaultRtspTransport(): RtspTransport {
  const raw = (process.env.RTSP_TRANSPORT ?? 'tcp').toLowerCase();
  if (raw === 'udp' || raw === 'udp_multicast' || raw === 'http' || raw === 'tcp') return raw;
  return 'tcp';
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

/**
 * Bounded exponential backoff for reconnects.
 * attempt is 1-based. delay = min(initial * 2^(attempt-1), max). Pure + testable.
 */
export function computeReconnectDelayMs(
  attempt: number,
  initialMs: number = RECONNECT_INITIAL_DELAY_MS,
  maxMs: number = RECONNECT_MAX_DELAY_MS,
): number {
  const safeAttempt = Math.max(1, Math.floor(attempt));
  const exponential = initialMs * Math.pow(2, safeAttempt - 1);
  return Math.min(exponential, maxMs);
}

/** Redact RTSP credentials and drop FFmpeg progress noise from any logged stderr. */
export function redactStderr(text: string): string {
  return text
    .replace(/rtsp:\/\/[^\s/@]+:[^\s/@]+@/gi, 'rtsp://[redacted]@')
    .replace(/(?<=rtsp:\/\/)[^\s/@]+@/gi, '[redacted]@');
}

/** Strip FFmpeg `frame=...` progress lines so real errors remain visible. */
function stripProgressNoise(text: string): string {
  return text
    .split(/\r\n|\r|\n/)
    .filter((line) => !/^\s*(frame=|\[(dup|drop)\s)/.test(line))
    .join('\n')
    .replace(/(^|\n)\s*frame=.*$/gm, '$1')
    .trim();
}

/**
 * Kill an FFmpeg child safely. `immediate=true` sends SIGKILL now; otherwise
 * SIGTERM then escalate to SIGKILL after a grace period. Never throws.
 */
function killProcessGracefully(proc: ChildProcess, immediate = false): void {
  if (!proc) return;
  // Already gone?
  if (proc.exitCode !== null || proc.signalCode !== null || proc.killed) {
    try { proc.kill('SIGKILL'); } catch { /* noop */ }
    return;
  }
  try {
    if (immediate) {
      proc.kill('SIGKILL');
    } else {
      proc.kill('SIGTERM');
    }
  } catch { /* noop */ }

  if (immediate) return;
  const escalate = setTimeout(() => {
    try {
      if (proc.exitCode === null && proc.signalCode === null) proc.kill('SIGKILL');
    } catch { /* noop */ }
  }, FFMPEG_KILL_GRACE_MS);
  escalate.unref?.();
  proc.once('close', () => clearTimeout(escalate));
  proc.once('error', () => clearTimeout(escalate));
}

/** Best-effort kill of an FFmpeg process tree (Windows especially). Never throws. */
function killProcessTreeSync(proc: ChildProcess): void {
  const pid = proc.pid;
  if (!pid) return;
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      // POSIX: kill the process group if we created one; otherwise just the pid.
      try { process.kill(-pid, 'SIGKILL'); } catch { try { process.kill(pid, 'SIGKILL'); } catch { /* noop */ } }
    }
  } catch { /* noop */ }
}

function formatMjpegPart(frame: Buffer): Buffer {
  return Buffer.concat([
    Buffer.from(
      `--${MJPEG_BOUNDARY}\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`
    ),
    frame,
    Buffer.from('\r\n'),
  ]);
}

interface StreamDiagnostics {
  startedAt: number;
  bytesReceived: number;
  framesReceived: number;
  framesAtLastFpsSample: number;
  lastFpsSampleAt: number;
  frameParser: MjpegFrameParser;
  rtspStatus: 'connecting' | 'connected' | 'disconnected';
  lastFrameAt: number | null;
  lastFrame: Buffer | null;
  lastDiagnosticAt: number;
  stalled: boolean;
}

export class MjpegFrameParser {
  private buffer = Buffer.alloc(0);
  invalidFrames = 0;

  push(chunk: Buffer): Buffer[] {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const frames: Buffer[] = [];

    while (this.buffer.length > 0) {
      const start = this.buffer.indexOf(JPEG_START_MARKER);
      if (start < 0) {
        this.buffer = this.buffer[this.buffer.length - 1] === 0xff
          ? this.buffer.subarray(-1)
          : Buffer.alloc(0);
        return frames;
      }

      const parsed = this.findJpegEnd(start);
      if (parsed === null) {
        this.buffer = this.buffer.subarray(start);
        if (this.buffer.length > MAX_JPEG_FRAME_BYTES) {
          throw new Error('Camera MJPEG frame exceeded the configured size limit.');
        }
        return frames;
      }

      if (typeof parsed !== 'number') {
        this.invalidFrames += 1;
        this.buffer = this.buffer.subarray(parsed.invalidAt);
        continue;
      }

      const end = parsed;
      if (end - start > MAX_JPEG_FRAME_BYTES) {
        throw new Error('Camera MJPEG frame exceeded the configured size limit.');
      }
      frames.push(Buffer.from(this.buffer.subarray(start, end)));
      this.buffer = this.buffer.subarray(end);
    }

    return frames;
  }

  private findJpegEnd(start: number): number | { invalidAt: number } | null {
    let position = start + JPEG_START_MARKER.length;
    let inScan = false;

    while (position < this.buffer.length) {
      if (inScan) {
        const markerStart = this.buffer.indexOf(0xff, position);
        if (markerStart < 0 || markerStart + 1 >= this.buffer.length) return null;

        let markerCodeAt = markerStart + 1;
        while (markerCodeAt < this.buffer.length && this.buffer[markerCodeAt] === 0xff) {
          markerCodeAt += 1;
        }
        if (markerCodeAt >= this.buffer.length) return null;

        const marker = this.buffer[markerCodeAt];
        if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7)) {
          position = markerCodeAt + 1;
          continue;
        }
        if (marker === 0xd9) return markerCodeAt + 1;
        if (marker === 0xd8) return { invalidAt: markerStart };
        position = markerStart;
        inScan = false;
        continue;
      }

      if (this.buffer[position] !== 0xff) {
        const nextStart = this.buffer.indexOf(JPEG_START_MARKER, position);
        return nextStart >= 0 ? { invalidAt: nextStart } : null;
      }
      while (position < this.buffer.length && this.buffer[position] === 0xff) position += 1;
      if (position >= this.buffer.length) return null;

      const marker = this.buffer[position];
      position += 1;
      if (marker === 0xd9) return position;
      if (marker === 0xd8) return { invalidAt: position - 2 };
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (marker === 0x00 || position + 2 > this.buffer.length) return null;

      const segmentLength = this.buffer.readUInt16BE(position);
      if (segmentLength < 2) return null;
      const segmentEnd = position + segmentLength;
      if (segmentEnd > this.buffer.length) return null;
      position = segmentEnd;
      inScan = marker === 0xda;
    }

    return null;
  }
}

export class LatestFrameWriter {
  private waitingForDrain = false;
  private latestFrame?: Buffer;
  private drainHandler?: () => void;

  constructor(
    private readonly response: Pick<Response, 'destroyed' | 'writableEnded'> & {
      write(chunk: Buffer): boolean;
      once(event: 'drain', listener: () => void): unknown;
      off(event: 'drain', listener: () => void): unknown;
    },
    private readonly onError: (error: unknown) => void,
  ) {}

  write(frame: Buffer): void {
    if (this.response.destroyed || this.response.writableEnded) return;
    if (this.waitingForDrain) {
      this.latestFrame = frame;
      return;
    }

    try {
      if (this.response.write(formatMjpegPart(frame))) return;
      this.waitingForDrain = true;
      this.drainHandler = () => {
        this.waitingForDrain = false;
        this.drainHandler = undefined;
        const latestFrame = this.latestFrame;
        this.latestFrame = undefined;
        if (latestFrame) this.write(latestFrame);
      };
      this.response.once('drain', this.drainHandler);
    } catch (error: unknown) {
      this.dispose();
      this.onError(error);
    }
  }

  dispose(): void {
    if (this.drainHandler) this.response.off('drain', this.drainHandler);
    this.drainHandler = undefined;
    this.latestFrame = undefined;
    this.waitingForDrain = false;
  }
}

export interface CameraRecording {
  id: string;
  createdAt: string;
  sizeBytes: number;
}

interface ActiveRecording {
  cameraId: string;
  id: string;
  startedAt: string;
  durationSeconds: number;
  outputPath: string;
  partialPath: string;
  process: ChildProcess;
  input: Writable;
  frameParser: MjpegFrameParser;
  frameCount: number;
  timer: NodeJS.Timeout;
  completion: Promise<CameraRecording>;
  resolve: (recording: CameraRecording) => void;
  reject: (error: Error) => void;
  failure?: string;
  settled: boolean;
}

/**
 * Strips sensitive fields and returns a safe public record for the frontend.
 * Passwords, RTSP URLs, and encrypted values are NEVER exposed.
 */
export function toPublic(record: CameraRecord): CameraPublicRecord {
  return {
    id: record.id,
    name: record.name,
    brand: record.brand,
    location: record.location,
    ipAddress: record.ipAddress,
    port: record.port,
    onvifPort: record.onvifPort,
    username: record.username,
    hasCustomRtspPath: !!record.rtspUrlEncrypted,
    enabled: record.enabled,
    model: record.model,
    firmware: record.firmware,
    serialNumber: record.serialNumber,
    onvifVersion: record.onvifVersion,
    resolution: record.resolution,
    fps: record.fps,
    lastConnected: record.lastConnected,
    healthStatus: record.healthStatus,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export type RtspTransport = 'tcp' | 'udp' | 'udp_multicast' | 'http';

export function createCameraStreamFfmpegConfig(
  record: CameraRecord,
  password: string,
  customRtspPath?: string,
  transport?: RtspTransport
): { args: string[]; redactedRtspUrl?: string } {
  if (record.ipAddress === 'mock' || record.ipAddress === '0.0.0.0') {
    return {
      args: [
        '-re',
        '-f', 'lavfi',
        '-i', 'testsrc=size=1280x720:rate=15',
        '-an',
        '-c:v', 'mjpeg',
        '-q:v', '5',
        '-f', 'image2pipe',
        'pipe:1',
      ],
    };
  }

  const profile = getBrandProfile(record.brand);
  const rtspPath =
    record.discoveredRtspPath ??
    customRtspPath ??
    resolveRtspPath(profile.rtspPathTemplates[0], 1);
  const rtspUrl = buildRtspUrl(
    record.ipAddress,
    record.port,
    record.username,
    password,
    rtspPath
  );
  const redactedRtspUrl = buildRedactedRtspUrl(
    record.ipAddress,
    record.port,
    record.username,
    rtspPath
  );

  return {
    redactedRtspUrl,
    args: [
      '-nostdin',
      '-hide_banner',
      // RTSP transport: default TCP (no corruption), but some CP PLUS WiFi
      // cameras only stream RTP over UDP; see UDP fallback in startStream.
      '-rtsp_transport', transport ?? defaultRtspTransport(),
      '-stimeout', String(RTSP_SOCKET_TIMEOUT_US),
      '-avoid_negative_ts', 'make_zero',
      // Generate timestamps; keep a SMALL reorder buffer for smoothing packet
      // loss instead of `+nobuffer+discardcorrupt+low_delay` (which drops frames).
      '-fflags', '+genpts',
      '-max_delay', String(STREAM_MAX_DELAY_US),
      '-reorder_queue_size', '128',
      // Bounded probing: don't stall startup ~10s waiting to analyze a stream.
      '-probesize', String(STREAM_PROBE_SIZE),
      '-analyzeduration', String(STREAM_ANALYZE_DURATION_US),
      '-i', rtspUrl,
      '-map', '0:v:0',
      '-c:v', 'mjpeg',
      '-an',
      // Cap output fps + downscale wide streams; preserve aspect; even height.
      '-vf', `fps=${STREAM_OUTPUT_FPS},scale=w='min(${STREAM_MAX_WIDTH},iw)':h=-2`,
      '-threads:v', String(STREAM_THREADS),
      '-f', 'image2pipe',
      '-q:v', String(STREAM_JPEG_QUALITY),
      'pipe:1',
    ],
  };
}

// ─── CameraService ────────────────────────────────────────────────────────────

export class CameraService {
  /** FFmpeg child processes keyed by camera ID */
  private processes = new Map<string, ChildProcess>();
  /** Cameras whose FFmpeg spawn is in progress (guards against duplicate starts). */
  private startingStreams = new Set<string>();
  /** Per-camera RTSP transport override set after a no-frame startup (e.g. UDP fallback). */
  private rtspTransportOverrides = new Map<string, RtspTransport>();
  /** Runtime stream listeners keyed by camera ID */
  private listeners = new Map<string, Set<Response>>();
  /** One-frame, latest-only backpressure state per HTTP stream client */
  private streamWriters = new Map<Response, LatestFrameWriter>();
  /** Runtime camera statuses */
  private statuses = new Map<string, CameraStatus>();
  /** Reconnect attempt counters */
  private reconnectAttempts = new Map<string, number>();
  /** Active timers (reconnect + idle) */
  private timers = new Map<string, NodeJS.Timeout>();
  /** Active continuous PTZ command and failsafe stop timer by camera ID */
  private activePtzCommands = new Map<string, { timer: NodeJS.Timeout }>();
  /** Per-camera serialization chain so concurrent PTZ calls can't interleave SOAP. */
  private ptzQueues = new Map<string, Promise<unknown>>();
  /** ONVIF profile and service information discovered for each camera */
  private onvifPtzConfigurations = new Map<string, OnvifPtzConfiguration>();
  /** Active recording process keyed by camera ID */
  private activeRecordings = new Map<string, ActiveRecording>();
  /** Frame-production diagnostics and liveness state keyed by camera ID */
  private streamDiagnostics = new Map<string, StreamDiagnostics>();
  private streamHealthTimers = new Map<string, NodeJS.Timeout>();
  /** WebSocket status broadcast callback */
  private onStatusChangeCb: ((status: CameraStatus) => void) | null = null;

  constructor(private readonly repo: CameraRepository) {}

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Called on server startup.
   * Initializes all camera states and starts enabled streams independently.
   */
  async initialize(): Promise<void> {
    const cameras = await this.repo.findAll();
    const enabled = cameras.filter((c) => c.enabled);

    log(
      'info',
      'system',
      `Initializing: ${enabled.length} enabled camera(s) of ${cameras.length} total`
    );

    // Initialize runtime state for all cameras.
    for (const cam of cameras) {
      this.listeners.set(cam.id, new Set());
      this.reconnectAttempts.set(cam.id, 0);
      this.statuses.set(cam.id, this.buildStatus(cam, 'OFFLINE'));
    }

    // Start enabled camera streams independently.
    // A failed camera must not prevent the server from starting.
    for (const cam of enabled) {
      try {
        void this.startStream(cam).catch((err: unknown) => {
          const message =
            err instanceof Error ? err.message : String(err);

          log('error', cam.id, `Camera startup failed: ${message}`);
          this.updateStatus(cam.id, 'ERROR', message);
        });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : String(err);

        log('error', cam.id, `Camera startup failed: ${message}`);
        this.updateStatus(cam.id, 'ERROR', message);
      }
    }
  }

  /** Registers WebSocket status change callback */
  onStatusChange(cb: (status: CameraStatus) => void) {
    this.onStatusChangeCb = cb;
  }

  /** Gracefully shuts down all active camera streams */
  async shutdown(): Promise<void> {
    log('info', 'system', 'Shutting down CameraService processes...');

    await Promise.all(
      [...this.activeRecordings.values()].map(async (recording) => {
        try {
          await this.stopRecording(recording.cameraId, recording.id);
        } catch (err: unknown) {
          log(
            'error',
            recording.id,
            'Could not finalize recording during shutdown',
            err instanceof Error ? err.message : String(err),
          );
        }
      }),
    );

    await Promise.all(
      [...this.activePtzCommands.keys()].map(async (id) => {
        try {
          const result = await this.controlPTZ(id, 'stop');
          if (!result.success) log('warn', id, `PTZ shutdown stop failed: ${result.message}`);
        } catch (err: unknown) {
          log('error', id, 'Could not stop PTZ movement during shutdown', err);
        }
      }),
    );

    // Clear reconnect timers first so nothing respawns during teardown.
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();

    this.killAllStreams();
    this.processes.clear();
    this.startingStreams.clear();
    this.onvifPtzConfigurations.clear();

    for (const timer of this.streamHealthTimers.values()) {
      clearInterval(timer);
    }

    this.streamHealthTimers.clear();
    this.streamDiagnostics.clear();

    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }

    this.timers.clear();
  }

  /** Synchronously kill every tracked FFmpeg child. Safe to call on process exit. */
  killAllStreams(): void {
    // Clear first so 'close' handlers see no current process and won't reconnect.
    const procs = [...this.processes.values()];
    this.processes.clear();
    this.startingStreams.clear();
    // Cancel pending reconnects before killing.
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    for (const proc of procs) {
      try { killProcessGracefully(proc, true); } catch { /* noop */ }
      killProcessTreeSync(proc);
    }
    // Also clear any in-flight stream-health timers.
    for (const timer of this.streamHealthTimers.values()) clearInterval(timer);
    this.streamHealthTimers.clear();
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

    this.listeners.set(record.id, new Set());
    this.reconnectAttempts.set(record.id, 0);
    this.statuses.set(record.id, this.buildStatus(record, 'OFFLINE'));

    log('info', record.id, `Camera created: ${record.name}`);

    return toPublic(record);
  }

  async updateCamera(id: string, dto: UpdateCameraDto): Promise<CameraPublicRecord> {
    const record = await this.repo.update(id, dto);
    this.onvifPtzConfigurations.delete(id);
    log('info', id, `Camera updated: ${record.name}`);
    return toPublic(record);
  }

  async deleteCamera(id: string): Promise<void> {
    this.stopStream(id);

    const listeners = this.listeners.get(id);
    if (listeners) {
      for (const res of listeners) {
        if (!res.writableEnded) {
          try {
            res.end();
          } catch {
            // ignore
          }
        }
      }
      listeners.clear();
    }

    await this.repo.delete(id);

    this.listeners.delete(id);
    this.statuses.delete(id);
    this.reconnectAttempts.delete(id);
    this.onvifPtzConfigurations.delete(id);

    log('info', id, 'Camera deleted');

    // Notify connected WebSocket clients of removal
    this.onStatusChangeCb?.({
      id,
      name: '',
      location: 'other',
      brand: 'onvif',
      status: 'OFFLINE',
      ipAddress: '',
      resolution: 'N/A',
      fps: 0,
      connectionTime: null,
      reconnectAttempts: 0,
      lastFrameAt: null,
      error: 'Camera removed',
    });
  }

  async toggleCamera(id: string, enabled: boolean): Promise<CameraPublicRecord> {
    const record = await this.repo.setEnabled(id, enabled);

    if (enabled) {
      log('info', id, 'Camera enabled — starting stream');

      void this.startStream(record).catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : String(err);

        log('error', id, `Camera startup failed: ${message}`);
        this.updateStatus(id, 'ERROR', message);
      });
    } else {
      log('info', id, 'Camera disabled — stopping stream');
      this.stopStream(id);
      this.updateStatus(id, 'OFFLINE');
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
      password,
      customRtspPath || record.discoveredRtspPath
    );

    await this.repo.updateMetadata(id, {
      model: result.model ?? record.model,
      firmware: result.firmware ?? record.firmware,
      serialNumber: result.serialNumber ?? record.serialNumber,
      onvifVersion: result.onvifVersion ?? record.onvifVersion,
      discoveredRtspPath: result.discoveredRtspPath ?? record.discoveredRtspPath,
      resolution: result.resolution ?? record.resolution,
      fps: result.fps ?? record.fps,
      port: result.detectedRtspPort ?? record.port,
      onvifPort: result.detectedOnvifPort ?? record.onvifPort,
      lastConnected: result.success ? result.testedAt : record.lastConnected,
      healthStatus: result.success ? 'healthy' : result.authError ? 'degraded' : 'offline',
    });

    log(
      'info',
      id,
      `Probe complete. RTSP: ${result.rtspAvailable}, ONVIF: ${result.onvifAvailable}`
    );

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

    if (!this.listeners.has(id)) {
      this.listeners.set(id, new Set());
    }

    const listeners = this.listeners.get(id)!;
    res.writeHead(200, {
      'Content-Type': `multipart/x-mixed-replace; boundary=${MJPEG_BOUNDARY}`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'Pragma': 'no-cache',
      'X-Accel-Buffering': 'no',
      'X-Content-Type-Options': 'nosniff',
    });
    res.socket?.setNoDelay(true);

    listeners.add(res);
    this.streamWriters.set(res, new LatestFrameWriter(res, (err) => {
      this.removeStreamWriter(res);
      listeners.delete(res);
      const message = err instanceof Error ? err.message : String(err);
      log('warn', id, 'Could not write camera frame to a stream client', message);
      if (!res.destroyed && !res.writableEnded) res.end();
    }));

    log('info', id, `Stream client connected. Total: ${listeners.size}`);

    const disconnectListener = () => {
      const wasRegistered = listeners.delete(res);
      this.removeStreamWriter(res);
      if (!wasRegistered) return;

      log(
        'info',
        id,
        `Stream client disconnected. Remaining: ${listeners.size}`
      );

      if (listeners.size === 0 && !this.activeRecordings.has(id)) {
        log('info', id, 'No stream clients remain — stopping FFmpeg');
        this.stopStream(id);
        this.updateStatus(id, 'OFFLINE');
      }
    };

    res.on('close', disconnectListener);
    res.on('error', (err: Error) => {
      log('warn', id, 'Camera stream client emitted an error', err.message);
      disconnectListener();
    });

    res.flushHeaders();

    if (!this.processes.has(id)) {
      void this.startStream(record).catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : String(err);

        log('error', id, `Camera stream failed: ${message}`);
        this.updateStatus(id, 'ERROR', message);

        for (const listener of listeners) {
          if (!listener.writableEnded) {
            listener.end();
          }
        }

        listeners.clear();
      });
    }
  }

  // ─── FFmpeg Process Management ─────────────────────────────────────────────

  private async startStream(record: CameraRecord, fromReconnect = false): Promise<void> {
    if (this.processes.has(record.id)) {
      log('info', record.id, 'Stream start skipped; FFmpeg is already running');
      return;
    }
    if (this.startingStreams.has(record.id)) {
      log('info', record.id, 'Stream start skipped; FFmpeg spawn already in progress');
      return;
    }

    this.clearTimer(record.id, 'idle');
    this.clearTimer(record.id, 'reconnect');
    // A fresh external start resets the retry streak; reconnect-driven starts accumulate.
    if (!fromReconnect) this.reconnectAttempts.set(record.id, 0);
    this.startingStreams.add(record.id);

    let password = '';
    try {
      password = getDecryptedPassword(record);
    } catch {
      password = '';
    }
    let customRtspPath: string | undefined;
    try {
      customRtspPath = getDecryptedRtspPath(record);
    } catch {
      customRtspPath = undefined;
    }
    let ffmpegConfig: { args: string[]; redactedRtspUrl?: string };
    const activeTransport: RtspTransport = this.rtspTransportOverrides.get(record.id) ?? defaultRtspTransport();
    try {
      ffmpegConfig = createCameraStreamFfmpegConfig(record, password, customRtspPath, activeTransport);
    } catch (err: unknown) {
      this.startingStreams.delete(record.id);
      const message = err instanceof Error ? err.message : String(err);
      log('error', record.id, 'Failed to build FFmpeg command', redactStderr(message));
      this.updateStatus(record.id, 'ERROR', `Failed to build FFmpeg command: ${message}`);
      if (this.hasStreamConsumers(record.id)) this.scheduleReconnect(record);
      return;
    }
    if (ffmpegConfig.redactedRtspUrl) {
      log('info', record.id, `Starting RTSP stream: ${ffmpegConfig.redactedRtspUrl}`);
    }

    this.updateStatus(record.id, 'CONNECTING');

    let proc: ChildProcessByStdio<null, Readable, Readable>;
    try {
      proc = spawn(ffmpegInstaller.path, ffmpegConfig.args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err: unknown) {
      this.startingStreams.delete(record.id);
      const message = err instanceof Error ? err.message : String(err);
      log('error', record.id, 'Failed to spawn FFmpeg', redactStderr(message));
      this.updateStatus(record.id, 'ERROR', `Failed to start FFmpeg: ${message}`);
      if (this.hasStreamConsumers(record.id)) this.scheduleReconnect(record);
      return;
    }
    const startedAt = Date.now();

    // Guard against duplicate FFmpeg for the same camera: only keep one.
    const existing = this.processes.get(record.id);
    if (existing && existing !== proc) {
      log('warn', record.id, 'Duplicate FFmpeg detected; killing newly spawned process');
      killProcessGracefully(proc);
      this.startingStreams.delete(record.id);
      return;
    }
    this.processes.set(record.id, proc);
    this.startingStreams.delete(record.id);
    const diagnostics: StreamDiagnostics = {
      startedAt,
      bytesReceived: 0,
      framesReceived: 0,
      framesAtLastFpsSample: 0,
      lastFpsSampleAt: startedAt,
      frameParser: new MjpegFrameParser(),
      rtspStatus: 'connecting',
      lastFrameAt: null,
      lastFrame: null,
      lastDiagnosticAt: startedAt,
      stalled: false,
    };
    this.streamDiagnostics.set(record.id, diagnostics);
    log('info', record.id, 'Stream diagnostics', JSON.stringify({
      event: 'stream_started',
      ffmpegPid: proc.pid ?? null,
      ffmpegStatus: 'running',
      rtspStatus: diagnostics.rtspStatus,
      reconnectCount: this.reconnectAttempts.get(record.id) ?? 0,
      activeConsumers: this.getActiveStreamConsumerCount(record.id),
    }));

    proc.stdout.on('data', (chunk: Buffer) => {
      const now = Date.now();
      diagnostics.bytesReceived += chunk.length;
      let jpegFrames: Buffer[];
      try {
        jpegFrames = diagnostics.frameParser.push(chunk);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        log('warn', record.id, 'Rejecting invalid FFmpeg JPEG output', message);
        this.updateStatus(record.id, 'ERROR', message);
        killProcessGracefully(proc, true);
        return;
      }
      const framesInChunk = jpegFrames.length;
      diagnostics.framesReceived += framesInChunk;
      if (framesInChunk > 0) {
        diagnostics.rtspStatus = 'connected';
        diagnostics.lastFrameAt = now;
        diagnostics.lastFrame = jpegFrames[jpegFrames.length - 1];
        // Expose accurate last-frame timestamp on the public status object.
        const liveStatus = this.statuses.get(record.id);
        if (liveStatus) liveStatus.lastFrameAt = new Date(now).toISOString();
        if (diagnostics.stalled) {
          diagnostics.stalled = false;
          log('info', record.id, 'Stream frame production recovered', JSON.stringify({
            event: 'stream_recovered',
            ffmpegPid: proc.pid ?? null,
            framesReceived: diagnostics.framesReceived,
            activeConsumers: this.getActiveStreamConsumerCount(record.id),
          }));
        }

        const status = this.statuses.get(record.id);
        if (status?.status !== 'ONLINE') {
          const nowTs = new Date(now).toISOString();
          this.updateStatus(record.id, 'ONLINE', undefined, nowTs);
          void this.repo.updateMetadata(record.id, {
            healthStatus: 'healthy',
            lastConnected: nowTs,
          }).catch(() => {});
        }
      }

      if (now - diagnostics.lastFpsSampleAt >= 1000) {
        const elapsedMs = now - diagnostics.lastFpsSampleAt;
        const framesSinceSample = diagnostics.framesReceived - diagnostics.framesAtLastFpsSample;
        const measuredFps = Math.round((framesSinceSample * 1000 / elapsedMs) * 10) / 10;
        diagnostics.framesAtLastFpsSample = diagnostics.framesReceived;
        diagnostics.lastFpsSampleAt = now;

        const status = this.statuses.get(record.id);
        if (status && status.status === 'ONLINE' && status.fps !== measuredFps) {
          status.fps = measuredFps;
          this.onStatusChangeCb?.(status);
        }
      }

      if (now - diagnostics.lastDiagnosticAt >= STREAM_DIAGNOSTIC_INTERVAL_MS) {
        diagnostics.lastDiagnosticAt = now;
        log('info', record.id, 'Stream diagnostics', JSON.stringify({
          event: 'stream_metrics',
          ffmpegPid: proc.pid ?? null,
          ffmpegStatus: 'running',
          rtspStatus: diagnostics.rtspStatus,
          upstreamStatus: framesInChunk > 0 || diagnostics.lastFrameAt
            ? 'receiving_frames'
            : 'waiting_for_first_frame',
          framesReceived: diagnostics.framesReceived,
          bytesReceived: diagnostics.bytesReceived,
          invalidJpegFrames: diagnostics.frameParser.invalidFrames,
          outputFps: this.statuses.get(record.id)?.fps ?? 0,
          lastFrameAt: diagnostics.lastFrameAt
            ? new Date(diagnostics.lastFrameAt).toISOString()
            : null,
          frameAgeMs: diagnostics.lastFrameAt ? now - diagnostics.lastFrameAt : null,
          reconnectCount: this.reconnectAttempts.get(record.id) ?? 0,
          activeConsumers: this.getActiveStreamConsumerCount(record.id),
        }));
      }

      const listeners = this.listeners.get(record.id) ?? new Set<Response>();
      const latestFrame = jpegFrames[jpegFrames.length - 1];
      for (const res of listeners) {
        if (latestFrame) this.writeLatestStreamFrame(record.id, res, latestFrame);
      }

      const recording = this.activeRecordings.get(record.id);
      if (recording && !recording.input.writableEnded) {
        try {
          for (const frame of recording.frameParser.push(chunk)) {
            if (recording.input.writableLength > MAX_RECORDING_BUFFER_BYTES) {
              recording.failure = 'Recording input exceeded its buffer limit.';
              recording.input.end();
              break;
            }
            recording.input.write(frame);
            recording.frameCount += 1;
          }
        } catch (err: unknown) {
          recording.failure = `Could not parse the camera MJPEG stream: ${
            err instanceof Error ? err.message : String(err)
          }`;
          recording.input.end();
        }
      }

    });
    const healthTimer = setInterval(() => {
      this.checkStreamHealth(record.id, proc, diagnostics);
    }, STREAM_HEALTH_CHECK_INTERVAL_MS);
    this.streamHealthTimers.set(record.id, healthTimer);

    proc.stdout.on('error', (err: Error) => {
      log('warn', record.id, 'FFmpeg stdout stream error', redactStderr(err.message));
    });

    proc.stderr.on('error', (err: Error) => {
      log('warn', record.id, 'FFmpeg stderr stream error', redactStderr(err.message));
    });

    proc.stdout.on('end', () => {
      const recording = this.activeRecordings.get(record.id);
      if (recording && !recording.input.writableEnded) {
        recording.failure ??= 'The camera stream ended before the recording completed.';
        recording.input.end();
      }
    });

    let lastError: string | undefined;
    let stderrTail = '';

    proc.stderr.on('data', (chunk: Buffer) => {
      const output = chunk.toString();
      stderrTail = `${stderrTail}${output}`.slice(-2000);
      const st = this.statuses.get(record.id);

      if (/Input #\d+,\s*rtsp,/i.test(stderrTail)) {
        diagnostics.rtspStatus = 'connected';
      } else if (
        stderrTail.includes('Connection refused') ||
        stderrTail.includes('Connection timed out') ||
        stderrTail.includes('No route to host') ||
        stderrTail.includes('method DESCRIBE failed') ||
        stderrTail.includes('401 Unauthorized')
      ) {
        diagnostics.rtspStatus = 'disconnected';
      }

      if (output.includes('401 Unauthorized')) {
        lastError = 'Authentication failed — invalid camera credentials';
      } else if (output.includes('Connection refused') || output.includes('10061')) {
        lastError = 'Connection refused — camera port is closed or offline';
      } else if (
        output.includes('Connection timed out') ||
        output.includes('10060') ||
        output.includes('No route to host')
      ) {
        lastError = 'Connection timed out — camera IP is unreachable on current network';
      } else if (output.includes('404 Not Found') || output.includes('Stream not found')) {
        lastError = 'RTSP stream path not found on camera';
      } else if (output.includes('method DESCRIBE failed')) {
        lastError = 'Camera rejected RTSP DESCRIBE request';
      }

      if (!st) return;

      let changed = false;

      const resMatch = output.match(/(\d{3,4}x\d{3,4})/);

      if (resMatch && st.resolution !== resMatch[1]) {
        st.resolution = resMatch[1];
        changed = true;
      }

      if (changed && this.onStatusChangeCb) {
        this.onStatusChangeCb(st);
      }
    });

    proc.on('close', (code, signal) => {
      const isCurrentProcess = this.processes.get(record.id) === proc;
      if (!isCurrentProcess) return;
      this.clearStreamHealth(record.id, proc);
      this.processes.delete(record.id);

      const uptimeSeconds = Math.round((Date.now() - startedAt) / 1000);
      // Strip FFmpeg progress noise + redact any credentials; keep the real error visible.
      const safeStderr = redactStderr(stripProgressNoise(stderrTail));
      const stderrSummary = [lastError, safeStderr].filter(Boolean).join(' | ') || 'No FFmpeg stderr output captured';
      log(
        code === 0 && !signal ? 'info' : 'warn',
        record.id,
        `FFmpeg exited after ${uptimeSeconds}s (code=${code ?? 'null'}, signal=${signal ?? 'none'})`,
        JSON.stringify({
          ffmpegPid: proc.pid ?? null,
          ffmpegStatus: 'exited',
          rtspStatus: diagnostics.rtspStatus,
          exitCode: code,
          signal,
          bytesReceived: diagnostics.bytesReceived,
          framesReceived: diagnostics.framesReceived,
          lastFrameAt: diagnostics.lastFrameAt
            ? new Date(diagnostics.lastFrameAt).toISOString()
            : null,
          reconnectCount: this.reconnectAttempts.get(record.id) ?? 0,
          activeConsumers: this.getActiveStreamConsumerCount(record.id),
          stderrTail: stderrSummary,
        })
      );

      // Only treat a session as stable after a sustained period of uninterrupted video.
      if (uptimeSeconds * 1000 >= RECONNECT_STABLE_RESET_MS && diagnostics.framesReceived > 0) {
        this.reconnectAttempts.set(record.id, 0);
      }

      // UDP fallback: this RTSP server accepted TCP + SDP but sent no RTP-over-TCP
      // (common on CP PLUS WiFi cameras). Retry over UDP once, without losing reliability.
      if (diagnostics.framesReceived === 0 && activeTransport === 'tcp' && this.rtspTransportOverrides.get(record.id) !== 'udp') {
        this.rtspTransportOverrides.set(record.id, 'udp');
        log('warn', record.id, 'No frames over RTSP-TCP; falling back to RTSP-UDP transport');
      }

      const st = this.statuses.get(record.id);

      // If credentials failed, do not retry in an aggressive loop to prevent camera lockout
      if (lastError && lastError.includes('Authentication failed')) {
        log('error', record.id, 'Authentication error — aborting auto-reconnect to avoid device lockout');
        this.updateStatus(record.id, 'ERROR', lastError);
        void this.repo.updateMetadata(record.id, { healthStatus: 'degraded' }).catch(() => {});
        return;
      }

      if (st && st.status !== 'OFFLINE' && this.hasStreamConsumers(record.id)) {
        if (code !== 0 || signal) {
          this.updateStatus(record.id, 'ERROR', lastError || `Stream closed (code ${code ?? 'null'}${signal ? ` signal=${signal}` : ''})`);
        }
        this.scheduleReconnect(record);
      } else if (st && st.status !== 'OFFLINE') {
        this.updateStatus(record.id, 'OFFLINE');
      }
    });

    proc.on('error', (err) => {
      log('error', record.id, 'FFmpeg process error', redactStderr(err.message));
      if (this.processes.get(record.id) === proc) {
        this.clearStreamHealth(record.id, proc);
        this.processes.delete(record.id);
        this.startingStreams.delete(record.id);
        this.updateStatus(record.id, 'ERROR', redactStderr(err.message));
        // A spawn/runtime error previously left no process and no reconnect; recover.
        if (this.hasStreamConsumers(record.id)) this.scheduleReconnect(record);
      }
    });
  }

  private stopStream(id: string): void {
    this.clearStreamHealth(id);
    this.startingStreams.delete(id);

    const recording = this.activeRecordings.get(id);
    if (recording && !recording.input.writableEnded) {
      recording.failure ??= 'The camera stream was stopped before the recording completed.';
      recording.input.end();
    }

    const proc = this.processes.get(id);

    if (proc) {
      // Remove first so 'close' handler won't schedule a reconnect for a stopped stream.
      this.processes.delete(id);
      proc.stdout?.unpipe();
      killProcessGracefully(proc);

      log('info', id, `FFmpeg process ${proc.pid ?? 'unknown'} terminating`);
    }

    this.clearTimer(id, 'idle');
    this.clearTimer(id, 'reconnect');
  }

  private hasStreamConsumers(id: string): boolean {
    return (this.listeners.get(id)?.size ?? 0) > 0 || this.activeRecordings.has(id);
  }

  private getActiveStreamConsumerCount(id: string): number {
    return (this.listeners.get(id)?.size ?? 0) + (this.activeRecordings.has(id) ? 1 : 0);
  }

  private removeStreamWriter(res: Response): void {
    this.streamWriters.get(res)?.dispose();
    this.streamWriters.delete(res);
  }

  private writeLatestStreamFrame(id: string, res: Response, frame: Buffer): void {
    const writer = this.streamWriters.get(res);
    if (!writer || res.destroyed || res.writableEnded) {
      this.removeStreamWriter(res);
      this.listeners.get(id)?.delete(res);
      return;
    }

    writer.write(frame);
  }

  private checkStreamHealth(
    id: string,
    proc: ChildProcess,
    diagnostics: StreamDiagnostics,
  ): void {
    if (this.processes.get(id) !== proc || diagnostics.stalled) return;

    const now = Date.now();
    const lastFrameAt = diagnostics.lastFrameAt ?? diagnostics.startedAt;
    const frameAgeMs = now - lastFrameAt;
    // No frames yet -> allow a longer startup grace; after first frame -> stall timeout.
    const startupPending = diagnostics.lastFrameAt === null;
    const transport = this.rtspTransportOverrides.get(id) ?? defaultRtspTransport();
    // On TCP, fall back to UDP faster, but never exceed STREAM_STARTUP_TIMEOUT_MS.
    const startupTimeoutMs = Math.min(
      STREAM_STARTUP_TIMEOUT_MS,
      transport === 'tcp' ? RTSP_TCP_FALLBACK_MS : STREAM_STARTUP_TIMEOUT_MS,
    );
    const timeoutMs = startupPending ? startupTimeoutMs : STREAM_STALL_TIMEOUT_MS;
    if (frameAgeMs >= STREAM_FPS_IDLE_MS) {
      const status = this.statuses.get(id);
      if (status && status.fps !== 0) {
        status.fps = 0;
        this.onStatusChangeCb?.(status);
      }
      diagnostics.framesAtLastFpsSample = diagnostics.framesReceived;
      diagnostics.lastFpsSampleAt = now;
    }
    if (frameAgeMs < timeoutMs) return;

    diagnostics.stalled = true;
    log('warn', id, 'No JPEG frames received; restarting stalled FFmpeg process', JSON.stringify({
      event: 'stream_stalled',
      ffmpegPid: proc.pid ?? null,
      ffmpegStatus: 'running_without_frames',
      rtspStatus: diagnostics.rtspStatus,
      upstreamStatus: 'no_frames',
      framesReceived: diagnostics.framesReceived,
      bytesReceived: diagnostics.bytesReceived,
      lastFrameAt: diagnostics.lastFrameAt
        ? new Date(diagnostics.lastFrameAt).toISOString()
        : null,
      frameAgeMs,
      reconnectCount: this.reconnectAttempts.get(id) ?? 0,
      activeConsumers: this.getActiveStreamConsumerCount(id),
    }));
    this.updateStatus(id, 'ERROR', 'No camera frames received; restarting the stream.');
    // SIGKILL a hung FFmpeg; 'close' then triggers bounded reconnect.
    killProcessGracefully(proc, true);
  }

  private clearStreamHealth(id: string, proc?: ChildProcess): void {
    if (proc && this.processes.get(id) !== proc) return;
    const timer = this.streamHealthTimers.get(id);
    if (timer) clearInterval(timer);
    this.streamHealthTimers.delete(id);
    this.streamDiagnostics.delete(id);
  }

  private scheduleReconnect(record: CameraRecord): void {
    if (!this.hasStreamConsumers(record.id)) {
      log('info', record.id, 'No listeners - skipping reconnect');
      this.updateStatus(record.id, 'OFFLINE');
      return;
    }

    // Never stack multiple pending reconnect timers for one camera.
    this.clearTimer(record.id, 'reconnect');

    const attempts = (this.reconnectAttempts.get(record.id) ?? 0) + 1;
    this.reconnectAttempts.set(record.id, attempts);

    // Bounded retries: stop hammering an unreachable/overloaded camera.
    if (attempts > MAX_RECONNECT_ATTEMPTS) {
      log(
        'error',
        record.id,
        `Reconnect limit reached (${MAX_RECONNECT_ATTEMPTS} attempts); giving up auto-reconnect`,
      );
      this.updateStatus(
        record.id,
        'ERROR',
        `Stream reconnect limit reached (${MAX_RECONNECT_ATTEMPTS} attempts). Verify camera power/network, then retry.`,
      );
      return;
    }

    // Bounded exponential backoff.
    const delay = computeReconnectDelayMs(attempts, RECONNECT_INITIAL_DELAY_MS, RECONNECT_MAX_DELAY_MS);

    log(
      'warn',
      record.id,
      `Scheduling reconnect #${attempts} in ${delay / 1000}s`,
    );

    this.updateStatus(
      record.id,
      'CONNECTING',
      `Reconnecting... attempt ${attempts}/${MAX_RECONNECT_ATTEMPTS} (in ${delay / 1000}s)`,
    );

    const timerKey = `${record.id}_reconnect`;
    const t = setTimeout(async () => {
      this.timers.delete(timerKey);
      try {
        const latest = await this.repo.findById(record.id);

        if (!latest?.enabled) return;

        // Re-check nothing already restarted this stream + no pending stop.
        if (this.processes.has(record.id) || this.startingStreams.has(record.id)) return;
        if (!this.hasStreamConsumers(record.id)) return;

        log('info', record.id, `Reconnect attempt #${attempts}`);

        await this.startStream(latest, true).catch((err: unknown) => {
          const message =
            err instanceof Error ? err.message : String(err);
          log('error', record.id, `Reconnect failed: ${redactStderr(message)}`);
          // startStream already reports + reschedules on FFmpeg failure; only
          // schedule again if it could not (e.g. spawn threw synchronously).
          if (!this.processes.has(record.id) && this.hasStreamConsumers(record.id)) {
            this.scheduleReconnect(record);
          }
        });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : String(err);
        log('error', record.id, `Reconnect failed: ${redactStderr(message)}`);
        this.updateStatus(record.id, 'ERROR', redactStderr(message));
        if (this.hasStreamConsumers(record.id)) this.scheduleReconnect(record);
      }
    }, delay);
    t.unref?.();

    this.timers.set(timerKey, t);
  }

  // ─── PTZ Control ───────────────────────────────────────────────────────────

  async controlPTZ(
    id: string,
    action: PTZDirection,
    speed: number = 5
  ): Promise<{ success: boolean; message: string }> {
    // Serialize per camera so concurrent PTZ calls can't interleave SOAP messages.
    const prior = this.ptzQueues.get(id) ?? Promise.resolve();
    const run = prior.catch(() => undefined).then(() => this.doControlPTZ(id, action, speed));
    // Keep chain non-rejecting; callers get `run`.
    const settled = run.then(() => undefined, () => undefined);
    this.ptzQueues.set(id, settled);
    // Drop the map entry once this link is the tail and has settled.
    void settled.then(() => {
      if (this.ptzQueues.get(id) === settled) this.ptzQueues.delete(id);
    });
    return run;
  }

  private async doControlPTZ(
    id: string,
    action: PTZDirection,
    speed: number = 5
  ): Promise<{ success: boolean; message: string }> {
    const record = await this.repo.findById(id);

    if (!record) throw new Error(`Camera not found: ${id}`);

    log('info', id, `PTZ: ${action} (speed ${speed})`);

    if (record.ipAddress === 'mock' || record.ipAddress === '0.0.0.0') {
      return { success: false, message: 'PTZ is unavailable for mock cameras.' };
    }

    const activeCommand = this.activePtzCommands.get(id);

    try {
      let configuration = this.onvifPtzConfigurations.get(id);
      if (!configuration) {
        configuration = await discoverOnvifPtz(record);
        this.onvifPtzConfigurations.set(id, configuration);
        log(
          'info',
          id,
          `ONVIF PTZ ready (profile ${configuration.profileToken}, service ${new URL(configuration.ptzServiceUrl).pathname})`,
        );
      }

      if (activeCommand && action !== 'stop') {
        await sendOnvifPtzCommand(record, configuration, 'stop', 0);
        clearTimeout(activeCommand.timer);
        this.activePtzCommands.delete(id);
      }

      await sendOnvifPtzCommand(record, configuration, action, speed);

      if (action === 'stop') {
        if (activeCommand) {
          clearTimeout(activeCommand.timer);
          this.activePtzCommands.delete(id);
        }
        return { success: true, message: 'Camera movement stopped via ONVIF' };
      }

      if (action !== 'home') {
        const timer = setTimeout(() => {
          void this.controlPTZ(id, 'stop')
            .then((stopResult) => {
              if (!stopResult.success) {
                log('warn', id, `PTZ failsafe stop failed: ${stopResult.message}`);
              }
            })
            .catch((err: unknown) => {
              const message = err instanceof Error ? err.message : String(err);
              log('error', id, 'PTZ failsafe stop failed', message);
            });
        }, 30000);
        timer.unref();
        this.activePtzCommands.set(id, { timer });
      }
      return {
        success: true,
        message: action === 'home'
          ? 'Camera returned to its ONVIF home position'
          : `Camera ${action} command accepted via ONVIF`,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);

      log('error', id, 'PTZ command failed', message);

      return { success: false, message: `PTZ failed: ${message}` };
    }
  }

  // ─── AI Service Helpers ────────────────────────────────────────────────────

  /**
   * Returns stream info for AI consumers.
   * AI services can READ this information but NEVER write back to the camera.
   */
  async getAIStreamConsumer(
    id: string,
    isInternal: boolean = false
  ): Promise<AIStreamConsumer> {
    let status = this.statuses.get(id);
    const record = await this.repo.findById(id);

    if (!record) throw new Error(`Camera not found: ${id}`);

    if (!status) {
      status = this.buildStatus(record, 'OFFLINE');
      this.statuses.set(id, status);
    }

    const apiBase = process.env.API_BASE_URL ?? 'http://localhost:5000';

    let directRtspUrl: string | undefined;

    // Direct RTSP is provided ONLY internally to local/authenticated agent processes
    if (isInternal) {
      let password = '';
      try {
        password = getDecryptedPassword(record);
      } catch {
        password = '';
      }
      const customRtspPath = getDecryptedRtspPath(record);
      const profile = getBrandProfile(record.brand);
      const rtspPath =
        customRtspPath ??
        record.discoveredRtspPath ??
        resolveRtspPath(profile.rtspPathTemplates[0], 1);

      directRtspUrl = buildRtspUrl(
        record.ipAddress,
        record.port,
        record.username,
        password,
        rtspPath
      );
    }

    return {
      cameraId: id,
      name: record.name,
      brand: record.brand,
      location: record.location,
      status: status.status,
      streamEndpoint: `${apiBase}/api/cameras/${id}/stream`,
      websocketEndpoint: apiBase.replace(/^http/, 'ws'),
      frameRate: status.fps ?? 15,
      resolution: status.resolution ?? 'unknown',
      ...(directRtspUrl ? { directRtspUrl } : {}),
    };
  }

  // ─── Internal Helpers ──────────────────────────────────────────────────────

  private buildStatus(
    record: CameraRecord,
    status: CameraStatus['status']
  ): CameraStatus {
    return {
      id: record.id,
      name: record.name,
      location: record.location,
      brand: record.brand,
      status,
      ipAddress: record.ipAddress,
      resolution: record.resolution ?? 'N/A',
      fps: 0,
      connectionTime: null,
      reconnectAttempts: this.reconnectAttempts.get(record.id) ?? 0,
      lastFrameAt: null,
    };
  }

  private updateStatus(
    id: string,
    status: CameraStatus['status'],
    error?: string,
    connectionTime?: string
  ): void {
    const st = this.statuses.get(id);

    if (!st) return;

    st.status = status;
    st.error = error;
    if (status !== 'ONLINE') {
      st.fps = 0;
    }

    // Keep reconnect accounting visible + accurate for consumers.
    st.reconnectAttempts = this.reconnectAttempts.get(id) ?? st.reconnectAttempts;

    if (connectionTime) {
      st.connectionTime = connectionTime;
    }

    if (status === 'OFFLINE') {
      st.connectionTime = null;
      st.fps = 0;
      st.resolution = 'N/A';
      st.lastFrameAt = null;
    }

    this.onStatusChangeCb?.(st);
  }

  private clearTimer(id: string, type: 'idle' | 'reconnect'): void {
    const key = `${id}_${type}`;
    const t = this.timers.get(key);

    if (t) {
      clearTimeout(t);
      this.timers.delete(key);
    }
  }

  // ─── Snapshot ──────────────────────────────────────────────────────────────

  /**
   * Captures a single JPEG frame from the live RTSP stream using FFmpeg.
   * Saves to server/data/snapshots/<cameraId>-<timestamp>.jpg
   */
  async takeSnapshot(id: string): Promise<{ message: string; path: string }> {
    const record = await this.repo.findById(id);
    if (!record) throw new Error(`Camera not found: ${id}`);

    const snapshotDir = path.resolve(__dirname, '..', 'data', 'snapshots');
    if (!fs.existsSync(snapshotDir)) fs.mkdirSync(snapshotDir, { recursive: true });

    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const outFile = path.join(snapshotDir, `${id}-${ts}.jpg`);

    if (record.ipAddress === 'mock' || record.ipAddress === '0.0.0.0') {
      log('info', id, `Snapshot simulated: ${outFile}`);
      return { message: 'Snapshot captured (simulated)', path: outFile };
    }

    // Prefer reusing the live shared stream's latest frame over opening a
    // SECOND RTSP session on the camera (many cameras cap concurrent streams).
    const live = this.streamDiagnostics.get(id);
    if (this.processes.has(id) && live?.lastFrame && live.lastFrame.length > 0) {
      try {
        fs.writeFileSync(outFile, live.lastFrame);
        log('info', id, `Snapshot saved from live stream: ${outFile}`);
        return { message: 'Snapshot saved', path: outFile };
      } catch { /* fall back to a one-shot RTSP probe */ }
    }

    let password = '';
    try { password = getDecryptedPassword(record); } catch { password = ''; }
    const customPath = getDecryptedRtspPath(record);
    const profile = getBrandProfile(record.brand);
    const rtspPath = record.discoveredRtspPath ?? customPath ?? resolveRtspPath(profile.rtspPathTemplates[0], 1);
    const rtspUrl = buildRtspUrl(record.ipAddress, record.port, record.username, password, rtspPath);

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(ffmpegInstaller.path, [
        '-nostdin',
        '-hide_banner',
        '-rtsp_transport', 'tcp',
        '-stimeout', '3000000',
        '-i', rtspUrl,
        '-vframes', '1',
        '-q:v', '2',
        '-y', outFile,
      ], { stdio: ['ignore', 'ignore', 'pipe'] });

      // Drain stderr so FFmpeg can't block on a full pipe; never log it raw (may contain RTSP creds).
      let stderrTail = '';
      proc.stderr?.on('data', (chunk: Buffer) => { stderrTail = `${stderrTail}${chunk.toString()}`.slice(-1000); });
      proc.stderr?.on('error', () => {});

      const timer = setTimeout(() => { killProcessGracefully(proc, true); reject(new Error('Snapshot timed out')); }, 10000);
      proc.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0 || fs.existsSync(outFile)) resolve();
        else reject(new Error(`Snapshot FFmpeg exited with code ${code}${stderrTail ? `: ${redactStderr(stderrTail).trim().slice(-200)}` : ''}`));
      });
      proc.on('error', (err) => { clearTimeout(timer); reject(err); });
    });

    log('info', id, `Snapshot saved: ${outFile}`);
    return { message: 'Snapshot saved', path: outFile };
  }

  // ─── Recording ─────────────────────────────────────────────────────────────

  /**
   * Records the existing Node.js MJPEG output; the camera's RTSP stream is not opened again.
   */
  async startRecording(
    id: string,
    durationSeconds = 30,
  ): Promise<{ id: string; startedAt: string; durationSeconds: number }> {
    const record = await this.repo.findById(id);
    if (!record) throw new Error(`Camera not found: ${id}`);
    if (!record.enabled) throw new Error(`Camera ${record.name} is disabled.`);
    if (!Number.isInteger(durationSeconds) || durationSeconds < 1 || durationSeconds > 3600) {
      throw new Error('Recording duration must be an integer between 1 and 3600 seconds.');
    }
    if (this.activeRecordings.has(id)) {
      throw new Error(`A recording is already active for camera ${id}.`);
    }

    const recDir = path.resolve(__dirname, '..', 'data', 'recordings');
    fs.mkdirSync(recDir, { recursive: true });

    const startedAt = new Date().toISOString();
    const timestamp = startedAt.replace(/[:.]/g, '-');
    const recordingId = `${id}-${timestamp}-${crypto.randomUUID()}.mp4`;
    const outputPath = path.join(recDir, recordingId);
    const partialPath = `${outputPath}.partial`;

    let resolveCompletion!: (recording: CameraRecording) => void;
    let rejectCompletion!: (error: Error) => void;
    const completion = new Promise<CameraRecording>((resolve, reject) => {
      resolveCompletion = resolve;
      rejectCompletion = reject;
    });
    void completion.catch(() => undefined);

    const proc = spawn(ffmpegInstaller.path, [
      '-nostdin',
      '-hide_banner',
      '-loglevel', 'error',
      '-f', 'image2pipe',
      '-vcodec', 'mjpeg',
      '-framerate', '15',
      '-i', 'pipe:0',
      '-an',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-f', 'mp4',
      '-y', partialPath,
    ], { stdio: ['pipe', 'ignore', 'pipe'] });
    if (!proc.stdin || !proc.stderr) {
      proc.kill();
      throw new Error('Could not create the FFmpeg recording pipes.');
    }
    const input = proc.stdin;
    const errorOutput = proc.stderr;

    const session: ActiveRecording = {
      cameraId: id,
      id: recordingId,
      startedAt,
      durationSeconds,
      outputPath,
      partialPath,
      process: proc,
      input,
      frameParser: new MjpegFrameParser(),
      frameCount: 0,
      timer: setTimeout(() => {
        void this.stopRecording(id, recordingId).catch((err: unknown) => {
          log('error', id, 'Automatic recording stop failed', err);
        });
      }, durationSeconds * 1000),
      completion,
      resolve: resolveCompletion,
      reject: rejectCompletion,
      settled: false,
    };
    session.timer.unref();
    this.activeRecordings.set(id, session);

    const settleFailure = (error: Error) => {
      if (session.settled) return;
      session.settled = true;
      clearTimeout(session.timer);
      if (this.activeRecordings.get(id) === session) this.activeRecordings.delete(id);
      if (fs.existsSync(partialPath)) fs.unlinkSync(partialPath);
      log('error', id, 'Recording failed', error.message);
      session.reject(error);
      this.stopStreamIfUnused(id);
    };

    let stderrTail = '';
    errorOutput.on('data', (chunk: Buffer) => {
      stderrTail = `${stderrTail}${chunk.toString()}`.slice(-2000);
    });
    input.on('error', (err: Error) => {
      session.failure ??= `FFmpeg recording input failed: ${err.message}`;
    });
    proc.on('error', settleFailure);
    proc.on('close', (code, signal) => {
      if (session.settled) return;
      if (session.failure || code !== 0 || signal) {
        settleFailure(new Error(
          session.failure ?? `FFmpeg recording exited with code ${code ?? 'null'}${stderrTail ? `: ${stderrTail.trim()}` : ''}`,
        ));
        return;
      }

      try {
        if (session.frameCount === 0) {
          throw new Error('The camera stream produced no complete JPEG frames for this recording.');
        }
        const stats = fs.statSync(partialPath);
        const header = Buffer.alloc(12);
        const fd = fs.openSync(partialPath, 'r');
        try {
          fs.readSync(fd, header, 0, header.length, 0);
        } finally {
          fs.closeSync(fd);
        }
        if (stats.size < 1024 || header.toString('ascii', 4, 8) !== 'ftyp') {
          throw new Error('FFmpeg produced an invalid or empty MP4 recording.');
        }
        fs.renameSync(partialPath, outputPath);
        session.settled = true;
        clearTimeout(session.timer);
        if (this.activeRecordings.get(id) === session) this.activeRecordings.delete(id);
        const recording = {
          id: recordingId,
          createdAt: startedAt,
          sizeBytes: stats.size,
        };
        log('info', id, `Recording finalized: ${recordingId} (${stats.size} bytes)`);
        session.resolve(recording);
        this.stopStreamIfUnused(id);
      } catch (err: unknown) {
        settleFailure(err instanceof Error ? err : new Error(String(err)));
      }
    });

    if (!this.processes.has(id)) {
      void this.startStream(record).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        session.failure = `Could not start the shared camera stream: ${message}`;
        if (!input.writableEnded) input.end();
      });
    }

    log('info', id, `Recording started from the shared MJPEG stream: ${recordingId}`);
    return { id: recordingId, startedAt, durationSeconds };
  }

  async stopRecording(id: string, recordingId: string): Promise<CameraRecording> {
    const session = this.activeRecordings.get(id);
    if (!session || session.id !== recordingId) {
      const completedPath = this.getRecordingPath(id, recordingId);
      if (completedPath) {
        const stats = fs.statSync(completedPath);
        return {
          id: recordingId,
          createdAt: stats.birthtime.toISOString(),
          sizeBytes: stats.size,
        };
      }
      throw new Error(`No active recording ${recordingId} exists for camera ${id}.`);
    }
    if (!session.input.writableEnded) session.input.end();
    return session.completion;
  }

  async listRecordings(id: string): Promise<CameraRecording[]> {
    const record = await this.repo.findById(id);
    if (!record) throw new Error(`Camera not found: ${id}`);
    const recDir = path.resolve(__dirname, '..', 'data', 'recordings');
    if (!fs.existsSync(recDir)) return [];

    return fs.readdirSync(recDir)
      .filter((fileName) => fileName.startsWith(`${id}-`) && fileName.endsWith('.mp4'))
      .map((fileName) => {
        const recordingPath = path.join(recDir, fileName);
        const stats = fs.statSync(recordingPath);
        return {
          id: fileName,
          createdAt: stats.birthtime.toISOString(),
          sizeBytes: stats.size,
        };
      })
      .filter((recording) => recording.sizeBytes >= 1024 && this.hasMp4Signature(
        path.join(recDir, recording.id),
      ))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  getRecordingPath(cameraId: string, recordingId: string): string | null {
    if (
      path.basename(recordingId) !== recordingId ||
      !recordingId.startsWith(`${cameraId}-`) ||
      !recordingId.endsWith('.mp4')
    ) {
      return null;
    }
    const recordingPath = path.resolve(
      __dirname,
      '..',
      'data',
      'recordings',
      recordingId,
    );
    if (!fs.existsSync(recordingPath)) return null;
    const stats = fs.statSync(recordingPath);
    return stats.size >= 1024 && this.hasMp4Signature(recordingPath) ? recordingPath : null;
  }

  private hasMp4Signature(filePath: string): boolean {
    const header = Buffer.alloc(12);
    const fd = fs.openSync(filePath, 'r');
    try {
      return fs.readSync(fd, header, 0, header.length, 0) === header.length &&
        header.toString('ascii', 4, 8) === 'ftyp';
    } finally {
      fs.closeSync(fd);
    }
  }

  private stopStreamIfUnused(id: string): void {
    if (this.hasStreamConsumers(id)) return;
    this.stopStream(id);
    this.updateStatus(id, 'OFFLINE');
  }
}
