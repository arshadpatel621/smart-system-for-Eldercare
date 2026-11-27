import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { after, before, beforeEach, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

const projectId = 'demo-vitalcare-rules';
const caregiverUid = 'caregiver-a';
const secondCaregiverUid = 'caregiver-b';
const unlinkedCaregiverUid = 'caregiver-unlinked';
const elderUid = 'elder-a';
const otherElderUid = 'elder-b';
const adminUid = 'admin';
const elderId = 'ELD-ABCD12';
const otherElderId = 'ELD-EFGH34';
const timestamp = '2025-01-01T00:00:00.000Z';

let testEnv;

function profile(uid, role, extra = {}) {
  return {
    uid,
    fullName: uid,
    email: `${uid}@example.test`,
    role,
    authProvider: 'password',
    createdAt: timestamp,
    status: 'active',
    ...extra,
  };
}

function relationship(caregiver, resident = elderUid, residentId = elderId) {
  const id = `rel-${caregiver}-${residentId}`;
  return {
    id,
    caregiverUid: caregiver,
    elderUid: resident,
    elderId: residentId,
    status: 'active',
  };
}

async function seed() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const profiles = [
      profile(caregiverUid, 'caregiver'),
      profile(secondCaregiverUid, 'caregiver'),
      profile(unlinkedCaregiverUid, 'caregiver', { linkedElderIds: [elderId] }),
      profile(elderUid, 'elder', { elderId }),
      profile(otherElderUid, 'elder', { elderId: otherElderId }),
      profile(adminUid, 'admin'),
    ];

    for (const user of profiles) {
      await setDoc(doc(db, 'users', user.uid), user);
    }

    await setDoc(doc(db, 'elderIds', elderId), {
      elderUid,
      elderId,
      fullName: 'Elder A',
      status: 'active',
      createdAt: timestamp,
    });
    await setDoc(doc(db, 'elderIds', otherElderId), {
      elderUid: otherElderUid,
      elderId: otherElderId,
      fullName: 'Elder B',
      status: 'active',
      createdAt: timestamp,
    });
    await setDoc(doc(db, 'elders', elderId), { privateValue: 'elder-a-data' });
    await setDoc(doc(db, 'elders', otherElderId), { privateValue: 'elder-b-data' });
  });
}

async function seedRelationship(caregiver = caregiverUid) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(
      doc(db, 'relationships', relationship(caregiver).id),
      { ...relationship(caregiver), createdAt: Timestamp.fromDate(new Date(timestamp)) }
    );
  });
}

before(async () => {
  const emulator = process.env.FIRESTORE_EMULATOR_HOST;
  assert.ok(emulator, 'Run these tests through the Firestore Emulator.');
  const separator = emulator.lastIndexOf(':');
  const host = emulator.slice(0, separator);
  const port = Number(emulator.slice(separator + 1));
  const rules = await readFile(
    fileURLToPath(new URL('../firestore.rules', import.meta.url)),
    'utf8'
  );
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { host, port, rules },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed();
});

after(async () => {
  await testEnv?.cleanup();
});

test('allows an immediate valid Elder-ID connection and access only to that Elder', async () => {
  await seedRelationship();
  const db = testEnv.authenticatedContext(caregiverUid).firestore();

  const links = await assertSucceeds(getDocs(query(
    collection(db, 'relationships'),
    where('caregiverUid', '==', caregiverUid),
    where('status', '==', 'active')
  )));
  assert.equal(links.size, 1);
  await assertSucceeds(getDoc(doc(db, 'users', elderUid)));
  await assertSucceeds(getDoc(doc(db, 'elders', elderId)));
  await assertFails(getDoc(doc(db, 'elders', otherElderId)));
});

test('allows multiple caregivers to connect independently to one Elder', async () => {
  const dbA = testEnv.authenticatedContext(caregiverUid).firestore();
  const dbB = testEnv.authenticatedContext(secondCaregiverUid).firestore();

  for (const [db, uid] of [[dbA, caregiverUid], [dbB, secondCaregiverUid]]) {
    const link = relationship(uid);
    await assertSucceeds(setDoc(doc(db, 'relationships', link.id), {
      ...link,
      createdAt: serverTimestamp(),
    }));
  }
});

test('rejects forged identities, mismatched Elder IDs, extra fields, and client timestamps', async () => {
  const db = testEnv.authenticatedContext(caregiverUid).firestore();
  const correctLink = relationship(caregiverUid);

  await assertFails(setDoc(
    doc(db, 'relationships', `rel-${secondCaregiverUid}-${elderId}`),
    { ...relationship(secondCaregiverUid), createdAt: serverTimestamp() }
  ));
  await assertFails(setDoc(doc(db, 'relationships', correctLink.id), {
    ...correctLink,
    elderUid: otherElderUid,
    createdAt: serverTimestamp(),
  }));
  await assertFails(setDoc(doc(db, 'relationships', `rel-${caregiverUid}-ELD-FAKE99`), {
    ...relationship(caregiverUid, elderUid, 'ELD-FAKE99'),
    createdAt: serverTimestamp(),
  }));
  await assertFails(setDoc(doc(db, 'relationships', correctLink.id), {
    ...correctLink,
    createdAt: serverTimestamp(),
    admin: true,
  }));
  await assertFails(setDoc(doc(db, 'relationships', correctLink.id), {
    ...correctLink,
    createdAt: Timestamp.now(),
  }));
});

test('does not authorize an Elder from a forged linkedElderIds profile cache', async () => {
  const db = testEnv.authenticatedContext(unlinkedCaregiverUid).firestore();
  await assertFails(getDoc(doc(db, 'elders', elderId)));
  await assertFails(getDoc(doc(db, 'users', elderUid)));
});

test('prevents caregivers from updating or deleting canonical relationships', async () => {
  await seedRelationship();
  const db = testEnv.authenticatedContext(caregiverUid).firestore();
  const relationshipRef = doc(db, 'relationships', relationship(caregiverUid).id);

  await assertFails(updateDoc(relationshipRef, { status: 'inactive' }));
  await assertFails(deleteDoc(relationshipRef));
});

test('prevents Elder-ID takeover and Elder-ID reassignment', async () => {
  const caregiverDb = testEnv.authenticatedContext(caregiverUid).firestore();
  await assertFails(setDoc(doc(caregiverDb, 'elderIds', elderId), {
    elderUid: caregiverUid,
    elderId,
    fullName: 'Forged owner',
    status: 'active',
    createdAt: timestamp,
  }));

  const elderDb = testEnv.authenticatedContext(elderUid).firestore();
  await assertFails(updateDoc(doc(elderDb, 'users', elderUid), {
    elderId: otherElderId,
  }));
});

test('allows an Elder to create its profile and unique ID mapping atomically', async () => {
  const newUid = 'elder-new';
  const newElderId = 'ELD-JKLM56';
  const db = testEnv.authenticatedContext(newUid).firestore();
  const batch = writeBatch(db);

  batch.set(doc(db, 'elderIds', newElderId), {
    elderUid: newUid,
    elderId: newElderId,
    fullName: 'New Elder',
    status: 'active',
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, 'users', newUid), profile(newUid, 'elder', {
    elderId: newElderId,
  }));

  await assertSucceeds(batch.commit());
});

test('lets admins inspect all relationships and deactivate access', async () => {
  await seedRelationship();
  const adminDb = testEnv.authenticatedContext(adminUid).firestore();
  const rows = await assertSucceeds(getDocs(collection(adminDb, 'relationships')));
  assert.equal(rows.size, 1);

  await assertSucceeds(updateDoc(
    doc(adminDb, 'relationships', relationship(caregiverUid).id),
    { status: 'inactive' }
  ));

  const caregiverDb = testEnv.authenticatedContext(caregiverUid).firestore();
  await assertFails(getDoc(doc(caregiverDb, 'elders', elderId)));
});
