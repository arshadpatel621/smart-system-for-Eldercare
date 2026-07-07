/**
 * camera.repository.ts
 * Repository pattern for camera data persistence.
 *
 * Architecture:
 *   CameraRepository (interface) ─── can be implemented by:
 *     JsonCameraRepository   ← current (development)
 *     PostgresCameraRepository ← future
 *     FirebaseCameraRepository ← future
 *
 * Business logic (CameraService) depends ONLY on the interface,
 * making storage backends fully interchangeable with zero service changes.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { encrypt, decrypt, isEncrypted } from './camera.crypto';
import type {
  CameraRecord,
  CameraRepository,
  CreateCameraDto,
  UpdateCameraDto,
} from './camera.types';

// ─── Helper ───────────────────────────────────────────────────────────────────

function generateId(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

// ─── JSON File Repository ─────────────────────────────────────────────────────

const DB_PATH = path.resolve(__dirname, '../data/cameras.json');

/**
 * JsonCameraRepository — stores camera records in a local JSON file.
 *
 * Data file format: { "cameras": CameraRecord[] }
 *
 * To migrate to PostgreSQL/Firebase, implement CameraRepository with a new
 * class and inject it in index.ts. No service code changes required.
 */
export class JsonCameraRepository implements CameraRepository {

  /** Reads all records from the JSON file. */
  private readAll(): CameraRecord[] {
    try {
      if (!fs.existsSync(DB_PATH)) {
        fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
        fs.writeFileSync(DB_PATH, JSON.stringify({ cameras: [] }, null, 2));
      }
      const raw = fs.readFileSync(DB_PATH, 'utf8');
      const parsed = JSON.parse(raw) as { cameras?: CameraRecord[] };
      return parsed.cameras ?? [];
    } catch (err) {
      console.error('[CameraRepository] Failed to read database:', err);
      return [];
    }
  }

  /** Writes all records back to the JSON file atomically. */
  private writeAll(cameras: CameraRecord[]): void {
    try {
      fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
      // Write to a temp file first, then rename (atomic write)
      const tmp = DB_PATH + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify({ cameras }, null, 2));
      fs.renameSync(tmp, DB_PATH);
    } catch (err) {
      console.error('[CameraRepository] Failed to write database:', err);
      throw new Error('Database write failed');
    }
  }

  async findAll(): Promise<CameraRecord[]> {
    return this.readAll();
  }

  async findById(id: string): Promise<CameraRecord | null> {
    const cameras = this.readAll();
    return cameras.find((c) => c.id === id) ?? null;
  }

  async create(dto: CreateCameraDto): Promise<CameraRecord> {
    const cameras = this.readAll();

    // Encrypt credentials before storage — NEVER store plaintext
    const passwordEncrypted = encrypt(dto.password);
    const rtspUrlEncrypted = dto.customRtspPath
      ? encrypt(dto.customRtspPath)
      : undefined;

    const record: CameraRecord = {
      id: generateId(),
      name: dto.name,
      brand: dto.brand,
      location: dto.location,
      ipAddress: dto.ipAddress,
      port: dto.port ?? 554,
      onvifPort: dto.onvifPort ?? 80,
      username: dto.username,
      passwordEncrypted,
      rtspUrlEncrypted,
      enabled: false, // Cameras start disabled — user must explicitly enable
      healthStatus: 'unknown',
      createdAt: now(),
      updatedAt: now(),
    };

    cameras.push(record);
    this.writeAll(cameras);
    console.log(`[CameraRepository] Camera created: ${record.name} (${record.id})`);
    return record;
  }

  async update(id: string, dto: UpdateCameraDto): Promise<CameraRecord> {
    const cameras = this.readAll();
    const idx = cameras.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error(`Camera not found: ${id}`);

    const existing = cameras[idx];
    const updated: CameraRecord = {
      ...existing,
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.brand !== undefined && { brand: dto.brand }),
      ...(dto.location !== undefined && { location: dto.location }),
      ...(dto.ipAddress !== undefined && { ipAddress: dto.ipAddress }),
      ...(dto.port !== undefined && { port: dto.port }),
      ...(dto.onvifPort !== undefined && { onvifPort: dto.onvifPort }),
      ...(dto.username !== undefined && { username: dto.username }),
      ...(dto.enabled !== undefined && { enabled: dto.enabled }),
      updatedAt: now(),
    };

    // Re-encrypt password only if a new one is provided
    if (dto.password) {
      updated.passwordEncrypted = encrypt(dto.password);
    }

    // Re-encrypt custom RTSP path only if a new one is provided
    if (dto.customRtspPath !== undefined) {
      updated.rtspUrlEncrypted = dto.customRtspPath
        ? encrypt(dto.customRtspPath)
        : undefined;
    }

    cameras[idx] = updated;
    this.writeAll(cameras);
    console.log(`[CameraRepository] Camera updated: ${updated.name} (${id})`);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const cameras = this.readAll();
    const filtered = cameras.filter((c) => c.id !== id);
    if (filtered.length === cameras.length) {
      throw new Error(`Camera not found: ${id}`);
    }
    this.writeAll(filtered);
    console.log(`[CameraRepository] Camera deleted: ${id}`);
  }

  async setEnabled(id: string, enabled: boolean): Promise<CameraRecord> {
    return this.update(id, { enabled });
  }

  async updateMetadata(
    id: string,
    metadata: Partial<Pick<CameraRecord,
      'model' | 'firmware' | 'serialNumber' | 'onvifVersion' |
      'discoveredRtspPath' | 'resolution' | 'fps' | 'lastConnected' | 'healthStatus'
    >>
  ): Promise<CameraRecord> {
    const cameras = this.readAll();
    const idx = cameras.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error(`Camera not found: ${id}`);

    cameras[idx] = { ...cameras[idx], ...metadata, updatedAt: now() };
    this.writeAll(cameras);
    return cameras[idx];
  }
}

// ─── Credential Helpers ───────────────────────────────────────────────────────

/**
 * Decrypts the camera password from the stored record.
 * Used internally by the service layer ONLY — never returned to frontend.
 */
export function getDecryptedPassword(record: CameraRecord): string {
  return decrypt(record.passwordEncrypted);
}

/**
 * Decrypts the stored custom RTSP path.
 * Used internally by the service layer ONLY — never returned to frontend.
 */
export function getDecryptedRtspPath(record: CameraRecord): string | undefined {
  if (!record.rtspUrlEncrypted) return undefined;
  return decrypt(record.rtspUrlEncrypted);
}
