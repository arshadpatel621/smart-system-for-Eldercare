import { useState, useEffect, useCallback } from 'react';
import { DeviceService } from '../services/deviceService';
import type { Device, CreateDeviceInput } from '../types/device';
import { useEldercare } from '../context/EldercareContext';

export function useDeviceManager() {
  const { data } = useEldercare();
  const patientId = data?.profile?.id ?? 'default-patient';
  
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDevices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Dummy data seeding removed
      
      const loaded = await DeviceService.getDevicesForResident(patientId);
      setDevices(loaded);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  const addDevice = async (input: Omit<CreateDeviceInput, 'patientId'>) => {
    try {
      setLoading(true);
      const newDevice = await DeviceService.addDevice({ ...input, patientId });
      setDevices((prev) => [...prev, newDevice]);
      return true;
    } catch (err: any) {
      setError(err.message ?? 'Failed to add device');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const updateDevice = async (id: string, updates: Partial<Device>) => {
    try {
      setLoading(true);
      const updated = await DeviceService.updateDevice(id, updates);
      setDevices((prev) => prev.map((d) => (d.id === id ? updated : d)));
      return true;
    } catch (err: any) {
      setError(err.message ?? 'Failed to update device');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const removeDevice = async (id: string) => {
    try {
      setLoading(true);
      await DeviceService.removeDevice(id);
      setDevices((prev) => prev.filter((d) => d.id !== id));
      return true;
    } catch (err: any) {
      setError(err.message ?? 'Failed to remove device');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const connectDevice = async (id: string) => {
    return updateDevice(id, { status: 'connected', lastSync: new Date().toISOString() });
  };

  const disconnectDevice = async (id: string) => {
    return updateDevice(id, { status: 'disconnected' });
  };

  return {
    devices,
    loading,
    error,
    refresh: loadDevices,
    addDevice,
    updateDevice,
    removeDevice,
    connectDevice,
    disconnectDevice,
    clearError: () => setError(null),
  };
}
