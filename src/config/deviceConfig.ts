import type { CategoryConfig } from '../types/device';

export const DEVICE_CATEGORIES: CategoryConfig[] = [
  {
    id: 'wearable',
    label: 'Smart Wearable',
    icon: 'watch',
    desc: 'Smartwatches and fitness trackers',
    flowType: 'scan',
    brands: [
      { id: 'apple_watch_9', brand: 'Apple', model: 'Apple Watch Series 9', metrics: ['heart_rate', 'spo2', 'steps', 'sleep_hours', 'calories'], connectionMethods: ['bluetooth', 'cloud_api'] },
      { id: 'samsung_galaxy_6', brand: 'Samsung', model: 'Galaxy Watch 6', metrics: ['heart_rate', 'spo2', 'steps', 'sleep_hours', 'calories', 'blood_pressure'], connectionMethods: ['bluetooth', 'cloud_api'] },
      { id: 'garmin_fenix_7', brand: 'Garmin', model: 'Fenix 7', metrics: ['heart_rate', 'spo2', 'steps', 'sleep_hours', 'calories'], connectionMethods: ['bluetooth'] },
      { id: 'fitbit_charge_6', brand: 'Fitbit', model: 'Charge 6', metrics: ['heart_rate', 'steps', 'sleep_hours', 'calories'], connectionMethods: ['bluetooth'] }
    ],
  },
  {
    id: 'medical_device',
    label: 'Medical Device',
    icon: 'monitor_heart',
    desc: 'Blood pressure, glucose monitors, etc.',
    flowType: 'manual_form',
    brands: [
      { id: 'omron_bp', brand: 'Omron', model: 'BP7450', metrics: ['blood_pressure', 'heart_rate'], connectionMethods: ['bluetooth'], requiredFields: ['serialNumber'] },
      { id: 'withings_bpm', brand: 'Withings', model: 'BPM Connect', metrics: ['blood_pressure', 'heart_rate'], connectionMethods: ['wifi', 'bluetooth'], requiredFields: ['serialNumber'] },
      { id: 'dexcom_g7', brand: 'Dexcom', model: 'G7 CGM', metrics: [], connectionMethods: ['bluetooth'], requiredFields: ['serialNumber'] }, // e.g. glucose not in basic metrics yet
    ],
  },
  {
    id: 'sensor',
    label: 'Smart Sensor',
    icon: 'sensors',
    desc: 'Bed sensors, fall detectors, etc.',
    flowType: 'network_config',
    brands: [
      { id: 'withings_sleep', brand: 'Withings', model: 'Sleep Analyzer', metrics: ['sleep_hours', 'heart_rate'], connectionMethods: ['wifi'], requiredFields: ['location'] },
      { id: 'aqara_fp2', brand: 'Aqara', model: 'Presence Sensor FP2', metrics: [], connectionMethods: ['wifi'], requiredFields: ['location'] },
      { id: 'philips_hue', brand: 'Philips', model: 'Hue Motion Sensor', metrics: [], connectionMethods: ['zigbee'], requiredFields: ['location'] },
    ],
  },
];
