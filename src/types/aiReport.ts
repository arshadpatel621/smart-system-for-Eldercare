/**
 * AI Report Types
 * Interfaces for n8n AI workflow responses
 */

export interface AIAnalysisRequest {
  residentId: string;
  name: string;
  age: number;
  heartRate: number;
  spo2: number;
  bloodPressure: string;
  temperature: number;
  sleepHours: number;
  steps: number;
  cameraEvent: string;
  timestamp: string;
}

export interface RiskAssessment {
  level: 'low' | 'medium' | 'high' | 'critical';
  percentage: number;
  factors: string[];
}

export interface VitalStatus {
  value: number | string;
  status: 'Normal' | 'Warning' | 'Critical';
}

export interface HealthRecommendation {
  category: string;
  recommendation: string;
  priority: 'low' | 'medium' | 'high';
  rationale: string;
}

export interface CaregiverReport {
  summary: string;
  alerts: string[];
  actionItems: string[];
  observationNotes: string;
}

export interface EmergencyStatus {
  isEmergency: boolean;
  severity: 'none' | 'warning' | 'critical';
  conditions: string[];
  requiredAction: string;
}

export interface HealthSummary {
  overallStatus: 'stable' | 'caution' | 'critical';
  vitalsSummary: string;
  recentTrends: string;
  complianceMetrics: {
    healthScore?: number;
    medicationAdherence: number;
    activityLevel: number;
    sleepQuality: number;
  };
}

export interface AIAnalysisResponse {
  id: string;
  timestamp: string;
  residentId: string;
  residentName: string;

  // Health Monitoring Results
  healthMonitoring: {
    heartRateStatus: VitalStatus;
    spo2Status: VitalStatus;
    bloodPressureStatus: VitalStatus;
    temperatureStatus: VitalStatus;
  };

  // Risk Predictions
  riskPredictions: {
    fallRisk: RiskAssessment;
    dehydrationRisk: RiskAssessment;
    cognitiveDeclineRisk: RiskAssessment;
    nutritionRisk: RiskAssessment;
  };

  // Emergency Assessment
  emergencyStatus: EmergencyStatus;

  // AI Recommendations
  recommendations: HealthRecommendation[];

  // Caregiver Report
  caregiverReport: CaregiverReport;

  // Health Summary
  healthSummary: HealthSummary;

  // Overall Risk Level
  overallRiskLevel: 'low' | 'medium' | 'high' | 'critical';

  // Raw response for debugging
  rawResponse?: Record<string, unknown>;
}

export interface AIReportDocument extends AIAnalysisResponse {
  createdAt: string;
  updatedAt: string;
  userId: string;
}
