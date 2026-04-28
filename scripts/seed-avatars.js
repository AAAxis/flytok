// Backfill `photoURL` on every user doc that doesn't already have one.
//
// Uses pravatar.cc — a free service that returns a stable random portrait
// for any seed. Same UID always gets the same face, so re-running is a
// no-op on users we've already filled.
//
// Usage:
//   node scripts/seed-avatars.js [--key=path/to/key.json] [--force]
//
// Pass --force to overwrite existing photoURLs (useful if you want to
// reroll all demo avatars after changing the seeding scheme).

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

function findServiceAccount() {
  const explicit = process.argv.find((a) => a.startsWith('--key='));
  if (explicit) return resolve(repoRoot, explicit.slice('--key='.length));
  const rootCandidate = resolve(repoRoot, 'service-account.json');
  if (existsSync(rootCandidate)) return rootCandidate;
  const firebaseDir = resolve(repoRoot, 'firebase');
  if (existsSync(firebaseDir)) {
    const adminsdk = readdirSync(firebaseDir).find((f) =>
      /-firebase-adminsdk-.*\.json$/.test(f),
    );
    if (adminsdk) return resolve(firebaseDir, adminsdk);
  }
  return null;
}

const FORCE = process.argv.includes('--force');
const keyPath = findServiceAccount();
if (!keyPath) {
  console.error('Could not find a Firebase Admin service account JSON.');
  process.exit(1);
}

initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, 'utf8'))) });
const db = getFirestore();

function avatarFor(uid) {
  // pravatar's `u=<seed>` is stable: the same seed always returns the same
  // face. Using the uid keeps each user's avatar consistent across re-runs.
  return `https://i.pravatar.cc/300?u=${encodeURIComponent(uid)}`;
}

const users = await db.collection('users').limit(500).get();
let updated = 0;
let skipped = 0;

for (const doc of users.docs) {
  const data = doc.data();
  if (!FORCE && data.photoURL) {
    skipped++;
    continue;
  }
  const url = avatarFor(doc.id);
  await doc.ref.set({ photoURL: url }, { merge: true });
  updated++;
  console.log(`${doc.id}  ←  ${url}`);
}

console.log('');
console.log(`Done — updated ${updated}, skipped ${skipped} (already had photoURL).`);
console.log(FORCE ? 'All avatars rerolled.' : 'Pass --force to overwrite existing avatars.');
process.exit(0);
