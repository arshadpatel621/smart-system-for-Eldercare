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

import type {
  Watch, CreateWatchInput, UpdateWatchInput,
  WatchTestResult, ScannedBLEDevice, BLETestStep,
} from '../types/watch';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5000';

// ─── Helper ───────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const json = await res.json();
  if (!res.ok) throw new Error((json as any).error ?? `API error ${res.status}`);
  return json as T;
}

// ─── Watch CRUD (mirrors camera.ts pattern) ───────────────────────────────────

export const fetchWatches = () =>
  apiFetch<Watch[]>('/api/watches');

export const fetchWatchesByResident = (residentId: string) =>
  apiFetch<Watch[]>(`/api/watches/resident/${residentId}`);

export const fetchWatch = (id: string) =>
  apiFetch<Watch>(`/api/watches/${id}`);

export const createWatch = (input: CreateWatchInput) =>
  apiFetch<Watch>('/api/watches', { method: 'POST', body: JSON.stringify(input) });

export const updateWatch = (id: string, input: UpdateWatchInput) =>
  apiFetch<Watch>(`/api/watches/${id}`, { method: 'PUT', body: JSON.stringify(input) });

export const deleteWatch = (id: string) =>
  apiFetch<{ success: boolean }>(`/api/watches/${id}`, { method: 'DELETE' });

// ─── BLE Test Result (store server-side after browser BLE test) ───────────────

export const postBLETestResult = (id: string, result: WatchTestResult) =>
  apiFetch<{ success: boolean; watch: Watch }>(`/api/watches/${id}/test-result`, {
    method: 'POST',
    body: JSON.stringify(result),
  });

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
