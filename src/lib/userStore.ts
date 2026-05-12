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
import { auth, db, elderId as defaultElderId, googleProvider } from './firebase';
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

const USER_PROFILE_CACHE_KEY = 'eldercare-user-profile';

function userRef(uid: string) {
  return doc(db!, 'users', uid);
}

function cacheKey(uid: string) {
  return `${USER_PROFILE_CACHE_KEY}:${uid}`;
}

function readCachedProfile(uid: string) {
  try {
    const raw = window.localStorage.getItem(cacheKey(uid));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as AppUserProfile;
  } catch {
    return null;
  }
}

function writeCachedProfile(profile: AppUserProfile) {
  try {
    window.localStorage.setItem(cacheKey(profile.uid), JSON.stringify(profile));
  } catch {
    // Ignore cache write failures.
  }
}

export async function getUserProfile(uid: string) {
  const cached = readCachedProfile(uid);

  if (!db) {
    return cached;
  }

  try {
    const snapshot = await getDoc(userRef(uid));
    if (!snapshot.exists()) {
      return cached;
    }

    const profile = snapshot.data() as AppUserProfile;
    writeCachedProfile(profile);
    return profile;
  } catch (error) {
    if (cached) {
      return cached;
    }
    throw error;
  }
}

export async function saveUserProfile(profile: AppUserProfile) {
  writeCachedProfile(profile);

  if (!db) {
    return profile;
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

  await signInWithEmailAndPassword(auth, input.email, input.password);
}

export async function signInWithGoogleAccount(input: GoogleSignInInput) {
  if (!auth) {
    throw new Error('Firebase Auth is not available.');
  }

  const result = await signInWithPopup(auth, googleProvider);
  const existing = await getUserProfile(result.user.uid);

  if (!existing) {
    const profile = buildUserProfile(result.user, input.role, input.elderId, 'google', input.fullName);
    await saveUserProfile(profile);
    await ensureEldercareRecord(input.elderId, input.role === 'elder' ? input.fullName : undefined);
  }
}

export async function signOutUser() {
  if (!auth) {
    return;
  }

  await signOut(auth);
}

export { formatFirebaseError };
