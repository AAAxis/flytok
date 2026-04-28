// One-shot cleanup: floor every videos/<id>.likeCount to >= 0.
//
// Why: an earlier version of toggleLike used FieldValue.increment(-1) which
// allowed counts to drift below zero when a like-doc existed but the
// likeCount field was missing. The current toggleLike (transaction with
// Math.max(0, current - 1)) can't go negative, but the bad data is still in
// the DB. This script reads every video and rewrites likeCount to
// max(0, current) — also recomputing the count from the actual `likes`
// subcollection so it matches reality.
//
// Usage:
//   node scripts/clamp-like-counts.js [--key=path/to/key.json]

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

const keyPath = findServiceAccount();
if (!keyPath) {
  console.error('Could not find a Firebase Admin service account JSON.');
  process.exit(1);
}

initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, 'utf8'))) });
const db = getFirestore();

const videos = await db.collection('videos').get();
let touched = 0;
let fixed = 0;
let recomputed = 0;

for (const doc of videos.docs) {
  const data = doc.data();
  const stored = (data.likeCount ?? 0) | 0;
  // Re-count from the likes subcollection for accuracy.
  const likes = await db.collection('videos').doc(doc.id).collection('likes').count().get();
  const actual = likes.data().count;

  const next = Math.max(0, actual);
  if (stored !== next) {
    await doc.ref.set({ likeCount: next }, { merge: true });
    if (stored < 0) fixed++;
    if (stored !== actual) recomputed++;
    touched++;
    console.log(`${doc.id}: ${stored} → ${next}`);
  }
}

console.log('');
console.log(`Done — scanned ${videos.size}, touched ${touched}, fixed ${fixed} negatives, recomputed ${recomputed}.`);
process.exit(0);
