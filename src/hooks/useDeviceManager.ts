import { useState, useEffect, useCallback } from 'react';
import { DeviceService } from '../services/deviceService';
import type { Device, CreateDeviceInput } from '../types/device';
import { useEldercare } from '../context/EldercareContext';

export function useDeviceManager(residentIdParam?: string) {
  const { data, activeElderId } = useEldercare();
  const patientId = residentIdParam || activeElderId || data?.profile?.id || 'demo-resident';
  
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDevices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const loaded = await DeviceService.getDevicesForResident(patientId);
      setDevices(Array.isArray(loaded) ? loaded : []);
    } catch (err: any) {
      console.warn('Failed to load devices in useDeviceManager:', err);
      setError(err?.message ?? 'Failed to load devices');
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
      const updated = await DeviceService.updateDevice(id, updates, patientId);
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
      await DeviceService.removeDevice(id, patientId);
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
