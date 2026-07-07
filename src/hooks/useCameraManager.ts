/**
 * src/hooks/useCameraManager.ts
 * State management hook for the Camera Management admin page.
 * Handles CRUD operations, connection testing, and enable/disable toggling.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  fetchCameras, createCamera, updateCamera, deleteCamera,
  toggleCamera, testCameraConnection,
  type CameraPublicRecord, type CreateCameraInput,
  type UpdateCameraInput, type ProbeResult,
} from '../services/camera';

export function useCameraManager() {
  const [cameras, setCameras] = useState<CameraPublicRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [probeResult, setProbeResult] = useState<ProbeResult | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  /** Loads all cameras from server */
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchCameras();
      setCameras(list);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load cameras');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  /** Creates a new camera */
  const addCamera = async (input: CreateCameraInput): Promise<boolean> => {
    try {
      const created = await createCamera(input);
      setCameras((prev) => [...prev, created]);
      return true;
    } catch (err: any) {
      setError(err.message); return false;
    }
  };

  /** Updates an existing camera */
  const editCamera = async (id: string, input: UpdateCameraInput): Promise<boolean> => {
    try {
      const updated = await updateCamera(id, input);
      setCameras((prev) => prev.map((c) => (c.id === id ? updated : c)));
      return true;
    } catch (err: any) {
      setError(err.message); return false;
    }
  };

  /** Deletes a camera */
  const removeCamera = async (id: string): Promise<boolean> => {
    setDeletingId(id);
    try {
      await deleteCamera(id);
      setCameras((prev) => prev.filter((c) => c.id !== id));
      return true;
    } catch (err: any) {
      setError(err.message); return false;
    } finally {
      setDeletingId(null);
    }
  };

  /** Enables or disables a camera stream */
  const toggle = async (id: string, enabled: boolean): Promise<void> => {
    setTogglingId(id);
    try {
      const updated = await toggleCamera(id, enabled);
      setCameras((prev) => prev.map((c) => (c.id === id ? updated : c)));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTogglingId(null);
    }
  };

  /** Runs a connection probe and stores the result */
  const runTest = async (id: string): Promise<ProbeResult | null> => {
    setTestingId(id);
    setProbeResult(null);
    try {
      const result = await testCameraConnection(id);
      setProbeResult(result);
      // Update camera metadata in local state after probe
      if (result.model || result.resolution) {
        setCameras((prev) =>
          prev.map((c) =>
            c.id === id
              ? { ...c, model: result.model ?? c.model, resolution: result.resolution ?? c.resolution, fps: result.fps ?? c.fps, healthStatus: result.success ? 'healthy' : 'offline' }
              : c
          )
        );
      }
      return result;
    } catch (err: any) {
      setError(err.message); return null;
    } finally {
      setTestingId(null);
    }
  };

  return {
    cameras, loading, error, testingId, probeResult,
    deletingId, togglingId,
    refresh, addCamera, editCamera, removeCamera, toggle, runTest,
    clearError: () => setError(null),
    clearProbe: () => setProbeResult(null),
  };
}
