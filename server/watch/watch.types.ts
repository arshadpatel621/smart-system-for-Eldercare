/**
 * watch.types.ts
 * Central type definitions for the Smart Watch Module.
 *
 * Architecture mirrors the Camera Module exactly:
 *   WatchRecord      — full persisted record (JSON file)
 *   WatchPublicRecord — safe public view returned to frontend
 *   CreateWatchDto    — input shape for creating a watch
 *   UpdateWatchDto    — partial update shape
 *   WatchTestResult   — BLE connection test result (mirrors ProbeResult)
 *
 * Future: Android Companion App will POST to /api/watches/:id/health-data
 * and PATCH /api/watches/:id/status without any React changes required.
 */

// ─── Health Source ────────────────────────────────────────────────────────────

/**
 * Health source defines where health data originates.
 * - 'ble_testing': Web Bluetooth API (browser diagnostic tool only)
 * - 'android_companion': Future Android Companion App (production)
 * - 'google_fit': Future Google Fit cloud sync
 * - 'health_connect': Future Android Health Connect
 */
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

/**
 * Connection status is DERIVED from lastSeen timestamp — never hardcoded.
 *   Connected : lastSeen < 30 seconds ago
 *   Syncing   : lastSeen 30s – 2 minutes ago
 *   Offline   : lastSeen > 2 minutes ago OR never seen
 */
export type WatchConnectionStatus = 'connected' | 'syncing' | 'offline';

// ─── Watch Record (persisted) ─────────────────────────────────────────────────

/** Full watch record as stored in the JSON repository. */
export interface WatchRecord {
  id: string;

  // Identity
  watchName: string;       // Friendly name e.g. "Dad's Watch"
  bluetoothName: string;   // BLE advertised name e.g. "Icon Buzz_Phone"
  macAddress: string;      // BLE MAC address e.g. "F6:CE:4B:7F:0F:30"

  // Assignment
  residentId: string;      // Firestore patient / resident ID

  // Health configuration
  healthSource: HealthSource;

  // Discovered metadata (from BLE test or Android Companion App)
  firmware?: string;       // e.g. "MOY-HGH3-2.3.2"
  battery?: number;        // 0–100
  rssi?: number;           // Signal strength in dBm e.g. -58

  // Live status (updated by Android Companion App or BLE test)
  lastSeen?: string;       // ISO timestamp — drives connection status computation

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// ─── Public Record (safe for frontend) ────────────────────────────────────────

/** Watch record returned to frontend — connection status computed server-side. */
export interface WatchPublicRecord {
  id: string;
  watchName: string;
  bluetoothName: string;
  macAddress: string;
  residentId: string;
  healthSource: HealthSource;
  firmware?: string;
  battery?: number;
  rssi?: number;
  lastSeen?: string;
  connectionStatus: WatchConnectionStatus;  // Derived from lastSeen
  createdAt: string;
  updatedAt: string;
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

/** Input to create a new watch (from the React form). */
export interface CreateWatchDto {
  watchName: string;
  bluetoothName: string;
  macAddress: string;
  residentId: string;
  healthSource: HealthSource;
  firmware?: string;
  battery?: number;
  rssi?: number;
}

/**
 * Input to update an existing watch.
 * All fields optional — only provided fields are updated.
 */
export interface UpdateWatchDto {
  watchName?: string;
  bluetoothName?: string;
  macAddress?: string;
  residentId?: string;
  healthSource?: HealthSource;
  firmware?: string;
  battery?: number;
  rssi?: number;
  lastSeen?: string;
}

// ─── BLE Test Result (mirrors ProbeResult from camera.types.ts) ───────────────

export interface BLETestStep {
  label: string;
  ok: boolean;
  detail?: string;
}

/**
 * Result of a BLE connection test.
 * The test is performed by the Web Bluetooth API in the browser.
 * The frontend POSTs this result to /api/watches/:id/test-result
 * so it can be persisted and reflected in real-time status.
 *
 * Design note: The server does NOT perform BLE operations — it only
 * stores results. The future Android Companion App will use native BLE.
 */
export interface WatchTestResult {
  success: boolean;
  macAddress: string;
  bluetoothName: string;

  // Step-by-step diagnostic results
  steps: BLETestStep[];

  // Discovered metadata
  firmware?: string;
  battery?: number;
  rssi?: number;
  availableServices: string[];

  // Error info
  errorMessage?: string;
  testedAt: string;   // ISO timestamp
}

// ─── Health Data ──────────────────────────────────────────────────────────────

/**
 * Health data payload posted by the Android Companion App (future).
 * POST /api/watches/:id/health-data
 */
export interface WatchHealthData {
  watchId: string;
  residentId: string;
  heartRate?: number;      // bpm
  spo2?: number;           // %
  steps?: number;
  sleepHours?: number;
  calories?: number;
  battery?: number;
  rssi?: number;
  timestamp: string;       // ISO timestamp
}

// ─── Repository Interface ──────────────────────────────────────────────────────

/**
 * WatchRepository defines the contract for data persistence.
 * Swap implementations to change backends: JSON → Firestore → PostgreSQL.
 * Service layer depends ONLY on this interface.
 */
export interface WatchRepository {
  findAll(): Promise<WatchRecord[]>;
  findById(id: string): Promise<WatchRecord | null>;
  findByResidentId(residentId: string): Promise<WatchRecord[]>;
  create(dto: CreateWatchDto): Promise<WatchRecord>;
  update(id: string, dto: UpdateWatchDto): Promise<WatchRecord>;
  delete(id: string): Promise<void>;
  updateLastSeen(id: string, metadata: Partial<Pick<WatchRecord, 'battery' | 'rssi' | 'firmware' | 'lastSeen'>>): Promise<WatchRecord>;
}
