// End-to-end verification against a real Express + WS server using a TEMP db.
import express from 'express';
import http from 'http';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire('D:/eldercare/eldercare/server/package.json');
const wsPkg = require('ws');
const WebSocketServer = wsPkg.WebSocketServer ?? wsPkg.Server;
const WebSocket = wsPkg.WebSocket ?? wsPkg;
const expressApp = (await import('express')).default ?? express;

const SERVER = 'D:/eldercare/eldercare/server/dist';
const { JsonCameraRepository } = await import(`file:///${SERVER}/camera/camera.repository.js`);
const { CameraService } = await import(`file:///${SERVER}/camera/camera.service.js`);
const { CameraController } = await import(`file:///${SERVER}/camera/camera.controller.js`);
const { createCameraRouter } = await import(`file:///${SERVER}/camera/camera.routes.js`);
const { encrypt } = await import(`file:///${SERVER}/camera/camera.crypto.js`);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-e2e-'));
const dbPath = path.join(tmp, 'cameras.json');
fs.writeFileSync(dbPath, JSON.stringify({ cameras: [{
  id: 'cam1', name: 'E2E Mock', brand: 'cpplus', location: 'living_room', ipAddress: 'mock',
  port: 5543, onvifPort: 8899, username: 'admin', passwordEncrypted: encrypt('should-not-leak'),
  enabled: true, healthStatus: 'healthy', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
}] }));

const repo = new JsonCameraRepository(dbPath);
const service = new CameraService(repo);
const controller = new CameraController(service);
const app = expressApp();
app.use(express.json());
app.use('/api/cameras', createCameraRouter(controller));
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
service.onStatusChange((s) => wss.clients.forEach((c) => { if (c.readyState === WebSocket.OPEN) c.send(JSON.stringify({ type: 'camera_status_update', data: s })); }));
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;
await service.initialize();

const wsMessages = [];
const ws = new WebSocket(`ws://127.0.0.1:${port}`);
await new Promise((r) => ws.on('open', r));
ws.on('message', (d) => wsMessages.push(JSON.parse(d.toString())));

// Persistent consumer A (keeps stream alive)
const abortA = new AbortController();
const resA = await fetch(`${base}/api/cameras/cam1/stream`, { signal: abortA.signal });
const readerA = resA.body.getReader();
let framesA = 0; let bytesA = 0;
(async () => { try { while (true) { const { value, done } = await readerA.read(); if (done) break; if (value) { bytesA += value.length; framesA += (Buffer.from(value).toString('latin1').match(/\xff\xd8/g) || []).length; } } } catch { /* */ } })();

await new Promise((r) => setTimeout(r, 2000));

// Concurrent second consumer
const abortB = new AbortController();
const resB = await fetch(`${base}/api/cameras/cam1/stream`, { signal: abortB.signal });
const readerB = resB.body.getReader();
let framesB = 0;
const readB = (async () => { try { while (true) { const { value, done } = await readerB.read(); if (done) break; if (value) framesB += (Buffer.from(value).toString('latin1').match(/\xff\xd8/g) || []).length; } } catch { /* */ } })();

await new Promise((r) => setTimeout(r, 2000));
const procs = service.processes;
const ffmpegCountWhileStreaming = procs.size;
const pidBefore = procs.get('cam1')?.pid;
const framesA_beforeKill = framesA;
const framesB_beforeKill = framesB;

// Kill child to force reconnection while consumers stay attached
procs.get('cam1')?.kill('SIGKILL');
let reconnected = false; let pidAfter = null;
const recEnd = Date.now() + 12000;
while (Date.now() < recEnd) { await new Promise((r) => setTimeout(r, 250)); if (procs.size && procs.get('cam1')?.pid !== pidBefore) { reconnected = true; pidAfter = procs.get('cam1')?.pid; break; } }
await new Promise((r) => setTimeout(r, 2000));

const statusAfter = await (await fetch(`${base}/api/cameras/cam1/status`)).json();

// PTZ while streaming
const ptzPidBefore = procs.get('cam1')?.pid;
const ptzRes = await fetch(`${base}/api/cameras/cam1/ptz`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'left', speed: 5 }) });
const ptzBody = await ptzRes.json();
const ptzPidAfter = procs.get('cam1')?.pid;

const fpsSamples = wsMessages.filter((m) => m.type === 'camera_status_update' && m.data.status === 'ONLINE').map((m) => m.data.fps);
const wsStatuses = [...new Set(wsMessages.filter((m) => m.type === 'camera_status_update').map((m) => m.data.status))];
const leakedInWs = JSON.stringify(wsMessages).includes('should-not-leak');
const leakedInStatus = JSON.stringify(statusAfter).includes('should-not-leak') || JSON.stringify(statusAfter).includes('passwordEncrypted');
const leakedInList = JSON.stringify(await (await fetch(`${base}/api/cameras`)).json()).includes('should-not-leak');

console.log(JSON.stringify({
  continuousStreaming: { httpStatus: resA.status, contentType: resA.headers.get('content-type'), bytesA, framesA, secondsObserved: 4, fpsApprox: +(framesA / 4).toFixed(2) },
  multiConsumer: { consumerA_frames: framesA_beforeKill, consumerB_frames: framesB_beforeKill, ffmpegProcessCountWhileStreaming: ffmpegCountWhileStreaming },
  reconnection: { reconnected, pidBefore, pidAfter, statusAfter: statusAfter.status, reconnectAttemptsAfter: statusAfter.reconnectAttempts, lastFrameAt: statusAfter.lastFrameAt, consumersStillReceiving: { A: framesA > framesA_beforeKill, B: framesB > framesB_beforeKill } },
  ptz: { httpStatus: ptzRes.status, body: ptzBody, streamProcessUnaffected: ptzPidBefore === ptzPidAfter },
  websocket: { messages: wsMessages.length, statusesSeen: wsStatuses, sampleFps: fpsSamples.slice(0, 6), lastFrameAtSeen: wsMessages.some((m) => m.data?.lastFrameAt), reconnectAttemptsSeen: [...new Set(wsMessages.filter((m) => m.type === 'camera_status_update').map((m) => m.data.reconnectAttempts))] },
  credentialSafety: { leakedInWs, leakedInStatus, leakedInList },
}, null, 2));

abortA.abort(); abortB.abort(); ws.close(); await service.shutdown(); server.close(); process.exit(0);
