/**
 * src/types/watch.ts
 * Frontend type definitions for the Smart Watch Module.
 *
 * These mirror the server's watch.types.ts (WatchPublicRecord)
 * plus BLE-specific types for the Web Bluetooth diagnostic flow.
 *
 * Design: Web Bluetooth is treated as a development/diagnostic tool.
 * Production health data will come from the Android Companion App.
 */

// ─── Health Source ────────────────────────────────────────────────────────────

export type HealthSource =
  | 'ble_testing'
  | 'android_companion'
  | 'google_fit'
  | 'health_connect';

export const HEALTH_SOURCE_LABELS: Record<HealthSource, string> = {
  ble_testing:       'BLE Testing (Browser)',
  android_companion: 'Android Companion App',
  google_fit:        'Google Fit (Future)',
  health_connect:    'Health Connect (Future)',
};

// ─── Connection Status ────────────────────────────────────────────────────────

/** Derived server-side from lastSeen — never hardcoded on frontend. */
export type WatchConnectionStatus = 'connected' | 'syncing' | 'offline';

// ─── Watch Record (from server API) ──────────────────────────────────────────

/** Safe public record returned by GET /api/watches */
export interface Watch {
  id: string;
  watchName: string;       // Friendly name e.g. "Dad's Watch"
  bluetoothName: string;   // BLE advertised name e.g. "Icon Buzz_Phone"
  macAddress: string;      // BLE MAC e.g. "F6:CE:4B:7F:0F:30"
  residentId: string;
  healthSource: HealthSource;
  firmware?: string;
  battery?: number;
  rssi?: number;
  lastSeen?: string;
  connectionStatus: WatchConnectionStatus;
  createdAt: string;
  updatedAt: string;
}

// ─── Form Input ───────────────────────────────────────────────────────────────

export interface CreateWatchInput {
  watchName: string;
  bluetoothName: string;
  macAddress: string;
  residentId: string;
  healthSource: HealthSource;
  firmware?: string;
  battery?: number;
  rssi?: number;
}

export type UpdateWatchInput = Partial<CreateWatchInput>;

// ─── BLE Scan Result ──────────────────────────────────────────────────────────

/** A device found during a Web Bluetooth BLE scan. */
export interface ScannedBLEDevice {
  id: string;            // Browser-assigned opaque device ID
  name: string;          // Advertised BLE name (e.g. "Icon Buzz_Phone")
  rssi?: number;         // Signal strength at time of scan
}

// ─── BLE Test Step ────────────────────────────────────────────────────────────

export interface BLETestStep {
  label: string;
  status: 'pending' | 'running' | 'ok' | 'fail' | 'skipped';
  detail?: string;
}

// ─── BLE Test Result (posted to /api/watches/:id/test-result) ────────────────

export interface WatchTestResult {
  success: boolean;
  macAddress: string;
  bluetoothName: string;
  steps: Array<{ label: string; ok: boolean; detail?: string }>;
  firmware?: string;
  battery?: number;
  rssi?: number;
  availableServices: string[];
  errorMessage?: string;
  testedAt: string;
}
