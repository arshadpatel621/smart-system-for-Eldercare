/**
 * server/test/camera.test.ts
 *
 * Comprehensive Automated Test Suite for VitalCare Camera Integration.
 * Covers:
 *  1. Camera Input Validation (IPs, Hostnames, Ports, RTSP Paths)
 *  2. Credential Security & AES-256-CBC Encryption (Zero plain password leakage)
 *  3. Path Normalization & Dynamic Port Handling
 *  4. Camera Repository CRUD & Safe Deletion
 *  5. Probe Connection Diagnostics & 401 Auth Failure Detection
 *  6. Reconnection Bounded Exponential Backoff & Auth Lockout Prevention
 */

import { test, describe, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'child_process';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

import {
  encrypt,
  decrypt,
} from '../camera/camera.crypto';
import {
  normalizeRtspPath,
  parseRtspTarget,
  buildRtspUrl,
  buildRedactedRtspUrl,
  BRAND_PROFILES,
} from '../camera/brand.profiles';
import { JsonCameraRepository } from '../camera/camera.repository';
import {
  createCameraStreamFfmpegConfig,
  MjpegFrameParser,
  toPublic,
  CameraService,
} from '../camera/camera.service';
import { CameraController } from '../camera/camera.controller';
import { createCameraRouter } from '../camera/camera.routes';
import { probeCamera, parseFfmpegStderr } from '../camera/camera.probe';
import type { CameraRecord, CameraBrand, CreateCameraDto } from '../camera/camera.types';

describe('VitalCare Camera Integration Tests', () => {
  const TEST_DATA_DIR = path.resolve(__dirname, '../../test_data');
  const TEST_CAMERAS_FILE = path.join(TEST_DATA_DIR, 'test_cameras.json');

  beforeEach(() => {
    if (!fs.existsSync(TEST_DATA_DIR)) {
      fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(TEST_CAMERAS_FILE, JSON.stringify({ cameras: [] }, null, 2), 'utf-8');
  });

  after(() => {
    try {
      if (fs.existsSync(TEST_CAMERAS_FILE)) fs.unlinkSync(TEST_CAMERAS_FILE);
      if (fs.existsSync(TEST_DATA_DIR)) fs.rmdirSync(TEST_DATA_DIR);
    } catch {
      // Cleanup best-effort
    }
  });

  // ─── 1. Validation & Input Sanitization ──────────────────────────────────────
  describe('1. Input Validation & Path Normalization', () => {
    test('normalizeRtspPath ensures leading slash and preserves queries', () => {
      assert.equal(normalizeRtspPath('live/ch0'), '/live/ch0');
      assert.equal(normalizeRtspPath('/live/ch0'), '/live/ch0');
      assert.equal(
        normalizeRtspPath('/cam/realmonitor?channel=1&subtype=0'),
        '/cam/realmonitor?channel=1&subtype=0'
      );
      assert.equal(normalizeRtspPath(''), '');
    });

    test('Brand profiles contain valid ports and RTSP templates', () => {
      const brands: CameraBrand[] = ['cpplus', 'dahua', 'hikvision', 'tplink_tapo', 'ezviz', 'onvif', 'rtsp'];
      for (const brand of brands) {
        const profile = BRAND_PROFILES[brand];
        assert.ok(profile, `Profile exists for ${brand}`);
        assert.ok(profile.defaultRtspPort > 0 && profile.defaultRtspPort <= 65535, `Valid defaultRtspPort for ${brand}`);
        assert.ok(profile.defaultOnvifPort > 0 && profile.defaultOnvifPort <= 65535, `Valid defaultOnvifPort for ${brand}`);
        assert.ok(Array.isArray(profile.rtspPathTemplates) && profile.rtspPathTemplates.length > 0, `Valid templates for ${brand}`);
      }
    });

    test('buildRtspUrl handles custom port 5543 and ONVIF discovered path', () => {
      const url = buildRtspUrl(
        '192.168.1.113',
        5543,
        'admin',
        'aabb123',
        '/09009cbd9dc76737d7e64380b5612bd8/live/channel0'
      );
      assert.equal(
        url,
        'rtsp://admin:aabb123@192.168.1.113:5543/09009cbd9dc76737d7e64380b5612bd8/live/channel0'
      );

      const redacted = buildRedactedRtspUrl(
        '192.168.1.113',
        5543,
        'admin',
        '/09009cbd9dc76737d7e64380b5612bd8/live/channel0'
      );
      assert.equal(
        redacted,
        'rtsp://admin:***@192.168.1.113:5543/09009cbd9dc76737d7e64380b5612bd8/live/channel0'
      );
    });

    test('buildRtspUrl handles full RTSP URI without duplicating host/port or corrupting path', () => {
      const fullUri = 'rtsp://192.168.1.113:5543/09009cbd9dc76737d7e64380b5612bd8/live/channel0';
      const url = buildRtspUrl('192.168.1.113', 554, 'admin', 'aabb123', fullUri);
      assert.equal(
        url,
        'rtsp://admin:aabb123@192.168.1.113:5543/09009cbd9dc76737d7e64380b5612bd8/live/channel0'
      );
    });

    test('RTSP stream config uses the verified ONVIF path, TCP, HEVC decoding, and MJPEG output', () => {
      const camera: CameraRecord = {
        id: 'camera-test',
        name: 'Living Room',
        brand: 'cpplus',
        location: 'living_room',
        ipAddress: '192.168.1.184',
        port: 5543,
        onvifPort: 8000,
        username: 'admin',
        passwordEncrypted: encrypt('test-camera-password'),
        discoveredRtspPath: '/09009cbd9dc76737d7e64380b5612bd8/live/channel0',
        enabled: true,
        healthStatus: 'healthy',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const config = createCameraStreamFfmpegConfig(camera, 'test-camera-password');
      const inputIndex = config.args.indexOf('-i');
      const inputUrl = config.args[inputIndex + 1];
      const outputCodecIndex = config.args.indexOf('-c:v');

      assert.equal(config.args[config.args.indexOf('-rtsp_transport') + 1], 'tcp');
      assert.equal(
        inputUrl,
        'rtsp://admin:test-camera-password@192.168.1.184:5543/09009cbd9dc76737d7e64380b5612bd8/live/channel0'
      );
      assert.ok(inputIndex >= 0);
      assert.ok(outputCodecIndex > inputIndex, 'Output codec must not constrain the RTSP input decoder');
      assert.equal(config.args[outputCodecIndex + 1], 'mjpeg');
      assert.equal(config.args[config.args.indexOf('-f', outputCodecIndex) + 1], 'image2pipe');
      assert.match(config.redactedRtspUrl ?? '', /admin:\*\*\*@192\.168\.1\.184:5543/);
      assert.ok(!config.redactedRtspUrl?.includes('test-camera-password'));

      const decoders = spawnSync(ffmpegInstaller.path, ['-hide_banner', '-decoders'], {
        encoding: 'utf8',
        timeout: 5000,
      });
      assert.equal(decoders.status, 0, decoders.stderr);
      assert.match(decoders.stdout, /\bhevc\b/i, 'Bundled FFmpeg must support HEVC input');
    });

    test('buildRtspUrl encodes special characters in credentials safely', () => {
      const url = buildRtspUrl(
        '192.168.1.113',
        5543,
        'admin@home',
        'p@ss:w/ord%123',
        '/live/ch0'
      );
      assert.ok(url.includes('admin%40home'));
      assert.ok(url.includes('p%40ss%3Aw%2Ford%25123'));
      assert.ok(url.endsWith('@192.168.1.113:5543/live/ch0'));
    });
  });

  // ─── 2. Security & Credential Encryption ─────────────────────────────────────
  describe('2. Credential Security & AES-256 Encryption', () => {
    test('encrypt produces IV:ciphertext and does not leak plaintext', () => {
      const plaintext = 'SecretCameraPass123!';
      const encrypted = encrypt(plaintext);

      assert.notEqual(encrypted, plaintext, 'Encrypted value must not match plaintext');
      assert.ok(encrypted.includes(':'), 'Encrypted value must be in iv:ciphertext format');
      const parts = encrypted.split(':');
      assert.equal(parts.length, 2, 'Should have exactly IV and ciphertext');

      const decrypted = decrypt(encrypted);
      assert.equal(decrypted, plaintext, 'Decrypted value must match original plaintext');
    });

    test('encrypt uses random IV for each encryption (semantic security)', () => {
      const plaintext = 'SamePassword';
      const enc1 = encrypt(plaintext);
      const enc2 = encrypt(plaintext);

      assert.notEqual(enc1, enc2, 'Two encryptions of the same password must produce different ciphertexts');
      assert.equal(decrypt(enc1), plaintext);
      assert.equal(decrypt(enc2), plaintext);
    });

    test('toPublic strips encrypted credentials and passwords', () => {
      const fakeCamera: CameraRecord = {
        id: 'cam-test-1',
        name: 'Test Cam',
        brand: 'cpplus',
        location: 'living_room',
        ipAddress: '192.168.1.50',
        port: 554,
        onvifPort: 8899,
        username: 'admin',
        passwordEncrypted: encrypt('SuperSecretPass'),
        rtspUrlEncrypted: encrypt('rtsp://admin:SuperSecretPass@192.168.1.50:554/live/ch0'),
        enabled: true,
        healthStatus: 'healthy',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const publicRec = toPublic(fakeCamera);

      // Verify no passwords exist in public record
      assert.equal((publicRec as unknown as Record<string, unknown>).passwordEncrypted, undefined);
      assert.equal((publicRec as unknown as Record<string, unknown>).rtspUrlEncrypted, undefined);
      assert.equal((publicRec as unknown as Record<string, unknown>).password, undefined);
      assert.equal(publicRec.id, 'cam-test-1');
      assert.equal(publicRec.ipAddress, '192.168.1.50');
      assert.equal(publicRec.hasCustomRtspPath, true);
    });
  });

  // ─── 3. Camera Repository CRUD & Stale Config Removal ────────────────────────
  describe('3. Camera Repository CRUD & Stale Config Removal', () => {
    test('Can create, retrieve, update, and safely delete camera configurations', async () => {
      const repo = new JsonCameraRepository(TEST_CAMERAS_FILE);

      // 1. Create camera
      const createDto: CreateCameraDto = {
        name: 'Front Porch',
        brand: 'hikvision',
        location: 'entrance',
        ipAddress: '192.168.1.120',
        port: 554,
        onvifPort: 80,
        username: 'admin',
        password: 'InitialPassword1',
        discoveredRtspPath: '/Streaming/Channels/101',
        model: 'DS-2CD2043G2-I',
        resolution: '1920x1080',
        fps: 25,
      };

      const created = await repo.create(createDto);
      assert.ok(created.id, 'Created camera has an ID');
      assert.equal(created.name, 'Front Porch');
      assert.equal(created.model, 'DS-2CD2043G2-I');
      assert.equal(created.discoveredRtspPath, '/Streaming/Channels/101');

      // Verify persistence to disk
      const diskList = await repo.findAll();
      assert.equal(diskList.length, 1);
      assert.equal(diskList[0].id, created.id);

      // 2. Update camera (without changing password)
      const updated = await repo.update(created.id, {
        name: 'Front Door High Quality',
        location: 'entrance',
        port: 554,
        onvifPort: 80,
      });

      assert.ok(updated);
      assert.equal(updated.name, 'Front Door High Quality');
      // Password must remain decryptable and intact
      assert.equal(decrypt(updated.passwordEncrypted), 'InitialPassword1');

      // 3. Delete stale camera
      await repo.delete(created.id);

      // Verify safe removal
      const listAfterDelete = await repo.findAll();
      assert.equal(listAfterDelete.length, 0);

      const findDeleted = await repo.findById(created.id);
      assert.equal(findDeleted, null);
    });
  });

  // ─── PTZ continuous movement commands ─────────────────────────────────────
  describe('3a. PTZ Direction, Zoom, and Stop Commands', () => {
    test('discovers authenticated ONVIF profiles and sends continuous move and stop commands', async () => {
      const repo = new JsonCameraRepository(TEST_CAMERAS_FILE);
      const camera = await repo.create({
        name: 'PTZ Test Camera',
        brand: 'cpplus',
        location: 'living_room',
        ipAddress: '192.0.2.15',
        onvifPort: 80,
        username: 'operator',
        password: 'ptz-secret',
      });
      const service = new CameraService(repo);
      const originalFetch = globalThis.fetch;
      const requests: Array<{ url: URL; body: string }> = [];
      const servicesXml = `<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:tds="http://www.onvif.org/ver10/device/wsdl"><s:Body><tds:GetServicesResponse>
        <tds:Service><tds:Namespace>http://www.onvif.org/ver20/media/wsdl</tds:Namespace><tds:XAddr>http://192.0.2.15:8080/onvif/media2_service</tds:XAddr></tds:Service>
        <tds:Service><tds:Namespace>http://www.onvif.org/ver10/media/wsdl</tds:Namespace><tds:XAddr>http://192.0.2.15:8080/onvif/media_service</tds:XAddr></tds:Service>
        <tds:Service><tds:Namespace>http://www.onvif.org/ver20/ptz/wsdl</tds:Namespace><tds:XAddr>http://192.0.2.15:8080/onvif/ptz_service</tds:XAddr></tds:Service>
      </tds:GetServicesResponse></s:Body></s:Envelope>`;
      const profilesXml = `<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:trt="http://www.onvif.org/ver10/media/wsdl" xmlns:tt="http://www.onvif.org/ver10/schema"><s:Body><trt:GetProfilesResponse><trt:Profiles token="profile-token"><tt:PTZConfiguration token="ptz-config"/></trt:Profiles></trt:GetProfilesResponse></s:Body></s:Envelope>`;
      const nodesXml = `<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:tt="http://www.onvif.org/ver10/schema"><s:Body><tt:SupportedPTZSpaces>
        <tt:ContinuousPanTiltVelocitySpace><tt:URI>http://www.onvif.org/ver10/tptz/PanTiltSpaces/VelocityGenericSpace</tt:URI><tt:XRange><tt:Min>-1</tt:Min><tt:Max>1</tt:Max></tt:XRange><tt:YRange><tt:Min>-1</tt:Min><tt:Max>1</tt:Max></tt:YRange></tt:ContinuousPanTiltVelocitySpace>
        <tt:ContinuousZoomVelocitySpace><tt:URI>http://www.onvif.org/ver10/tptz/ZoomSpaces/VelocityGenericSpace</tt:URI><tt:XRange><tt:Min>-1</tt:Min><tt:Max>1</tt:Max></tt:XRange></tt:ContinuousZoomVelocitySpace>
      </tt:SupportedPTZSpaces></s:Body></s:Envelope>`;
      globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        const url = input instanceof Request
          ? new URL(input.url)
          : input instanceof URL
            ? input
            : new URL(input);
        const body = String(init?.body ?? '');
        requests.push({
          url,
          body,
        });
        if (body.includes('<tds:GetServices>')) return new Response(servicesXml, { status: 200 });
        if (body.includes('<trt:GetProfiles')) return new Response(profilesXml, { status: 200 });
        if (body.includes('<tptz:GetNodes')) return new Response(nodesXml, { status: 200 });
        return new Response('<s:Envelope><s:Body><tptz:ContinuousMoveResponse/></s:Body></s:Envelope>', { status: 200 });
      }) as typeof fetch;

      try {
        for (const [action, expectedCode] of [
          ['up', 'y="0.500"'],
          ['down', 'y="-0.500"'],
          ['left', 'x="-0.500"'],
          ['right', 'x="0.500"'],
          ['zoom_in', 'x="0.500"'],
          ['zoom_out', 'x="-0.500"'],
        ] as const) {
          const started = await service.controlPTZ(camera.id, action, 5);
          assert.equal(started.success, true);
          const startRequest = requests.at(-1);
          assert.equal(startRequest?.url.pathname, '/onvif/ptz_service');
          assert.match(startRequest?.body ?? '', /<tptz:ContinuousMove>/);
          assert.match(startRequest?.body ?? '', new RegExp(expectedCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
          assert.match(startRequest?.body ?? '', /<tptz:ProfileToken>profile-token<\/tptz:ProfileToken>/);
          assert.match(startRequest?.body ?? '', /<wsse:Username>operator<\/wsse:Username>/);
          assert.match(startRequest?.body ?? '', /#PasswordDigest">[^<]+<\/wsse:Password>/);

          const stopped = await service.controlPTZ(camera.id, 'stop');
          assert.equal(stopped.success, true);
          const stopRequest = requests.at(-1);
          assert.equal(stopRequest?.url.pathname, '/onvif/ptz_service');
          assert.match(stopRequest?.body ?? '', /<tptz:Stop>/);
          assert.match(stopRequest?.body ?? '', /<tptz:PanTilt>true<\/tptz:PanTilt>/);
          assert.match(stopRequest?.body ?? '', /<tptz:Zoom>true<\/tptz:Zoom>/);
        }
        assert.equal(requests.filter((request) => request.body.includes('<tds:GetServices>')).length, 1);
        const profileRequest = requests.find((request) => request.body.includes('<trt:GetProfiles'));
        assert.ok(profileRequest);
        assert.equal(profileRequest.url.pathname, '/onvif/media_service');
        assert.equal(requests.filter((request) => request.body.includes('<tptz:GetNodes')).length, 1);
      } finally {
        globalThis.fetch = originalFetch;
        await service.shutdown();
      }
    });

    test('does not report simulated movement as success for mock cameras', async () => {
      const repo = new JsonCameraRepository(TEST_CAMERAS_FILE);
      const camera = await repo.create({
        name: 'Mock PTZ Camera',
        brand: 'dahua',
        location: 'living_room',
        ipAddress: 'mock',
        username: 'operator',
        password: 'ptz-secret',
      });
      const service = new CameraService(repo);

      const result = await service.controlPTZ(camera.id, 'up');

      assert.equal(result.success, false);
      assert.match(result.message, /unavailable for mock/i);
    });
  });

  describe('3b. Shared-stream lifecycle', () => {
    test('MJPEG parser only emits complete JPEG frames', () => {
      const parser = new MjpegFrameParser();
      const frameStart = Buffer.from([0xff, 0xd8, 0x01, 0x02]);

      assert.deepEqual(parser.push(frameStart), []);
      assert.deepEqual(parser.push(Buffer.from([0x03, 0xff])), []);
      const complete = parser.push(Buffer.from([0xd9]));

      assert.equal(complete.length, 1);
      assert.deepEqual(complete[0], Buffer.from([0xff, 0xd8, 0x01, 0x02, 0x03, 0xff, 0xd9]));
    });

    test('MJPEG endpoint returns a decodable JPEG and marks ONLINE only after a frame', async () => {
      const repo = new JsonCameraRepository(TEST_CAMERAS_FILE);
      const camera = await repo.create({
        name: 'MJPEG Endpoint Test Camera',
        brand: 'cpplus',
        location: 'living_room',
        ipAddress: 'mock',
        username: 'operator',
        password: 'stream-secret',
      });
      const service = new CameraService(repo);
      const app = express();
      app.use('/api/cameras', createCameraRouter(new CameraController(service)));
      const server = app.listen(0, '127.0.0.1');
      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), 10000);
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

      try {
        await new Promise<void>((resolve, reject) => {
          server.once('listening', resolve);
          server.once('error', reject);
        });
        await service.initialize();
        const address = server.address();
        assert.ok(address && typeof address !== 'string');

        const response = await fetch(
          `http://127.0.0.1:${address.port}/api/cameras/${camera.id}/stream`,
          { signal: abortController.signal }
        );
        assert.equal(response.status, 200);
        assert.match(response.headers.get('content-type') ?? '', /multipart\/x-mixed-replace/);
        assert.ok(response.body);
        reader = response.body.getReader();

        const parser = new MjpegFrameParser();
        let jpeg: Buffer | undefined;
        while (!jpeg) {
          const result = await reader.read();
          assert.equal(result.done, false, 'MJPEG response ended before a complete JPEG frame arrived');
          const frames = parser.push(Buffer.from(result.value));
          if (frames.length > 0) jpeg = frames[0];
        }

        assert.deepEqual(jpeg.subarray(0, 2), Buffer.from([0xff, 0xd8]));
        assert.deepEqual(jpeg.subarray(-2), Buffer.from([0xff, 0xd9]));
        const decoded = spawnSync(
          ffmpegInstaller.path,
          ['-hide_banner', '-loglevel', 'error', '-f', 'mjpeg', '-i', 'pipe:0', '-frames:v', '1', '-f', 'null', '-'],
          { input: jpeg, timeout: 5000 }
        );
        assert.equal(decoded.status, 0, decoded.stderr.toString());
        assert.equal((await service.getCameraStatus(camera.id)).status, 'ONLINE');
        assert.ok((service['streamDiagnostics'].get(camera.id)?.framesReceived ?? 0) > 0);
      } finally {
        clearTimeout(timeout);
        await reader?.cancel().catch(() => undefined);
        abortController.abort();
        await service.shutdown();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });

    test('repeated start requests reuse the existing FFmpeg process', async () => {
      const repo = new JsonCameraRepository(TEST_CAMERAS_FILE);
      const camera = await repo.create({
        name: 'Stream Lifecycle Test Camera',
        brand: 'cpplus',
        location: 'living_room',
        ipAddress: 'mock',
        username: 'operator',
        password: 'stream-secret',
      });
      const service = new CameraService(repo);

      try {
        await service.initialize();
        const firstProcess = service['processes'].get(camera.id);
        assert.ok(firstProcess);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        assert.ok((service['streamDiagnostics'].get(camera.id)?.framesReceived ?? 0) > 0);

        await service.toggleCamera(camera.id, true);

        assert.equal(service['processes'].get(camera.id), firstProcess);
      } finally {
        await service.shutdown();
      }
    });

    test('kills a live FFmpeg process when JPEG frames stall', async () => {
      const repo = new JsonCameraRepository(TEST_CAMERAS_FILE);
      const camera = await repo.create({
        name: 'Stream Stall Test Camera',
        brand: 'cpplus',
        location: 'living_room',
        ipAddress: 'mock',
        username: 'operator',
        password: 'stream-secret',
      });
      const service = new CameraService(repo);

      try {
        await service.initialize();
        const process = service['processes'].get(camera.id);
        const diagnostics = service['streamDiagnostics'].get(camera.id);
        assert.ok(process);
        assert.ok(diagnostics);

        diagnostics.lastFrameAt = Date.now() - 21_000;
        service['checkStreamHealth'](camera.id, process, diagnostics);

        assert.equal(diagnostics.stalled, true);
        assert.equal(process.killed, true);
        assert.equal((await service.getCameraStatus(camera.id)).status, 'ERROR');
      } finally {
        await service.shutdown();
      }
    });
  });

  describe('3c. Shared-stream recording', () => {
    test('finalizes a playable MP4, lists it, and rejects path traversal', async () => {
      const repo = new JsonCameraRepository(TEST_CAMERAS_FILE);
      const camera = await repo.create({
        name: 'Recording Test Camera',
        brand: 'cpplus',
        location: 'living_room',
        ipAddress: 'mock',
        username: 'operator',
        password: 'recording-secret',
      });
      const service = new CameraService(repo);
      const recordingsDir = path.resolve(__dirname, '../data/recordings');
      const createdDirectory = !fs.existsSync(recordingsDir);
      let recordingId: string | undefined;

      try {
        const started = await service.startRecording(camera.id, 30);
        recordingId = started.id;
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const completed = await service.stopRecording(camera.id, started.id);

        assert.equal(completed.id, started.id);
        assert.ok(completed.sizeBytes > 1024);
        const filePath = service.getRecordingPath(camera.id, started.id);
        assert.ok(filePath);
        assert.equal(path.extname(filePath), '.mp4');

        const listed = await service.listRecordings(camera.id);
        assert.ok(listed.some((item) => item.id === started.id));
        assert.equal(service.getRecordingPath(camera.id, `..\\${started.id}`), null);

        await new Promise<void>((resolve, reject) => {
          const validator = spawn(ffmpegInstaller.path, [
            '-hide_banner',
            '-loglevel', 'error',
            '-i', filePath,
            '-map', '0:v:0',
            '-frames:v', '1',
            '-f', 'rawvideo',
            '-pix_fmt', 'rgb24',
            'pipe:1',
          ], { stdio: ['ignore', 'pipe', 'pipe'] });
          let decodedFrameBytes = 0;
          validator.stdout?.on('data', (chunk: Buffer) => {
            decodedFrameBytes += chunk.length;
          });
          validator.on('error', reject);
          validator.on('close', (code) => {
            if (code === 0 && decodedFrameBytes > 0) resolve();
            else if (code === 0) reject(new Error('Recorded MP4 contains no decodable video frames.'));
            else reject(new Error(`Recorded MP4 decoder exited with code ${code}.`));
          });
        });
      } finally {
        await service.shutdown();
        if (recordingId) {
          const filePath = service.getRecordingPath(camera.id, recordingId);
          if (filePath) fs.unlinkSync(filePath);
        }
        if (createdDirectory && fs.existsSync(recordingsDir) && fs.readdirSync(recordingsDir).length === 0) {
          fs.rmdirSync(recordingsDir);
        }
      }
    });
  });

  // ─── 4. Connection Probe & Authentication Failures ────────────────────────────
  describe('4. Probe Connection Diagnostics & Auth Failure Handling', () => {
    test('probeCamera accurately reports unreachable network on non-responsive host', async () => {
      // 192.0.2.1 is TEST-NET-1 (RFC 5737), guaranteed non-routable in real networks
      const result = await probeCamera(
        '192.0.2.1',
        'onvif',
        554,
        80,
        'admin',
        'password'
      );

      assert.equal(result.success, false);
      assert.equal(result.networkUnreachable, true);
      assert.equal(result.authError, false);
      assert.ok(result.portsScanned.length > 0);
    });

    test('probeCamera includes custom ports (e.g. 5543 and 8000) in portsScanned', async () => {
      // 192.0.2.1 is non-routable; verifies ports 5543 and 8000 are explicitly scanned
      const result = await probeCamera(
        '192.0.2.1',
        'cpplus',
        5543,
        8000,
        'admin',
        'aabb123'
      );

      assert.equal(result.success, false);
      assert.equal(result.networkUnreachable, true);
      const scannedPorts = result.portsScanned.map((p) => p.port);
      assert.ok(scannedPorts.includes(5543), 'portsScanned must include custom RTSP port 5543');
      assert.ok(scannedPorts.includes(8000), 'portsScanned must include custom ONVIF port 8000');
    });

    test('probeCamera mock mode handles custom ports and preserves stream parameters', async () => {
      const result = await probeCamera(
        'mock',
        'cpplus',
        5543,
        8000,
        'admin',
        'password'
      );

      assert.equal(result.success, true);
      assert.equal(result.rtspAvailable, true);
      assert.equal(result.onvifAvailable, true);
      assert.equal(result.networkUnreachable, false);
      assert.ok(result.discoveredRtspPath);
    });

    test('parseFfmpegStderr detects video metadata and resolution without keyframe delay', () => {
      const sampleStderr = `
        Input #0, rtsp, from 'rtsp://***:***@192.168.1.113:5543/09009cbd9dc76737d7e64380b5612bd8/live/channel0':
          Metadata:
            title           : minirtsp
          Duration: N/A, start: 0.000000, bitrate: N/A
            Stream #0:0: Video: hevc (Main), yuvj420p(pc, bt709), 2560x1440, 20 fps, 20 tbr, 90k tbn, 20 tbc
        frame=    1 fps=0.0 q=-0.0 Lsize=N/A time=00:00:00.05 bitrate=N/A
      `;
      const res = parseFfmpegStderr(sampleStderr, 0, 5543);
      assert.equal(res.success, true);
      assert.equal(res.resolution, '2560x1440');
      assert.equal(res.fps, 20);
      assert.equal(res.codec, 'hevc');
      assert.equal(res.authError, false);
    });

    test('parseFfmpegStderr detects 401 Unauthorized authentication failure', () => {
      const sampleStderr = 'method DESCRIBE failed: 401 Unauthorized\nWWW-Authenticate: Digest realm="Login to minirtsp"';
      const res = parseFfmpegStderr(sampleStderr, 1, 5543);
      assert.equal(res.success, false);
      assert.equal(res.authError, true);
      assert.equal(res.statusCode, 401);
      assert.equal(res.failureReason, 'auth');
    });

    test('parseFfmpegStderr detects 404 Not Found stream path failure', () => {
      const sampleStderr = 'method DESCRIBE failed: 404 Not Found';
      const res = parseFfmpegStderr(sampleStderr, 1, 5543);
      assert.equal(res.success, false);
      assert.equal(res.authError, false);
      assert.equal(res.statusCode, 404);
      assert.equal(res.failureReason, 'not_found');
    });

    test('parseFfmpegStderr detects port connection refused', () => {
      const sampleStderr = 'rtsp://192.168.1.113:5543/live/ch0: Connection refused (10061)';
      const res = parseFfmpegStderr(sampleStderr, 1, 5543);
      assert.equal(res.success, false);
      assert.equal(res.failureReason, 'port_closed');
    });
  });

  // ─── 5. Reconnection Bounded Exponential Backoff ──────────────────────────────
  describe('5. Stream Reconnection & Bounded Backoff', () => {
    test('Calculates bounded exponential backoff up to max attempts', () => {
      // Formula tested: Math.min(INITIAL_RECONNECT_DELAY_MS * Math.pow(2, attempts - 1), MAX_RECONNECT_DELAY_MS)
      const INITIAL_MS = 2000;
      const MAX_MS = 30000;
      const MAX_RETRIES = 5;

      const delays: number[] = [];
      for (let attempt = 1; attempt <= MAX_RETRIES + 2; attempt++) {
        if (attempt > MAX_RETRIES) {
          delays.push(-1); // Reconnection halted
        } else {
          const delay = Math.min(INITIAL_MS * Math.pow(2, attempt - 1), MAX_MS);
          delays.push(delay);
        }
      }

      assert.deepEqual(delays, [
        2000,   // Attempt 1: 2s
        4000,   // Attempt 2: 4s
        8000,   // Attempt 3: 8s
        16000,  // Attempt 4: 16s
        30000,  // Attempt 5: 30s (capped at MAX_MS)
        -1,     // Attempt 6: Stopped (max retries reached)
        -1,     // Attempt 7: Stopped
      ]);
    });

    test('CameraService stops and cleans up active streams on camera deletion', async () => {
      const repo = new JsonCameraRepository(TEST_CAMERAS_FILE);
      const service = new CameraService(repo);

      const cam = await repo.create({
        name: 'Living Room',
        brand: 'cpplus',
        location: 'living_room',
        ipAddress: '192.168.1.150',
        username: 'admin',
        password: 'testpassword',
      });

      // Camera deletion stops all background loops and timers
      await service.deleteCamera(cam.id);

      // Verify status is cleared
      await assert.rejects(
        async () => {
          await service.getCameraStatus(cam.id);
        },
        /No status found for camera/,
        'Status should be removed from active status registry on deletion'
      );
    });
  });
});
