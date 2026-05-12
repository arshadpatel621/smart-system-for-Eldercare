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

function isoHoursAgo(hoursAgo: number) {
  return new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
}

const profile: ElderProfile = {
  id: 'demo-resident',
  fullName: 'Anita Rao',
  photoUrl:
    'https://images.unsplash.com/photo-1581579438747-104c53d10f48?auto=format&fit=crop&w=900&q=80',
  age: 74,
  gender: 'Female',
  bloodGroup: 'B+',
  heightCm: 158,
  weightKg: 67,
  conditions: ['Hypertension', 'Mild diabetes'],
  allergies: ['Penicillin'],
  careNotes: 'Needs soft meals at night and supervised exercise after 5 PM.',
  baseline: {
    minHeartRate: 58,
    maxHeartRate: 98,
    minSpo2: 94,
    maxSystolic: 135,
    maxDiastolic: 88,
    dailyStepsTarget: 5500,
    sleepTargetHours: 7,
    hydrationTargetLiters: 2.1,
  },
};

const contacts: CareContact[] = [
  {
    id: 'contact-1',
    name: 'Rohan Rao',
    relation: 'Son',
    role: 'Family caregiver',
    phone: '+91 9876543210',
    notifyOnEmergency: true,
  },
  {
    id: 'contact-2',
    name: 'Dr. Meera Patel',
    relation: 'Doctor',
    role: 'Primary physician',
    phone: '+91 9898989898',
    notifyOnEmergency: true,
  },
];

const metrics: HealthMetric[] = [
  { id: 'metric-1', type: 'heart_rate', value: 76, unit: 'bpm', source: 'watch', recordedAt: isoHoursAgo(0.5) },
  { id: 'metric-2', type: 'spo2', value: 97, unit: '%', source: 'watch', recordedAt: isoHoursAgo(1) },
  {
    id: 'metric-3',
    type: 'blood_pressure',
    value: 128,
    secondaryValue: 82,
    unit: 'mmHg',
    source: 'manual',
    recordedAt: isoHoursAgo(2),
  },
  { id: 'metric-4', type: 'sleep_hours', value: 7.2, unit: 'hours', source: 'watch', recordedAt: isoHoursAgo(9) },
  { id: 'metric-5', type: 'steps', value: 4120, unit: 'steps', source: 'watch', recordedAt: isoHoursAgo(0.25) },
  { id: 'metric-6', type: 'hydration', value: 1.4, unit: 'liters', source: 'manual', recordedAt: isoHoursAgo(1.5) },
  { id: 'metric-7', type: 'calories', value: 1320, unit: 'kcal', source: 'manual', recordedAt: isoHoursAgo(1.5) },
  { id: 'metric-8', type: 'mood', value: 4, unit: '/5', source: 'manual', note: 'Feeling stable', recordedAt: isoHoursAgo(3) },
  { id: 'metric-9', type: 'weight', value: 67, unit: 'kg', source: 'manual', recordedAt: isoHoursAgo(24) },
];

const medications: Medication[] = [
  {
    id: 'med-1',
    name: 'Lisinopril',
    dosage: '10 mg',
    schedule: ['08:00', '20:00'],
    instructions: 'After food with water.',
    active: true,
  },
  {
    id: 'med-2',
    name: 'Metformin',
    dosage: '500 mg',
    schedule: ['09:00'],
    instructions: 'Take after breakfast.',
    active: true,
  },
];

const medicationLogs: MedicationLog[] = [
  {
    id: 'log-1',
    medicationId: 'med-1',
    scheduledFor: new Date().toISOString().slice(0, 10) + 'T08:00:00.000Z',
    status: 'taken',
    takenAt: new Date().toISOString().slice(0, 10) + 'T08:05:00.000Z',
  },
];

const devices: DeviceConnection[] = [
  {
    id: 'device-1',
    source: 'health_connect',
    connected: true,
    lastSyncedAt: isoHoursAgo(0.1),
    status: 'active',
    notes: 'Android smartwatch sync via mobile bridge.',
  },
  {
    id: 'device-2',
    source: 'manual',
    connected: true,
    lastSyncedAt: isoHoursAgo(2),
    status: 'active',
    notes: 'Caretaker enters BP and food intake manually.',
  },
];

const safetyEvents: SafetyEvent[] = [
  {
    id: 'safety-1',
    type: 'inactivity',
    severity: 'warning',
    occurredAt: isoHoursAgo(5),
    location: 'Living room',
    note: 'No movement detected for 45 minutes. Resident confirmed safe.',
    resolved: true,
  },
];

const alerts: AlertRecord[] = [
  {
    id: 'alert-1',
    title: 'Medicine reminder',
    message: 'Evening dose of Lisinopril is scheduled for 08:00 PM.',
    severity: 'info',
    source: 'manual',
    createdAt: isoHoursAgo(0.5),
    acknowledged: false,
  },
];

export const demoData: EldercareData = {
  profile,
  contacts,
  metrics,
  medications,
  medicationLogs,
  devices,
  safetyEvents,
  alerts,
};

export function cloneDemoData(options?: { elderId?: string; fullName?: string }) {
  const cloned = JSON.parse(JSON.stringify(demoData)) as EldercareData;

  if (options?.elderId) {
    cloned.profile.id = options.elderId;
  }

  if (options?.fullName) {
    cloned.profile.fullName = options.fullName;
  }

  return cloned;
}
