/**
 * camera.routes.ts
 * Registers all camera API endpoints on an Express Router.
 */

import { Router } from 'express';
import { CameraController } from './camera.controller';

export function createCameraRouter(controller: CameraController): Router {
  const router = Router();

  // ── Collection routes ────────────────────────────────────────────
  router.get('/',           controller.listCameras);      // List all cameras
  router.get('/statuses',   controller.getAllStatuses);    // All live statuses
  router.get('/discover',   controller.discoverCameras);  // LAN ONVIF scan
  router.post('/test',      controller.testAdHocConnection); // Ad-hoc probe before saving
  router.post('/',          controller.createCamera);      // Add camera

  // ── Single-camera routes ──────────────────────────────────────────
  router.get('/:id',           controller.getCamera);         // Camera details
  router.put('/:id',           controller.updateCamera);      // Edit camera
  router.delete('/:id',        controller.deleteCamera);      // Remove camera
  router.get('/:id/status',    controller.getCameraStatus);   // Live status
  router.get('/:id/capabilities', controller.getCameraCapabilities); // Supported camera actions
  router.post('/:id/toggle',   controller.toggleCamera);      // Enable/disable
  router.post('/:id/test',     controller.testConnection);    // Connection probe
  router.get('/:id/stream',    controller.streamCamera);      // MJPEG stream
  router.get('/:id/recordings', controller.listRecordings);   // Completed local MP4 recordings
  router.post('/:id/recordings', controller.startRecording);  // Start shared-stream recording
  router.post('/:id/recordings/:recordingId/stop', controller.stopRecording);
  router.get('/:id/recordings/:recordingId/download', controller.downloadRecording);
  router.get('/:id/recordings/:recordingId', controller.playRecording);
  router.post('/:id/ptz',      controller.controlPTZ);        // PTZ control
  router.get('/:id/ai-consumer', controller.getAIConsumer);  // AI stream info

  return router;
}
