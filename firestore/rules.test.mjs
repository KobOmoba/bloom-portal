// EduBloom Firestore rules tests. Runs against the local Firestore emulator only:
// no live data is touched. Each test signs in as a different kind of user and
// checks they can open exactly what they should.
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc } from 'firebase/firestore';

const ADMIN_UID = 'HSpdm2NYK4hEGqBxyTPEi2wy39F2';
let env;

const as = {
  stranger: () => env.unauthenticatedContext().firestore(),
  admin:    () => env.authenticatedContext(ADMIN_UID, { email: 'admin@edubloom.com.ng' }).firestore(),
  schoolA:  () => env.authenticatedContext('uidA', { email: 'eb-a01@schools.edubloom.com.ng' }).firestore(),
  schoolB:  () => env.authenticatedContext('uidB', { email: 'eb-b02@schools.edubloom.com.ng' }).firestore(),
  agent:    () => env.authenticatedContext('uidAg', { email: 'agent-2348000000001@agents.edubloom.com.ng' }).firestore(),
  // Someone who made their own Firebase account with a look-alike email
  bursarA:  () => env.authenticatedContext('uidBu', { email: 'bursar@gmail.com' }).firestore(),
  teacherA: () => env.authenticatedContext('uidT', { email: 'mrs.ade@gmail.com' }).firestore(),
  // A real login who is not on any staff list (e.g. removed teacher)
  outsider: () => env.authenticatedContext('uidX', { email: 'someone@gmail.com' }).firestore(),
  faker:    () => env.authenticatedContext('uidF', { email: 'eb-a01@schools.edubloom.com.ng.evil.com' }).firestore(),
};

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'edubloom-rules-lab',
    firestore: { rules: readFileSync(process.env.RULES || 'firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
after(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    // School document IDs are stored in upper case, logins in lower case
    await setDoc(doc(db, 'schools/EB-A01'), { name: 'School A' });
    await setDoc(doc(db, 'schools/EB-A01/students/s1'), { name: 'Pupil', class: 'JSS1' });
    await setDoc(doc(db, 'schools/EB-A01/students/s1/private/fees'), { balance: 5000 });
    await setDoc(doc(db, 'schools/EB-B02'), { name: 'School B' });
    await setDoc(doc(db, 'schools/EB-A01/staff_directory/uidT'), { role: 'Class Teacher', assignedClass: 'JSS1', email: 'mrs.ade@gmail.com' });
    await setDoc(doc(db, 'schools/EB-A01/staff_directory/uidBu'), { role: 'Bursar', email: 'bursar@gmail.com' });
    await setDoc(doc(db, 'admin_agents/a1'), { phone: '2348000000001' });
    await setDoc(doc(db, 'admin_deals/d1'), { status: 'approved' });
    await setDoc(doc(db, 'admin_ledger/l1'), { agentPhone: '2348000000001' });
    await setDoc(doc(db, 'public_ocr_keys/main'), { groqApiKey: 'gsk_test' });
    await setDoc(doc(db, 'admin_settings/main'), { x: 1 });
    await setDoc(doc(db, 'admin_approved_schools/EB-A01'), { password: 'secret' });
  });
});

// ── Strangers (not logged in) ──
test('stranger cannot read any school', async () => {
  await assertFails(getDoc(doc(as.stranger(), 'schools/EB-A01')));
  await assertFails(getDoc(doc(as.stranger(), 'schools/EB-A01/students/s1')));
});
test('stranger cannot write a school', async () => {
  await assertFails(setDoc(doc(as.stranger(), 'schools/EB-A01'), { hacked: true }));
});
test('stranger cannot read AI keys', async () => {
  await assertFails(getDoc(doc(as.stranger(), 'public_ocr_keys/main')));
});
test('stranger cannot read agents, deals or ledger', async () => {
  await assertFails(getDoc(doc(as.stranger(), 'admin_agents/a1')));
  await assertFails(getDoc(doc(as.stranger(), 'admin_deals/d1')));
  await assertFails(getDoc(doc(as.stranger(), 'admin_ledger/l1')));
});
test('stranger CAN send an agent sign-up request and an alert', async () => {
  await assertSucceeds(addDoc(collection(as.stranger(), 'admin_agent_requests'), { name: 'New agent' }));
  await assertSucceeds(addDoc(collection(as.stranger(), 'admin_alerts'), { msg: 'forgot password' }));
});
test('stranger cannot read sign-up requests or alerts', async () => {
  await assertFails(getDoc(doc(as.stranger(), 'admin_alerts/x')));
});

// ── Schools ──
test('school A can read and write its own data (any depth)', async () => {
  const db = as.schoolA();
  await assertSucceeds(getDoc(doc(db, 'schools/EB-A01')));
  await assertSucceeds(getDoc(doc(db, 'schools/EB-A01/students/s1/private/fees')));
  await assertSucceeds(updateDoc(doc(db, 'schools/EB-A01'), { name: 'School A+' }));
  await assertSucceeds(setDoc(doc(db, 'schools/EB-A01/data/fees'), { v: [] }));
});
test('school A cannot read or write school B', async () => {
  const db = as.schoolA();
  await assertFails(getDoc(doc(db, 'schools/EB-B02')));
  await assertFails(setDoc(doc(db, 'schools/EB-B02'), { hacked: true }));
});
test('look-alike email cannot open school A', async () => {
  await assertFails(getDoc(doc(as.faker(), 'schools/EB-A01')));
});
test('school can read AI keys (stop-gap) but cannot change them', async () => {
  await assertSucceeds(getDoc(doc(as.schoolA(), 'public_ocr_keys/main')));
  await assertFails(setDoc(doc(as.schoolA(), 'public_ocr_keys/main'), { groqApiKey: 'x' }));
});
test('school cannot read agents, ledger or school passwords', async () => {
  await assertFails(getDoc(doc(as.schoolA(), 'admin_agents/a1')));
  await assertFails(getDoc(doc(as.schoolA(), 'admin_ledger/l1')));
  await assertFails(getDoc(doc(as.schoolA(), 'admin_approved_schools/EB-A01')));
});

// ── Agents ──
test('agent can read agents, deals, ledger and submit a deal', async () => {
  const db = as.agent();
  await assertSucceeds(getDoc(doc(db, 'admin_agents/a1')));
  await assertSucceeds(getDoc(doc(db, 'admin_deals/d1')));
  await assertSucceeds(getDoc(doc(db, 'admin_ledger/l1')));
  await assertSucceeds(setDoc(doc(db, 'admin_deals/new1'), { status: 'pending' }));
  await assertSucceeds(setDoc(doc(db, 'admin_deal_students/new1'), { n: 1 }));
});
test('agent cannot approve a deal, change the ledger or open schools', async () => {
  const db = as.agent();
  await assertFails(updateDoc(doc(db, 'admin_deals/d1'), { status: 'paid' }));
  await assertFails(setDoc(doc(db, 'admin_ledger/l2'), { amount: 1e6 }));
  await assertFails(getDoc(doc(db, 'schools/EB-A01')));
  await assertFails(getDoc(doc(db, 'admin_settings/main')));
});

// ── Admin (Bayo) ──
test('admin can read and write everything', async () => {
  const db = as.admin();
  await assertSucceeds(getDoc(doc(db, 'schools/EB-A01/students/s1/private/fees')));
  await assertSucceeds(updateDoc(doc(db, 'admin_deals/d1'), { status: 'paid' }));
  await assertSucceeds(getDoc(doc(db, 'admin_approved_schools/EB-A01')));
  await assertSucceeds(setDoc(doc(db, 'admin_settings/main'), { x: 2 }));
  await assertSucceeds(deleteDoc(doc(db, 'admin_ledger/l1')));
});

// ── Staff (teachers / bursars with their own logins) ──
test('teacher on school A staff list can log in and use school A data', async () => {
  const db = as.teacherA();
  await assertSucceeds(getDoc(doc(db, 'schools/EB-A01/staff_directory/uidT')));
  await assertSucceeds(getDoc(doc(db, 'schools/EB-A01')));
  await assertSucceeds(getDoc(doc(db, 'schools/EB-A01/students/s1')));
  await assertSucceeds(setDoc(doc(db, 'schools/EB-A01/students/s1/scores/Term1_Maths'), { exam: 60, subject: 'Maths' }));
  await assertSucceeds(setDoc(doc(db, 'schools/EB-A01/attendance/2026-11'), { days: {} }));
  await assertSucceeds(getDoc(doc(db, 'schools/EB-A01/data/students')));
});
test('class teacher cannot see fees; bursar can', async () => {
  await assertFails(getDoc(doc(as.teacherA(), 'schools/EB-A01/students/s1/private/fees')));
  await assertSucceeds(getDoc(doc(as.bursarA(), 'schools/EB-A01/students/s1/private/fees')));
});
test('ATTACK: a stranger login cannot make itself Principal of a school', async () => {
  await assertFails(setDoc(doc(as.outsider(), 'schools/EB-A01/staff_directory/uidX'), { role: 'Principal' }));
});
test('school login saves its data folders', async () => {
  const db = as.schoolA();
  await assertSucceeds(setDoc(doc(db, 'schools/EB-A01/data/students'), { v: [] }));
  await assertSucceeds(setDoc(doc(db, 'schools/EB-A01/attendance/2026-11'), { days: {} }));
  await assertSucceeds(setDoc(doc(db, 'schools/EB-A01/payment_receipts/r1'), { amt: 1 }));
});
test('teacher cannot promote themself or add staff', async () => {
  const db = as.teacherA();
  await assertFails(updateDoc(doc(db, 'schools/EB-A01/staff_directory/uidT'), { role: 'Principal' }));
  await assertFails(setDoc(doc(db, 'schools/EB-A01/staff_directory/uidNew'), { role: 'Bursar' }));
});
test('teacher of school A cannot open school B', async () => {
  await assertFails(getDoc(doc(as.teacherA(), 'schools/EB-B02')));
});
test('a login not on the staff list (e.g. removed teacher) gets nothing', async () => {
  await assertFails(getDoc(doc(as.outsider(), 'schools/EB-A01')));
  await assertFails(getDoc(doc(as.outsider(), 'schools/EB-A01/staff_directory/uidT')));
});
test('Principal (school login) can add and remove staff', async () => {
  const db = as.schoolA();
  await assertSucceeds(setDoc(doc(db, 'schools/EB-A01/staff_directory/uidNew'), { role: 'Bursar' }));
  await assertSucceeds(deleteDoc(doc(db, 'schools/EB-A01/staff_directory/uidT')));
});
