// Run with: node scripts/diagnose-saves.js
//
// Lists every user that has at least one doc in users/{uid}/saves and
// prints which video IDs they've saved. Uses the admin service account so
// it bypasses Firestore security rules — what's reported here is the
// actual server state.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

function findServiceAccount() {
  const rootCandidate = resolve(repoRoot, 'service-account.json');
  if (existsSync(rootCandidate)) return rootCandidate;
  const firebaseDir = resolve(repoRoot, 'firebase');
  if (existsSync(firebaseDir)) {
    const adminsdk = readdirSync(firebaseDir).find((f) => /-firebase-adminsdk-.*\.json$/.test(f));
    if (adminsdk) return resolve(firebaseDir, adminsdk);
  }
  return null;
}

const keyPath = findServiceAccount();
if (!keyPath) {
  console.error('Could not find service account.');
  process.exit(1);
}

initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, 'utf8'))) });
const db = getFirestore();

const usersSnap = await db.collection('users').limit(200).get();
console.log(`Found ${usersSnap.size} users.\n`);

let totalSaves = 0;
const usersWithSaves = [];

for (const userDoc of usersSnap.docs) {
  const savesSnap = await db
    .collection('users')
    .doc(userDoc.id)
    .collection('saves')
    .limit(50)
    .get();
  if (savesSnap.empty) continue;

  totalSaves += savesSnap.size;
  const data = userDoc.data() ?? {};
  const label = data.displayName || data.email || userDoc.id;
  usersWithSaves.push({
    uid: userDoc.id,
    label,
    count: savesSnap.size,
    videoIds: savesSnap.docs.map((d) => d.id),
  });
}

if (usersWithSaves.length === 0) {
  console.log('No user has any save docs.');
  console.log('That means Save taps in the app are not reaching Firestore.');
  console.log('Likely: rules blocking the write, or toggleSave is throwing.');
} else {
  console.log(`${usersWithSaves.length} user(s) have saves (${totalSaves} total).\n`);
  for (const u of usersWithSaves) {
    console.log(`• ${u.label}  uid=${u.uid}  saves=${u.count}`);
    console.log(`  video ids: ${u.videoIds.join(', ')}`);

    // Check whether those video docs actually exist in /videos.
    const checks = await Promise.all(
      u.videoIds.map((id) =>
        db.collection('videos').doc(id).get().then((s) => ({ id, exists: s.exists })),
      ),
    );
    const missing = checks.filter((c) => !c.exists);
    if (missing.length) {
      console.log(`  MISSING video docs: ${missing.map((m) => m.id).join(', ')}`);
    } else {
      console.log(`  all videos exist ✓`);
    }
    console.log('');
  }
}

process.exit(0);
