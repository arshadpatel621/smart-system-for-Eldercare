/**
 * src/services/watchService.ts
 * Frontend API client for the Smart Watch Module.
 *
 * Architecture mirrors camera.ts exactly:
 *   - All CRUD via REST → Express /api/watches
 *   - BLE scan and test performed in the browser via Web Bluetooth API
 *   - Test results posted back to server for persistence
 *
 * Design note on Web Bluetooth:
 *   Web Bluetooth is a development/diagnostic tool. It cannot provide continuous
 *   background health monitoring. The future Android Companion App will handle
 *   production BLE communication via the Nordic Android BLE library.
 *
 * BLE GATT Service UUIDs (standard):
 *   battery_service           0x180F  → Battery Level (0x2A19)
 *   heart_rate                0x180D  → Heart Rate Measurement (0x2A37)
 *   device_information        0x180A  → Firmware Rev (0x2A26), Mfr Name (0x2A29)
 *   health_thermometer        0x1809
 */

import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { db, hasFirebaseConfig } from '../lib/firebase';
import type {
  Watch, CreateWatchInput, UpdateWatchInput,
  WatchTestResult, ScannedBLEDevice, BLETestStep, WatchConnectionStatus,
} from '../types/watch';

const STORAGE_KEY = 'vitalcare_watches';

export function deriveWatchConnectionStatus(lastSeen?: string): WatchConnectionStatus {
  if (!lastSeen) return 'offline';
  const ageMs = Date.now() - new Date(lastSeen).getTime();
  if (ageMs < 5 * 60 * 1000) return 'connected'; // 5 minutes
  if (ageMs < 30 * 60 * 1000) return 'syncing';   // 30 minutes
  return 'offline';
}

function getLocalWatches(): Watch[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalWatches(watches: Watch[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(watches));
  } catch (e) {
    console.error('Failed to save watches to localStorage:', e);
  }
}

// ─── Watch CRUD (Firestore with LocalStorage Fallback) ────────────────────────

export async function fetchWatches(residentId: string = 'demo-resident'): Promise<Watch[]> {
  if (hasFirebaseConfig && db) {
    try {
      const elderRef = doc(db, 'elders', residentId);
      const snapshot = await getDocs(collection(elderRef, 'watches'));
      return snapshot.docs.map(d => {
        const data = d.data() as Omit<Watch, 'id' | 'connectionStatus'>;
        return {
          id: d.id,
          ...data,
          connectionStatus: deriveWatchConnectionStatus(data.lastSeen),
        } as Watch;
      });
    } catch (err) {
      console.warn('Failed to load watches from Firestore, falling back to local storage:', err);
    }
  }
  const all = getLocalWatches();
  return all
    .filter(w => !residentId || w.residentId === residentId)
    .map(w => ({ ...w, connectionStatus: deriveWatchConnectionStatus(w.lastSeen) }));
}

export async function fetchWatchesByResident(residentId: string): Promise<Watch[]> {
  return fetchWatches(residentId);
}

export async function fetchWatch(id: string, residentId: string = 'demo-resident'): Promise<Watch> {
  if (hasFirebaseConfig && db) {
    const elderRef = doc(db, 'elders', residentId);
    const snap = await getDoc(doc(collection(elderRef, 'watches'), id));
    if (snap.exists()) {
      const data = snap.data() as Omit<Watch, 'id' | 'connectionStatus'>;
      return {
        id: snap.id,
        ...data,
        connectionStatus: deriveWatchConnectionStatus(data.lastSeen),
      } as Watch;
    }
  }
  const found = getLocalWatches().find(w => w.id === id);
  if (!found) throw new Error(`Watch ${id} not found`);
  return { ...found, connectionStatus: deriveWatchConnectionStatus(found.lastSeen) };
}

export async function createWatch(input: CreateWatchInput): Promise<Watch> {
  const residentId = input.residentId || 'demo-resident';
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const newWatch: Watch = {
    id,
    ...input,
    residentId,
    lastSeen: now,
    connectionStatus: deriveWatchConnectionStatus(now),
    createdAt: now,
    updatedAt: now,
  };

  if (hasFirebaseConfig && db) {
    try {
      const elderRef = doc(db, 'elders', residentId);
      await setDoc(doc(collection(elderRef, 'watches'), id), newWatch);
      return newWatch;
    } catch (err) {
      console.warn('Failed to write watch to Firestore, saving locally:', err);
    }
  }

  const all = getLocalWatches().filter(w => w.id !== id);
  all.push(newWatch);
  saveLocalWatches(all);
  return newWatch;
}

export async function updateWatch(id: string, input: UpdateWatchInput, residentId: string = 'demo-resident'): Promise<Watch> {
  const targetResidentId = input.residentId || residentId;
  const now = new Date().toISOString();

  if (hasFirebaseConfig && db) {
    try {
      const elderRef = doc(db, 'elders', targetResidentId);
      const watchDocRef = doc(collection(elderRef, 'watches'), id);
      const snap = await getDoc(watchDocRef);
      const existing = snap.exists() ? (snap.data() as Partial<Watch>) : {};
      const updated: Watch = {
        id,
        watchName: input.watchName ?? existing.watchName ?? 'Smart Watch',
        bluetoothName: input.bluetoothName ?? existing.bluetoothName ?? '',
        macAddress: input.macAddress ?? existing.macAddress ?? '',
        residentId: targetResidentId,
        healthSource: input.healthSource ?? existing.healthSource ?? 'ble_testing',
        firmware: input.firmware ?? existing.firmware,
        battery: input.battery ?? existing.battery,
        rssi: input.rssi ?? existing.rssi,
        lastSeen: now,
        connectionStatus: deriveWatchConnectionStatus(now),
        createdAt: existing.createdAt ?? now,
        updatedAt: now,
      };
      await setDoc(watchDocRef, updated);
      return updated;
    } catch (err) {
      console.warn('Failed to update watch in Firestore, saving locally:', err);
    }
  }

  const all = getLocalWatches();
  const index = all.findIndex(w => w.id === id);
  const existing = index >= 0 ? all[index] : ({} as any);
  const updated: Watch = {
    ...existing,
    ...input,
    id,
    residentId: targetResidentId,
    lastSeen: now,
    connectionStatus: deriveWatchConnectionStatus(now),
    updatedAt: now,
  };
  if (index >= 0) all[index] = updated;
  else all.push(updated);
  saveLocalWatches(all);
  return updated;
}

export async function deleteWatch(id: string, residentId: string = 'demo-resident'): Promise<{ success: boolean }> {
  if (hasFirebaseConfig && db) {
    try {
      const elderRef = doc(db, 'elders', residentId);
      await deleteDoc(doc(collection(elderRef, 'watches'), id));
      return { success: true };
    } catch (err) {
      console.warn('Failed to delete watch from Firestore, removing locally:', err);
    }
  }
  const filtered = getLocalWatches().filter(w => w.id !== id);
  saveLocalWatches(filtered);
  return { success: true };
}

// ─── BLE Test Result (store in Firestore / localStorage) ──────────────────────

export async function postBLETestResult(id: string, result: WatchTestResult, residentId: string = 'demo-resident'): Promise<{ success: boolean; watch: Watch }> {
  const updated = await updateWatch(id, {
    firmware: result.firmware,
    battery: result.battery,
    rssi: result.rssi,
  }, residentId);
  return { success: true, watch: updated };
}

// ─── Web Bluetooth — BLE Scan ─────────────────────────────────────────────────

/**
 * Scans for nearby BLE devices using the Web Bluetooth API.
 * Shows the browser's native device picker — user selects the device.
 * Returns the selected device with its name and opaque browser ID.
 *
 * Limitations:
 *   - Requires HTTPS or localhost (Secure Context)
 *   - One device per picker session
 *   - Web Bluetooth cannot read MAC directly — use the 'id' as identifier
 *   - Background scanning is NOT possible in browsers
 */
export async function scanBLEDevice(): Promise<ScannedBLEDevice> {
  if (!navigator.bluetooth) {
    throw new Error(
      'Web Bluetooth is not available. Use Chrome or Edge on HTTPS/localhost.',
    );
  }

  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [
      'battery_service',    // 0x180F
      'heart_rate',         // 0x180D
      'device_information', // 0x180A
    ],
  });

  return {
    id:   device.id,
    name: device.name ?? 'Unknown BLE Device',
    // RSSI is not directly available from requestDevice; set to undefined
    rssi: undefined,
  };
}

// ─── Web Bluetooth — BLE Connection Test ─────────────────────────────────────

/**
 * Runs a step-by-step BLE connection test using the Web Bluetooth API.
 * Mirrors the camera ProbeResult pattern.
 *
 * Steps:
 *   1. Bluetooth Available
 *   2. Request Device (Scan)
 *   3. Device Found
 *   4. Connect GATT
 *   5. Get Primary Services
 *   6. Read Battery Service (0x180F)
 *   7. Read Heart Rate Service (0x180D)
 *   8. Read Device Information (0x180A) — firmware, manufacturer
 *
 * @param onStep — callback called after each step (for live UI updates)
 * @param targetMac — if provided, validates the device MAC (best-effort via name match)
 * @param targetName — the expected BLE device name (e.g. "Icon Buzz_Phone")
 */
export async function runBLEConnectionTest(
  onStep: (steps: BLETestStep[]) => void,
  targetName?: string,
): Promise<WatchTestResult> {

  const steps: BLETestStep[] = [
    { label: 'Bluetooth Available',         status: 'pending' },
    { label: 'Scan Device',                 status: 'pending' },
    { label: 'Device Found',                status: 'pending' },
    { label: 'Connect BLE (GATT)',          status: 'pending' },
    { label: 'Read GATT Services',          status: 'pending' },
    { label: 'Read Battery Service',        status: 'pending' },
    { label: 'Read Heart Rate Service',     status: 'pending' },
    { label: 'Read Device Information',     status: 'pending' },
  ];

  const emit = () => onStep([...steps]);
  const pass  = (i: number, detail?: string) => { steps[i] = { ...steps[i], status: 'ok',      detail }; emit(); };
  const fail  = (i: number, detail?: string) => { steps[i] = { ...steps[i], status: 'fail',    detail }; emit(); };
  const run   = (i: number)                  => { steps[i] = { ...steps[i], status: 'running'        }; emit(); };
  const skip  = (i: number, detail?: string) => { steps[i] = { ...steps[i], status: 'skipped', detail }; emit(); };

  const result: WatchTestResult = {
    success: false,
    macAddress: '',
    bluetoothName: '',
    steps: [],
    availableServices: [],
    testedAt: new Date().toISOString(),
  };

  let device: BluetoothDevice | null = null;
  let server: BluetoothRemoteGATTServer | null = null;

  try {
    // Step 0: Check Bluetooth availability
    run(0);
    if (!navigator.bluetooth) {
      fail(0, 'Web Bluetooth API not available');
      result.errorMessage = 'Web Bluetooth not supported in this browser';
      result.steps = steps.map(s => ({ label: s.label, ok: s.status === 'ok', detail: s.detail }));
      return result;
    }
    const available = await navigator.bluetooth.getAvailability();
    if (!available) {
      fail(0, 'Bluetooth adapter not found or disabled');
      result.errorMessage = 'No Bluetooth adapter available';
      result.steps = steps.map(s => ({ label: s.label, ok: s.status === 'ok', detail: s.detail }));
      return result;
    }
    pass(0, 'Bluetooth adapter is available');

    // Step 1: Scan (open device picker)
    run(1);
    const acceptFilters = targetName
      ? [{ name: targetName }]
      : undefined;

    device = await navigator.bluetooth.requestDevice(
      acceptFilters
        ? { filters: acceptFilters, optionalServices: ['battery_service', 'heart_rate', 'device_information'] }
        : { acceptAllDevices: true, optionalServices: ['battery_service', 'heart_rate', 'device_information'] }
    );
    pass(1, `Picker opened, device selected`);

    // Step 2: Device found
    run(2);
    if (!device) {
      fail(2, 'No device returned from picker');
      result.steps = steps.map(s => ({ label: s.label, ok: s.status === 'ok', detail: s.detail }));
      return result;
    }
    result.bluetoothName = device.name ?? 'Unknown';
    // Browser does not expose MAC directly for privacy — use the opaque device.id
    result.macAddress = device.id;
    pass(2, `Found: ${result.bluetoothName}`);

    // Step 3: Connect GATT
    run(3);
    if (!device.gatt) {
      fail(3, 'GATT not supported on this device');
      result.steps = steps.map(s => ({ label: s.label, ok: s.status === 'ok', detail: s.detail }));
      return result;
    }
    server = await device.gatt.connect();
    pass(3, 'GATT server connected');

    // Step 4: Get primary services
    run(4);
    let services: BluetoothRemoteGATTService[] = [];
    try {
      services = await server.getPrimaryServices();
      const serviceUUIDs = services.map(s => s.uuid);
      result.availableServices = serviceUUIDs;
      pass(4, `${services.length} service(s) found`);
    } catch {
      fail(4, 'Could not enumerate services');
    }

    // Step 5: Battery Service (0x180F)
    run(5);
    try {
      const battService = await server.getPrimaryService('battery_service');
      const battChar = await battService.getCharacteristic('battery_level');
      const battVal = await battChar.readValue();
      result.battery = battVal.getUint8(0);
      pass(5, `Battery: ${result.battery}%`);
    } catch (e: any) {
      skip(5, e.message?.includes('not found') ? 'Service not supported' : `Error: ${e.message}`);
    }

    // Step 6: Heart Rate Service (0x180D)
    run(6);
    try {
      await server.getPrimaryService('heart_rate');
      pass(6, 'Heart Rate service present');
    } catch (e: any) {
      skip(6, e.message?.includes('not found') ? 'Service not supported' : `Error: ${e.message}`);
    }

    // Step 7: Device Information (0x180A)
    run(7);
    try {
      const infoService = await server.getPrimaryService('device_information');
      let firmwareParts: string[] = [];

      try {
        const fwChar = await infoService.getCharacteristic('firmware_revision_string');
        const fwVal  = await fwChar.readValue();
        const fw = new TextDecoder().decode(fwVal);
        firmwareParts.push(`FW: ${fw}`);
        result.firmware = fw;
      } catch { /* characteristic may not be present */ }

      try {
        const mfgChar = await infoService.getCharacteristic('manufacturer_name_string');
        const mfgVal  = await mfgChar.readValue();
        firmwareParts.push(`Mfr: ${new TextDecoder().decode(mfgVal)}`);
      } catch { /* characteristic may not be present */ }

      pass(7, firmwareParts.length ? firmwareParts.join(' | ') : 'Service present, no characteristics readable');
    } catch (e: any) {
      skip(7, e.message?.includes('not found') ? 'Service not supported' : `Error: ${e.message}`);
    }

    result.success = true;

  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    // Find the first running step and mark it failed
    const runningIdx = steps.findIndex(s => s.status === 'running');
    if (runningIdx >= 0) fail(runningIdx, msg);
    result.errorMessage = msg;
  } finally {
    // Always disconnect cleanly
    if (server?.connected) {
      try { server.disconnect(); } catch { /* ignore */ }
    }
  }

  result.steps = steps.map(s => ({ label: s.label, ok: s.status === 'ok', detail: s.detail }));
  result.testedAt = new Date().toISOString();
  return result;
}
