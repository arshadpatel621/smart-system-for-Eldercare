/**
 * watch.repository.ts
 * Repository pattern for Smart Watch data persistence.
 *
 * Architecture mirrors JsonCameraRepository exactly:
 *   WatchRepository (interface) — defined in watch.types.ts
 *   JsonWatchRepository         — current implementation (JSON file)
 *   FirebaseWatchRepository     — future (swap in index.ts with zero service changes)
 *
 * Data file: server/data/watches.json
 * Format   : { "watches": WatchRecord[] }
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
  WatchRecord,
  WatchRepository,
  CreateWatchDto,
  UpdateWatchDto,
} from './watch.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

// ─── JSON File Repository ──────────────────────────────────────────────────────

const DB_PATH = path.resolve(process.cwd(), 'data', 'watches.json');

/**
 * JsonWatchRepository — stores watch records in a local JSON file.
 *
 * Data file format: { "watches": WatchRecord[] }
 *
 * To migrate to Firestore, implement WatchRepository as FirebaseWatchRepository
 * and inject it in index.ts. No service or controller code changes required.
 */
export class JsonWatchRepository implements WatchRepository {

  /** Reads all records from the JSON file. */
  private readAll(): WatchRecord[] {
    try {
      if (!fs.existsSync(DB_PATH)) {
        fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
        fs.writeFileSync(DB_PATH, JSON.stringify({ watches: [] }, null, 2));
      }
      const raw = fs.readFileSync(DB_PATH, 'utf8');
      const parsed = JSON.parse(raw) as { watches?: WatchRecord[] };
      return parsed.watches ?? [];
    } catch (err) {
      console.error('[WatchRepository] Failed to read database:', err);
      return [];
    }
  }

  /** Writes all records back to the JSON file atomically. */
  private writeAll(watches: WatchRecord[]): void {
    try {
      fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
      // Atomic write: write to temp file then rename
      const tmp = DB_PATH + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify({ watches }, null, 2));
      fs.renameSync(tmp, DB_PATH);
    } catch (err) {
      console.error('[WatchRepository] Failed to write database:', err);
      throw new Error('Database write failed');
    }
  }

  async findAll(): Promise<WatchRecord[]> {
    return this.readAll();
  }

  async findById(id: string): Promise<WatchRecord | null> {
    return this.readAll().find((w) => w.id === id) ?? null;
  }

  async findByResidentId(residentId: string): Promise<WatchRecord[]> {
    return this.readAll().filter((w) => w.residentId === residentId);
  }

  async create(dto: CreateWatchDto): Promise<WatchRecord> {
    const watches = this.readAll();

    const record: WatchRecord = {
      id: generateId(),
      watchName:     dto.watchName.trim(),
      bluetoothName: dto.bluetoothName.trim(),
      macAddress:    dto.macAddress.trim().toUpperCase(),
      residentId:    dto.residentId,
      healthSource:  dto.healthSource,
      firmware:      dto.firmware,
      battery:       dto.battery,
      rssi:          dto.rssi,
      createdAt:     now(),
      updatedAt:     now(),
    };

    watches.push(record);
    this.writeAll(watches);
    console.log(`[WatchRepository] Watch created: ${record.watchName} (${record.id})`);
    return record;
  }

  async update(id: string, dto: UpdateWatchDto): Promise<WatchRecord> {
    const watches = this.readAll();
    const idx = watches.findIndex((w) => w.id === id);
    if (idx === -1) throw new Error(`Watch not found: ${id}`);

    const existing = watches[idx];
    const updated: WatchRecord = {
      ...existing,
      ...(dto.watchName     !== undefined && { watchName:     dto.watchName.trim() }),
      ...(dto.bluetoothName !== undefined && { bluetoothName: dto.bluetoothName.trim() }),
      ...(dto.macAddress    !== undefined && { macAddress:    dto.macAddress.trim().toUpperCase() }),
      ...(dto.residentId    !== undefined && { residentId:    dto.residentId }),
      ...(dto.healthSource  !== undefined && { healthSource:  dto.healthSource }),
      ...(dto.firmware      !== undefined && { firmware:      dto.firmware }),
      ...(dto.battery       !== undefined && { battery:       dto.battery }),
      ...(dto.rssi          !== undefined && { rssi:          dto.rssi }),
      ...(dto.lastSeen      !== undefined && { lastSeen:      dto.lastSeen }),
      updatedAt: now(),
    };

    watches[idx] = updated;
    this.writeAll(watches);
    console.log(`[WatchRepository] Watch updated: ${updated.watchName} (${id})`);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const watches = this.readAll();
    const filtered = watches.filter((w) => w.id !== id);
    if (filtered.length === watches.length) {
      throw new Error(`Watch not found: ${id}`);
    }
    this.writeAll(filtered);
    console.log(`[WatchRepository] Watch deleted: ${id}`);
  }

  async updateLastSeen(
    id: string,
    metadata: Partial<Pick<WatchRecord, 'battery' | 'rssi' | 'firmware' | 'lastSeen'>>,
  ): Promise<WatchRecord> {
    const watches = this.readAll();
    const idx = watches.findIndex((w) => w.id === id);
    if (idx === -1) throw new Error(`Watch not found: ${id}`);

    watches[idx] = {
      ...watches[idx],
      ...metadata,
      lastSeen: metadata.lastSeen ?? now(),
      updatedAt: now(),
    };
    this.writeAll(watches);
    return watches[idx];
  }
}
