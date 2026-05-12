import type {
  AlertRecord,
  EldercareData,
  HealthMetric,
  LatestVitals,
  Recommendation,
} from '../types/eldercare';

function getLatestMetric(metrics: HealthMetric[], type: HealthMetric['type']) {
  return metrics
    .filter((metric) => metric.type === type)
    .sort((left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime())[0];
}

export function getLatestVitals(data: EldercareData): LatestVitals {
  return {
    heartRate: getLatestMetric(data.metrics, 'heart_rate'),
    spo2: getLatestMetric(data.metrics, 'spo2'),
    bloodPressure: getLatestMetric(data.metrics, 'blood_pressure'),
    sleep: getLatestMetric(data.metrics, 'sleep_hours'),
    steps: getLatestMetric(data.metrics, 'steps'),
    hydration: getLatestMetric(data.metrics, 'hydration'),
    weight: getLatestMetric(data.metrics, 'weight'),
    calories: getLatestMetric(data.metrics, 'calories'),
    mood: getLatestMetric(data.metrics, 'mood'),
  };
}

function getMedicationDueAlerts(data: EldercareData) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  return data.medications
    .filter((medication) => medication.active)
    .flatMap((medication) =>
      medication.schedule.map((time) => {
        const scheduledAt = new Date(`${today}T${time}:00`);
        const hasLog = data.medicationLogs.some((log) => {
          return (
            log.medicationId === medication.id &&
            log.scheduledFor.startsWith(`${today}T${time}`) &&
            log.status === 'taken'
          );
        });

        if (scheduledAt.getTime() >= now.getTime() || hasLog) {
          return null;
        }

        const minutesLate = Math.round((now.getTime() - scheduledAt.getTime()) / 60000);

        return {
          id: `medication-${medication.id}-${time}`,
          title: `${medication.name} is overdue`,
          message: `${medication.dosage} was scheduled for ${time}. It is ${minutesLate} minutes late.`,
          severity: minutesLate > 120 ? 'critical' : 'warning',
          source: 'rule',
          createdAt: now.toISOString(),
          acknowledged: false,
        } satisfies AlertRecord;
      }),
    )
    .filter(Boolean) as AlertRecord[];
}

export function evaluateAlerts(data: EldercareData) {
  const alerts: AlertRecord[] = [];
  const vitals = getLatestVitals(data);

  if (vitals.heartRate) {
    if (vitals.heartRate.value > data.profile.baseline.maxHeartRate + 12) {
      alerts.push({
        id: 'rule-high-heart-rate',
        title: 'Heart rate is above safe range',
        message: `Latest heart rate is ${vitals.heartRate.value} bpm. Check exertion, hydration, and symptoms.`,
        severity: vitals.heartRate.value > data.profile.baseline.maxHeartRate + 20 ? 'critical' : 'warning',
        source: 'rule',
        createdAt: vitals.heartRate.recordedAt,
        acknowledged: false,
      });
    }
  }

  if (vitals.spo2 && vitals.spo2.value < data.profile.baseline.minSpo2) {
    alerts.push({
      id: 'rule-low-spo2',
      title: 'Blood oxygen is low',
      message: `Latest SpO2 is ${vitals.spo2.value}%. Recheck reading and contact caregiver if symptoms continue.`,
      severity: vitals.spo2.value < data.profile.baseline.minSpo2 - 2 ? 'critical' : 'warning',
      source: 'rule',
      createdAt: vitals.spo2.recordedAt,
      acknowledged: false,
    });
  }

  if (
    vitals.bloodPressure &&
    ((vitals.bloodPressure.value ?? 0) > data.profile.baseline.maxSystolic ||
      (vitals.bloodPressure.secondaryValue ?? 0) > data.profile.baseline.maxDiastolic)
  ) {
    alerts.push({
      id: 'rule-blood-pressure',
      title: 'Blood pressure needs review',
      message: `Latest reading is ${vitals.bloodPressure.value}/${vitals.bloodPressure.secondaryValue} mmHg.`,
      severity: 'warning',
      source: 'rule',
      createdAt: vitals.bloodPressure.recordedAt,
      acknowledged: false,
    });
  }

  data.devices.forEach((device) => {
    if (!device.connected || device.status === 'disconnected') {
      alerts.push({
        id: `device-${device.id}`,
        title: `${device.source.replace('_', ' ')} needs attention`,
        message: 'Health data sync is offline. Manual entry should continue until the device reconnects.',
        severity: 'warning',
        source: 'device',
        createdAt: new Date().toISOString(),
        acknowledged: false,
      });
    }
  });

  data.safetyEvents
    .filter((event) => !event.resolved)
    .forEach((event) => {
      alerts.push({
        id: `safety-${event.id}`,
        title: `${event.type.replace('_', ' ')} event requires follow-up`,
        message: `${event.location}: ${event.note}`,
        severity: event.severity,
        source: 'safety',
        createdAt: event.occurredAt,
        acknowledged: false,
      });
    });

  return [...alerts, ...getMedicationDueAlerts(data)];
}

export function buildRecommendations(data: EldercareData): Recommendation[] {
  const vitals = getLatestVitals(data);
  const recommendations: Recommendation[] = [];

  if ((vitals.hydration?.value ?? 0) < data.profile.baseline.hydrationTargetLiters * 0.7) {
    recommendations.push({
      id: 'hydration-top-up',
      title: 'Increase water intake',
      description: `Target is ${data.profile.baseline.hydrationTargetLiters} liters. Add two small glasses before evening.`,
      category: 'hydration',
      priority: 'high',
    });
  }

  if ((vitals.steps?.value ?? 0) < data.profile.baseline.dailyStepsTarget * 0.75) {
    recommendations.push({
      id: 'walk-reminder',
      title: 'Add a short supervised walk',
      description: 'A 10 to 15 minute indoor walk will help close the daily movement target safely.',
      category: 'fitness',
      priority: 'medium',
    });
  }

  if ((vitals.sleep?.value ?? 0) < data.profile.baseline.sleepTargetHours) {
    recommendations.push({
      id: 'sleep-support',
      title: 'Protect tonight’s sleep routine',
      description: 'Keep dinner light, reduce screen exposure, and aim for a fixed bedtime.',
      category: 'routine',
      priority: 'medium',
    });
  }

  recommendations.push({
    id: 'meal-plan',
    title: 'Prefer protein-rich lunch',
    description: 'Include dal, curd, vegetables, and a fruit serving to support energy and blood sugar stability.',
    category: 'food',
    priority: 'medium',
  });

  return recommendations;
}
