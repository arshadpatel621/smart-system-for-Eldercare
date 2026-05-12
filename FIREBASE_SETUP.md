# Firebase Setup

This app now works in two modes:

- `local` mode: no Firebase keys are present, so demo data is stored in browser `localStorage`
- `firebase` mode: the app reads and writes elder care data to Firestore

## 1. Environment variables

Copy `.env.example` to `.env` and add your Firebase Web App keys:

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_FIREBASE_ELDER_ID=demo-resident
```

## 2. Enable Firebase services

Enable these in Firebase Console:

- Authentication -> `Email/Password`
- Authentication -> `Google`
- Firestore Database

## 3. Firestore collections

The app uses one elder document and these subcollections:

- `users/{uid}`
- `elders/{elderId}`
- `elders/{elderId}/contacts`
- `elders/{elderId}/metrics`
- `elders/{elderId}/medications`
- `elders/{elderId}/medicationLogs`
- `elders/{elderId}/devices`
- `elders/{elderId}/safetyEvents`
- `elders/{elderId}/alerts`

User documents store:

- `uid`
- `fullName`
- `email`
- `role`
- `elderId`
- `authProvider`

## 4. Firestore rules

Deploy `firestore.rules` from this repo.

Role access:

- `admin`: full access to all user and elder records
- `caregiver`: read/write assigned elder record
- `elder`: read/write assigned elder record

## 5. Current app flow

- Resident profile page writes elder demographics and baseline thresholds
- Health monitor page writes manual vitals
- Routine page writes medications and medication adherence logs
- AI insights page imports sample smartwatch data into Firestore
- Safety and live monitor pages write safety events and alerts
- Login and signup create Firebase Auth accounts plus `users/{uid}` role records
- Google sign-in creates the Firestore user record on first login

## 6. Next backend steps in Firebase

Use Cloud Functions for the remaining production features:

- `onDocumentWritten('elders/{elderId}/alerts/{alertId}')`
  Send FCM, SMS, WhatsApp, or email to caretaker contacts
- `onDocumentWritten('elders/{elderId}/devices/{deviceId}')`
  Validate watch sync status and schedule retry jobs
- `https callable or webhook endpoint`
  Receive Fitbit or other wearable API payloads and convert them into `metrics`
- `camera detection service`
  Write fall or inactivity events into `safetyEvents`

## 7. Smartwatch integration path

Recommended first production path:

- Android watch or phone syncs into `Health Connect`
- Mobile app reads Health Connect
- Mobile app calls Firebase Cloud Function or writes authorized metric documents
- Web dashboard reads the same Firestore data

Alternative path:

- Fitbit OAuth on backend
- Cloud Function fetches Fitbit activity, heart rate, sleep, and SpO2
- Cloud Function writes normalized records into `metrics`

## 8. Notification path

Recommended escalation path:

- Browser notification for dashboard users
- Firebase Cloud Messaging for caretaker mobile app
- Twilio or WhatsApp for critical alerts

## 9. Camera detection path

Current repo includes a live camera test page only.

Production implementation should:

- run fall detection with MediaPipe, TensorFlow, or a Python service
- create a `safetyEvents` record when confidence passes threshold
- create or update an `alerts` record
- trigger Cloud Function notifications for unresolved critical events
