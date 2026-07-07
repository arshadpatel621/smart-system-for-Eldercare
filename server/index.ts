/**
 * index.ts — Elder Care Monitoring System — Backend Server
 *
 * Initializes:
 *  - Express REST API (camera CRUD, streaming, PTZ, probe, discovery)
 *  - WebSocket server (real-time camera status + AI alert push)
 *  - POST /api/events  ← AI module event receiver (Python YOLO/MediaPipe)
 *  - GET  /health      ← Health check endpoint
 */

import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

import { JsonCameraRepository } from './camera/camera.repository';
import { CameraService } from './camera/camera.service';
import { CameraController } from './camera/camera.controller';
import { createCameraRouter } from './camera/camera.routes';
import type { AIEvent } from './camera/camera.types';

// Load env vars from server/.env
dotenv.config({ path: path.resolve(__dirname, '.env') });

const PORT = process.env.PORT ?? 5000;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173').split(',');

// ── Express App ────────────────────────────────────────────────────────────
const app = express();

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (server-to-server) or listed origins
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json());

// ── Camera Module ──────────────────────────────────────────────────────────
const cameraRepo = new JsonCameraRepository();
const cameraService = new CameraService(cameraRepo);
const cameraController = new CameraController(cameraService);

app.use('/api/cameras', createCameraRouter(cameraController));

// ── AI Event Receiver ──────────────────────────────────────────────────────
/**
 * POST /api/events
 * Receives real-time AI alerts from external Python AI services.
 * Broadcasts to all connected dashboard WebSocket clients.
 *
 * Expected payload:
 *  { type: 'fall_detected', cameraId: 'xxx', confidence: 0.92, details: {} }
 */
app.post('/api/events', (req, res) => {
  const { type, cameraId, confidence, details } = req.body as Partial<AIEvent>;

  if (!type || !cameraId) {
    res.status(400).json({ error: 'Required fields: type, cameraId' });
    return;
  }

  const event: AIEvent = {
    type: type as AIEvent['type'],
    cameraId,
    timestamp: new Date().toISOString(),
    confidence: confidence ?? 1.0,
    details: details ?? {},
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
app.get('/health', async (_req, res) => {
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
  } catch (err: any) {
    console.error('[WS] Snapshot failed:', err.message);
  }

  ws.on('message', (raw: any) => {
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

// ── Startup ────────────────────────────────────────────────────────────────
server.listen(PORT, async () => {
  console.log(`\n[SERVER] ═══════════════════════════════════════════`);
  console.log(`[SERVER]  Elder Care Camera Server`);
  console.log(`[SERVER]  HTTP  → http://localhost:${PORT}`);
  console.log(`[SERVER]  WS    → ws://localhost:${PORT}`);
  console.log(`[SERVER]  CORS  → ${ALLOWED_ORIGINS.join(', ')}`);
  console.log(`[SERVER] ═══════════════════════════════════════════\n`);

  // Auto-start enabled camera streams
  await cameraService.initialize();
});
