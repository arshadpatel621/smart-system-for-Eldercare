/**
 * camera.controller.ts
 * Express request handlers for all camera API endpoints.
 * Validates inputs, delegates to CameraService, and formats responses.
 * Credentials are NEVER returned in any response.
 */

import { Request, Response } from 'express';
import { CameraService } from './camera.service';
import { probeCamera } from './camera.probe';
import { verifyInternalSecret } from './camera.crypto';
import type { CreateCameraDto, UpdateCameraDto, PTZDirection } from './camera.types';

const VALID_BRANDS = ['cpplus', 'dahua', 'hikvision', 'tplink_tapo', 'ezviz', 'onvif', 'rtsp'];
const VALID_LOCATIONS = ['living_room', 'bedroom', 'kitchen', 'bathroom', 'entrance', 'garden', 'hallway', 'dining_room', 'other'];
const VALID_PTZ = ['left', 'right', 'up', 'down', 'home', 'zoom_in', 'zoom_out', 'stop'];

function isValidIpOrHost(host: string): boolean {
  if (!host || typeof host !== 'string') return false;
  const trimmed = host.trim();
  if (trimmed === 'mock' || trimmed === 'localhost') return true;
  // IPv4 regex (1.0.0.1 to 255.255.255.255 or 0.0.0.0)
  const ipv4Regex = /^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
  if (ipv4Regex.test(trimmed)) return true;
  // Hostname regex (RFC 1123)
  const hostnameRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  return hostnameRegex.test(trimmed);
}

function isValidPort(port: unknown): boolean {
  if (port === undefined || port === null || port === '') return true;
  const num = Number(port);
  return Number.isInteger(num) && num >= 1 && num <= 65535;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export class CameraController {
  constructor(private readonly service: CameraService) {}

  /** GET /api/cameras — list all cameras (public fields only) */
  listCameras = async (_req: Request, res: Response): Promise<void> => {
    try {
      const cameras = await this.service.getCameras();
      res.json(cameras);
    } catch (err: unknown) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  };

  /** GET /api/cameras/statuses — live statuses of all cameras */
  getAllStatuses = async (_req: Request, res: Response): Promise<void> => {
    try {
      const statuses = await this.service.getAllStatuses();
      res.json(statuses);
    } catch (err: unknown) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  };

  /** GET /api/cameras/:id — single camera public record */
  getCamera = async (req: Request, res: Response): Promise<void> => {
    try {
      const camera = await this.service.getCameraById(req.params.id);
      res.json(camera);
    } catch (err: unknown) {
      res.status(404).json({ error: getErrorMessage(err) });
    }
  };

  /** GET /api/cameras/:id/status — live status */
  getCameraStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const status = await this.service.getCameraStatus(req.params.id);
      res.json(status);
    } catch (err: unknown) {
      res.status(404).json({ error: getErrorMessage(err) });
    }
  };

  /** GET /api/cameras/:id/capabilities — actions implemented for this camera */
  getCameraCapabilities = async (req: Request, res: Response): Promise<void> => {
    try {
      const camera = await this.service.getCameraById(req.params.id);
      const supportsPTZ = camera.brand === 'cpplus' || camera.brand === 'dahua';

      res.json({
        supportsPTZ,
        supportsTracking: false,
        supportsNightVision: false,
        supportsTalk: false,
        supportsRecording: true,
        supportsSnapshot: false,
        supportsPresets: false,
      });
    } catch (err: unknown) {
      res.status(404).json({ error: getErrorMessage(err) });
    }
  };

  /** POST /api/cameras — create new camera */
  createCamera = async (req: Request, res: Response): Promise<void> => {
    const {
      name,
      brand,
      location,
      ipAddress,
      port,
      onvifPort,
      username,
      password,
      customRtspPath,
      discoveredRtspPath,
      model,
      firmware,
      serialNumber,
      onvifVersion,
      resolution,
      fps,
      healthStatus,
      enabled,
    } = req.body;

    // Strict Validations
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Camera name is required' });
      return;
    }
    if (!brand || !VALID_BRANDS.includes(brand)) {
      res.status(400).json({ error: `Invalid brand. Valid: ${VALID_BRANDS.join(', ')}` });
      return;
    }
    if (!location || !VALID_LOCATIONS.includes(location)) {
      res.status(400).json({ error: `Invalid location. Valid: ${VALID_LOCATIONS.join(', ')}` });
      return;
    }
    if (!ipAddress || typeof ipAddress !== 'string' || !isValidIpOrHost(ipAddress)) {
      res.status(400).json({ error: 'Valid IP address or hostname is required (e.g. 192.168.1.50)' });
      return;
    }
    if (port !== undefined && !isValidPort(port)) {
      res.status(400).json({ error: 'RTSP port must be an integer between 1 and 65535' });
      return;
    }
    if (onvifPort !== undefined && !isValidPort(onvifPort)) {
      res.status(400).json({ error: 'ONVIF port must be an integer between 1 and 65535' });
      return;
    }
    if (!username || typeof username !== 'string' || !username.trim()) {
      res.status(400).json({ error: 'Username is required' });
      return;
    }
    if (!password || typeof password !== 'string') {
      res.status(400).json({ error: 'Password is required' });
      return;
    }

    const dto: CreateCameraDto = {
      name: name.trim(),
      brand,
      location,
      ipAddress: ipAddress.trim(),
      port: port ? Number(port) : undefined,
      onvifPort: onvifPort ? Number(onvifPort) : undefined,
      username: username.trim(),
      password,
      customRtspPath: customRtspPath && typeof customRtspPath === 'string' ? customRtspPath.trim() : undefined,
      discoveredRtspPath: discoveredRtspPath && typeof discoveredRtspPath === 'string' ? discoveredRtspPath.trim() : undefined,
      model: model && typeof model === 'string' ? model.trim() : undefined,
      firmware: firmware && typeof firmware === 'string' ? firmware.trim() : undefined,
      serialNumber: serialNumber && typeof serialNumber === 'string' ? serialNumber.trim() : undefined,
      onvifVersion: onvifVersion && typeof onvifVersion === 'string' ? onvifVersion.trim() : undefined,
      resolution: resolution && typeof resolution === 'string' ? resolution.trim() : undefined,
      fps: fps ? Number(fps) : undefined,
      healthStatus: healthStatus || 'healthy',
      enabled: enabled !== undefined ? Boolean(enabled) : true,
    };

    try {
      const camera = await this.service.createCamera(dto);
      res.status(201).json(camera);
    } catch (err: unknown) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  };

  /** PUT /api/cameras/:id — update camera */
  updateCamera = async (req: Request, res: Response): Promise<void> => {
    const {
      name,
      brand,
      location,
      ipAddress,
      port,
      onvifPort,
      username,
      password,
      customRtspPath,
      discoveredRtspPath,
      model,
      firmware,
      serialNumber,
      onvifVersion,
      resolution,
      fps,
      healthStatus,
      enabled,
    } = req.body;

    if (brand && !VALID_BRANDS.includes(brand)) {
      res.status(400).json({ error: `Invalid brand` });
      return;
    }
    if (location && !VALID_LOCATIONS.includes(location)) {
      res.status(400).json({ error: `Invalid location` });
      return;
    }
    if (ipAddress !== undefined && !isValidIpOrHost(ipAddress)) {
      res.status(400).json({ error: 'Invalid IP address or hostname' });
      return;
    }
    if (port !== undefined && !isValidPort(port)) {
      res.status(400).json({ error: 'RTSP port must be an integer between 1 and 65535' });
      return;
    }
    if (onvifPort !== undefined && !isValidPort(onvifPort)) {
      res.status(400).json({ error: 'ONVIF port must be an integer between 1 and 65535' });
      return;
    }

    const dto: UpdateCameraDto = {
      ...(name !== undefined && { name: name.trim() }),
      ...(brand !== undefined && { brand }),
      ...(location !== undefined && { location }),
      ...(ipAddress !== undefined && { ipAddress: ipAddress.trim() }),
      ...(port !== undefined && { port: Number(port) }),
      ...(onvifPort !== undefined && { onvifPort: Number(onvifPort) }),
      ...(username !== undefined && { username: username.trim() }),
      ...(password !== undefined && password !== '' && { password }),
      ...(customRtspPath !== undefined && { customRtspPath: customRtspPath ? customRtspPath.trim() : undefined }),
      ...(discoveredRtspPath !== undefined && { discoveredRtspPath: discoveredRtspPath ? discoveredRtspPath.trim() : undefined }),
      ...(model !== undefined && { model: model ? model.trim() : undefined }),
      ...(firmware !== undefined && { firmware: firmware ? firmware.trim() : undefined }),
      ...(serialNumber !== undefined && { serialNumber: serialNumber ? serialNumber.trim() : undefined }),
      ...(onvifVersion !== undefined && { onvifVersion: onvifVersion ? onvifVersion.trim() : undefined }),
      ...(resolution !== undefined && { resolution: resolution ? resolution.trim() : undefined }),
      ...(fps !== undefined && { fps: Number(fps) }),
      ...(healthStatus !== undefined && { healthStatus }),
      ...(enabled !== undefined && { enabled: Boolean(enabled) }),
    };

    try {
      const camera = await this.service.updateCamera(req.params.id, dto);
      res.json(camera);
    } catch (err: unknown) {
      res.status(400).json({ error: getErrorMessage(err) });
    }
  };

  /** DELETE /api/cameras/:id */
  deleteCamera = async (req: Request, res: Response): Promise<void> => {
    try {
      await this.service.deleteCamera(req.params.id);
      res.json({ success: true, message: 'Camera deleted' });
    } catch (err: unknown) {
      res.status(400).json({ error: getErrorMessage(err) });
    }
  };

  /** POST /api/cameras/:id/toggle — enable or disable */
  toggleCamera = async (req: Request, res: Response): Promise<void> => {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      res.status(400).json({ error: 'enabled must be a boolean' });
      return;
    }
    try {
      const camera = await this.service.toggleCamera(req.params.id, enabled);
      res.json(camera);
    } catch (err: unknown) {
      res.status(400).json({ error: getErrorMessage(err) });
    }
  };

  /** POST /api/cameras/:id/test — run connection probe on existing camera */
  testConnection = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.service.testConnection(req.params.id);
      res.json(result);
    } catch (err: unknown) {
      res.status(400).json({ error: getErrorMessage(err) });
    }
  };

  /** POST /api/cameras/test — run connection probe before saving */
  testAdHocConnection = async (req: Request, res: Response): Promise<void> => {
    const { ipAddress, brand, port, onvifPort, username, password, customRtspPath } = req.body;
    if (!ipAddress || typeof ipAddress !== 'string' || !isValidIpOrHost(ipAddress)) {
      res.status(400).json({ error: 'Valid IP address or hostname is required (e.g. 192.168.1.50)' });
      return;
    }
    if (port !== undefined && !isValidPort(port)) {
      res.status(400).json({ error: 'RTSP port must be between 1 and 65535' });
      return;
    }
    if (onvifPort !== undefined && !isValidPort(onvifPort)) {
      res.status(400).json({ error: 'ONVIF port must be between 1 and 65535' });
      return;
    }

    try {
      const result = await probeCamera(
        ipAddress.trim(),
        brand || 'cpplus',
        port ? Number(port) : 554,
        onvifPort ? Number(onvifPort) : (brand === 'cpplus' ? 8899 : 80),
        username?.trim() || 'admin',
        password || '',
        customRtspPath?.trim() || undefined
      );
      res.json(result);
    } catch (err: unknown) {
      res.status(400).json({ error: getErrorMessage(err) });
    }
  };

  /** GET /api/cameras/:id/stream — MJPEG stream */
  streamCamera = async (req: Request, res: Response): Promise<void> => {
    try {
      await this.service.addStreamListener(req.params.id, res);
    } catch (err: unknown) {
      if (!res.headersSent) {
        res.status(400).json({ error: getErrorMessage(err) });
      }
    }
  };

  /** POST /api/cameras/:id/ptz — PTZ movement */
  controlPTZ = async (req: Request, res: Response): Promise<void> => {
    const { action, speed } = req.body;
    if (!VALID_PTZ.includes(action)) {
      res.status(400).json({ error: `Invalid action. Valid: ${VALID_PTZ.join(', ')}` });
      return;
    }
    if (
      speed !== undefined &&
      (typeof speed !== 'number' || !Number.isFinite(speed) || speed < 1 || speed > 10)
    ) {
      res.status(400).json({ error: 'Speed must be a number between 1 and 10' });
      return;
    }
    try {
      const result = await this.service.controlPTZ(req.params.id, action as PTZDirection, speed);
      if (result.success) {
        res.json({ message: result.message });
      } else {
        res.status(502).json({ error: result.message });
      }
    } catch (err: unknown) {
      res.status(400).json({ error: getErrorMessage(err) });
    }
  };

  /** POST /api/cameras/:id/recordings — record the existing shared MJPEG stream */
  startRecording = async (req: Request, res: Response): Promise<void> => {
    const duration = req.body?.duration;
    if (
      duration !== undefined &&
      (!Number.isInteger(duration) || duration < 1 || duration > 3600)
    ) {
      res.status(400).json({ error: 'Duration must be an integer between 1 and 3600 seconds' });
      return;
    }

    try {
      const recording = await this.service.startRecording(req.params.id, duration);
      res.status(202).json(recording);
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      res.status(message.startsWith('Camera not found:') ? 404 : 400).json({ error: message });
    }
  };

  /** POST /api/cameras/:id/recordings/:recordingId/stop */
  stopRecording = async (req: Request, res: Response): Promise<void> => {
    try {
      const recording = await this.service.stopRecording(
        req.params.id,
        req.params.recordingId,
      );
      res.json(recording);
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      res.status(message.startsWith('No active recording') ? 404 : 500).json({ error: message });
    }
  };

  /** GET /api/cameras/:id/recordings — completed playable recordings */
  listRecordings = async (req: Request, res: Response): Promise<void> => {
    try {
      const recordings = await this.service.listRecordings(req.params.id);
      res.json({ recordings });
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      res.status(message.startsWith('Camera not found:') ? 404 : 500).json({ error: message });
    }
  };

  /** GET /api/cameras/:id/recordings/:recordingId — inline MP4 playback */
  playRecording = (req: Request, res: Response): void => {
    const filePath = this.service.getRecordingPath(req.params.id, req.params.recordingId);
    if (!filePath) {
      res.status(404).json({ error: 'Completed MP4 recording not found.' });
      return;
    }

    res.type('video/mp4').sendFile(filePath, { dotfiles: 'deny' }, (err: Error) => {
      if (err && !res.headersSent) {
        res.status(500).json({ error: 'Could not stream the recording.' });
      }
    });
  };

  /** GET /api/cameras/:id/recordings/:recordingId/download */
  downloadRecording = (req: Request, res: Response): void => {
    const filePath = this.service.getRecordingPath(req.params.id, req.params.recordingId);
    if (!filePath) {
      res.status(404).json({ error: 'Completed MP4 recording not found.' });
      return;
    }

    res.download(filePath, req.params.recordingId, (err: Error) => {
      if (err && !res.headersSent) {
        res.status(500).json({ error: 'Could not download the recording.' });
      }
    });
  };

  /** GET /api/cameras/discover — scan LAN for ONVIF cameras */
  discoverCameras = async (_req: Request, res: Response): Promise<void> => {
    try {
      const devices = await this.service.discoverCameras();
      res.json(devices);
    } catch (err: unknown) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  };

  /** GET /api/cameras/:id/ai-consumer — stream info for AI services */
  getAIConsumer = async (req: Request, res: Response): Promise<void> => {
    try {
      const internalHeader = req.headers['x-internal-secret'] || req.headers['authorization'];
      const isAuthorizedInternal = verifyInternalSecret(internalHeader);

      const info = await this.service.getAIStreamConsumer(req.params.id, isAuthorizedInternal);
      res.json(info);
    } catch (err: unknown) {
      res.status(404).json({ error: getErrorMessage(err) });
    }
  };
}
