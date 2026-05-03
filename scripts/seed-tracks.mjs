// Seeds the curated music library used by the upload screen's
// `MusicPickerSheet` (W4 / Upload v2).
//
// For each track in `TRACKS` below the script downloads the source file,
// uploads it to Firebase Storage at `audio_library/{trackId}.mp3`, and writes
// (or updates) a `tracks/{trackId}` document with title / artist / duration /
// license metadata. Re-running the script with the same `id` is idempotent —
// the existing storage object is overwritten and the doc is merged.
//
// Usage:
//   node scripts/seed-tracks.mjs
//
// Optional flags:
//   --key=<path>   Use a non-default service account JSON. Defaults to
//                  `service-account.json` at repo root, then any
//                  `firebase/*-firebase-adminsdk-*.json`, then the
//                  `roamerz-b0056-firebase-adminsdk-*.json` at repo root.
//   --bucket=<id>  Override the Storage bucket. Defaults to
//                  `<projectId>.firebasestorage.app` (matches the prod app).
//
// All tracks listed here are CC0 (Pixabay Music). Add your own curated picks
// by appending to TRACKS — the only required fields are `id`, `title`,
// `artist`, `durationSec`, and `url`. `category` is for the picker's section
// labels; `attributionURL` is best-effort for our records.

import { existsSync, readFileSync, readdirSync, mkdtempSync, createWriteStream } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { Readable } from 'node:stream';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

// Seed list. Roman should curate this with real Pixabay Music URLs before
// running the script. Each entry maps to a tracks/{id} doc and an
// audio_library/{id}.mp3 storage object.
const TRACKS = [
  {
    id: 'pix-chill-coast',
    title: 'Chill Coast',
    artist: 'Pixabay Music',
    durationSec: 142,
    category: 'chill',
    license: 'cc0',
    url: 'https://cdn.pixabay.com/audio/2023/06/09/audio_56e0e7c4e0.mp3',
    attributionURL: 'https://pixabay.com/music/',
  },
  {
    id: 'pix-lofi-streets',
    title: 'Lofi Streets',
    artist: 'Pixabay Music',
    durationSec: 168,
    category: 'lo-fi',
    license: 'cc0',
    url: 'https://cdn.pixabay.com/audio/2022/10/30/audio_347111d1f5.mp3',
    attributionURL: 'https://pixabay.com/music/',
  },
  {
    id: 'pix-cinematic-dawn',
    title: 'Cinematic Dawn',
    artist: 'Pixabay Music',
    durationSec: 124,
    category: 'cinematic',
    license: 'cc0',
    url: 'https://cdn.pixabay.com/audio/2022/03/15/audio_c8e9d54820.mp3',
    attributionURL: 'https://pixabay.com/music/',
  },
  {
    id: 'pix-upbeat-summer',
    title: 'Upbeat Summer',
    artist: 'Pixabay Music',
    durationSec: 132,
    category: 'upbeat',
    license: 'cc0',
    url: 'https://cdn.pixabay.com/audio/2023/05/16/audio_5b7e6e3b7b.mp3',
    attributionURL: 'https://pixabay.com/music/',
  },
  {
    id: 'pix-travel-anthem',
    title: 'Travel Anthem',
    artist: 'Pixabay Music',
    durationSec: 156,
    category: 'travel',
    license: 'cc0',
    url: 'https://cdn.pixabay.com/audio/2022/08/02/audio_2fdba50a9b.mp3',
    attributionURL: 'https://pixabay.com/music/',
  },
  {
    id: 'pix-ambient-skies',
    title: 'Ambient Skies',
    artist: 'Pixabay Music',
    durationSec: 188,
    category: 'ambient',
    license: 'cc0',
    url: 'https://cdn.pixabay.com/audio/2022/11/22/audio_d9b9b7fdc4.mp3',
    attributionURL: 'https://pixabay.com/music/',
  },
  {
    id: 'pix-acoustic-walk',
    title: 'Acoustic Walk',
    artist: 'Pixabay Music',
    durationSec: 120,
    category: 'acoustic',
    license: 'cc0',
    url: 'https://cdn.pixabay.com/audio/2023/03/02/audio_c6079b1fd6.mp3',
    attributionURL: 'https://pixabay.com/music/',
  },
  {
    id: 'pix-electronic-pulse',
    title: 'Electronic Pulse',
    artist: 'Pixabay Music',
    durationSec: 200,
    category: 'electronic',
    license: 'cc0',
    url: 'https://cdn.pixabay.com/audio/2022/05/27/audio_d7c2c6f4dc.mp3',
    attributionURL: 'https://pixabay.com/music/',
  },
];

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
  // Wave 1+ committed the service account at the repo root for Firestore
  // rule deploys. Fall back to that.
  const rootAdminsdk = readdirSync(repoRoot).find((f) => /-firebase-adminsdk-.*\.json$/.test(f));
  if (rootAdminsdk) return resolve(repoRoot, rootAdminsdk);
  return null;
}

const keyPath = findServiceAccount();
if (!keyPath) {
  console.error('Could not find a Firebase Admin service account JSON.');
  console.error('Pass --key=<path> or place the JSON at the repo root / firebase/*.json.');
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));

const bucketArg = process.argv.find((a) => a.startsWith('--bucket='));
const bucketName = bucketArg
  ? bucketArg.slice('--bucket='.length)
  : `${serviceAccount.project_id}.firebasestorage.app`;

initializeApp({ credential: cert(serviceAccount), storageBucket: bucketName });
const db = getFirestore();
const bucket = getStorage().bucket();

async function downloadToTemp(url, dest) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  await new Promise((resolveDownload, rejectDownload) => {
    const out = createWriteStream(dest);
    Readable.fromWeb(res.body).pipe(out);
    out.on('finish', resolveDownload);
    out.on('error', rejectDownload);
  });
}

async function seed() {
  const tmp = mkdtempSync(join(tmpdir(), 'flytok-tracks-'));
  let inserted = 0;
  let skipped = 0;
  for (const track of TRACKS) {
    process.stdout.write(`• ${track.id} — ${track.title} … `);
    const localPath = join(tmp, `${track.id}.mp3`);
    try {
      await downloadToTemp(track.url, localPath);
    } catch (err) {
      console.log(`download failed (${err.message})`);
      skipped++;
      continue;
    }
    const storagePath = `audio_library/${track.id}.mp3`;
    try {
      await bucket.upload(localPath, {
        destination: storagePath,
        contentType: 'audio/mpeg',
        public: false,
        resumable: false,
        metadata: { metadata: { license: track.license, sourceURL: track.url } },
      });
    } catch (err) {
      console.log(`upload failed (${err.message})`);
      skipped++;
      continue;
    }
    try {
      await db.collection('tracks').doc(track.id).set(
        {
          title: track.title,
          artist: track.artist,
          durationSec: track.durationSec,
          storagePath,
          category: track.category ?? null,
          license: track.license,
          attributionURL: track.attributionURL ?? null,
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      inserted++;
      console.log('ok');
    } catch (err) {
      console.log(`firestore write failed (${err.message})`);
      skipped++;
    }
  }
  console.log(`\nDone. Seeded ${inserted} track${inserted === 1 ? '' : 's'}, skipped ${skipped}.`);
}

seed().catch((err) => {
  console.error('seed-tracks failed:', err);
  process.exit(1);
});
