import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import {
  acknowledgeAlert,
  addCareContact,
  removeCareContact,
  saveMedicalReport,
  removeMedicalReport,
  addMetric,
  addSafetyEvent,
  formatFirebaseError,
  getStorageMode,
  importWearableSnapshot,
  loadEldercareData,
  loadLocalEldercareData,
  markMedicationTaken,
  saveDevice,
  saveMedication,
  saveProfile,
  sanitizeRealAccountData,
} from '../lib/eldercareStore';
import { buildRecommendations, evaluateAlerts, getLatestVitals } from '../lib/alertRules';
import type {
  AlertRecord,
  CareContact,
  MedicalReport,
  DeviceConnection,
  EldercareData,
  ElderProfile,
  HealthMetric,
  Medication,
  SafetyEvent,
} from '../types/eldercare';

interface EldercareContextValue {
  data: EldercareData | null;
  activeElderId: string | null;
  setActiveElderId: (id: string | null) => void;
  latestVitals: ReturnType<typeof getLatestVitals> | null;
  derivedAlerts: AlertRecord[];
  recommendations: ReturnType<typeof buildRecommendations>;
  loading: boolean;
  error: string | null;
  storageMode: 'firebase' | 'local';
  refresh: () => Promise<void>;
  updateProfile: (profile: ElderProfile) => Promise<void>;
  createMetric: (metric: Omit<HealthMetric, 'id'>) => Promise<void>;
  createMedication: (medication: Omit<Medication, 'id'> & { id?: string }) => Promise<void>;
  takeMedication: (medicationId: string, scheduledFor: string) => Promise<void>;
  createContact: (contact: Omit<CareContact, 'id'>) => Promise<void>;
  deleteContact: (contactId: string) => Promise<void>;
  createMedicalReport: (report: Omit<MedicalReport, 'id'>) => Promise<void>;
  removeMedicalReport: (reportId: string) => Promise<void>;
  updateDevice: (device: Omit<DeviceConnection, 'id'> & { id?: string }) => Promise<void>;
  createSafetyEvent: (event: Omit<SafetyEvent, 'id'>) => Promise<void>;
  confirmAlert: (alert: AlertRecord) => Promise<void>;
  importWatchData: (source: DeviceConnection['source']) => Promise<void>;
  enableBrowserNotifications: () => Promise<void>;
}


const EldercareContext = createContext<EldercareContextValue | undefined>(undefined);

async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return;
  }
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}

export function EldercareProvider({ children }: { children: ReactNode }) {
  const { profile, loading: authLoading, user } = useAuth();
  const [selectedElderId, setSelectedElderId] = useState<string | null>(null);

  const isDemoUser = Boolean(
    profile?.uid?.startsWith('guest-') ||
    profile?.uid === 'guest-user' ||
    (!user && !profile)
  );

  // Default to profile elderId if no override selected
  const activeElderId =
    selectedElderId ||
    profile?.elderId ||
    (isDemoUser
      ? 'demo-resident'
      : (profile?.uid ? `ELD-${profile.uid.slice(0, 6).toUpperCase()}` : null));

  const [data, setData] = useState<EldercareData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastNotificationId = useRef<string | null>(null);
  const storageMode = getStorageMode();

  const refresh = async () => {
    if (!activeElderId) {
      setData(null);
      setLoading(false);
      return;
    }
    
    // Only show loading if we don't have ANY data yet
    if (!data) setLoading(true);
    
    setError(null);
    try {
      const result = await loadEldercareData(activeElderId, profile?.fullName, isDemoUser);
      setData(result);
    } catch (loadError) {
      console.warn('Firebase data load failed, using local/cached data:', loadError);
      if (!data) {
        setData(loadLocalEldercareData(activeElderId, profile?.fullName, isDemoUser));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    void refresh();
  }, [authLoading, activeElderId, isDemoUser]);

  const latestVitals = data ? getLatestVitals(data) : null;
  const derivedAlerts = useMemo(() => {
    if (!data) {
      return [];
    }
    const alerts = [...data.alerts, ...evaluateAlerts(data)];
    return alerts.sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
  }, [data]);

  const recommendations = useMemo(() => {
    if (!data) {
      return [];
    }
    return buildRecommendations(data);
  }, [data]);

  useEffect(() => {
    if (!derivedAlerts.length || !('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }
    const critical = derivedAlerts.find((alert) => alert.severity === 'critical');
    if (!critical || lastNotificationId.current === critical.id) {
      return;
    }
    lastNotificationId.current = critical.id;
    new Notification(critical.title, { body: critical.message });
  }, [derivedAlerts]);

  const persist = async (operation: () => Promise<EldercareData>) => {
    if (!activeElderId) {
      setError('No elder profile is assigned to this account.');
      return;
    }
    setError(null);
    try {
      const result = await operation();
      const sanitized = isDemoUser ? result : sanitizeRealAccountData(result, activeElderId, profile?.fullName);
      setData(sanitized);
    } catch (persistError) {
      setError(formatFirebaseError(persistError));
    }
  };

  const value: EldercareContextValue = {
    data,
    activeElderId,
    setActiveElderId: (id: string | null) => setSelectedElderId(id),
    latestVitals,
    derivedAlerts,
    recommendations,
    loading,
    error,
    storageMode,
    refresh,
    updateProfile: async (profile) => persist(() => saveProfile(profile, activeElderId!)),
    createMetric: async (metric) => persist(() => addMetric(metric, activeElderId!)),
    createMedication: async (medication) => persist(() => saveMedication(medication, activeElderId!)),
    takeMedication: async (medicationId, scheduledFor) =>
      persist(() => markMedicationTaken(medicationId, scheduledFor, activeElderId!)),
    createContact: async (contact) => persist(() => addCareContact(contact, activeElderId!)),
    deleteContact: async (contactId) => persist(() => removeCareContact(contactId, activeElderId!)),
    createMedicalReport: async (report) => persist(() => saveMedicalReport(report, activeElderId!)),
    removeMedicalReport: async (reportId) => persist(() => removeMedicalReport(reportId, activeElderId!)),
    updateDevice: async (device) => persist(() => saveDevice(device, activeElderId!)),

    createSafetyEvent: async (event) => persist(() => addSafetyEvent(event, activeElderId!)),
    confirmAlert: async (alert) => persist(() => acknowledgeAlert(alert, activeElderId!)),
    importWatchData: async (source) => persist(() => importWearableSnapshot(source, activeElderId!)),
    enableBrowserNotifications: requestNotificationPermission,
  };

  return <EldercareContext.Provider value={value}>{children}</EldercareContext.Provider>;
}

export function useEldercare() {
  const context = useContext(EldercareContext);
  if (!context) {
    throw new Error('useEldercare must be used inside EldercareProvider');
  }
  return context;
}
