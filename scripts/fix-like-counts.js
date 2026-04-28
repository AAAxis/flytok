// Recomputes videos.likeCount from each video's /likes subcollection.
// Run once to heal historical bad values (negatives, drift).
//
// Usage:  node scripts/fix-like-counts.js [--dry]

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const dryRun = process.argv.includes('--dry');

function findServiceAccount() {
  const root = resolve(repoRoot, 'service-account.json');
  if (existsSync(root)) return root;
  const dir = resolve(repoRoot, 'firebase');
  if (existsSync(dir)) {
    const file = readdirSync(dir).find((f) => /-firebase-adminsdk-.*\.json$/.test(f));
    if (file) return resolve(dir, file);
  }
  return null;
}

const keyPath = findServiceAccount();
if (!keyPath) {
  console.error('No service account JSON found.');
  process.exit(1);
}

initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, 'utf8'))) });
const db = getFirestore();

const videos = await db.collection('videos').limit(500).get();
console.log(`Scanning ${videos.size} videos${dryRun ? ' (dry run)' : ''}...\n`);

let fixed = 0;
let alreadyCorrect = 0;
const writer = db.batch();
let writes = 0;

for (const v of videos.docs) {
  const stored = v.data().likeCount ?? 0;
  const actual = (await v.ref.collection('likes').count().get()).data().count;
  if (stored !== actual) {
    console.log(`• ${v.id}: stored=${stored} → actual=${actual}`);
    if (!dryRun) {
      writer.update(v.ref, { likeCount: actual });
      writes++;
      // Firestore batches max out at 500 ops; commit-flush as we go.
      if (writes >= 400) {
        await writer.commit();
        writes = 0;
      }
    }
    fixed++;
  } else {
    alreadyCorrect++;
  }
}

if (!dryRun && writes > 0) await writer.commit();

console.log('');
console.log(`Done — ${fixed} ${dryRun ? 'would fix' : 'fixed'}, ${alreadyCorrect} already correct.`);
process.exit(0);
