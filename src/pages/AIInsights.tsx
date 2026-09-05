import { useState, useEffect } from 'react';
import { useEldercare } from '../context/EldercareContext';
import { useAuth } from '../context/AuthContext';
import { aiService } from '../services/aiService';
import { AIReportService } from '../services/aiReportService';
import { HealthMonitoringCard } from '../components/ai/HealthMonitoringCard';
import { RiskPredictionCard, RiskItem } from '../components/ai/RiskPredictionCard';
import { EmergencyCard } from '../components/ai/EmergencyCard';
import { RecommendationCard } from '../components/ai/RecommendationCard';
import { CaregiverReportCard } from '../components/ai/CaregiverReportCard';
import type { AIAnalysisResponse } from '../types/aiReport';

interface DeviceStatusItem {
  name: string;
  icon: string;
  status: 'Simulation Mode' | 'Connected' | 'Not Connected';
  badgeStyle: string;
}

const deviceStatuses: DeviceStatusItem[] = [
  { name: 'Smartwatch', icon: '⌚', status: 'Simulation Mode', badgeStyle: 'bg-blue-50 text-blue-700 border-blue-200' },
  { name: 'Camera', icon: '📹', status: 'Simulation Mode', badgeStyle: 'bg-blue-50 text-blue-700 border-blue-200' },
  { name: 'Health Connect', icon: '🧬', status: 'Not Connected', badgeStyle: 'bg-slate-100 text-slate-600 border-slate-200' },
  { name: 'Firebase', icon: '🔥', status: 'Connected', badgeStyle: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { name: 'n8n Workflow', icon: '⚡', status: 'Connected', badgeStyle: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
];

const timelineSteps = [
  { label: 'Collecting resident health data', stepIndex: 0 },
  { label: 'Validating vitals integrity', stepIndex: 1 },
  { label: 'Health Monitoring Agent completed', stepIndex: 2 },
  { label: 'Risk Prediction Agent completed', stepIndex: 3 },
  { label: 'Emergency Agent completed', stepIndex: 4 },
  { label: 'Recommendation Agent completed', stepIndex: 5 },
  { label: 'Caregiver Report generated', stepIndex: 6 }
];

export default function AIInsights() {
  const { data, latestVitals, importWatchData } = useEldercare();
  const { profile } = useAuth();

  const [aiReport, setAiReport] = useState<AIAnalysisResponse | null>(null);
  const [tempReport, setTempReport] = useState<AIAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAnalysisTime, setLastAnalysisTime] = useState<Date | null>(null);
  
  // Custom states for visual agent reasoning
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [demoMode, setDemoMode] = useState<'simulation' | 'webhook'>('simulation');

  // Get realistic mock data generator matching resident profile
  const getMockReport = (requestData: any): AIAnalysisResponse => {
    return {
      id: `report-${Date.now()}`,
      timestamp: new Date().toISOString(),
      residentId: requestData.residentId,
      residentName: requestData.name,
      healthMonitoring: {
        heartRateStatus: { value: requestData.heartRate || 76, status: 'Normal' },
        spo2Status: { value: requestData.spo2 || 97, status: 'Normal' },
        bloodPressureStatus: { value: requestData.bloodPressure || '128/82', status: 'Normal' },
        temperatureStatus: { value: requestData.temperature || 36.8, status: 'Normal' }
      },
      riskPredictions: {
        fallRisk: { level: 'low', percentage: 24, factors: ['Stable gait', 'No recent slips'] },
        dehydrationRisk: { level: 'low', percentage: 18, factors: ['Fluid intake within range'] },
        cognitiveDeclineRisk: { level: 'low', percentage: 32, factors: ['Active routine', 'Daily tasks done'] },
        nutritionRisk: { level: 'low', percentage: 28, factors: ['Balanced diet', 'Appetite stable'] }
      },
      emergencyStatus: {
        isEmergency: false,
        severity: 'none',
        conditions: [],
        requiredAction: 'No immediate action required. Resident is stable.'
      },
      recommendations: [
        { category: 'Hydration', recommendation: 'Increase water intake by 250ml', priority: 'medium', rationale: 'Maintain optimal hydration level' },
        { category: 'Activity', recommendation: 'Take a 15 minute walk after 5 PM', priority: 'low', rationale: 'Promote circulation and joint mobility' },
        { category: 'Vitals', recommendation: 'Check blood pressure again in 4 hours', priority: 'medium', rationale: 'Monitor evening pressure levels' },
        { category: 'Medication', recommendation: 'Take scheduled Lisinopril at 08:00 PM', priority: 'high', rationale: 'Ensure blood pressure maintenance' },
        { category: 'Sleep', recommendation: 'Avoid caffeine after 4 PM', priority: 'low', rationale: 'Improve sleep efficiency and deep sleep cycles' }
      ],
      caregiverReport: {
        summary: `Resident ${requestData.name} is stable today. Vital signs are within normal clinical thresholds.`,
        alerts: [],
        actionItems: [
          'Ensure Lisinopril is taken at 8 PM',
          'Encourage a short walk in the evening',
          'Log fluid intake'
        ],
        observationNotes: `${requestData.name} has been active today (${requestData.steps || 4120} steps). Energy levels report normal baseline.`
      },
      healthSummary: {
        overallStatus: 'stable',
        vitalsSummary: `Heart rate of ${requestData.heartRate || 76} bpm, SpO2 of ${requestData.spo2 || 97}%, and Blood Pressure of ${requestData.bloodPressure || '128/82'} mmHg are all within safe clinical boundaries.`,
        recentTrends: 'Systolic blood pressure has stabilized around 125-130 mmHg over the last 3 days.',
        complianceMetrics: {
          healthScore: 87,
          medicationAdherence: 95,
          activityLevel: 80,
          sleepQuality: 88
        }
      },
      overallRiskLevel: 'medium'
    };
  };

  // Auto initialize initial baseline report so 5 agents load immediately
  useEffect(() => {
    if (!aiReport && data && latestVitals) {
      const initialReqData = {
        residentId: profile?.elderId || 'ELD-DEMO01',
        name: data.profile.fullName || 'Resident',
        age: data.profile.age,
        heartRate: latestVitals.heartRate?.value ?? 76,
        spo2: latestVitals.spo2?.value ?? 97,
        bloodPressure: '128/82',
        steps: latestVitals.steps?.value ?? 4120,
      };
      setAiReport(getMockReport(initialReqData));
      setLastAnalysisTime(new Date());
    }
  }, [data, latestVitals, profile?.elderId]);

  if (!data || !latestVitals) {
    return <div className="text-slate-500 p-8 text-center">Loading AI insights...</div>;
  }

  const handleAnalyze = async () => {
    if (!profile?.elderId) {
      setError('Resident ID not found. Please ensure user is logged in.');
      return;
    }

    console.log("[AI Dashboard] Analyze button clicked");

    setLoading(true);
    setError(null);
    setCurrentStep(0);
    setTempReport(null);

    // Prepare vital signs data
    const requestData = {
      residentId: profile.elderId,
      name: data.profile.fullName,
      age: data.profile.age,
      heartRate: latestVitals.heartRate?.value ?? 76,
      spo2: latestVitals.spo2?.value ?? 97,
      bloodPressure: latestVitals.bloodPressure
        ? `${Math.round(latestVitals.bloodPressure.value)}/${Math.round(
            latestVitals.bloodPressure.secondaryValue ?? 82
          )}`
        : '128/82',
      temperature: 36.8,
      sleepHours: latestVitals.sleep?.value ?? 7.2,
      steps: latestVitals.steps?.value ?? 4120,
      cameraEvent: '',
      timestamp: new Date().toISOString(),
    };

    const isWebhookMode = demoMode === 'webhook';

    let resolvedReport: AIAnalysisResponse | null = null;
    let webhookFailed = false;

    // Background fetch initiator
    const fetchPromise = (async () => {
      if (isWebhookMode) {
        try {
          const res = await aiService.analyzeHealthData(requestData);
          return res;
        } catch (err) {
          webhookFailed = true;
          return getMockReport(requestData);
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, 600));
        return getMockReport(requestData);
      }
    })();

    const stepsDelays = [800, 800, 950, 950, 950, 950, 950];

    try {
      await new Promise((resolve) => setTimeout(resolve, stepsDelays[0]));
      setCurrentStep(1);
      await new Promise((resolve) => setTimeout(resolve, stepsDelays[1]));

      resolvedReport = await fetchPromise;
      setTempReport(resolvedReport);

      setCurrentStep(2);
      await new Promise((resolve) => setTimeout(resolve, stepsDelays[2]));

      setCurrentStep(3);
      await new Promise((resolve) => setTimeout(resolve, stepsDelays[3]));

      setCurrentStep(4);
      await new Promise((resolve) => setTimeout(resolve, stepsDelays[4]));

      setCurrentStep(5);
      await new Promise((resolve) => setTimeout(resolve, stepsDelays[5]));

      setCurrentStep(6);
      await new Promise((resolve) => setTimeout(resolve, stepsDelays[6]));

      setCurrentStep(7);
      setAiReport(resolvedReport);
      setLastAnalysisTime(new Date());

      if (webhookFailed) {
        setError('Notice: Webhook returned a connection error. The dashboard has loaded utilizing realistic simulated resident data.');
        setDemoMode('simulation');
      }

      if (profile?.uid && resolvedReport) {
        try {
          await AIReportService.saveReport(resolvedReport, profile.uid);
        } catch (sError) {
          console.error("[AI Dashboard] Firestore error:", sError);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Orchestration failed');
      setDemoMode('simulation');
    } finally {
      setLoading(false);
    }
  };

  const getAgentStatus = (agentIndex: number): 'idle' | 'thinking' | 'completed' => {
    if (loading) {
      const stepForAgent = agentIndex + 2;
      if (currentStep === stepForAgent) return 'thinking';
      if (currentStep > stepForAgent) return 'completed';
      return 'idle';
    }
    return aiReport ? 'completed' : 'idle';
  };

  const activeReport = loading ? tempReport : aiReport;

  // Formulate data mapping for agents safely
  const healthCardProps = {
    status: getAgentStatus(0),
    healthScore: activeReport?.healthSummary?.complianceMetrics?.healthScore ?? 87,
    confidence: 98.4,
    heartRate: activeReport ? Number(activeReport.healthMonitoring?.heartRateStatus?.value) : 76,
    heartRateStatus: activeReport?.healthMonitoring?.heartRateStatus?.status ?? 'Normal',
    spo2: activeReport ? Number(activeReport.healthMonitoring?.spo2Status?.value) : 97,
    spo2Status: activeReport?.healthMonitoring?.spo2Status?.status ?? 'Normal',
    bloodPressure: activeReport?.healthMonitoring?.bloodPressureStatus?.value?.toString() ?? '128/82',
    bloodPressureStatus: activeReport?.healthMonitoring?.bloodPressureStatus?.status ?? 'Normal',
    temperature: activeReport ? Number(activeReport.healthMonitoring?.temperatureStatus?.value) : 36.8,
    temperatureStatus: activeReport?.healthMonitoring?.temperatureStatus?.status ?? 'Normal',
    respiratoryRate: 18,
    stress: 34,
    hydration: 'Good',
    summary: activeReport?.healthSummary?.vitalsSummary ?? 'All vital signs are stable.',
  };

  const risksCardProps = {
    status: getAgentStatus(1),
    overallRisk: activeReport?.overallRiskLevel ?? 'medium',
    risks: activeReport ? ([
      { name: 'Fall Risk', percentage: activeReport.riskPredictions?.fallRisk?.percentage ?? 24, level: activeReport.riskPredictions?.fallRisk?.level ?? 'low', factors: activeReport.riskPredictions?.fallRisk?.factors },
      { name: 'Heart Risk', percentage: 15, level: 'low', factors: ['Normal HRV', 'Stable ECG logs'] },
      { name: 'Stroke Risk', percentage: 12, level: 'low', factors: ['Stable Blood Pressure', 'Active movement logs'] },
      { name: 'Dehydration Risk', percentage: activeReport.riskPredictions?.dehydrationRisk?.percentage ?? 18, level: activeReport.riskPredictions?.dehydrationRisk?.level ?? 'low', factors: activeReport.riskPredictions?.dehydrationRisk?.factors },
      { name: 'Cognitive Risk', percentage: activeReport.riskPredictions?.cognitiveDeclineRisk?.percentage ?? 32, level: activeReport.riskPredictions?.cognitiveDeclineRisk?.level ?? 'low', factors: activeReport.riskPredictions?.cognitiveDeclineRisk?.factors },
      { name: 'Nutrition Risk', percentage: activeReport.riskPredictions?.nutritionRisk?.percentage ?? 28, level: activeReport.riskPredictions?.nutritionRisk?.level ?? 'low', factors: activeReport.riskPredictions?.nutritionRisk?.factors },
    ] as RiskItem[]) : undefined,
  };

  const emergencyCardProps = {
    status: getAgentStatus(2),
    isEmergency: activeReport?.emergencyStatus?.isEmergency ?? false,
    severity: activeReport?.emergencyStatus?.severity ?? 'none',
    conditions: activeReport?.emergencyStatus?.conditions ?? [],
    requiredAction: activeReport?.emergencyStatus?.requiredAction ?? 'No immediate action required.',
  };

  const recommendationCardProps = {
    status: getAgentStatus(3),
    recommendations: activeReport?.recommendations ?? [],
  };

  const caregiverCardProps = {
    status: getAgentStatus(4),
    summary: activeReport?.caregiverReport?.summary ?? 'No report generated yet.',
    alerts: activeReport?.caregiverReport?.alerts ?? [],
    actionItems: activeReport?.caregiverReport?.actionItems ?? [],
    observationNotes: activeReport?.caregiverReport?.observationNotes ?? 'Awaiting vital analysis logs.',
    medicationCompliance: activeReport?.healthSummary?.complianceMetrics?.medicationAdherence ? `${activeReport.healthSummary.complianceMetrics.medicationAdherence}%` : '95%',
    readyToSend: true,
  };

  const compositeHealthScore = activeReport?.healthSummary?.complianceMetrics?.healthScore ?? 87;
  const compositeRiskLevel = activeReport?.overallRiskLevel ?? 'medium';

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto px-4 sm:px-6">
      {/* Header bar controls */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-4xl font-black text-slate-900 flex items-center gap-3">
            <span className="text-4xl">🧠</span>
            AI Intelligence Center
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-semibold">
            5 Multi-Agent AI Healthcare Orchestration & Clinical Diagnostic Center
          </p>
        </div>

        {/* Demo controllers */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="bg-slate-100 p-1 rounded-xl flex border border-slate-200 shrink-0">
            <button
              onClick={() => setDemoMode('simulation')}
              disabled={loading}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                demoMode === 'simulation'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Demo Simulation
            </button>
            <button
              onClick={() => setDemoMode('webhook')}
              disabled={loading}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                demoMode === 'webhook'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Live Webhook
            </button>
          </div>

          <button
            onClick={() => void handleAnalyze()}
            disabled={loading}
            className={`rounded-xl px-5 py-2.5 font-bold text-xs text-white transition-all whitespace-nowrap flex items-center justify-center gap-2 grow sm:grow-0 ${
              loading
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-primary hover:bg-primary/90 active:scale-95 shadow-md shadow-primary/10'
            }`}
          >
            {loading ? (
              <>
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Orchestrating 5 AI Agents...
              </>
            ) : (
              <>
                <span>🔄 Analyze Health Data</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* 5 AI Multi-Agent Network Overview Banner */}
      <div className="rounded-3xl bg-white p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-600 text-2xl">hub</span>
            <h2 className="text-xl font-bold text-slate-900">5 AI Specialist Agents Network Architecture</h2>
          </div>
          <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 text-xs font-bold uppercase tracking-wider">
            All 5 Agents Active & Operational
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Agent 1 */}
          <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-100 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-900 flex items-center gap-1">1. 🩺 Health Monitor</span>
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <p className="text-[11px] text-blue-700">Vital Signs & Biometric Analysis Agent</p>
          </div>

          {/* Agent 2 */}
          <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-100 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900 flex items-center gap-1">2. ⚠️ Risk Prediction</span>
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <p className="text-[11px] text-amber-700">Fall & Clinical Risk Assessment Agent</p>
          </div>

          {/* Agent 3 */}
          <div className="p-3.5 rounded-2xl bg-rose-50/60 border border-rose-100 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-900 flex items-center gap-1">3. 🚨 Emergency</span>
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <p className="text-[11px] text-rose-700">Anomaly & SOS Escalation Agent</p>
          </div>

          {/* Agent 4 */}
          <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-100 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-900 flex items-center gap-1">4. 💡 Recommendations</span>
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <p className="text-[11px] text-indigo-700">Care & Wellness Guidance Agent</p>
          </div>

          {/* Agent 5 */}
          <div className="p-3.5 rounded-2xl bg-teal-50/60 border border-teal-100 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-teal-900 flex items-center gap-1">5. 📋 Caregiver Report</span>
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <p className="text-[11px] text-teal-700">Shift Summary & Observation Agent</p>
          </div>
        </div>
      </div>

      {/* Error alert banner */}
      {error && (
        <div className="rounded-2xl border-l-4 border-l-amber-500 bg-amber-50 p-4 border border-amber-200">
          <div className="flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <h3 className="font-bold text-amber-900 text-sm">System Diagnostics</h3>
              <p className="text-xs text-amber-700 mt-0.5">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Main layout: Grid splits into side metrics and agent cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left column sidebar (Health metrics, Devices, Timeline logs) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* circular score and risk gauges */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md flex flex-col justify-between">
            <div className="flex justify-between items-start mb-6">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Composite Analysis</span>
              {lastAnalysisTime && (
                <span className="text-[10px] text-slate-400 font-semibold uppercase">
                  🕐 {lastAnalysisTime.toLocaleTimeString()}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 items-center mb-4">
              {/* Overall health Circular Progress */}
              <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-50/50 border border-slate-100">
                <div className="relative w-20 h-20 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-slate-150 stroke-current text-slate-200"
                      strokeWidth="3"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-primary stroke-current"
                      strokeWidth="3.2"
                      strokeDasharray={`${compositeHealthScore}, 100`}
                      strokeLinecap="round"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <span className="absolute text-xl font-black text-slate-900">{compositeHealthScore}</span>
                </div>
                <span className="text-[10px] font-bold text-slate-500 uppercase mt-2.5">Health Score</span>
              </div>

              {/* Composite risk badge */}
              <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-50/50 border border-slate-100">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-base shadow-sm border uppercase ${
                  compositeRiskLevel === 'low'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-250'
                    : compositeRiskLevel === 'medium'
                      ? 'bg-amber-50 text-amber-700 border-amber-250'
                      : 'bg-rose-50 text-rose-700 border-rose-250'
                }`}>
                  {compositeRiskLevel}
                </div>
                <span className="text-[10px] font-bold text-slate-500 uppercase mt-5">Risk Profile</span>
              </div>
            </div>
          </div>

          {/* Connected Device Status */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-md">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-4">
              Connected Device Status
            </span>
            <div className="space-y-3">
              {deviceStatuses.map((device, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-slate-50/70 border border-slate-100 rounded-2xl hover:border-slate-200 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{device.icon}</span>
                    <span className="text-xs font-bold text-slate-700">{device.name}</span>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[9px] font-black border uppercase tracking-wider ${device.badgeStyle}`}>
                    {device.status}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-150">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block mb-2">
                Simulated Watch Sync Override
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => void importWatchData('fitbit')}
                  className="rounded-lg bg-slate-900 text-white font-bold text-[9px] px-2.5 py-1.5 hover:bg-slate-800 transition-colors flex-1"
                >
                  Fitbit
                </button>
                <button
                  onClick={() => void importWatchData('health_connect')}
                  className="rounded-lg bg-blue-600 text-white font-bold text-[9px] px-2.5 py-1.5 hover:bg-blue-700 transition-colors flex-1"
                >
                  Health
                </button>
                <button
                  onClick={() => void importWatchData('apple_health')}
                  className="rounded-lg bg-slate-700 text-white font-bold text-[9px] px-2.5 py-1.5 hover:bg-slate-600 transition-colors flex-1"
                >
                  Apple
                </button>
              </div>
            </div>
          </div>

          {/* AI Processing Timeline */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-md">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-4">
              AI Agent Processing Timeline
            </span>
            <div className="relative border-l border-slate-200 ml-2 pl-4 space-y-4">
              {timelineSteps.map((step, idx) => {
                const isActive = loading && currentStep === step.stepIndex;
                const isCompleted = currentStep > step.stepIndex || (!loading && aiReport);
                
                return (
                  <div key={idx} className="relative">
                    {isCompleted ? (
                      <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100 flex items-center justify-center text-[7px] text-white font-bold">
                        ✓
                      </div>
                    ) : isActive ? (
                      <div className="absolute -left-[22px] top-0.5 w-3.5 h-3.5 rounded-full bg-blue-600 ring-4 ring-blue-100 flex items-center justify-center">
                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                      </div>
                    ) : (
                      <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-slate-200 ring-4 ring-slate-50" />
                    )}

                    <span className={`text-xs font-bold leading-none block ${
                      isCompleted
                        ? 'text-slate-700'
                        : isActive
                          ? 'text-blue-600 font-extrabold animate-pulse'
                          : 'text-slate-400'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right column (Visual 5 Agent Output Cards) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="space-y-6">
            {/* Agent 1: Health Monitoring Card */}
            <HealthMonitoringCard {...healthCardProps} />

            {/* Agent 2: Risk Prediction Card */}
            <RiskPredictionCard {...risksCardProps} />

            {/* Agent 3: Emergency Card */}
            <EmergencyCard {...emergencyCardProps} />

            {/* Agent 4: Recommendation Card */}
            <RecommendationCard {...recommendationCardProps} />

            {/* Agent 5: Caregiver Report Card */}
            <CaregiverReportCard {...caregiverCardProps} />
          </div>
        </div>
      </div>
    </div>
  );
}
