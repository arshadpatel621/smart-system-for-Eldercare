import { initializeApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, GoogleAuthProvider, setPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';

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

let app = null;
let auth = null;
let db = null;

if (hasFirebaseConfig) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    void setPersistence(auth, browserLocalPersistence);
  } catch (error) {
    console.warn('[Firebase] Failed to initialize Firebase app or auth:', error);
  }
}

export { app, auth, db };
export const isAuthAvailable = Boolean(auth);
export const googleProvider = new GoogleAuthProvider();

// Initialize Analytics if supported and config exists
export const analytics = app && typeof window !== 'undefined' 
  ? isSupported().then(supported => supported ? getAnalytics(app!) : null)
  : null;

