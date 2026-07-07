/**
 * camera.controller.ts
 * Express request handlers for all camera API endpoints.
 * Validates inputs, delegates to CameraService, and formats responses.
 * Credentials are NEVER returned in any response.
 */

import { Request, Response } from 'express';
import { CameraService } from './camera.service';
import type { CreateCameraDto, UpdateCameraDto, PTZDirection } from './camera.types';

const VALID_BRANDS = ['cpplus', 'dahua', 'hikvision', 'tplink_tapo', 'ezviz', 'onvif', 'rtsp'];
const VALID_LOCATIONS = ['living_room', 'bedroom', 'kitchen', 'bathroom', 'entrance', 'garden', 'hallway', 'dining_room', 'other'];
const VALID_PTZ = ['left', 'right', 'up', 'down', 'home'];

export class CameraController {
  constructor(private readonly service: CameraService) {}

  /** GET /api/cameras — list all cameras (public fields only) */
  listCameras = async (_req: Request, res: Response) => {
    try {
      const cameras = await this.service.getCameras();
      res.json(cameras);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  /** GET /api/cameras/statuses — live statuses of all cameras */
  getAllStatuses = async (_req: Request, res: Response) => {
    try {
      const statuses = await this.service.getAllStatuses();
      res.json(statuses);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  /** GET /api/cameras/:id — single camera public record */
  getCamera = async (req: Request, res: Response) => {
    try {
      const camera = await this.service.getCameraById(req.params.id);
      res.json(camera);
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  };

  /** GET /api/cameras/:id/status — live status */
  getCameraStatus = async (req: Request, res: Response) => {
    try {
      const status = await this.service.getCameraStatus(req.params.id);
      res.json(status);
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  };

  /** POST /api/cameras — create new camera */
  createCamera = async (req: Request, res: Response) => {
    const { name, brand, location, ipAddress, port, onvifPort, username, password, customRtspPath } = req.body;

    // Validation
    if (!name?.trim()) { res.status(400).json({ error: 'Camera name is required' }); return; }
    if (!VALID_BRANDS.includes(brand)) { res.status(400).json({ error: `Invalid brand. Valid: ${VALID_BRANDS.join(', ')}` }); return; }
    if (!VALID_LOCATIONS.includes(location)) { res.status(400).json({ error: `Invalid location. Valid: ${VALID_LOCATIONS.join(', ')}` }); return; }
    if (!ipAddress?.trim()) { res.status(400).json({ error: 'IP address is required' }); return; }
    if (!username?.trim()) { res.status(400).json({ error: 'Username is required' }); return; }
    if (!password) { res.status(400).json({ error: 'Password is required' }); return; }

    const dto: CreateCameraDto = {
      name: name.trim(),
      brand,
      location,
      ipAddress: ipAddress.trim(),
      port: port ? Number(port) : undefined,
      onvifPort: onvifPort ? Number(onvifPort) : undefined,
      username: username.trim(),
      password,            // Encrypted in repository
      customRtspPath: customRtspPath?.trim() || undefined,
    };

    try {
      const camera = await this.service.createCamera(dto);
      res.status(201).json(camera);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  /** PUT /api/cameras/:id — update camera */
  updateCamera = async (req: Request, res: Response) => {
    const { name, brand, location, ipAddress, port, onvifPort, username, password, customRtspPath, enabled } = req.body;

    if (brand && !VALID_BRANDS.includes(brand)) { res.status(400).json({ error: `Invalid brand` }); return; }
    if (location && !VALID_LOCATIONS.includes(location)) { res.status(400).json({ error: `Invalid location` }); return; }

    const dto: UpdateCameraDto = {
      ...(name !== undefined && { name: name.trim() }),
      ...(brand !== undefined && { brand }),
      ...(location !== undefined && { location }),
      ...(ipAddress !== undefined && { ipAddress: ipAddress.trim() }),
      ...(port !== undefined && { port: Number(port) }),
      ...(onvifPort !== undefined && { onvifPort: Number(onvifPort) }),
      ...(username !== undefined && { username: username.trim() }),
      ...(password !== undefined && { password }),
      ...(customRtspPath !== undefined && { customRtspPath: customRtspPath?.trim() || undefined }),
      ...(enabled !== undefined && { enabled: Boolean(enabled) }),
    };

    try {
      const camera = await this.service.updateCamera(req.params.id, dto);
      res.json(camera);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  };

  /** DELETE /api/cameras/:id */
  deleteCamera = async (req: Request, res: Response) => {
    try {
      await this.service.deleteCamera(req.params.id);
      res.json({ success: true, message: 'Camera deleted' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  };

  /** POST /api/cameras/:id/toggle — enable or disable */
  toggleCamera = async (req: Request, res: Response) => {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      res.status(400).json({ error: 'enabled must be a boolean' });
      return;
    }
    try {
      const camera = await this.service.toggleCamera(req.params.id, enabled);
      res.json(camera);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  };

  /** POST /api/cameras/:id/test — run connection probe */
  testConnection = async (req: Request, res: Response) => {
    try {
      const result = await this.service.testConnection(req.params.id);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  };

  /** GET /api/cameras/:id/stream — MJPEG stream */
  streamCamera = async (req: Request, res: Response) => {
    try {
      await this.service.addStreamListener(req.params.id, res);
    } catch (err: any) {
      if (!res.headersSent) res.status(400).json({ error: err.message });
    }
  };

  /** POST /api/cameras/:id/ptz — PTZ movement */
  controlPTZ = async (req: Request, res: Response) => {
    const { action, speed } = req.body;
    if (!VALID_PTZ.includes(action)) {
      res.status(400).json({ error: `Invalid action. Valid: ${VALID_PTZ.join(', ')}` });
      return;
    }
    try {
      const result = await this.service.controlPTZ(req.params.id, action as PTZDirection, speed);
      if (result.success) res.json({ message: result.message });
      else res.status(502).json({ error: result.message });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  };

  /** GET /api/cameras/discover — scan LAN for ONVIF cameras */
  discoverCameras = async (_req: Request, res: Response) => {
    try {
      const devices = await this.service.discoverCameras();
      res.json(devices);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  /** GET /api/cameras/:id/ai-consumer — stream info for AI services */
  getAIConsumer = async (req: Request, res: Response) => {
    try {
      const info = await this.service.getAIStreamConsumer(req.params.id);
      res.json(info);
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  };
}
