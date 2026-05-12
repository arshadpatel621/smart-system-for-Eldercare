import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { cloneDemoData } from './mockData';
import { db, elderId as defaultElderId, hasFirebaseConfig } from './firebase';
import type {
  AlertRecord,
  CareContact,
  DeviceConnection,
  EldercareData,
  ElderProfile,
  HealthMetric,
  Medication,
  MedicationLog,
  SafetyEvent,
} from '../types/eldercare';

const STORAGE_KEY = 'eldercare-demo-data';

function getStorageKey(targetElderId: string) {
  return `${STORAGE_KEY}:${targetElderId}`;
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function loadLocalEldercareData(targetElderId = defaultElderId, fullName?: string) {
  const storageKey = getStorageKey(targetElderId);
  const saved = window.localStorage.getItem(storageKey);
  if (!saved) {
    const seeded = cloneDemoData({ elderId: targetElderId, fullName });
    window.localStorage.setItem(storageKey, JSON.stringify(seeded));
    return seeded;
  }
  return JSON.parse(saved) as EldercareData;
}

function saveLocalData(data: EldercareData, targetElderId = data.profile.id) {
  window.localStorage.setItem(getStorageKey(targetElderId), JSON.stringify(data));
}

async function loadRemoteCollection<T>(name: string, targetElderId: string) {
  const elderRef = doc(db!, 'elders', targetElderId);
  const snapshot = await getDocs(collection(elderRef, name));
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })) as T[];
}

async function persistRemoteCollection<T extends { id: string }>(name: string, value: T, targetElderId: string) {
  const elderRef = doc(db!, 'elders', targetElderId);
  await setDoc(doc(collection(elderRef, name), value.id), value);
}

async function seedRemoteProfile(profile: ElderProfile, targetElderId: string) {
  const elderRef = doc(db!, 'elders', targetElderId);
  await setDoc(elderRef, profile);
}

export async function loadEldercareData(targetElderId = defaultElderId) {
  if (!hasFirebaseConfig || !db) {
    return loadLocalEldercareData(targetElderId);
  }

  const elderRef = doc(db, 'elders', targetElderId);
  const profileSnapshot = await getDoc(elderRef);

  if (!profileSnapshot.exists()) {
    const seeded = loadLocalEldercareData(targetElderId);
    await persistData(seeded, targetElderId);
    return seeded;
  }

  return {
    profile: { id: profileSnapshot.id, ...profileSnapshot.data() } as ElderProfile,
    contacts: await loadRemoteCollection<CareContact>('contacts', targetElderId),
    metrics: await loadRemoteCollection<HealthMetric>('metrics', targetElderId),
    medications: await loadRemoteCollection<Medication>('medications', targetElderId),
    medicationLogs: await loadRemoteCollection<MedicationLog>('medicationLogs', targetElderId),
    devices: await loadRemoteCollection<DeviceConnection>('devices', targetElderId),
    safetyEvents: await loadRemoteCollection<SafetyEvent>('safetyEvents', targetElderId),
    alerts: await loadRemoteCollection<AlertRecord>('alerts', targetElderId),
  } satisfies EldercareData;
}

async function persistData(data: EldercareData, targetElderId = data.profile.id) {
  if (!hasFirebaseConfig || !db) {
    saveLocalData(data, targetElderId);
    return;
  }

  await seedRemoteProfile(data.profile, targetElderId);
  await Promise.all([
    ...data.contacts.map((contact) => persistRemoteCollection('contacts', contact, targetElderId)),
    ...data.metrics.map((metric) => persistRemoteCollection('metrics', metric, targetElderId)),
    ...data.medications.map((medication) => persistRemoteCollection('medications', medication, targetElderId)),
    ...data.medicationLogs.map((log) => persistRemoteCollection('medicationLogs', log, targetElderId)),
    ...data.devices.map((device) => persistRemoteCollection('devices', device, targetElderId)),
    ...data.safetyEvents.map((event) => persistRemoteCollection('safetyEvents', event, targetElderId)),
    ...data.alerts.map((alert) => persistRemoteCollection('alerts', alert, targetElderId)),
  ]);
}

export async function saveProfile(profile: ElderProfile, targetElderId = profile.id) {
  const data = await loadEldercareData(targetElderId);
  const next = { ...data, profile };
  await persistData(next, targetElderId);
  return next;
}

export async function addMetric(metric: Omit<HealthMetric, 'id'>, targetElderId = defaultElderId) {
  const data = await loadEldercareData(targetElderId);
  const nextMetric = { ...metric, id: createId('metric') };
  const nextProfile =
    metric.type === 'weight'
      ? { ...data.profile, weightKg: metric.value }
      : data.profile;
  const next = {
    ...data,
    profile: nextProfile,
    metrics: [nextMetric, ...data.metrics].sort(
      (left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime(),
    ),
  };
  await persistData(next, targetElderId);
  return next;
}

export async function saveMedication(
  medication: Omit<Medication, 'id'> & { id?: string },
  targetElderId = defaultElderId,
) {
  const data = await loadEldercareData(targetElderId);
  const nextMedication = { ...medication, id: medication.id || createId('medication') } as Medication;
  const next = {
    ...data,
    medications: [...data.medications.filter((item) => item.id !== nextMedication.id), nextMedication],
  };
  await persistData(next, targetElderId);
  return next;
}

export async function markMedicationTaken(
  medicationId: string,
  scheduledFor: string,
  targetElderId = defaultElderId,
) {
  const data = await loadEldercareData(targetElderId);
  const nextLog: MedicationLog = {
    id: createId('medlog'),
    medicationId,
    scheduledFor,
    status: 'taken',
    takenAt: new Date().toISOString(),
  };
  const next = { ...data, medicationLogs: [nextLog, ...data.medicationLogs] };
  await persistData(next, targetElderId);
  return next;
}

export async function addCareContact(contact: Omit<CareContact, 'id'>, targetElderId = defaultElderId) {
  const data = await loadEldercareData(targetElderId);
  const nextContact = { ...contact, id: createId('contact') };
  const next = { ...data, contacts: [...data.contacts, nextContact] };
  await persistData(next, targetElderId);
  return next;
}

export async function saveDevice(
  device: Omit<DeviceConnection, 'id'> & { id?: string },
  targetElderId = defaultElderId,
) {
  const data = await loadEldercareData(targetElderId);
  const nextDevice = { ...device, id: device.id || createId('device') } as DeviceConnection;
  const next = {
    ...data,
    devices: [...data.devices.filter((item) => item.id !== nextDevice.id), nextDevice],
  };
  await persistData(next, targetElderId);
  return next;
}

export async function addSafetyEvent(event: Omit<SafetyEvent, 'id'>, targetElderId = defaultElderId) {
  const data = await loadEldercareData(targetElderId);
  const nextEvent = { ...event, id: createId('safety') };
  const nextAlert: AlertRecord = {
    id: createId('alert'),
    title: `${event.type.replace('_', ' ')} detected`,
    message: `${event.location}: ${event.note}`,
    severity: event.severity,
    source: 'safety',
    createdAt: event.occurredAt,
    acknowledged: false,
  };
  const next = {
    ...data,
    safetyEvents: [nextEvent, ...data.safetyEvents],
    alerts: [nextAlert, ...data.alerts],
  };
  await persistData(next, targetElderId);
  return next;
}

export async function acknowledgeAlert(alert: AlertRecord, targetElderId = defaultElderId) {
  const data = await loadEldercareData(targetElderId);
  const existing = data.alerts.find((item) => item.id === alert.id);
  const next = {
    ...data,
    alerts: existing
      ? data.alerts.map((item) => (item.id === alert.id ? { ...item, acknowledged: true } : item))
      : [{ ...alert, acknowledged: true }, ...data.alerts],
  };
  await persistData(next, targetElderId);
  return next;
}

export async function importWearableSnapshot(
  source: DeviceConnection['source'],
  targetElderId = defaultElderId,
) {
  const now = new Date().toISOString();
  const data = await loadEldercareData(targetElderId);
  const sampleMetrics: HealthMetric[] = [
    { id: createId('metric'), type: 'heart_rate', value: 79, unit: 'bpm', source: 'watch', recordedAt: now },
    { id: createId('metric'), type: 'spo2', value: 98, unit: '%', source: 'watch', recordedAt: now },
    { id: createId('metric'), type: 'steps', value: 4680, unit: 'steps', source: 'watch', recordedAt: now },
    { id: createId('metric'), type: 'sleep_hours', value: 7.6, unit: 'hours', source: 'watch', recordedAt: now },
  ];
  const existingDevice = data.devices.find((device) => device.source === source);
  const nextDevice: DeviceConnection = existingDevice
    ? { ...existingDevice, connected: true, status: 'active', lastSyncedAt: now }
    : {
        id: createId('device'),
        source,
        connected: true,
        status: 'active',
        lastSyncedAt: now,
        notes: 'Imported sample wearable payload.',
      };
  const next = {
    ...data,
    devices: [...data.devices.filter((device) => device.source !== source), nextDevice],
    metrics: [...sampleMetrics, ...data.metrics],
  };
  await persistData(next, targetElderId);
  return next;
}

export async function seedFirebaseFromDemo(targetElderId = defaultElderId, fullName?: string) {
  const data = cloneDemoData({ elderId: targetElderId, fullName });
  await persistData(data, targetElderId);
  return data;
}

export async function ensureEldercareRecord(targetElderId = defaultElderId, fullName?: string) {
  if (!hasFirebaseConfig || !db) {
    return loadLocalEldercareData(targetElderId, fullName);
  }

  const elderRef = doc(db, 'elders', targetElderId);
  const snapshot = await getDoc(elderRef);
  if (snapshot.exists()) {
    return loadEldercareData(targetElderId);
  }

  return seedFirebaseFromDemo(targetElderId, fullName);
}

export function getStorageMode() {
  return hasFirebaseConfig ? 'firebase' : 'local';
}

export function formatFirebaseError(error: unknown) {
  if (!(error instanceof Error)) {
    return 'Unable to load elder care data.';
  }

  const message = error.message.toLowerCase();

  if (message.includes('permission') || message.includes('insufficient permissions')) {
    return 'Firestore denied access. Check Firestore rules and make sure the database is enabled.';
  }

  if (message.includes('offline') || message.includes('network')) {
    return 'Firebase network error. Check your internet connection and Firebase project status.';
  }

  if (message.includes('firestore')) {
    return 'Firestore is not ready yet. Enable Firestore Database in the Firebase console.';
  }

  return error.message;
}
