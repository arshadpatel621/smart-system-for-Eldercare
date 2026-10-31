/**
 * camera-agent/verify_phase2_integration.mjs
 * End-to-end integration test for Phase 2:
 * 1. Verifies /health endpoint
 * 2. Verifies /api/cameras/:id/ai-consumer security & credential isolation
 * 3. Verifies /api/events authentication & payload validation
 * 4. Verifies WebSocket delivery of synthetic person_detected event
 */

import WebSocket from '../server/node_modules/ws/index.js';

const BASE_URL = 'http://localhost:5000';
const WS_URL = 'ws://localhost:5000';
const INTERNAL_SECRET = 'vitalcare-internal-ai-service-token-32c!';

async function runTests() {
  console.log('═════════════════════════════════════════════════════════════');
  console.log(' Phase 2 Integration & Security Verification Suite');
  console.log('═════════════════════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(` [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // ── Step 1: Health Check ───────────────────────────────────────────────────
  console.log('── Step 1: Backend Health Check ──');
  const healthRes = await fetch(`${BASE_URL}/health`);
  assert(healthRes.status === 200, `Health check returned HTTP ${healthRes.status}`);
  const healthData = await healthRes.json();
  assert(healthData.status === 'ONLINE', `Health status is ONLINE (got ${healthData.status})`);
  console.log(`  Health snapshot: ${JSON.stringify(healthData)}`);

  // ── Step 2: Camera Discovery ───────────────────────────────────────────────
  console.log('\n── Step 2: Camera Discovery ──');
  const camerasRes = await fetch(`${BASE_URL}/api/cameras`);
  assert(camerasRes.status === 200, 'GET /api/cameras succeeded');
  const cameras = await camerasRes.json();
  assert(cameras.length > 0, `Found ${cameras.length} camera(s) in repository`);
  const targetCamera = cameras[0];
  const cameraId = targetCamera.id;
  console.log(`  Target camera: ${targetCamera.name} (ID: ${cameraId})`);

  // ── Step 3: Endpoint Security for /ai-consumer ─────────────────────────────
  console.log('\n── Step 3: Verify /api/cameras/:id/ai-consumer Authentication & Credential Isolation ──');

  // 3a. Unauthenticated request (no secret)
  const unauthRes = await fetch(`${BASE_URL}/api/cameras/${cameraId}/ai-consumer`);
  assert(unauthRes.status === 200, 'Unauthenticated /ai-consumer returns 200 with public streamEndpoint');
  const unauthData = await unauthRes.json();
  assert(!unauthData.directRtspUrl, 'Unauthenticated request DOES NOT receive directRtspUrl credentials');
  assert(!!unauthData.streamEndpoint, 'Unauthenticated request receives safe streamEndpoint proxy');

  // 3b. Unauthorized request (invalid secret)
  const wrongSecretRes = await fetch(`${BASE_URL}/api/cameras/${cameraId}/ai-consumer`, {
    headers: { 'X-Internal-Secret': 'wrong-unauthorized-secret' },
  });
  assert(wrongSecretRes.status === 200, 'Request with invalid secret returns 200');
  const wrongSecretData = await wrongSecretRes.json();
  assert(!wrongSecretData.directRtspUrl, 'Request with invalid secret DOES NOT receive directRtspUrl credentials');

  // 3c. Authorized request (valid secret)
  const authRes = await fetch(`${BASE_URL}/api/cameras/${cameraId}/ai-consumer`, {
    headers: { 'X-Internal-Secret': INTERNAL_SECRET },
  });
  assert(authRes.status === 200, 'Authorized internal request returns 200');
  const authData = await authRes.json();
  assert(!!authData.directRtspUrl, 'Authorized internal request DOES receive directRtspUrl');
  assert(authData.directRtspUrl.startsWith('rtsp://'), 'directRtspUrl is a valid RTSP URL scheme');

  // ── Step 4: AI Event Endpoint Authentication & Validation ──────────────────
  console.log('\n── Step 4: Verify POST /api/events Authentication & Validation ──');

  // 4a. No secret -> 401
  const noSecretEvtRes = await fetch(`${BASE_URL}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'person_detected', cameraId }),
  });
  assert(noSecretEvtRes.status === 401, `No secret rejected with 401 Unauthorized (got ${noSecretEvtRes.status})`);

  // 4b. Invalid secret -> 401
  const invalidSecretEvtRes = await fetch(`${BASE_URL}/api/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': 'invalid-secret-key-12345',
    },
    body: JSON.stringify({ type: 'person_detected', cameraId }),
  });
  assert(invalidSecretEvtRes.status === 401, `Invalid secret rejected with 401 Unauthorized (got ${invalidSecretEvtRes.status})`);

  // 4c. Valid secret, invalid type -> 400
  const invalidTypeRes = await fetch(`${BASE_URL}/api/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': INTERNAL_SECRET,
    },
    body: JSON.stringify({ type: 'hacked_malicious_event', cameraId }),
  });
  assert(invalidTypeRes.status === 400, `Invalid event type rejected with 400 Bad Request (got ${invalidTypeRes.status})`);

  // 4d. Valid secret, invalid confidence -> 400
  const invalidConfRes = await fetch(`${BASE_URL}/api/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': INTERNAL_SECRET,
    },
    body: JSON.stringify({ type: 'person_detected', cameraId, confidence: 5.5 }),
  });
  assert(invalidConfRes.status === 400, `Confidence > 1.0 rejected with 400 Bad Request (got ${invalidConfRes.status})`);

  // 4e. Valid secret, missing cameraId -> 400
  const missingCamRes = await fetch(`${BASE_URL}/api/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': INTERNAL_SECRET,
    },
    body: JSON.stringify({ type: 'person_detected', cameraId: '   ' }),
  });
  assert(missingCamRes.status === 400, `Empty cameraId rejected with 400 Bad Request (got ${missingCamRes.status})`);

  // ── Step 5: WebSocket Delivery of Synthetic Test Event ──────────────────────
  console.log('\n── Step 5: WebSocket Delivery of Synthetic Person-Detection Event ──');

  const ws = new WebSocket(WS_URL);

  const wsPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('WebSocket event receipt timed out after 5 seconds'));
    }, 5000);

    ws.on('open', () => {
      console.log('  WebSocket client connected to', WS_URL);
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'camera_statuses') {
          // Initial snapshot, ignore
          return;
        }
        if (msg.type === 'ai_alert') {
          clearTimeout(timer);
          resolve(msg);
        }
      } catch (err) {
        reject(err);
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });

  // Give WS client 300ms to register
  await new Promise((r) => setTimeout(r, 300));

  // Dispatch clearly labeled synthetic test event
  const syntheticPayload = {
    type: 'person_detected',
    cameraId,
    confidence: 0.94,
    details: {
      isSyntheticTestEvent: true,
      personCount: 1,
      trackIds: [999],
      boxes: [
        {
          trackId: 999,
          confidence: 0.94,
          box: [120, 80, 280, 390],
        },
      ],
      cameraName: targetCamera.name,
    },
  };

  const dispatchRes = await fetch(`${BASE_URL}/api/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': INTERNAL_SECRET,
    },
    body: JSON.stringify(syntheticPayload),
  });

  assert(dispatchRes.status === 200, `POST /api/events succeeded with HTTP 200`);
  const dispatchData = await dispatchRes.json();
  assert(dispatchData.success === true, 'Event dispatch response contains success: true');
  assert(dispatchData.broadcastedTo >= 1, `Event broadcasted to at least 1 client (got ${dispatchData.broadcastedTo})`);

  // Wait for WS message
  const receivedWsMsg = await wsPromise;
  ws.close();

  assert(receivedWsMsg.type === 'ai_alert', `WebSocket message type is 'ai_alert'`);
  assert(receivedWsMsg.data.type === 'person_detected', `Received event type is 'person_detected'`);
  assert(receivedWsMsg.data.cameraId === cameraId, `Received event cameraId matches ${cameraId}`);
  assert(receivedWsMsg.data.confidence === 0.94, `Received event confidence is 0.94`);
  assert(receivedWsMsg.data.details.isSyntheticTestEvent === true, 'Received synthetic test flag is true');
  assert(receivedWsMsg.data.details.personCount === 1, 'Received personCount is 1');
  assert(receivedWsMsg.data.details.boxes.length === 1, 'Received 1 bounding box');
  assert(receivedWsMsg.data.details.boxes[0].trackId === 999, 'Received track ID 999');

  console.log('\n═════════════════════════════════════════════════════════════');
  console.log(` Summary: ${passed} passed, ${failed} failed.`);
  console.log(' All Phase 2 Integration Tests PASSED!');
  console.log('═════════════════════════════════════════════════════════════\n');
}

runTests().catch((err) => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});
