import type { EldercareData, MedicalReport, AlertRecord, DeviceConnection, Medication, MedicationLog, SafetyEvent } from '../types/eldercare';

function isoHoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

const profile = {
  id: 'ELD-7K4P92',
  fullName: 'Anita Rao',
  age: 74,
  gender: 'Female',
  bloodGroup: 'B+',
  heightCm: 158,
  weightKg: 63,
  conditions: ['Hypertension', 'Mild Arthritis'],
  allergies: ['Penicillin'],
  careNotes: 'Prefers morning walks. Needs reminders for evening blood pressure medication.',
  baseline: {
    minHeartRate: 58,
    maxHeartRate: 102,
    minSpo2: 94,
    maxSystolic: 138,
    maxDiastolic: 88,
    dailyStepsTarget: 4500,
    sleepTargetHours: 7.5,
    hydrationTargetLiters: 2.0,
  },
};

const contacts = [
  {
    id: 'contact-1',
    name: 'Dr. Sarah Wilson',
    relation: 'Primary Physician',
    role: 'Doctor',
    phone: '+1 555-0100',
    notifyOnEmergency: true,
  },
  {
    id: 'contact-2',
    name: 'Rajesh Rao',
    relation: 'Son',
    role: 'Primary Caregiver',
    phone: '+1 555-0144',
    notifyOnEmergency: true,
  },
];

const metrics = [
  {
    id: 'metric-1',
    type: 'heart_rate' as const,
    value: 74,
    unit: 'bpm',
    source: 'watch' as const,
    recordedAt: isoHoursAgo(0.5),
  },
  {
    id: 'metric-2',
    type: 'spo2' as const,
    value: 98,
    unit: '%',
    source: 'watch' as const,
    recordedAt: isoHoursAgo(0.5),
  },
  {
    id: 'metric-3',
    type: 'blood_pressure' as const,
    value: 124,
    secondaryValue: 81,
    unit: 'mmHg',
    source: 'manual' as const,
    recordedAt: isoHoursAgo(2),
  },
  {
    id: 'metric-4',
    type: 'steps' as const,
    value: 3420,
    unit: 'steps',
    source: 'watch' as const,
    recordedAt: isoHoursAgo(1),
  },
  {
    id: 'metric-5',
    type: 'sleep_hours' as const,
    value: 7.4,
    unit: 'hours',
    source: 'watch' as const,
    recordedAt: isoHoursAgo(8),
  },
];

const medications: Medication[] = [
  {
    id: 'med-1',
    name: 'Lisinopril',
    dosage: '10 mg',
    schedule: ['08:00', '20:00'],
    instructions: 'Take with water before meals.',
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

const reports: MedicalReport[] = [
  {
    id: 'report-1',
    title: 'Monthly Wellness Summary - June',
    category: 'Wellness',
    fileSize: '2.4 MB',
    uploadedAt: isoHoursAgo(24),
    uploadedBy: 'Dr. Sarah Wilson',
  },
  {
    id: 'report-2',
    title: 'Cardiology & Blood Pressure Assessment',
    category: 'Cardiology',
    fileSize: '1.1 MB',
    uploadedAt: isoHoursAgo(72),
    uploadedBy: 'Dr. Sarah Wilson',
  },
  {
    id: 'report-3',
    title: 'Weekly Biometric Vitals Log',
    category: 'Laboratory',
    fileSize: '0.8 MB',
    uploadedAt: isoHoursAgo(120),
    uploadedBy: 'Sarah (Caregiver)',
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
  reports,
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
