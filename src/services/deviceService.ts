import type { Device, CreateDeviceInput, DeviceCategory } from '../types/device';

const STORAGE_KEY = 'vitalcare_devices';

/**
 * Service to manage devices.
 * Uses localStorage for now to allow seamless swapping to Firebase or a REST API later.
 */
class DeviceServiceClass {
  private getStorage(): Device[] {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  }

  private setStorage(devices: Device[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
  }

  async getDevices(): Promise<Device[]> {
    return Promise.resolve(this.getStorage());
  }

  async getDevicesForResident(patientId: string): Promise<Device[]> {
    const devices = this.getStorage().filter((d) => d.patientId === patientId);
    return Promise.resolve(devices);
  }

  async getDevicesByCategory(patientId: string, category: DeviceCategory): Promise<Device[]> {
    const devices = this.getStorage().filter((d) => d.patientId === patientId && d.category === category);
    return Promise.resolve(devices);
  }

  async addDevice(input: CreateDeviceInput): Promise<Device> {
    const devices = this.getStorage();
    const newDevice: Device = {
      ...input,
      id: crypto.randomUUID(),
    };
    devices.push(newDevice);
    this.setStorage(devices);
    return Promise.resolve(newDevice);
  }

  async updateDevice(id: string, updates: Partial<Device>): Promise<Device> {
    const devices = this.getStorage();
    const index = devices.findIndex((d) => d.id === id);
    if (index === -1) {
      return Promise.reject(new Error(`Device with ID ${id} not found`));
    }

    devices[index] = { ...devices[index], ...updates };
    this.setStorage(devices);
    return Promise.resolve(devices[index]);
  }

  async removeDevice(id: string): Promise<void> {
    const devices = this.getStorage();
    const filtered = devices.filter((d) => d.id !== id);
    if (devices.length === filtered.length) {
      return Promise.reject(new Error(`Device with ID ${id} not found`));
    }
    this.setStorage(filtered);
    return Promise.resolve();
  }

  /**
   * Helper to seed some initial dummy devices if none exist.
   */
  async seedInitialDevices(patientId: string): Promise<void> {
    const existing = await this.getDevicesForResident(patientId);
    if (existing.length === 0) {
      await this.addDevice({
        patientId,
        category: 'wearable',
        brand: 'Apple',
        model: 'Watch Series 9',
        macAddress: '00:1A:7D:DA:71:13',
        connectionType: 'bluetooth',
        firmwareVersion: '10.4.1',
        battery: 84,
        status: 'connected',
        lastSync: new Date().toISOString(),
        supportedMetrics: ['heart_rate', 'spo2', 'steps', 'sleep_hours', 'calories'],
      });
      await this.addDevice({
        patientId,
        category: 'medical_device',
        brand: 'Omron',
        model: 'Platinum Blood Pressure',
        connectionType: 'bluetooth',
        battery: 60,
        status: 'disconnected',
        lastSync: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        supportedMetrics: ['blood_pressure'],
      });
    }
  }
}

export const DeviceService = new DeviceServiceClass();
