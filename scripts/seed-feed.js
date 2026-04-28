// Seed the Firestore `videos` collection with 10 portrait videos from Pixabay.
//
// Usage:
//   PIXABAY_API_KEY=<your-key> node scripts/seed-feed.js
//
// Get a free key at https://pixabay.com/api/docs/ ("Get started" → log in → key
// appears under your profile). The script:
//   1. Searches Pixabay's video API for each curated travel theme
//   2. Picks the first portrait result (height > width)
//   3. Inserts a Firestore doc into `videos` pointing at the Pixabay CDN URL
//      with caption, hashtags, and location coordinates pre-filled.
//
// Re-running the script with the same theme labels updates existing docs
// rather than duplicating, so it's safe to re-run.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const PIXABAY_KEY = process.env.PIXABAY_API_KEY;
if (!PIXABAY_KEY) {
  console.error('Missing PIXABAY_API_KEY env var.');
  console.error('Get a free key at https://pixabay.com/api/docs/');
  console.error('Run with: PIXABAY_API_KEY=<key> node scripts/seed-feed.js');
  process.exit(1);
}

const PRESETS = [
  {
    label: 'Maldives palms',
    query: 'beach palm tropical',
    location: { latitude: 4.1755, longitude: 73.5093, label: 'Maldives' },
    caption:
      'Palm-fringed white sand and that impossible blue. The Maldives at low tide. ',
    hashtags: ['beach', 'tropical', 'maldives', 'paradise', 'travel'],
  },
  {
    label: 'Swiss Alps',
    query: 'mountain hiking alps snow',
    location: { latitude: 46.5547, longitude: 8.1009, label: 'Swiss Alps, Switzerland' },
    caption: 'Above the cloud line in the Alps. Worth every step.',
    hashtags: ['mountains', 'alps', 'switzerland', 'hiking', 'snow'],
  },
  {
    label: 'Tokyo neon',
    query: 'tokyo city night neon',
    location: { latitude: 35.6595, longitude: 139.7005, label: 'Shibuya, Tokyo' },
    caption: 'Shibuya scramble after dark. The whole city is a screen.',
    hashtags: ['tokyo', 'japan', 'night', 'city', 'neon'],
  },
  {
    label: 'Iceland waterfall',
    query: 'iceland waterfall nature',
    location: { latitude: 63.6157, longitude: -19.9929, label: 'Skógafoss, Iceland' },
    caption: 'Skógafoss roars all year. Wear a raincoat or get soaked, you choose.',
    hashtags: ['iceland', 'waterfall', 'nature', 'travel', 'cold'],
  },
  {
    label: 'Bali rice terraces',
    query: 'bali rice terrace green',
    location: { latitude: -8.4309, longitude: 115.2741, label: 'Tegalalang, Bali' },
    caption: 'Tegalalang in the morning haze before the tour buses arrive.',
    hashtags: ['bali', 'indonesia', 'rice', 'green', 'travel'],
  },
  {
    label: 'New York skyline',
    query: 'new york city skyline',
    location: { latitude: 40.7484, longitude: -73.9857, label: 'Manhattan, New York' },
    caption: "Empire State view that never gets old. NYC rooftops at golden hour.",
    hashtags: ['nyc', 'newyork', 'skyline', 'usa', 'city'],
  },
  {
    label: 'Santorini sunset',
    query: 'greece santorini white village',
    location: { latitude: 36.4615, longitude: 25.3760, label: 'Oia, Santorini' },
    caption: 'Oia at sunset. Yes, the cliché. Yes, still worth it.',
    hashtags: ['greece', 'santorini', 'sunset', 'islands', 'europe'],
  },
  {
    label: 'Patagonia glacier',
    query: 'patagonia glacier ice',
    location: { latitude: -50.4974, longitude: -73.1377, label: 'Perito Moreno, Argentina' },
    caption: 'The crack and boom of glacier ice calving in Patagonia.',
    hashtags: ['patagonia', 'argentina', 'glacier', 'ice', 'adventure'],
  },
  {
    label: 'Sahara dunes',
    query: 'sahara desert dunes morocco',
    location: { latitude: 31.1366, longitude: -4.0103, label: 'Erg Chebbi, Morocco' },
    caption: 'Sunrise over Erg Chebbi. The desert is louder than people think.',
    hashtags: ['sahara', 'morocco', 'desert', 'sunrise', 'travel'],
  },
  {
    label: 'Norway fjord',
    query: 'norway fjord water',
    location: { latitude: 60.8676, longitude: 7.0855, label: 'Geirangerfjord, Norway' },
    caption: 'Geirangerfjord from the deck. Cliffs, waterfalls, and water you can drink.',
    hashtags: ['norway', 'fjord', 'scandinavia', 'water', 'europe'],
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
  return null;
}

const keyPath = findServiceAccount();
if (!keyPath) {
  console.error('Could not find a Firebase Admin service account JSON.');
  console.error('Looked for service-account.json at repo root or firebase/*-firebase-adminsdk-*.json.');
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function findPortraitVideo(query) {
  const url = new URL('https://pixabay.com/api/videos/');
  url.searchParams.set('key', PIXABAY_KEY);
  url.searchParams.set('q', query);
  url.searchParams.set('per_page', '50');
  url.searchParams.set('safesearch', 'true');

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Pixabay API ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  if (!data.hits?.length) return null;

  // Pixabay returns multiple sizes per video. We want a portrait clip.
  // Prefer the "large" size and check its dimensions.
  for (const hit of data.hits) {
    const v = hit.videos?.large ?? hit.videos?.medium ?? hit.videos?.small;
    if (!v?.url) continue;
    if ((v.height ?? 0) > (v.width ?? 0)) {
      return {
        url: v.url,
        thumbnail: hit.videos?.tiny?.url ?? null,
        width: v.width,
        height: v.height,
        pixabayId: hit.id,
        pageURL: hit.pageURL,
      };
    }
  }
  // No portrait found — fall back to the first hit (square or landscape) so
  // the slot isn't empty.
  const fallback = data.hits[0];
  const v = fallback.videos?.large ?? fallback.videos?.medium;
  return v?.url
    ? {
        url: v.url,
        thumbnail: fallback.videos?.tiny?.url ?? null,
        width: v.width,
        height: v.height,
        pixabayId: fallback.id,
        pageURL: fallback.pageURL,
      }
    : null;
}

const ownerId = 'flytok-demo';
const ownerEmail = 'demo@flytok.app';

// Make sure the demo user has a profile doc so chats/comments don't show
// blank attribution.
await db.collection('users').doc(ownerId).set(
  {
    uid: ownerId,
    email: ownerEmail,
    displayName: 'Flytok Demo',
    bio: 'Curated stock travel clips. Add your own with the camera.',
    isDemo: true,
    createdAt: FieldValue.serverTimestamp(),
  },
  { merge: true },
);

let inserted = 0;
let updated = 0;
let skipped = 0;

for (const preset of PRESETS) {
  process.stdout.write(`• ${preset.label} … `);
  try {
    const video = await findPortraitVideo(preset.query);
    if (!video) {
      console.log('no result');
      skipped++;
      continue;
    }

    // Stable doc ID per preset so re-runs update rather than duplicate.
    const docId = `seed-${preset.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const ref = db.collection('videos').doc(docId);
    const existing = await ref.get();

    await ref.set(
      {
        ownerId,
        ownerEmail,
        downloadURL: video.url,
        thumbnailUrl: video.thumbnail,
        storagePath: null,
        caption: preset.caption,
        hashtags: preset.hashtags,
        location: preset.location,
        seed: true,
        seedSource: 'pixabay',
        seedSourceId: video.pixabayId,
        seedSourceURL: video.pageURL,
        widthHint: video.width,
        heightHint: video.height,
        createdAt: existing.exists ? existing.data().createdAt ?? FieldValue.serverTimestamp()
          : FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    if (existing.exists) {
      console.log(`updated ${docId} (${video.width}×${video.height})`);
      updated++;
    } else {
      console.log(`inserted ${docId} (${video.width}×${video.height})`);
      inserted++;
    }
  } catch (err) {
    console.log(`failed: ${err.message}`);
    skipped++;
  }
}

console.log('');
console.log(`Done — inserted ${inserted}, updated ${updated}, skipped ${skipped}.`);
console.log(`Owner uid: ${ownerId} (email ${ownerEmail})`);
process.exit(0);
