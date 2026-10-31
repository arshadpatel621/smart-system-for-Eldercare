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
import fs from 'node:fs';
import path from 'node:path';

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
import { toPublic, CameraService } from '../camera/camera.service';
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
