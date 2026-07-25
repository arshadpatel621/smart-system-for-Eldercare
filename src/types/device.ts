import type { MetricType } from './eldercare';

export type DeviceCategory = 'wearable' | 'medical_device' | 'sensor' | 'camera';
export type DeviceConnectionStatus = 'connected' | 'disconnected' | 'error';
export type DeviceConnectionType = 'bluetooth' | 'wifi' | 'cloud_api' | 'zigbee' | 'mqtt' | 'ip';

export interface Device {
  id: string;
  patientId: string;
  category: DeviceCategory;
  brand: string;
  model: string;
  macAddress?: string;
  ipAddress?: string;
  serialNumber?: string;
  connectionType: DeviceConnectionType;
  firmwareVersion?: string;
  battery?: number;
  status: DeviceConnectionStatus;
  lastSync?: string;
  supportedMetrics: MetricType[];
  location?: string;
  networkProtocol?: DeviceConnectionType;
}

export type CreateDeviceInput = Omit<Device, 'id'>;

export type WizardFlowType = 'scan' | 'manual_form' | 'network_config';

export interface DeviceConfig {
  id: string;
  brand: string;
  model: string;
  metrics: MetricType[];
  connectionMethods: DeviceConnectionType[];
  requiredFields?: string[];
}

export interface CategoryConfig {
  id: DeviceCategory;
  label: string;
  icon: string;
  desc: string;
  flowType: WizardFlowType;
  brands: DeviceConfig[];
}
