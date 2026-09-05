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
import { getUserProfile, saveUserProfile } from '../lib/userStore';
import type { AppUserProfile } from '../types/auth';
import type { Relationship } from '../types/relationship';


const LOCAL_RELATIONSHIPS_KEY = 'eldercare-relationships-demo';

export function validateElderIdFormat(rawId: string): boolean {
  const trimmed = rawId.trim().toUpperCase();
  return /^ELD-[A-Z0-9]{6}$/.test(trimmed);
}

function readLocalRelationships(): Relationship[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_RELATIONSHIPS_KEY);
    return raw ? (JSON.parse(raw) as Relationship[]) : [];
  } catch {
    return [];
  }
}

function saveLocalRelationships(relationships: Relationship[]) {
  try {
    window.localStorage.setItem(LOCAL_RELATIONSHIPS_KEY, JSON.stringify(relationships));
  } catch {
    // Ignore cache write failures
  }
}

export async function findElderByElderId(elderId: string): Promise<AppUserProfile | null> {
  const normalizedId = elderId.trim().toUpperCase();

  if (!db) {
    // Local demo fallback: search local user cache or create demo elder profile
    const cachedKeys = Object.keys(localStorage).filter((k) => k.startsWith('eldercare-user-profile:'));
    for (const key of cachedKeys) {
      try {
        const user = JSON.parse(localStorage.getItem(key) || '{}') as AppUserProfile;
        if (user.role === 'elder' && user.elderId?.toUpperCase() === normalizedId) {
          return user;
        }
      } catch {
        // continue
      }
    }
    // Mock Elder for demo mode if matching pattern
    if (validateElderIdFormat(normalizedId)) {
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

  const q = query(
    collection(db, 'users'),
    where('role', '==', 'elder'),
    where('elderId', '==', normalizedId)
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return null;
  }

  const docData = snapshot.docs[0].data() as AppUserProfile;
  if (docData.status === 'disabled' || docData.status === 'inactive') {
    return null;
  }

  return docData;
}

export async function connectCaregiverToElder(
  caregiverUid: string,
  rawElderId: string
): Promise<{ success: boolean; message: string; elderProfile?: AppUserProfile }> {
  if (auth?.currentUser && auth.currentUser.uid !== caregiverUid) {
    return {
      success: false,
      message: 'Unauthorized: Caller identity mismatch.',
    };
  }

  const normalizedElderId = rawElderId.trim().toUpperCase();


  if (!validateElderIdFormat(normalizedElderId)) {
    return {
      success: false,
      message: 'Invalid Elder ID format. Elder IDs should look like ELD-7K4P92.',
    };
  }

  const elderProfile = await findElderByElderId(normalizedElderId);
  if (!elderProfile) {
    return {
      success: false,
      message: "We couldn't find an active Elder with this ID. Please check the ID and try again.",
    };
  }

  const caregiverProfile = await getUserProfile(caregiverUid);
  if (!caregiverProfile || caregiverProfile.role !== 'caregiver') {
    return {
      success: false,
      message: 'Only registered Caregivers can connect to Elders.',
    };
  }

  if (caregiverProfile.linkedElderIds?.includes(normalizedElderId)) {
    return {
      success: false,
      message: 'This Elder is already connected to your account.',
    };
  }

  const relationshipId = `rel-${caregiverUid}-${elderProfile.uid}`;
  const newRelationship: Relationship = {
    id: relationshipId,
    caregiverUid,
    elderUid: elderProfile.uid,
    elderId: normalizedElderId,
    status: 'active',
    createdAt: new Date().toISOString(),
  };

  if (!db) {
    const localRels = readLocalRelationships();
    if (localRels.some((r) => r.caregiverUid === caregiverUid && r.elderId === normalizedElderId)) {
      return {
        success: false,
        message: 'This Elder is already connected to your account.',
      };
    }
    localRels.push(newRelationship);
    saveLocalRelationships(localRels);

    // Update local caregiver profile
    const updatedCaregiver: AppUserProfile = {
      ...caregiverProfile,
      linkedElderIds: [...(caregiverProfile.linkedElderIds || []), normalizedElderId],
    };
    await saveUserProfile(updatedCaregiver);

    return {
      success: true,
      message: `Successfully connected to ${elderProfile.fullName}!`,
      elderProfile,
    };
  }

  // Check Firestore relationship doc to prevent duplicates
  const relRef = doc(db, 'relationships', relationshipId);
  const relSnap = await getDoc(relRef);
  if (relSnap.exists()) {
    return {
      success: false,
      message: 'This Elder is already connected to your account.',
    };
  }

  // Create relationship doc & update caregiver linkedElderIds
  await setDoc(relRef, newRelationship);
  const caregiverRef = doc(db, 'users', caregiverUid);
  await setDoc(
    caregiverRef,
    { linkedElderIds: arrayUnion(normalizedElderId) },
    { merge: true }
  );

  return {
    success: true,
    message: `Successfully connected to ${elderProfile.fullName}!`,
    elderProfile,
  };
}

export async function getLinkedEldersForCaregiver(
  caregiverProfile: AppUserProfile
): Promise<AppUserProfile[]> {
  const linkedIds = caregiverProfile.linkedElderIds || [];
  if (linkedIds.length === 0) {
    return [];
  }

  if (!db) {
    const elders: AppUserProfile[] = [];
    for (const id of linkedIds) {
      const elder = await findElderByElderId(id);
      if (elder) elders.push(elder);
    }
    return elders;
  }

  const q = query(
    collection(db, 'users'),
    where('role', '==', 'elder'),
    where('elderId', 'in', linkedIds.slice(0, 10)) // Firestore 'in' limit is 10
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data() as AppUserProfile);
}

export async function getLinkedCaregiversForElder(
  elderUid: string
): Promise<AppUserProfile[]> {
  if (!db) {
    const rels = readLocalRelationships().filter((r) => r.elderUid === elderUid);
    const caregivers: AppUserProfile[] = [];
    for (const rel of rels) {
      const profile = await getUserProfile(rel.caregiverUid);
      if (profile) caregivers.push(profile);
    }
    return caregivers;
  }

  const q = query(
    collection(db, 'relationships'),
    where('elderUid', '==', elderUid),
    where('status', '==', 'active')
  );

  const snapshot = await getDocs(q);
  const caregiverUids = snapshot.docs.map((d) => (d.data() as Relationship).caregiverUid);

  const caregivers: AppUserProfile[] = [];
  for (const uid of caregiverUids) {
    const profile = await getUserProfile(uid);
    if (profile) caregivers.push(profile);
  }
  return caregivers;
}

export async function getAllRelationships(): Promise<Relationship[]> {
  if (!db) {
    return readLocalRelationships();
  }

  const snapshot = await getDocs(collection(db, 'relationships'));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Relationship);
}
