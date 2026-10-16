import { initializeApp, type FirebaseApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, GoogleAuthProvider, setPersistence, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const requiredConfig = [
  firebaseConfig.apiKey,
  firebaseConfig.authDomain,
  firebaseConfig.projectId,
  firebaseConfig.storageBucket,
  firebaseConfig.messagingSenderId,
  firebaseConfig.appId,
];

export const hasFirebaseConfig = requiredConfig.every((key) => typeof key === 'string' && key.trim().length > 0);
export const elderId = import.meta.env.VITE_FIREBASE_ELDER_ID || 'demo-resident';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (hasFirebaseConfig) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    void setPersistence(auth, browserLocalPersistence);

    if (typeof window !== 'undefined') {
      console.log('[VitalCare Firebase Initialized]', {
        hostname: window.location.hostname,
        authDomain: app.options.authDomain,
        projectId: app.options.projectId,
      });
    }
  } catch (error) {
    console.warn('[Firebase] Failed to initialize Firebase app or auth:', error);
  }
}

export { app, auth, db };
export const firebaseProjectId = firebaseConfig.projectId;
export const firebaseAuthDomain = firebaseConfig.authDomain;
export const isAuthAvailable = Boolean(auth);
export const googleProvider = new GoogleAuthProvider();

// Initialize Analytics if supported and config exists
export const analytics: Promise<Analytics | null> | null = app && typeof window !== 'undefined' 
  ? isSupported().then(supported => (supported && app ? getAnalytics(app) : null))
  : null;

