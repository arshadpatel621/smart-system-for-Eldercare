/**
 * src/hooks/useWatchManager.ts
 * State management hook for the Watch Management page.
 * Mirrors useCameraManager.ts structure exactly.
 *
 * Handles:
 *   - CRUD operations via REST API
 *   - BLE scan (Web Bluetooth device picker)
 *   - BLE connection test (step-by-step diagnostic)
 *   - Test result persistence (POST to server after BLE test)
 */

import { useState, useCallback, useEffect } from 'react';
import {
  fetchWatches,
  createWatch,
  updateWatch,
  deleteWatch,
  scanBLEDevice,
  runBLEConnectionTest,
  postBLETestResult,
} from '../services/watchService';
import type {
  Watch, CreateWatchInput, UpdateWatchInput,
  ScannedBLEDevice, WatchTestResult, BLETestStep,
} from '../types/watch';

export function useWatchManager() {
  const [watches,   setWatches]   = useState<Watch[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  // BLE test state (mirrors testingId / probeResult in useCameraManager)
  const [testingId,   setTestingId]   = useState<string | null>(null);
  const [testSteps,   setTestSteps]   = useState<BLETestStep[]>([]);
  const [testResult,  setTestResult]  = useState<WatchTestResult | null>(null);

  // Deletion loading state
  const [deletingId,  setDeletingId]  = useState<string | null>(null);

  // BLE scan state
  const [scanning,    setScanning]    = useState(false);

  /** Loads all watches from server. */
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchWatches();
      setWatches(list);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load watches');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  /** Creates a new watch. */
  const addWatch = async (input: CreateWatchInput): Promise<boolean> => {
    try {
      const created = await createWatch(input);
      setWatches((prev) => [...prev, created]);
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  };

  /** Updates an existing watch. */
  const editWatch = async (id: string, input: UpdateWatchInput): Promise<boolean> => {
    try {
      const updated = await updateWatch(id, input);
      setWatches((prev) => prev.map((w) => (w.id === id ? updated : w)));
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  };

  /** Deletes a watch. */
  const removeWatch = async (id: string): Promise<boolean> => {
    setDeletingId(id);
    try {
      await deleteWatch(id);
      setWatches((prev) => prev.filter((w) => w.id !== id));
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setDeletingId(null);
    }
  };

  /**
   * Opens the browser BLE device picker and returns the selected device.
   * Used in the "Scan Device" tab (like the Camera Discovery tab).
   */
  const scanDevice = async (): Promise<ScannedBLEDevice | null> => {
    setScanning(true);
    setError(null);
    try {
      const device = await scanBLEDevice();
      return device;
    } catch (err: any) {
      if (!err.message?.includes('cancelled') && !err.message?.includes('chosen')) {
        setError(err.message ?? 'BLE scan failed');
      }
      return null;
    } finally {
      setScanning(false);
    }
  };

  /**
   * Runs the step-by-step BLE connection test.
   * Mirrors runTest() in useCameraManager.
   * After completion, POSTs the result to the server for persistence.
   */
  const runTest = async (watchId: string, targetName?: string): Promise<WatchTestResult | null> => {
    setTestingId(watchId);
    setTestResult(null);
    setTestSteps([]);

    try {
      const result = await runBLEConnectionTest(
        (steps) => setTestSteps(steps),
        targetName,
      );

      setTestResult(result);

      // Persist the result and update local state with refreshed watch
      try {
        const { watch: updated } = await postBLETestResult(watchId, result);
        setWatches((prev) => prev.map((w) => (w.id === watchId ? updated : w)));
      } catch {
        // Non-fatal: BLE result stored locally even if server persistence fails
      }

      return result;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setTestingId(null);
    }
  };

  return {
    watches,
    loading,
    error,
    testingId,
    testSteps,
    testResult,
    deletingId,
    scanning,
    refresh,
    addWatch,
    editWatch,
    removeWatch,
    scanDevice,
    runTest,
    clearError:      () => setError(null),
    clearTestResult: () => { setTestResult(null); setTestSteps([]); },
  };
}
