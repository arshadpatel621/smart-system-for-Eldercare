import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase';
import { ensureEldercareRecord, formatFirebaseError } from './eldercareStore';
import type { AppUserProfile, UserRole } from '../types/auth';

interface SignUpInput {
  fullName: string;
  email: string;
  password: string;
  role: UserRole;
  elderId: string;
}

interface GoogleSignInInput {
  role: UserRole;
  elderId: string;
  fullName?: string;
}

function userRef(uid: string) {
  return doc(db!, 'users', uid);
}

export async function getUserProfile(uid: string) {
  if (!db) {
    return null;
  }

  const snapshot = await getDoc(userRef(uid));
  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.data() as AppUserProfile;
}

export async function saveUserProfile(profile: AppUserProfile) {
  if (!db) {
    throw new Error('Firestore is not available for user profile storage.');
  }

  await setDoc(userRef(profile.uid), profile, { merge: true });
  return profile;
}

function buildUserProfile(user: User, role: UserRole, elderId: string, authProvider: 'password' | 'google', fullName?: string) {
  return {
    uid: user.uid,
    fullName: fullName || user.displayName || 'VitalCare User',
    email: user.email || '',
    role,
    elderId,
    authProvider,
    createdAt: new Date().toISOString(),
  } satisfies AppUserProfile;
}

export async function signUpWithEmail(input: SignUpInput) {
  if (!auth) {
    throw new Error('Firebase Auth is not available.');
  }

  await setPersistence(auth, browserLocalPersistence);
  const result = await createUserWithEmailAndPassword(auth, input.email, input.password);
  await updateProfile(result.user, { displayName: input.fullName });

  const profile = buildUserProfile(result.user, input.role, input.elderId, 'password', input.fullName);
  await saveUserProfile(profile);
  await ensureEldercareRecord(input.elderId, input.role === 'elder' ? input.fullName : undefined);
  return profile;
}

export async function signInWithEmail(input: { email: string; password: string }) {
  if (!auth) {
    throw new Error('Firebase Auth is not available.');
  }

  await setPersistence(auth, browserLocalPersistence);
  const result = await signInWithEmailAndPassword(auth, input.email, input.password);
  const profile = await getUserProfile(result.user.uid);

  if (!profile) {
    throw new Error('Account profile is missing. Please contact admin or sign up again.');
  }

  return profile;
}

export async function signInWithGoogleAccount(input: GoogleSignInInput) {
  if (!auth) {
    throw new Error('Firebase Auth is not available.');
  }

  await setPersistence(auth, browserLocalPersistence);
  const result = await signInWithPopup(auth, googleProvider);
  const existing = await getUserProfile(result.user.uid);

  if (existing) {
    return existing;
  }

  const profile = buildUserProfile(result.user, input.role, input.elderId, 'google', input.fullName);
  await saveUserProfile(profile);
  await ensureEldercareRecord(input.elderId, input.role === 'elder' ? input.fullName : undefined);
  return profile;
}

export async function signOutUser() {
  if (!auth) {
    return;
  }

  await signOut(auth);
}

export { formatFirebaseError };
