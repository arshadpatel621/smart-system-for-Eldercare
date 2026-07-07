/**
 * src/hooks/useCamera.ts
 * Hook for the Live Monitor page — subscribes to WebSocket status
 * and provides stream URL + PTZ controls for a single camera.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  fetchCameraStatus, moveCamera, toggleCamera, getWebSocketUrl, getStreamUrl,
  type CameraStatus, type PTZDirection,
} from '../services/camera';

export function useCamera(cameraId: string) {
  const [status, setStatus] = useState<CameraStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ptzLoading, setPtzLoading] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCameraStatus(cameraId);
      setStatus(data);
      setError(null);
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch status');
    } finally {
      setLoading(false);
    }
  }, [cameraId]);

  useEffect(() => {
    let mounted = true;
    let reconnectTimer: NodeJS.Timeout;

    const connect = () => {
      try {
        const ws = new WebSocket(getWebSocketUrl());
        wsRef.current = ws;

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
          reconnectTimer = setTimeout(connect, 5000);
        };
        ws.onerror = () => ws.close();
      } catch { /* ignore */ }
    };

    connect();
    void refreshStatus();

    return () => {
      mounted = false;
      clearTimeout(reconnectTimer);
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
    } catch (err: any) {
      setError(err.message ?? 'Failed to start camera');
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
    } catch (err: any) {
      setError(err.message ?? 'Failed to stop camera');
    } finally {
      setLoading(false);
    }
  };

  const triggerPTZ = async (action: PTZDirection) => {
    setPtzLoading(true);
    try {
      await moveCamera(cameraId, action);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPtzLoading(false);
    }
  };

  return {
    status, loading, error, ptzLoading,
    start, stop, triggerPTZ, refresh: refreshStatus,
    streamUrl: getStreamUrl(cameraId),
  };
}
