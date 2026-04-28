// One-off (or repeatable) script: mirror every Firebase Auth user into the
// Firestore `users/{uid}` collection. Use as a backfill, or any time Auth and
// Firestore drift apart.
//
// Long-term plan: a Cloud Function on `auth.user().onCreate` writes the doc
// automatically when a user signs up. Until that's deployed, run this.
//
// Usage:
//   node scripts/sync-users.js

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

function findServiceAccount() {
  const explicit = process.argv.find((a) => a.startsWith('--key='));
  if (explicit) return resolve(repoRoot, explicit.slice('--key='.length));

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
  console.error('No service account JSON found.');
  process.exit(1);
}

initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, 'utf8'))) });
const auth = getAuth();
const db = getFirestore();

let synced = 0;
let pageToken;
do {
  const result = await auth.listUsers(1000, pageToken);
  for (const u of result.users) {
    const role = u.customClaims?.role ?? 'user';
    const createdAt = u.metadata?.creationTime
      ? Timestamp.fromDate(new Date(u.metadata.creationTime))
      : FieldValue.serverTimestamp();

    await db.collection('users').doc(u.uid).set(
      {
        email: u.email ?? null,
        displayName: u.displayName ?? null,
        avatarUrl: u.photoURL ?? null,
        emailVerified: u.emailVerified,
        role,
        createdAt,
        followerCount: 0,
        followingCount: 0,
        videoCount: 0,
      },
      { merge: true },
    );
    synced++;
    console.log(`✓ ${u.email ?? u.uid} (${role})`);
  }
  pageToken = result.pageToken;
} while (pageToken);

console.log(`\nSynced ${synced} user(s) to Firestore.`);
