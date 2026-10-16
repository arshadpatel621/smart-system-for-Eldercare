import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { ensureEldercareRecord } from '../lib/eldercareStore';
import type { AppUserProfile } from '../types/auth';
import type { Relationship } from '../types/relationship';

const LOCAL_RELATIONSHIPS_KEY = 'eldercare-relationships-demo';
const USER_PROFILE_CACHE_KEY = 'eldercare-user-profile';

function readCachedProfile(uid: string): AppUserProfile | null {
  try {
    const raw = window.localStorage.getItem(`${USER_PROFILE_CACHE_KEY}:${uid}`);
    return raw ? (JSON.parse(raw) as AppUserProfile) : null;
  } catch {
    return null;
  }
}

function writeCachedProfile(profile: AppUserProfile): void {
  try {
    window.localStorage.setItem(`${USER_PROFILE_CACHE_KEY}:${profile.uid}`, JSON.stringify(profile));
  } catch {
    // Ignore cache write failures
  }
}

export function validateElderIdFormat(rawId: string): boolean {
  if (!rawId || typeof rawId !== 'string') return false;
  const trimmed = rawId.trim().toUpperCase();
  return /^ELD-[A-Z0-9]{4,10}$/i.test(trimmed);
}

function readLocalRelationships(): Relationship[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_RELATIONSHIPS_KEY);
    return raw ? (JSON.parse(raw) as Relationship[]) : [];
  } catch {
    return [];
  }
}

function saveLocalRelationships(relationships: Relationship[]): void {
  try {
    window.localStorage.setItem(LOCAL_RELATIONSHIPS_KEY, JSON.stringify(relationships));
  } catch {
    // Ignore cache write failures
  }
}

/**
 * Resolves an active Elder by their unique shareable Elder ID (e.g. ELD-7K4P92).
 * Uses the dedicated /elderIds/{elderId} index collection for safe, authorized, O(1) direct reads.
 * Avoids broad collection queries against /users that trigger Firestore security rule rejections.
 */
export async function findElderByElderId(elderId: string): Promise<AppUserProfile | null> {
  if (!elderId || typeof elderId !== 'string') {
    return null;
  }

  const normalizedId = elderId.trim().toUpperCase();

  if (!validateElderIdFormat(normalizedId)) {
    return null;
  }

  // 1. Primary Firestore resolution via /elderIds/{normalizedId} index document
  if (db) {
    try {
      const resSnap = await getDoc(doc(db, 'elderIds', normalizedId));
      if (resSnap.exists()) {
        const resData = resSnap.data();
        if (resData?.elderUid) {
          if (resData.status === 'disabled' || resData.status === 'inactive') {
            return null;
          }

          let fullName = (resData.fullName as string) || 'Elder Resident';
          let elderStatus: 'active' | 'inactive' | 'disabled' = (resData.status as any) || 'active';
          let email = '';

          // If the caller is already authorized to read users/{elderUid} (e.g. already linked or admin),
          // enrich with the full user profile details. If rules block access (pre-link state),
          // we safely proceed with the verified metadata from elderIds.
          try {
            const userSnap = await getDoc(doc(db, 'users', resData.elderUid));
            if (userSnap.exists()) {
              const uData = userSnap.data() as AppUserProfile;
              fullName = uData.fullName || fullName;
              elderStatus = uData.status || elderStatus;
              email = uData.email || email;
            }
          } catch {
            // Expected when user document is strictly protected before relationship is established
          }

          if (elderStatus === 'disabled' || elderStatus === 'inactive') {
            return null;
          }

          return {
            uid: resData.elderUid,
            fullName,
            email,
            role: 'elder',
            elderId: normalizedId,
            authProvider: 'password',
            status: elderStatus,
            createdAt: resData.createdAt || new Date().toISOString(),
          };
        }
      }
    } catch (err: any) {
      console.warn('[relationshipService] Direct lookup in elderIds failed:', err?.message || err);
    }
  }

  // 2. Local storage fallback (offline mode / local testing)
  const cachedKeys = Object.keys(localStorage).filter((k) => k.startsWith(`${USER_PROFILE_CACHE_KEY}:`));
  for (const key of cachedKeys) {
    try {
      const user = JSON.parse(localStorage.getItem(key) || '{}') as AppUserProfile;
      if (user.role === 'elder' && user.elderId?.toUpperCase() === normalizedId) {
        if (user.status !== 'disabled' && user.status !== 'inactive') {
          return user;
        }
      }
    } catch {
      // continue
    }
  }

  // 3. Demo Elder fallback when Firebase is not connected and format matches
  if (!db && validateElderIdFormat(normalizedId)) {
    return {
      uid: `demo-elder-${normalizedId.toLowerCase()}`,
      fullName: 'Demo Elder Resident',
      email: 'resident@vitalcare.local',
      role: 'elder',
      elderId: normalizedId,
      authProvider: 'password',
      status: 'active',
      createdAt: new Date().toISOString(),
    };
  }

  return null;
}

/**
 * Connects a registered Caregiver to an Elder using the Elder ID.
 * Validates identity, prevents duplicates, stores relationship doc, and updates linkedElderIds.
 */
export async function connectCaregiverToElder(
  caregiverUid: string,
  rawElderId: string
): Promise<{ success: boolean; message: string; elderProfile?: AppUserProfile }> {
  // 1. Verify caller identity
  if (auth?.currentUser && auth.currentUser.uid !== caregiverUid) {
    return {
      success: false,
      message: 'Unauthorized: Caller identity mismatch.',
    };
  }

  // 2. Validate input and Elder ID format
  if (!rawElderId || !rawElderId.trim()) {
    return {
      success: false,
      message: 'Please enter an Elder ID.',
    };
  }

  const normalizedElderId = rawElderId.trim().toUpperCase();

  if (!validateElderIdFormat(normalizedElderId)) {
    return {
      success: false,
      message: 'Invalid Elder ID format. Elder IDs should look like ELD-7K4P92.',
    };
  }

  // 3. Locate active Elder by Elder ID
  const elderProfile = await findElderByElderId(normalizedElderId);
  if (!elderProfile) {
    return {
      success: false,
      message: `We couldn't find an active Elder with ID "${normalizedElderId}". Please verify the Elder ID with the resident.`,
    };
  }

  // 4. Prevent self-linking
  if (elderProfile.uid === caregiverUid) {
    return {
      success: false,
      message: 'You cannot connect your own Elder account as a caregiver.',
    };
  }

  // 5. Verify caregiver account status
  let caregiverProfile: AppUserProfile | null = null;
  if (db) {
    try {
      const caregiverSnap = await getDoc(doc(db, 'users', caregiverUid));
      if (caregiverSnap.exists()) {
        caregiverProfile = caregiverSnap.data() as AppUserProfile;
      }
    } catch {
      caregiverProfile = readCachedProfile(caregiverUid);
    }
  } else {
    caregiverProfile = readCachedProfile(caregiverUid);
  }

  if (caregiverProfile && caregiverProfile.role !== 'caregiver') {
    return {
      success: false,
      message: 'Only registered Caregivers can connect to Elders.',
    };
  }

  // 6. Check for duplicate connection in caregiver profile
  if (caregiverProfile?.linkedElderIds?.includes(normalizedElderId)) {
    return {
      success: false,
      message: 'This Elder is already connected to your account.',
    };
  }

  const relationshipId = `rel-${caregiverUid}-${normalizedElderId}`;
  const legacyRelationshipId = `rel-${caregiverUid}-${elderProfile.uid}`;

  const newRelationship: Relationship = {
    id: relationshipId,
    caregiverUid,
    elderUid: elderProfile.uid,
    elderId: normalizedElderId,
    status: 'active',
    createdAt: new Date().toISOString(),
  };

  // 7. Handle local offline mode
  if (!db) {
    const localRels = readLocalRelationships();
    if (
      localRels.some(
        (r) =>
          r.caregiverUid === caregiverUid &&
          (r.elderId === normalizedElderId || r.elderUid === elderProfile.uid)
      )
    ) {
      return {
        success: false,
        message: 'This Elder is already connected to your account.',
      };
    }

    localRels.push(newRelationship);
    saveLocalRelationships(localRels);

    if (caregiverProfile) {
      const updatedCaregiver: AppUserProfile = {
        ...caregiverProfile,
        linkedElderIds: [...(caregiverProfile.linkedElderIds || []), normalizedElderId],
      };
      writeCachedProfile(updatedCaregiver);
    }

    return {
      success: true,
      message: `Successfully connected to ${elderProfile.fullName}!`,
      elderProfile,
    };
  }

  // 8. Firestore execution: check duplicate relationships & commit link
  try {
    const relRef = doc(db, 'relationships', relationshipId);
    const relSnap = await getDoc(relRef);
    if (relSnap.exists()) {
      return {
        success: false,
        message: 'This Elder is already connected to your account.',
      };
    }

    const legacyRelRef = doc(db, 'relationships', legacyRelationshipId);
    const legacyRelSnap = await getDoc(legacyRelRef);
    if (legacyRelSnap.exists()) {
      return {
        success: false,
        message: 'This Elder is already connected to your account.',
      };
    }

    // Create primary relationship document
    await setDoc(relRef, newRelationship);

    // Update caregiver's linkedElderIds in Firestore
    const caregiverRef = doc(db, 'users', caregiverUid);
    await setDoc(
      caregiverRef,
      { linkedElderIds: arrayUnion(normalizedElderId) },
      { merge: true }
    );

    // Ensure the elders/{normalizedElderId} operational record exists
    await ensureEldercareRecord(normalizedElderId, elderProfile.fullName);

    // Update locally cached profile
    if (caregiverProfile) {
      const updatedCaregiver: AppUserProfile = {
        ...caregiverProfile,
        linkedElderIds: [...(caregiverProfile.linkedElderIds || []), normalizedElderId],
      };
      writeCachedProfile(updatedCaregiver);
    }

    return {
      success: true,
      message: `Successfully connected to ${elderProfile.fullName}!`,
      elderProfile,
    };
  } catch (err: any) {
    console.error('[relationshipService] Failed to establish relationship:', err);
    const errMsg = err?.message || String(err);
    if (errMsg.includes('permission') || errMsg.includes('PERMISSION_DENIED')) {
      return {
        success: false,
        message: 'Permission denied: Please ensure your account profile is saved and Firestore rules are deployed.',
      };
    }
    return {
      success: false,
      message: `Failed to connect Elder: ${errMsg}`,
    };
  }
}

/**
 * Loads all Elder profiles connected to the given Caregiver.
 * Safely resolves each linked Elder ID individually through authorized documents.
 */
export async function getLinkedEldersForCaregiver(
  caregiverProfile: AppUserProfile
): Promise<AppUserProfile[]> {
  const linkedIds = caregiverProfile.linkedElderIds || [];
  if (linkedIds.length === 0) {
    return [];
  }

  const elders: AppUserProfile[] = [];

  for (const id of linkedIds) {
    try {
      const elder = await findElderByElderId(id);
      if (elder) {
        elders.push(elder);
      }
    } catch (err) {
      console.warn(`[relationshipService] Failed to resolve elder "${id}":`, err);
    }
  }

  return elders;
}

/**
 * Retrieves all Caregivers connected to an Elder resident.
 */
export async function getLinkedCaregiversForElder(
  elderUid: string
): Promise<AppUserProfile[]> {
  if (!db) {
    const rels = readLocalRelationships().filter((r) => r.elderUid === elderUid);
    const caregivers: AppUserProfile[] = [];
    for (const rel of rels) {
      const profile = readCachedProfile(rel.caregiverUid);
      if (profile) caregivers.push(profile);
    }
    return caregivers;
  }

  try {
    const q = query(
      collection(db, 'relationships'),
      where('elderUid', '==', elderUid),
      where('status', '==', 'active')
    );

    const snapshot = await getDocs(q);
    const caregiverUids = snapshot.docs.map((d) => (d.data() as Relationship).caregiverUid);

    const caregivers: AppUserProfile[] = [];
    for (const uid of caregiverUids) {
      try {
        const userSnap = await getDoc(doc(db, 'users', uid));
        if (userSnap.exists()) {
          caregivers.push(userSnap.data() as AppUserProfile);
        } else {
          const cached = readCachedProfile(uid);
          if (cached) caregivers.push(cached);
        }
      } catch {
        const cached = readCachedProfile(uid);
        if (cached) caregivers.push(cached);
      }
    }
    return caregivers;
  } catch (err) {
    console.warn('[relationshipService] Failed to load linked caregivers for elder:', err);
    return [];
  }
}

/**
 * Retrieves all platform relationships (Admin management access).
 */
export async function getAllRelationships(): Promise<Relationship[]> {
  if (!db) {
    return readLocalRelationships();
  }

  const snapshot = await getDocs(collection(db, 'relationships'));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Relationship);
}
