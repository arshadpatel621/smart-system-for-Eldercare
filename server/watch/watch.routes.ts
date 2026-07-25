/**
 * watch.routes.ts
 * Registers all Smart Watch API endpoints on an Express Router.
 * Mirrors camera.routes.ts structure exactly.
 */

import { Router } from 'express';
import { WatchController } from './watch.controller';

export function createWatchRouter(controller: WatchController): Router {
  const router = Router();

  // ── Collection routes ─────────────────────────────────────────────
  router.get('/',                           controller.listWatches);            // List all watches
  router.post('/',                          controller.createWatch);             // Add watch
  router.get('/resident/:residentId',       controller.listWatchesByResident);  // Watches for resident

  // ── Single-watch routes ───────────────────────────────────────────
  router.get('/:id',                        controller.getWatch);               // Watch details
  router.put('/:id',                        controller.updateWatch);            // Edit watch
  router.delete('/:id',                     controller.deleteWatch);            // Remove watch

  // ── Diagnostic & integration routes ──────────────────────────────
  router.post('/:id/test-result',           controller.storeBLETestResult);     // Store BLE test result (browser)
  router.post('/:id/health-data',           controller.receiveHealthData);      // Android Companion App (future)

  return router;
}
