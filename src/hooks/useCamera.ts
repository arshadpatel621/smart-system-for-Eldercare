/**
 * src/hooks/useCamera.ts
 * Hook for the Live Monitor page — subscribes to WebSocket status
 * and provides stream URL + PTZ controls for a single camera.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  fetchCameraStatus, moveCamera, toggleCamera, getWebSocketUrl, getStreamUrl,
  fetchCameraCapabilities, moveCameraPreset, toggleMotionTracking, toggleNightVision, triggerTalk, captureSnapshot, recordVideo,
  stopVideoRecording, fetchCameraRecordings, getRecordingUrl, getRecordingDownloadUrl,
  type CameraStatus, type PTZDirection, type CameraCapabilities
} from '../services/camera';

export type CameraWebSocketStatus = 'connecting' | 'connected' | 'disconnected';

export function useCamera(cameraId: string) {
  const [status, setStatus] = useState<CameraStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<CameraCapabilities | null>(null);
  const [ptzLoading, setPtzLoading] = useState(false);
  const [webSocketStatus, setWebSocketStatus] = useState<CameraWebSocketStatus>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const ptzCommandRef = useRef<Promise<void>>(Promise.resolve());

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    try {
      const [data, caps] = await Promise.all([
        fetchCameraStatus(cameraId),
        fetchCameraCapabilities(cameraId).catch(() => null)
      ]);
      setStatus(data);
      if (caps) setCapabilities(caps);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
    } finally {
      setLoading(false);
    }
  }, [cameraId]);

  useEffect(() => {
    let mounted = true;
    let reconnectTimer: number | undefined;

    const connect = () => {
      if (!mounted) return;
      setWebSocketStatus('connecting');

      try {
        const ws = new WebSocket(getWebSocketUrl());
        wsRef.current = ws;

        ws.onopen = () => {
          if (mounted) setWebSocketStatus('connected');
        };

        ws.onmessage = (ev) => {
          if (!mounted) return;
          try {
            const msg = JSON.parse(ev.data);
            if (msg.type === 'camera_statuses') {
              const match = (msg.data as CameraStatus[]).find((s) => s.id === cameraId);
              if (match) setStatus(match);
            } else if (msg.type === 'camera_status_update' && msg.data?.id === cameraId) {
              setStatus(msg.data as CameraStatus);
            } else if (msg.type === 'ai_alert' && msg.data?.cameraId === cameraId) {
              window.dispatchEvent(new CustomEvent('eldercare-camera-alert', { detail: msg.data }));
            }
          } catch { /* malformed message */ }
        };

        ws.onclose = () => {
          if (!mounted) return;
          setWebSocketStatus('disconnected');
          reconnectTimer = window.setTimeout(connect, 5000);
        };
        ws.onerror = () => ws.close();
      } catch {
        setWebSocketStatus('disconnected');
        reconnectTimer = window.setTimeout(connect, 5000);
      }
    };

    connect();
    void refreshStatus();

    return () => {
      mounted = false;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [cameraId, refreshStatus]);

  /**
   * Enables the camera and triggers stream start on the backend.
   * The MJPEG stream will begin flowing to the <img> element once enabled.
   */
  const start = async () => {
    setLoading(true);
    try {
      await toggleCamera(cameraId, true);
      setError(null);
      // Refresh status after toggling
      await refreshStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start camera');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Disables the camera and stops its FFmpeg process on the backend.
   */
  const stop = async () => {
    setLoading(true);
    try {
      await toggleCamera(cameraId, false);
      setError(null);
      setStatus((prev) => prev ? { ...prev, status: 'OFFLINE' } : prev);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to stop camera');
    } finally {
      setLoading(false);
    }
  };

  const triggerPTZ = (action: PTZDirection) => {
    const command = ptzCommandRef.current.catch(() => undefined).then(async () => {
      setPtzLoading(true);
      try {
        await moveCamera(cameraId, action);
        setError(null);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'PTZ action failed');
      } finally {
        setPtzLoading(false);
      }
    });
    ptzCommandRef.current = command;
    return command;
  };

  const record = useCallback(async (duration: number) => {
    try {
      const recording = await recordVideo(cameraId, duration);
      setError(null);
      return recording;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start recording');
      throw err;
    }
  }, [cameraId]);

  const stopRecording = useCallback(async (recordingId: string) => {
    try {
      const recording = await stopVideoRecording(cameraId, recordingId);
      setError(null);
      return recording;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to stop recording');
      throw err;
    }
  }, [cameraId]);

  const loadRecordings = useCallback(async () => {
    try {
      const recordings = await fetchCameraRecordings(cameraId);
      setError(null);
      return recordings;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load recordings');
      throw err;
    }
  }, [cameraId]);

  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const executeAction = async (actionFn: () => Promise<{ message?: string }>) => {
    try {
      const res = await actionFn();
      setActionSuccess(res.message || 'Success');
      setTimeout(() => setActionSuccess(null), 3000); // clear after 3s
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Action failed');
      setActionSuccess(null);
    }
  };

  return {
    status, loading, error, actionSuccess, ptzLoading, capabilities, webSocketStatus,
    start, stop, triggerPTZ, refresh: refreshStatus,
    streamUrl: getStreamUrl(cameraId),
    gotoPreset: (preset: string) => executeAction(() => moveCameraPreset(cameraId, preset)),
    setMotionTracking: (enabled: boolean) => executeAction(() => toggleMotionTracking(cameraId, enabled)),
    setNightVision: (enabled: boolean) => executeAction(() => toggleNightVision(cameraId, enabled)),
    talk: () => executeAction(() => triggerTalk(cameraId)),
    snapshot: () => executeAction(() => captureSnapshot(cameraId)),
    record,
    stopRecording,
    loadRecordings,
    recordingUrl: (recordingId: string) => getRecordingUrl(cameraId, recordingId),
    recordingDownloadUrl: (recordingId: string) => getRecordingDownloadUrl(cameraId, recordingId),
  };
}
