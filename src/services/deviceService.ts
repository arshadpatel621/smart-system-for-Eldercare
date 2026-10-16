import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { db, hasFirebaseConfig } from '../lib/firebase';
import type { Device, CreateDeviceInput, DeviceCategory } from '../types/device';

const STORAGE_KEY = 'vitalcare_devices';
const HARDWARE_SUBCOLLECTION = 'hardware_devices';

function sanitizeDevice(raw: any, defaultPatientId: string): Device {
  return {
    id: raw.id || crypto.randomUUID(),
    patientId: raw.patientId || defaultPatientId,
    category: raw.category || 'wearable',
    brand: raw.brand || 'Generic',
    model: raw.model || raw.name || 'Connected Device',
    macAddress: raw.macAddress || undefined,
    ipAddress: raw.ipAddress || undefined,
    serialNumber: raw.serialNumber || undefined,
    connectionType: raw.connectionType || 'bluetooth',
    firmwareVersion: raw.firmwareVersion || undefined,
    battery: typeof raw.battery === 'number' ? raw.battery : raw.batteryLevel,
    status: raw.status === 'connected' ? 'connected' : raw.status === 'error' ? 'error' : 'disconnected',
    lastSync: raw.lastSync || raw.lastSyncedAt || undefined,
    supportedMetrics: Array.isArray(raw.supportedMetrics) ? raw.supportedMetrics : [],
    location: raw.location || undefined,
    networkProtocol: raw.networkProtocol || undefined,
  };
}

/**
 * Service to manage devices.
 * Uses Cloud Firestore (elders/{patientId}/hardware_devices) with localStorage fallback.
 */
class DeviceServiceClass {
  private getStorage(): Device[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed.map((item) => sanitizeDevice(item, 'default-patient')) : [];
    } catch {
      return [];
    }
  }

  private setStorage(devices: Device[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
    } catch (e) {
      console.error('Failed to save devices to localStorage:', e);
    }
  }

  async getDevices(): Promise<Device[]> {
    return this.getStorage();
  }

  async getDevicesForResident(patientId: string): Promise<Device[]> {
    if (hasFirebaseConfig && db && patientId) {
      try {
        const elderRef = doc(db, 'elders', patientId);
        // Primary source: hardware_devices subcollection
        const snapshot = await getDocs(collection(elderRef, HARDWARE_SUBCOLLECTION));
        if (!snapshot.empty) {
          return snapshot.docs.map((d) => sanitizeDevice({ id: d.id, ...d.data() }, patientId));
        }

        // Migration fallback: check legacy devices subcollection for hardware records with category or model
        const legacySnap = await getDocs(collection(elderRef, 'devices'));
        const legacyHardware = legacySnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((d: any) => d.category || d.model);

        if (legacyHardware.length > 0) {
          return legacyHardware.map((d) => sanitizeDevice(d, patientId));
        }
      } catch (err) {
        console.warn('Failed to load devices from Firestore, using local fallback:', err);
      }
    }
    const devices = this.getStorage().filter((d) => d.patientId === patientId);
    return devices;
  }

  async getDevicesByCategory(patientId: string, category: DeviceCategory): Promise<Device[]> {
    const devices = await this.getDevicesForResident(patientId);
    return devices.filter((d) => d.category === category);
  }

  async addDevice(input: CreateDeviceInput): Promise<Device> {
    const id = crypto.randomUUID();
    const newDevice = sanitizeDevice({ ...input, id }, input.patientId);

    if (hasFirebaseConfig && db && input.patientId) {
      try {
        const elderRef = doc(db, 'elders', input.patientId);
        await setDoc(doc(collection(elderRef, HARDWARE_SUBCOLLECTION), id), newDevice);
        return newDevice;
      } catch (err) {
        console.warn('Failed to save device to Firestore, saving locally:', err);
      }
    }

    const devices = this.getStorage();
    devices.push(newDevice);
    this.setStorage(devices);
    return newDevice;
  }

  async updateDevice(id: string, updates: Partial<Device>, patientId?: string): Promise<Device> {
    const targetPatientId = patientId || updates.patientId || 'default-patient';
    if (hasFirebaseConfig && db && targetPatientId) {
      try {
        const elderRef = doc(db, 'elders', targetPatientId);
        const deviceRef = doc(collection(elderRef, HARDWARE_SUBCOLLECTION), id);
        const snap = await getDoc(deviceRef);
        const existing = snap.exists() ? snap.data() : {};
        const updated = sanitizeDevice({ ...existing, ...updates, id, patientId: targetPatientId }, targetPatientId);
        await setDoc(deviceRef, updated);
        return updated;
      } catch (err) {
        console.warn('Failed to update device in Firestore, updating locally:', err);
      }
    }

    const devices = this.getStorage();
    const index = devices.findIndex((d) => d.id === id);
    if (index === -1) {
      throw new Error(`Device with ID ${id} not found`);
    }

    const updated = sanitizeDevice({ ...devices[index], ...updates }, targetPatientId);
    devices[index] = updated;
    this.setStorage(devices);
    return devices[index];
  }

  async removeDevice(id: string, patientId?: string): Promise<void> {
    if (hasFirebaseConfig && db && patientId) {
      try {
        const elderRef = doc(db, 'elders', patientId);
        await deleteDoc(doc(collection(elderRef, HARDWARE_SUBCOLLECTION), id));
        return;
      } catch (err) {
        console.warn('Failed to delete device from Firestore, deleting locally:', err);
      }
    }

    const devices = this.getStorage();
    const filtered = devices.filter((d) => d.id !== id);
    this.setStorage(filtered);
  }
}

export const DeviceService = new DeviceServiceClass();
