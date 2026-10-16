import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { cloneDemoData } from './mockData';
import { auth, db, elderId as defaultElderId, hasFirebaseConfig } from './firebase';
import type {
  AlertRecord,
  CareContact,
  DeviceConnection,
  EldercareData,
  ElderProfile,
  HealthMetric,
  MedicalReport,
  Medication,
  MedicationLog,
  SafetyEvent,
} from '../types/eldercare';

const STORAGE_KEY = 'eldercare-demo-data';

const DEMO_CONTACT_IDS = new Set(['contact-1', 'contact-2']);
const DEMO_METRIC_IDS = new Set(['metric-1', 'metric-2', 'metric-3', 'metric-4', 'metric-5']);
const DEMO_MED_IDS = new Set(['med-1', 'med-2']);
const DEMO_LOG_IDS = new Set(['log-1']);
const DEMO_DEVICE_IDS = new Set(['device-1', 'device-2']);
const DEMO_SAFETY_IDS = new Set(['safety-1']);
const DEMO_ALERT_IDS = new Set(['alert-1']);
const DEMO_REPORT_IDS = new Set(['report-1', 'report-2', 'report-3']);

function getStorageKey(targetElderId: string) {
  return `${STORAGE_KEY}:${targetElderId}`;
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function createEmptyEldercareData(elderId: string, fullName?: string): EldercareData {
  return {
    profile: {
      id: elderId,
      fullName: fullName || 'Resident',
      age: 70,
      gender: 'Unspecified',
      bloodGroup: 'Unknown',
      heightCm: 165,
      weightKg: 65,
      conditions: [],
      allergies: [],
      careNotes: '',
      baseline: {
        minHeartRate: 60,
        maxHeartRate: 100,
        minSpo2: 95,
        maxSystolic: 120,
        maxDiastolic: 80,
        dailyStepsTarget: 5000,
        sleepTargetHours: 8.0,
        hydrationTargetLiters: 2.0,
      },
    },
    contacts: [],
    metrics: [],
    medications: [],
    medicationLogs: [],
    devices: [],
    safetyEvents: [],
    alerts: [],
    reports: [],
  };
}

export function isDemoTarget(targetElderId: string, isDemoExplicit?: boolean): boolean {
  if (isDemoExplicit !== undefined) {
    return isDemoExplicit;
  }
  if (targetElderId.startsWith('guest-')) {
    return true;
  }
  if (auth?.currentUser && !auth.currentUser.isAnonymous) {
    return false;
  }
  return targetElderId === 'demo-resident' || targetElderId === 'ELD-7K4P92';
}

export function sanitizeRealAccountData(
  data: EldercareData,
  targetElderId: string,
  fullName?: string
): EldercareData {
  let modified = false;

  const contacts = (data.contacts || []).filter((c) => {
    if (DEMO_CONTACT_IDS.has(c.id) || c.name === 'Dr. Sarah Wilson' || c.name === 'Rajesh Rao') {
      modified = true;
      void deleteRemoteDocument('contacts', c.id, targetElderId);
      return false;
    }
    return true;
  });

  const metrics = (data.metrics || []).filter((m) => {
    if (DEMO_METRIC_IDS.has(m.id)) {
      modified = true;
      void deleteRemoteDocument('metrics', m.id, targetElderId);
      return false;
    }
    return true;
  });

  const medications = (data.medications || []).filter((m) => {
    if (DEMO_MED_IDS.has(m.id) || m.name === 'Lisinopril' || m.name === 'Metformin') {
      modified = true;
      void deleteRemoteDocument('medications', m.id, targetElderId);
      return false;
    }
    return true;
  });

  const medicationLogs = (data.medicationLogs || []).filter((l) => {
    if (DEMO_LOG_IDS.has(l.id)) {
      modified = true;
      void deleteRemoteDocument('medicationLogs', l.id, targetElderId);
      return false;
    }
    return true;
  });

  const devices = (data.devices || []).filter((d) => {
    if (DEMO_DEVICE_IDS.has(d.id)) {
      modified = true;
      void deleteRemoteDocument('devices', d.id, targetElderId);
      return false;
    }
    return true;
  });

  const safetyEvents = (data.safetyEvents || []).filter((s) => {
    if (DEMO_SAFETY_IDS.has(s.id) || (s.location === 'Bedroom' && s.type === 'fall')) {
      modified = true;
      void deleteRemoteDocument('safetyEvents', s.id, targetElderId);
      return false;
    }
    return true;
  });

  const alerts = (data.alerts || []).filter((a) => {
    if (
      DEMO_ALERT_IDS.has(a.id) ||
      a.title?.includes('Heart Rate Elevated') ||
      (a.source === 'safety' && DEMO_SAFETY_IDS.has(a.id))
    ) {
      modified = true;
      void deleteRemoteDocument('alerts', a.id, targetElderId);
      return false;
    }
    return true;
  });

  const reports = (data.reports || []).filter((r) => {
    if (
      DEMO_REPORT_IDS.has(r.id) ||
      r.title?.includes('Comprehensive Metabolic') ||
      r.title?.includes('Cardiology Consultation')
    ) {
      modified = true;
      void deleteRemoteDocument('reports', r.id, targetElderId);
      return false;
    }
    return true;
  });

  const profile = { ...data.profile };
  if (profile.fullName === 'Anita Rao' || profile.fullName === 'New Resident') {
    if (fullName) {
      profile.fullName = fullName;
      modified = true;
    }
  }
  if (
    profile.conditions?.length === 2 &&
    profile.conditions.includes('Hypertension') &&
    profile.conditions.includes('Mild Arthritis')
  ) {
    profile.conditions = [];
    modified = true;
  }
  if (profile.allergies?.length === 1 && profile.allergies.includes('Penicillin')) {
    profile.allergies = [];
    modified = true;
  }
  if (profile.careNotes?.includes('Prefers morning walks. Needs reminders')) {
    profile.careNotes = '';
    modified = true;
  }

  const cleanData: EldercareData = {
    profile,
    contacts,
    metrics,
    medications,
    medicationLogs,
    devices,
    safetyEvents,
    alerts,
    reports,
  };

  if (modified) {
    saveLocalData(cleanData, targetElderId);
    if (hasFirebaseConfig && db) {
      void seedRemoteProfile(profile, targetElderId);
    }
  }

  return cleanData;
}

export function loadLocalEldercareData(
  targetElderId = defaultElderId,
  fullName?: string,
  isDemoExplicit?: boolean
) {
  const isDemo = isDemoTarget(targetElderId, isDemoExplicit);
  const storageKey = getStorageKey(targetElderId);
  const saved = window.localStorage.getItem(storageKey);

  if (!isDemo) {
    if (!saved) {
      const empty = createEmptyEldercareData(targetElderId, fullName);
      window.localStorage.setItem(storageKey, JSON.stringify(empty));
      return empty;
    }
    try {
      const parsed = JSON.parse(saved) as EldercareData;
      return sanitizeRealAccountData(parsed, targetElderId, fullName);
    } catch {
      const empty = createEmptyEldercareData(targetElderId, fullName);
      window.localStorage.setItem(storageKey, JSON.stringify(empty));
      return empty;
    }
  }

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

async function deleteRemoteDocument(name: string, id: string, targetElderId: string) {
  if (!hasFirebaseConfig || !db) return;
  const elderRef = doc(db, 'elders', targetElderId);
  await deleteDoc(doc(collection(elderRef, name), id));
}

async function seedRemoteProfile(profile: ElderProfile, targetElderId: string) {
  const elderRef = doc(db!, 'elders', targetElderId);
  await setDoc(elderRef, profile);
}

export async function loadEldercareData(
  targetElderId = defaultElderId,
  fullName?: string,
  isDemoExplicit?: boolean
) {
  const isDemo = isDemoTarget(targetElderId, isDemoExplicit);

  if (!hasFirebaseConfig || !db) {
    return loadLocalEldercareData(targetElderId, fullName, isDemo);
  }

  const elderRef = doc(db, 'elders', targetElderId);
  const profileSnapshot = await getDoc(elderRef);

  if (!profileSnapshot.exists()) {
    if (isDemo) {
      const seeded = cloneDemoData({ elderId: targetElderId, fullName });
      await persistData(seeded, targetElderId);
      return seeded;
    } else {
      const initial = createEmptyEldercareData(targetElderId, fullName);
      await persistData(initial, targetElderId);
      return initial;
    }
  }

  const [contacts, metrics, medications, medicationLogs, devices, safetyEvents, alerts, reports] = await Promise.all([
    loadRemoteCollection<CareContact>('contacts', targetElderId),
    loadRemoteCollection<HealthMetric>('metrics', targetElderId),
    loadRemoteCollection<Medication>('medications', targetElderId),
    loadRemoteCollection<MedicationLog>('medicationLogs', targetElderId),
    loadRemoteCollection<DeviceConnection>('devices', targetElderId),
    loadRemoteCollection<SafetyEvent>('safetyEvents', targetElderId),
    loadRemoteCollection<AlertRecord>('alerts', targetElderId),
    loadRemoteCollection<MedicalReport>('reports', targetElderId),
  ]);

  const rawData: EldercareData = {
    profile: { id: profileSnapshot.id, ...profileSnapshot.data() } as ElderProfile,
    contacts,
    metrics,
    medications,
    medicationLogs,
    devices,
    safetyEvents,
    alerts,
    reports,
  };

  if (!isDemo) {
    return sanitizeRealAccountData(rawData, targetElderId, fullName);
  }

  return rawData;
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
    ...(data.reports || []).map((report) => persistRemoteCollection('reports', report, targetElderId)),
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

export async function removeCareContact(contactId: string, targetElderId = defaultElderId) {
  await deleteRemoteDocument('contacts', contactId, targetElderId);
  const data = await loadEldercareData(targetElderId);
  const next = {
    ...data,
    contacts: data.contacts.filter((c) => c.id !== contactId),
  };
  await persistData(next, targetElderId);
  return next;
}

export async function saveMedicalReport(
  report: Omit<MedicalReport, 'id'>,
  targetElderId = defaultElderId,
) {
  const data = await loadEldercareData(targetElderId);
  const nextReport = { ...report, id: createId('report') };
  const existing = data.reports || [];
  const next = {
    ...data,
    reports: [nextReport, ...existing],
  };
  await persistData(next, targetElderId);
  return next;
}

export async function removeMedicalReport(reportId: string, targetElderId = defaultElderId) {
  await deleteRemoteDocument('reports', reportId, targetElderId);
  const data = await loadEldercareData(targetElderId);
  const existing = data.reports || [];
  const next = {
    ...data,
    reports: existing.filter((r) => r.id !== reportId),
  };
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

export async function ensureEldercareRecord(
  targetElderId = defaultElderId,
  fullName?: string,
  isDemoExplicit?: boolean
) {
  if (!hasFirebaseConfig || !db) {
    loadLocalEldercareData(targetElderId, fullName, isDemoExplicit);
    return;
  }

  const elderRef = doc(db, 'elders', targetElderId);
  const snapshot = await getDoc(elderRef);
  if (snapshot.exists()) {
    const isDemo = isDemoTarget(targetElderId, isDemoExplicit);
    if (!isDemo) {
      await loadEldercareData(targetElderId, fullName, false);
    }
    return;
  }

  const isDemo = isDemoTarget(targetElderId, isDemoExplicit);
  if (isDemo) {
    await seedFirebaseFromDemo(targetElderId, fullName);
    return;
  }

  const initialData = createEmptyEldercareData(targetElderId, fullName);
  await persistData(initialData, targetElderId);
}

export function getStorageMode() {
  return hasFirebaseConfig ? 'firebase' : 'local';
}

export function formatFirebaseError(error: unknown) {
  if (!(error instanceof Error)) {
    return 'An unexpected error occurred.';
  }

  const message = error.message.toLowerCase();

  if (
    message.includes('auth/invalid-credential') ||
    message.includes('invalid-credential') ||
    message.includes('user-not-found') ||
    message.includes('wrong-password')
  ) {
    return 'Invalid email or password. Use Quick Guest Access below or Create an Account if you do not have credentials yet.';
  }

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

