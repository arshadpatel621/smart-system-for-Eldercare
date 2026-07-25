/**
 * watch.service.ts
 * Business logic for the Smart Watch Module.
 *
 * Responsibilities:
 *   - CRUD operations (delegates to WatchRepository)
 *   - Derives WatchConnectionStatus from lastSeen timestamp (never hardcoded)
 *   - Stores BLE test results posted by the browser (Web Bluetooth diagnostic)
 *   - Accepts health data from the future Android Companion App
 *   - Strips internal fields before returning to frontend (toPublicRecord)
 *
 * Connection status rules (per spec):
 *   Connected : lastSeen < 30 seconds ago
 *   Syncing   : lastSeen 30 seconds – 2 minutes ago
 *   Offline   : lastSeen > 2 minutes ago OR no lastSeen
 */

import type {
  WatchRecord,
  WatchRepository,
  WatchPublicRecord,
  WatchConnectionStatus,
  CreateWatchDto,
  UpdateWatchDto,
  WatchTestResult,
  WatchHealthData,
} from './watch.types';

// ─── Status Computation ────────────────────────────────────────────────────────

const CONNECTED_THRESHOLD_MS  = 30 * 1000;         // 30 seconds
const SYNCING_THRESHOLD_MS    = 2 * 60 * 1000;     // 2 minutes

export function computeConnectionStatus(lastSeen?: string): WatchConnectionStatus {
  if (!lastSeen) return 'offline';

  const elapsedMs = Date.now() - new Date(lastSeen).getTime();

  if (elapsedMs < CONNECTED_THRESHOLD_MS)  return 'connected';
  if (elapsedMs < SYNCING_THRESHOLD_MS)    return 'syncing';
  return 'offline';
}

// ─── Record → Public view ──────────────────────────────────────────────────────

function toPublicRecord(record: WatchRecord): WatchPublicRecord {
  return {
    id:               record.id,
    watchName:        record.watchName,
    bluetoothName:    record.bluetoothName,
    macAddress:       record.macAddress,
    residentId:       record.residentId,
    healthSource:     record.healthSource,
    firmware:         record.firmware,
    battery:          record.battery,
    rssi:             record.rssi,
    lastSeen:         record.lastSeen,
    connectionStatus: computeConnectionStatus(record.lastSeen),
    createdAt:        record.createdAt,
    updatedAt:        record.updatedAt,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class WatchService {
  constructor(private readonly repo: WatchRepository) {}

  /** Returns all watches as safe public records. */
  async getWatches(): Promise<WatchPublicRecord[]> {
    const records = await this.repo.findAll();
    return records.map(toPublicRecord);
  }

  /** Returns watches for a specific resident. */
  async getWatchesByResident(residentId: string): Promise<WatchPublicRecord[]> {
    const records = await this.repo.findByResidentId(residentId);
    return records.map(toPublicRecord);
  }

  /** Returns a single watch by ID. */
  async getWatchById(id: string): Promise<WatchPublicRecord> {
    const record = await this.repo.findById(id);
    if (!record) throw new Error(`Watch not found: ${id}`);
    return toPublicRecord(record);
  }

  /** Creates a new watch record. */
  async createWatch(dto: CreateWatchDto): Promise<WatchPublicRecord> {
    const record = await this.repo.create(dto);
    console.log(`[WatchService] Watch created: ${record.watchName}`);
    return toPublicRecord(record);
  }

  /** Updates an existing watch. */
  async updateWatch(id: string, dto: UpdateWatchDto): Promise<WatchPublicRecord> {
    const record = await this.repo.update(id, dto);
    return toPublicRecord(record);
  }

  /** Deletes a watch. */
  async deleteWatch(id: string): Promise<void> {
    await this.repo.delete(id);
    console.log(`[WatchService] Watch deleted: ${id}`);
  }

  /**
   * Stores the result of a browser-side BLE test.
   * Called when the frontend POSTs a WatchTestResult.
   * Updates lastSeen, battery, rssi, and firmware from the test result.
   *
   * Design: The server does NOT perform BLE itself — it stores what
   * the browser (or future Android Companion App) reports.
   */
  async storeBLETestResult(id: string, result: WatchTestResult): Promise<WatchPublicRecord> {
    const record = await this.repo.findById(id);
    if (!record) throw new Error(`Watch not found: ${id}`);

    if (result.success) {
      // Update device metadata from a successful BLE test
      await this.repo.updateLastSeen(id, {
        battery:  result.battery,
        rssi:     result.rssi,
        firmware: result.firmware,
        lastSeen: result.testedAt,
      });
    }

    const updated = await this.repo.findById(id);
    return toPublicRecord(updated!);
  }

  /**
   * Receives and stores health data from the Android Companion App (future).
   * This endpoint is designed now so the React app needs zero changes later.
   * POST /api/watches/:id/health-data
   */
  async receiveHealthData(id: string, data: WatchHealthData): Promise<{ success: boolean; watchId: string; timestamp: string }> {
    const record = await this.repo.findById(id);
    if (!record) throw new Error(`Watch not found: ${id}`);

    // Update lastSeen and battery/rssi from incoming health data
    await this.repo.updateLastSeen(id, {
      battery:  data.battery,
      rssi:     data.rssi,
      lastSeen: data.timestamp,
    });

    console.log(`[WatchService] Health data received for watch ${id}: HR=${data.heartRate}, SpO2=${data.spo2}`);

    // TODO: When Firestore is wired in, write healthData subcollection here:
    // await firestoreRepo.writeHealthData(data.residentId, data);

    return {
      success:   true,
      watchId:   id,
      timestamp: data.timestamp,
    };
  }
}
