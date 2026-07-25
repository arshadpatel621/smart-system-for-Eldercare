/**
 * watch.controller.ts
 * Express request handlers for all Smart Watch API endpoints.
 * Validates inputs, delegates to WatchService, and formats responses.
 *
 * Mirrors CameraController structure exactly.
 */

import { Request, Response } from 'express';
import { WatchService } from './watch.service';
import type { CreateWatchDto, UpdateWatchDto, WatchTestResult, WatchHealthData } from './watch.types';

const VALID_HEALTH_SOURCES = ['ble_testing', 'android_companion', 'google_fit', 'health_connect'];

export class WatchController {
  constructor(private readonly service: WatchService) {}

  /** GET /api/watches — list all watches (all residents) */
  listWatches = async (_req: Request, res: Response): Promise<void> => {
    try {
      const watches = await this.service.getWatches();
      res.json(watches);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  /** GET /api/watches/resident/:residentId — watches for one resident */
  listWatchesByResident = async (req: Request, res: Response): Promise<void> => {
    try {
      const watches = await this.service.getWatchesByResident(req.params.residentId);
      res.json(watches);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  /** POST /api/watches — create a new watch */
  createWatch = async (req: Request, res: Response): Promise<void> => {
    const { watchName, bluetoothName, macAddress, residentId, healthSource, firmware, battery, rssi } = req.body;

    // Validation
    if (!watchName?.trim())     { res.status(400).json({ error: 'Watch name is required' });       return; }
    if (!bluetoothName?.trim()) { res.status(400).json({ error: 'Bluetooth name is required' });   return; }
    if (!macAddress?.trim())    { res.status(400).json({ error: 'MAC address is required' });      return; }
    if (!residentId?.trim())    { res.status(400).json({ error: 'Resident ID is required' });      return; }
    if (!VALID_HEALTH_SOURCES.includes(healthSource)) {
      res.status(400).json({ error: `Invalid healthSource. Valid: ${VALID_HEALTH_SOURCES.join(', ')}` });
      return;
    }

    const dto: CreateWatchDto = {
      watchName:     watchName.trim(),
      bluetoothName: bluetoothName.trim(),
      macAddress:    macAddress.trim(),
      residentId:    residentId.trim(),
      healthSource,
      firmware:      firmware?.trim() || undefined,
      battery:       battery !== undefined ? Number(battery) : undefined,
      rssi:          rssi !== undefined    ? Number(rssi)    : undefined,
    };

    try {
      const watch = await this.service.createWatch(dto);
      res.status(201).json(watch);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  /** GET /api/watches/:id — single watch record */
  getWatch = async (req: Request, res: Response): Promise<void> => {
    try {
      const watch = await this.service.getWatchById(req.params.id);
      res.json(watch);
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  };

  /** PUT /api/watches/:id — update watch */
  updateWatch = async (req: Request, res: Response): Promise<void> => {
    const { watchName, bluetoothName, macAddress, residentId, healthSource, firmware, battery, rssi } = req.body;

    if (healthSource && !VALID_HEALTH_SOURCES.includes(healthSource)) {
      res.status(400).json({ error: `Invalid healthSource` });
      return;
    }

    const dto: UpdateWatchDto = {
      ...(watchName     !== undefined && { watchName:     watchName.trim() }),
      ...(bluetoothName !== undefined && { bluetoothName: bluetoothName.trim() }),
      ...(macAddress    !== undefined && { macAddress:    macAddress.trim() }),
      ...(residentId    !== undefined && { residentId:    residentId.trim() }),
      ...(healthSource  !== undefined && { healthSource }),
      ...(firmware      !== undefined && { firmware:      firmware?.trim() || undefined }),
      ...(battery       !== undefined && { battery:       Number(battery) }),
      ...(rssi          !== undefined && { rssi:          Number(rssi) }),
    };

    try {
      const watch = await this.service.updateWatch(req.params.id, dto);
      res.json(watch);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  };

  /** DELETE /api/watches/:id */
  deleteWatch = async (req: Request, res: Response): Promise<void> => {
    try {
      await this.service.deleteWatch(req.params.id);
      res.json({ success: true, message: 'Watch deleted' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  };

  /**
   * POST /api/watches/:id/test-result
   * Stores the result of a browser-side BLE test (Web Bluetooth API).
   * Called after the frontend runs its BLE diagnostic flow.
   * The server updates lastSeen / battery / rssi / firmware from the result.
   */
  storeBLETestResult = async (req: Request, res: Response): Promise<void> => {
    const result = req.body as WatchTestResult;

    if (!result || typeof result.success !== 'boolean') {
      res.status(400).json({ error: 'Invalid BLE test result payload' });
      return;
    }
    if (!result.testedAt) {
      result.testedAt = new Date().toISOString();
    }

    try {
      const watch = await this.service.storeBLETestResult(req.params.id, result);
      res.json({ success: true, watch });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  };

  /**
   * POST /api/watches/:id/health-data
   * Endpoint reserved for the Android Companion App (future).
   * Receives verified health data: heartRate, spo2, steps, sleep, calories.
   * Designed now so the React app needs zero changes when the Android app ships.
   */
  receiveHealthData = async (req: Request, res: Response): Promise<void> => {
    const data = req.body as WatchHealthData;

    if (!data?.timestamp) {
      data.timestamp = new Date().toISOString();
    }

    try {
      const result = await this.service.receiveHealthData(req.params.id, data);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  };
}
