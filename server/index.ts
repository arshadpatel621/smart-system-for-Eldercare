/**
 * index.ts — Elder Care Monitoring System — Backend Server
 *
 * Initializes:
 *  - Express REST API (camera CRUD, streaming, PTZ, probe, discovery)
 *  - WebSocket server (real-time camera status + AI alert push)
 *  - POST /api/events  ← AI module event receiver (Python YOLO/MediaPipe)
 *  - GET  /health      ← Health check endpoint
 */

import express, { Request, Response } from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

import { JsonCameraRepository } from './camera/camera.repository';
import { CameraService } from './camera/camera.service';
import { CameraController } from './camera/camera.controller';
import { verifyEncryptionConfig, verifyInternalSecret } from './camera/camera.crypto';
import { createCameraRouter } from './camera/camera.routes';
import type { AIEvent, AIEventType } from './camera/camera.types';

// ── Watch Module ────────────────────────────────────────────────────────────
import { JsonWatchRepository } from './watch/watch.repository';
import { WatchService } from './watch/watch.service';
import { WatchController } from './watch/watch.controller';
import { createWatchRouter } from './watch/watch.routes';

// Load env vars from server/.env and root .env
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const PORT = process.env.PORT ?? 5000;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173').split(',');

// ── Express App ────────────────────────────────────────────────────────────
const app = express();

const isAllowedOrigin = (origin: string): boolean => {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
};

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (server-to-server) or valid localhost/whitelisted origins
    if (!origin || isAllowedOrigin(origin)) return cb(null, true);
    cb(null, false);
  },
  credentials: true,
}));
app.use(express.json());

// ── Camera Module ──────────────────────────────────────────────────────────
const cameraRepo = new JsonCameraRepository();
const cameraService = new CameraService(cameraRepo);
const cameraController = new CameraController(cameraService);

app.use('/api/cameras', createCameraRouter(cameraController));

// ── Watch Module ────────────────────────────────────────────────────────────
const watchRepo = new JsonWatchRepository();
const watchService = new WatchService(watchRepo);
const watchController = new WatchController(watchService);

app.use('/api/watches', createWatchRouter(watchController));

const ALLOWED_AI_EVENT_TYPES: AIEventType[] = [
  'fall_detected',
  'inactivity_detected',
  'person_detected',
  'face_recognized',
  'smoke_detected',
  'intrusion_detected',
];

// ── AI Event Receiver ──────────────────────────────────────────────────────
/**
 * POST /api/events
 * Receives real-time AI alerts from external Python AI services.
 * Validates payload, checks internal authorization token, and broadcasts to dashboard WebSockets.
 *
 * Expected payload:
 *  { type: 'person_detected', cameraId: 'xxx', confidence: 0.92, details: {} }
 */
app.post('/api/events', (req: Request, res: Response) => {
  const internalHeader = req.headers['x-internal-secret'] || req.headers['authorization'];
  if (!verifyInternalSecret(internalHeader)) {
    res.status(401).json({ error: 'Unauthorized: valid internal service key required' });
    return;
  }

  const { type, cameraId, confidence, details } = req.body as Partial<AIEvent>;

  if (!type || typeof type !== 'string' || !ALLOWED_AI_EVENT_TYPES.includes(type as AIEventType)) {
    res.status(400).json({
      error: `Invalid or missing field "type". Allowed: ${ALLOWED_AI_EVENT_TYPES.join(', ')}`,
    });
    return;
  }

  if (!cameraId || typeof cameraId !== 'string' || !cameraId.trim()) {
    res.status(400).json({ error: 'Field "cameraId" must be a non-empty string' });
    return;
  }

  let conf = 1.0;
  if (confidence !== undefined) {
    const parsedConf = Number(confidence);
    if (isNaN(parsedConf) || parsedConf < 0 || parsedConf > 1) {
      res.status(400).json({ error: 'Field "confidence" must be a number between 0.0 and 1.0' });
      return;
    }
    conf = parsedConf;
  }

  const safeDetails =
    details && typeof details === 'object' && !Array.isArray(details)
      ? (details as Record<string, unknown>)
      : {};

  const event: AIEvent = {
    type: type as AIEventType,
    cameraId: cameraId.trim(),
    timestamp: new Date().toISOString(),
    confidence: conf,
    details: safeDetails,
  };

  console.log(`[AI EVENT] ${event.type} on camera ${event.cameraId} (confidence: ${event.confidence})`);

  // Broadcast to all connected dashboard clients
  let sent = 0;
  wss.clients.forEach((client: WebSocket) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'ai_alert', data: event }));
      sent++;
    }
  });

  res.json({ success: true, broadcastedTo: sent, timestamp: event.timestamp });
});

// ── Health Check ───────────────────────────────────────────────────────────
app.get('/health', async (_req: Request, res: Response) => {
  const cameras = await cameraService.getCameras();
  const statuses = await cameraService.getAllStatuses();
  res.json({
    status: 'ONLINE',
    time: new Date().toISOString(),
    cameras: { total: cameras.length, enabled: cameras.filter((c) => c.enabled).length },
    streams: { online: statuses.filter((s) => s.status === 'ONLINE').length },
  });
});

// ── HTTP + WebSocket Server ────────────────────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', async (ws: WebSocket) => {
  console.log('[WS] Dashboard client connected');

  // Send initial snapshot
  try {
    const statuses = await cameraService.getAllStatuses();
    ws.send(JSON.stringify({ type: 'camera_statuses', data: statuses }));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[WS] Snapshot failed:', msg);
  }

  ws.on('message', (raw: Buffer | string) => {
    try {
      const msg = JSON.parse(raw.toString());
      console.log('[WS] Client message:', msg);
    } catch { /* ignore malformed messages */ }
  });

  ws.on('close', () => console.log('[WS] Dashboard client disconnected'));
  ws.on('error', (err) => console.error('[WS] Error:', err.message));
});

// Forward CameraService status changes to WebSocket clients
cameraService.onStatusChange((status) => {
  const payload = JSON.stringify({ type: 'camera_status_update', data: status });
  wss.clients.forEach((client: WebSocket) => {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  });
});

// ── Startup & Shutdown ──────────────────────────────────────────────────────
server.listen(PORT, async () => {
  // 1. Verify encryption keys match the database
  verifyEncryptionConfig();

  // 2. Initialize camera streams
  await cameraService.initialize();

  console.log(`\n[SERVER] ═══════════════════════════════════════════`);
  console.log(`[SERVER]  Elder Care Camera Server`);
  console.log(`[SERVER]  HTTP  → http://localhost:${PORT}`);
  console.log(`[SERVER]  WS    → ws://localhost:${PORT}`);
  console.log(`[SERVER]  CORS  → ${ALLOWED_ORIGINS.join(', ')}`);
  console.log(`[SERVER] ═══════════════════════════════════════════\n`);
});

let isShuttingDown = false;
const shutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n[SERVER] Received ${signal}, shutting down gracefully...`);
  
  await cameraService.shutdown();
  
  server.close(() => {
    console.log('[SERVER] HTTP server closed.');
    process.exit(0);
  });
  
  // Force exit if taking too long
  setTimeout(() => {
    console.error('[SERVER] Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 3000);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGUSR2', () => shutdown('SIGUSR2')); // ts-node-dev / nodemon
