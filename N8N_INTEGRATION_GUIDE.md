# N8N Integration Guide

## Overview

The VitalCare Professional AI Intelligence Center is now fully integrated with your n8n workflow. This guide explains the architecture, setup, and usage.

## Architecture

```
React App (AIInsights page)
    ↓
aiService.ts (Validates & sends request)
    ↓
N8N Webhook (your workflow)
    ↓
N8N Agents:
  - Health Monitoring Agent
  - Risk Prediction Agent
  - Emergency Agent
  - Recommendation Agent
  - Caregiver Report Agent
    ↓
AIReportService (Saves to Firestore)
    ↓
Firebase Firestore (AIReports collection)
```

## Files Created/Modified

### New Files

1. **`src/types/aiReport.ts`**
   - TypeScript interfaces for AI analysis requests and responses
   - Defines the structure for all AI-generated data
   - Includes risk assessments, health summaries, and recommendations

2. **`src/services/aiService.ts`**
   - Reusable service for n8n webhook communication
   - Handles request validation
   - Provides error handling and retry logic
   - Features:
     - `analyzeHealthData(data)` - Main analysis function
     - `validateRequest(data)` - Input validation
     - `isConfigured()` - Check webhook configuration

3. **`src/services/aiReportService.ts`**
   - Firestore integration for persisting AI reports
   - Features:
     - `saveReport(report, userId)` - Save analysis to Firestore
     - `getLatestReport(residentId)` - Retrieve latest report
     - `getResidentReports(residentId, limit)` - Get report history

### Modified Files

1. **`.env`** - Added `VITE_N8N_WEBHOOK_URL` variable
2. **`.env.example`** - Added `VITE_N8N_WEBHOOK_URL` template
3. **`src/pages/AIInsights.tsx`** - Integrated n8n workflow:
   - Added "Analyze Health Data" button
   - Real-time display of AI analysis results
   - Loading and error states
   - Automatic report saving to Firestore

## Setup Instructions

### 1. Configure N8N Webhook URL

Add your n8n webhook URL to the `.env` file:

```env
VITE_N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/your-workflow-path
```

### 2. Expected Request Format

The React app sends this data structure to your n8n workflow:

```json
{
  "residentId": "unique-resident-id",
  "name": "Resident Full Name",
  "age": 75,
  "heartRate": 72,
  "spo2": 98,
  "bloodPressure": "120/80",
  "temperature": 36.8,
  "sleepHours": 7,
  "steps": 5000,
  "cameraEvent": "",
  "timestamp": "2026-07-25T10:30:00.000Z"
}
```

### 3. Expected Response Format

Your n8n workflow should return this structure:

```json
{
  "id": "report-id",
  "timestamp": "2026-07-25T10:30:00.000Z",
  "residentId": "resident-id",
  "residentName": "Resident Name",
  
  "healthMonitoring": {
    "heartRateStatus": "normal",
    "spo2Status": "normal",
    "bloodPressureStatus": "normal",
    "temperatureStatus": "normal"
  },
  
  "riskPredictions": {
    "fallRisk": {
      "level": "low|medium|high|critical",
      "percentage": 12,
      "factors": ["Factor 1", "Factor 2"]
    },
    "dehydrationRisk": { ... },
    "cognitiveDeclineRisk": { ... },
    "nutritionRisk": { ... }
  },
  
  "emergencyStatus": {
    "isEmergency": false,
    "severity": "none|warning|critical",
    "conditions": [],
    "requiredAction": ""
  },
  
  "recommendations": [
    {
      "category": "fitness",
      "recommendation": "Increase daily steps to 8000",
      "priority": "medium",
      "rationale": "Current activity is below target"
    }
  ],
  
  "caregiverReport": {
    "summary": "Overall health status is stable",
    "alerts": [],
    "actionItems": ["Review medication schedule"],
    "observationNotes": ""
  },
  
  "healthSummary": {
    "overallStatus": "stable|caution|critical",
    "vitalsSummary": "All vitals within normal range",
    "recentTrends": "Improvement in daily activity",
    "complianceMetrics": {
      "medicationAdherence": 95,
      "activityLevel": 80,
      "sleepQuality": 85
    }
  },
  
  "overallRiskLevel": "low|medium|high|critical"
}
```

## Usage

### From the UI

1. Navigate to **AI Intelligence Center** page
2. Click **"Analyze Health Data"** button
3. Wait for the analysis to complete
4. View results:
   - **Fall Risk** - Percentage and risk level
   - **Emergency Status** - Emergency detection and required actions
   - **Overall Risk** - High-level risk assessment
   - **Health Summary** - Compliance metrics and trends
   - **AI Recommendations** - Prioritized care suggestions
   - **Caregiver Report** - Summary alerts and action items

### From Code

```typescript
import { aiService } from '../services/aiService';
import { AIReportService } from '../services/aiReportService';

// Analyze health data
const response = await aiService.analyzeHealthData({
  residentId: 'resident-123',
  name: 'John Doe',
  age: 75,
  heartRate: 72,
  spo2: 98,
  bloodPressure: '120/80',
  temperature: 36.8,
  sleepHours: 7,
  steps: 5000,
  cameraEvent: '',
  timestamp: new Date().toISOString(),
});

// Save to Firestore
const reportId = await AIReportService.saveReport(response, userId);

// Retrieve latest report
const report = await AIReportService.getLatestReport(residentId);

// Get report history
const reports = await AIReportService.getResidentReports(residentId, 10);
```

## Error Handling

The service includes comprehensive error handling:

- **Missing webhook URL**: Shows configuration error message
- **Network errors**: Displays error with HTTP status
- **Invalid response**: Auto-generates report ID if missing
- **Validation errors**: Lists all required fields that are missing
- **Firebase errors**: Gracefully degrades (analysis succeeds even if save fails)

## Firestore Collection Structure

Reports are stored in the `AIReports` collection with this structure:

```
AIReports/
├── {reportId}/
│   ├── id
│   ├── timestamp
│   ├── createdAt
│   ├── updatedAt
│   ├── userId
│   ├── residentId
│   ├── residentName
│   ├── healthMonitoring
│   ├── riskPredictions
│   ├── emergencyStatus
│   ├── recommendations
│   ├── caregiverReport
│   ├── healthSummary
│   └── overallRiskLevel
```

## Production Checklist

- [ ] Configure `VITE_N8N_WEBHOOK_URL` in production `.env`
- [ ] Test n8n workflow with sample data
- [ ] Verify response structure matches expected format
- [ ] Enable Firebase Firestore with AIReports collection
- [ ] Add Firestore security rules for AIReports collection
- [ ] Test error scenarios (network failures, invalid data)
- [ ] Monitor initial reports for accuracy
- [ ] Set up Firebase backup/export policies

## Firestore Security Rules

Suggested rules for the AIReports collection:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /AIReports/{reportId} {
      allow create: if request.auth != null 
        && request.resource.data.userId == request.auth.uid;
      allow read: if request.auth != null 
        && (resource.data.userId == request.auth.uid 
          || request.auth.uid in resource.data.allowedViewers);
      allow update, delete: if request.auth != null 
        && resource.data.userId == request.auth.uid;
    }
  }
}
```

## Debugging

To debug the integration:

1. **Check webhook URL:**
   ```typescript
   import { aiService } from './services/aiService';
   console.log(aiService.getWebhookUrl());
   ```

2. **Validate request data:**
   ```typescript
   const errors = aiService.validateRequest(data);
   console.log('Validation errors:', errors);
   ```

3. **Monitor network requests:**
   - Open browser DevTools → Network tab
   - Click "Analyze Health Data"
   - Check the request and response payload

4. **Check Firestore:**
   - Open Firebase Console
   - Navigate to Firestore Database
   - View AIReports collection

## Troubleshooting

### "N8N webhook URL is not configured"
- Ensure `VITE_N8N_WEBHOOK_URL` is set in `.env`
- Restart the dev server after changing `.env`

### "N8N workflow returned status 404"
- Verify the webhook URL is correct
- Check n8n workflow is active and published
- Ensure webhook path matches n8n configuration

### "Failed to save AI report"
- Check Firebase is configured correctly
- Verify Firestore rules allow writes from authenticated users
- Check user is authenticated

### Reports not appearing in Firestore
- Check Firebase authentication is working
- Verify user ID is correctly set
- Check Firestore rules aren't blocking writes
- Monitor browser console for errors

## Performance Considerations

- Reports are saved asynchronously (non-blocking)
- Analysis requests timeout after 30 seconds
- Firebase queries are indexed on `residentId` and `createdAt`
- Consider paginating large report histories

## Future Enhancements

- [ ] Real-time report updates with Firestore listeners
- [ ] Report comparison and trending
- [ ] Scheduled daily analysis
- [ ] Report export (PDF, CSV)
- [ ] Multi-resident analysis batching
- [ ] Historical data visualization
