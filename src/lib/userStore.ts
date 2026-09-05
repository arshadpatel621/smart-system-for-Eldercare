import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, getDoc, runTransaction, setDoc } from 'firebase/firestore';

import { auth, db, googleProvider } from './firebase';
import { ensureEldercareRecord, formatFirebaseError } from './eldercareStore';
import type { AppUserProfile, UserRole } from '../types/auth';

export async function generateUniqueElderId(): Promise<string> {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let isUnique = false;
  let candidate = '';
  let attempts = 0;

  while (!isUnique && attempts < 10) {
    attempts++;
    candidate = 'ELD-';
    for (let i = 0; i < 6; i++) {
      candidate += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    if (!db) {
      isUnique = true;
      break;
    }

    try {
      const snap = await getDoc(doc(db, 'elderIds', candidate));
      if (!snap.exists()) {
        isUnique = true;
      }
    } catch {
      isUnique = true;
    }
  }

  return candidate;
}


export function generateElderId(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = 'ELD-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

interface SignUpInput {
  fullName: string;
  email: string;
  password: string;
  role: UserRole;
  elderId?: string;
}

interface GoogleSignInInput {
  role: UserRole;
  elderId?: string;
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

export async function reserveElderIdAtomic(
  profile: AppUserProfile
): Promise<AppUserProfile> {
  writeCachedProfile(profile);

  if (!db) {
    return profile;
  }

  if (profile.role !== 'elder' || !profile.elderId) {
    await setDoc(userRef(profile.uid), profile, { merge: true });
    return profile;
  }

  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let reserved = false;
  let attempts = 0;
  let currentProfile = { ...profile };

  while (!reserved && attempts < 10) {
    attempts++;
    const candidateId = currentProfile.elderId!;
    const reservationRef = doc(db, 'elderIds', candidateId);
    const userDocRef = userRef(currentProfile.uid);

    try {
      await runTransaction(db, async (transaction) => {
        const resSnap = await transaction.get(reservationRef);
        if (resSnap.exists()) {
          const existingData = resSnap.data();
          if (existingData.elderUid !== currentProfile.uid) {
            throw new Error('COLLISION');
          }
        }

        transaction.set(reservationRef, {
          elderUid: currentProfile.uid,
          elderId: candidateId,
          createdAt: new Date().toISOString(),
        });

        transaction.set(userDocRef, currentProfile, { merge: true });
      });

      reserved = true;
      writeCachedProfile(currentProfile);
    } catch (err: any) {
      if (err?.message === 'COLLISION') {
        let newId = 'ELD-';
        for (let i = 0; i < 6; i++) {
          newId += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        currentProfile = { ...currentProfile, elderId: newId };
      } else {
        throw err;
      }
    }
  }

  return currentProfile;
}

export async function saveUserProfile(profile: AppUserProfile) {
  if (profile.role === 'elder' && profile.elderId) {
    return await reserveElderIdAtomic(profile);
  }

  writeCachedProfile(profile);

  if (!db) {
    return profile;
  }

  await setDoc(userRef(profile.uid), profile, { merge: true });
  return profile;
}


/**
 * Safely update editable profile fields only.
 * Role, uid, email, and authProvider are intentionally excluded from updates.
 */
export type EditableProfileFields = Pick<
  AppUserProfile,
  | 'fullName'
  | 'phone'
  | 'address'
  | 'organization'
  | 'qualifications'
  | 'certifications'
  | 'specialization'
  | 'experienceYears'
  | 'joiningDate'
>;

export async function updateUserProfile(
  currentProfile: AppUserProfile,
  updates: Partial<EditableProfileFields>
): Promise<AppUserProfile> {
  const merged: AppUserProfile = { ...currentProfile, ...updates };
  writeCachedProfile(merged);

  if (db) {
    await setDoc(userRef(merged.uid), updates, { merge: true });
  }

  return merged;
}

async function buildUserProfile(
  user: User,
  role: UserRole,
  authProvider: 'password' | 'google',
  fullName?: string,
  providedElderId?: string
): Promise<AppUserProfile> {
  const isElder = role === 'elder';
  const isCaregiver = role === 'caregiver';
  const assignedElderId = isElder
    ? (providedElderId || (await generateUniqueElderId()))
    : undefined;

  const profile: AppUserProfile = {
    uid: user.uid,
    fullName: fullName || user.displayName || 'VitalCare User',
    email: user.email || '',
    role,
    authProvider,
    status: 'active',
    createdAt: new Date().toISOString(),
  };

  if (isElder && assignedElderId) {
    profile.elderId = assignedElderId;
  }

  if (isCaregiver) {
    profile.linkedElderIds = [];
  }

  return profile;
}

export async function signUpWithEmail(input: SignUpInput) {
  if (input.role === 'admin') {
    throw new Error('Administrator accounts cannot be registered publicly.');
  }

  if (!auth) {
    throw new Error('Firebase Auth is not available.');
  }

  const result = await createUserWithEmailAndPassword(auth, input.email, input.password);
  await updateProfile(result.user, { displayName: input.fullName });

  const profile = await buildUserProfile(result.user, input.role, 'password', input.fullName, input.elderId);
  await saveUserProfile(profile);

  if (profile.role === 'elder' && profile.elderId) {
    await ensureEldercareRecord(profile.elderId, profile.fullName);
  }
  return profile;
}

/**
 * For users already authenticated (e.g. via Google) who need to complete their profile.
 * Skips account creation — just saves the Firestore profile.
 */
export async function saveProfileForCurrentUser(
  user: User,
  input: { fullName: string; role: UserRole; elderId?: string }
) {
  if (input.role === 'admin') {
    throw new Error('Administrator accounts cannot be registered publicly.');
  }

  const profile = await buildUserProfile(user, input.role, 'google', input.fullName, input.elderId);
  await saveUserProfile(profile);

  if (profile.role === 'elder' && profile.elderId) {
    await ensureEldercareRecord(profile.elderId, profile.fullName);
  }
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
    const profile = await buildUserProfile(result.user, input.role, 'google', input.fullName, input.elderId);
    await saveUserProfile(profile);
    if (profile.role === 'elder' && profile.elderId) {
      await ensureEldercareRecord(profile.elderId, profile.fullName);
    }
  }
}

export async function signOutUser() {
  if (!auth) {
    return;
  }

  await signOut(auth);
}

export { formatFirebaseError };

