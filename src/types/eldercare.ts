export type MetricType =
  | 'heart_rate'
  | 'spo2'
  | 'blood_pressure'
  | 'sleep_hours'
  | 'steps'
  | 'weight'
  | 'hydration'
  | 'calories'
  | 'mood';

export type MetricSource = 'manual' | 'watch' | 'camera' | 'system';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface CareContact {
  id: string;
  name: string;
  relation: string;
  role: string;
  phone: string;
  notifyOnEmergency: boolean;
}

export interface ElderProfile {
  id: string;
  fullName: string;
  photoUrl?: string;
  age: number;
  gender: string;
  bloodGroup: string;
  heightCm: number;
  weightKg: number;
  conditions: string[];
  allergies: string[];
  careNotes: string;
  baseline: {
    minHeartRate: number;
    maxHeartRate: number;
    minSpo2: number;
    maxSystolic: number;
    maxDiastolic: number;
    dailyStepsTarget: number;
    sleepTargetHours: number;
    hydrationTargetLiters: number;
  };
}

export interface HealthMetric {
  id: string;
  type: MetricType;
  value: number;
  secondaryValue?: number;
  unit: string;
  source: MetricSource;
  note?: string;
  recordedAt: string;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  schedule: string[];
  instructions: string;
  active: boolean;
}

export interface MedicationLog {
  id: string;
  medicationId: string;
  scheduledFor: string;
  status: 'taken' | 'missed';
  takenAt?: string;
}

export interface DeviceConnection {
  id: string;
  source: 'manual' | 'fitbit' | 'health_connect' | 'apple_health';
  connected: boolean;
  lastSyncedAt?: string;
  status: 'active' | 'attention' | 'disconnected';
  notes?: string;
}

export interface SafetyEvent {
  id: string;
  type: 'fall' | 'inactivity' | 'sos' | 'unusual_behavior';
  severity: AlertSeverity;
  occurredAt: string;
  location: string;
  note: string;
  resolved: boolean;
}

export interface AlertRecord {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  source: 'rule' | 'manual' | 'safety' | 'device';
  createdAt: string;
  acknowledged: boolean;
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  category: 'food' | 'routine' | 'hydration' | 'fitness' | 'medication';
  priority: 'high' | 'medium' | 'low';
}

export interface EldercareData {
  profile: ElderProfile;
  contacts: CareContact[];
  metrics: HealthMetric[];
  medications: Medication[];
  medicationLogs: MedicationLog[];
  devices: DeviceConnection[];
  safetyEvents: SafetyEvent[];
  alerts: AlertRecord[];
}

export interface LatestVitals {
  heartRate?: HealthMetric;
  spo2?: HealthMetric;
  bloodPressure?: HealthMetric;
  sleep?: HealthMetric;
  steps?: HealthMetric;
  hydration?: HealthMetric;
  weight?: HealthMetric;
  calories?: HealthMetric;
  mood?: HealthMetric;
}
