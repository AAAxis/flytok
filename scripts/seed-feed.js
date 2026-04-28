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

// Each preset becomes one demo user + one video they "uploaded".
const PRESETS = [
  {
    label: 'Maldives palms',
    user: { uid: 'demo-aria', displayName: 'Aria Lindberg', username: 'aria', bio: 'Beach scout. Probably barefoot.' },
    query: 'beach palm tropical',
    location: { latitude: 4.1755, longitude: 73.5093, label: 'Maldives' },
    caption: 'Palm-fringed white sand and that impossible blue. Maldives at low tide.',
    hashtags: ['beach', 'tropical', 'maldives', 'paradise', 'travel'],
  },
  {
    label: 'Swiss Alps',
    user: { uid: 'demo-jonas', displayName: 'Jonas Beck', username: 'jonas', bio: 'Mountains, granola, no signal.' },
    query: 'mountain hiking alps snow',
    location: { latitude: 46.5547, longitude: 8.1009, label: 'Swiss Alps, Switzerland' },
    caption: 'Above the cloud line in the Alps. Worth every step.',
    hashtags: ['mountains', 'alps', 'switzerland', 'hiking', 'snow'],
  },
  {
    label: 'Tokyo neon',
    user: { uid: 'demo-kenji', displayName: 'Kenji Sato', username: 'kenji', bio: 'Tokyo nights, ramen, walking 20km a day.' },
    query: 'tokyo city night neon',
    location: { latitude: 35.6595, longitude: 139.7005, label: 'Shibuya, Tokyo' },
    caption: 'Shibuya scramble after dark. The whole city is a screen.',
    hashtags: ['tokyo', 'japan', 'night', 'city', 'neon'],
  },
  {
    label: 'Iceland waterfall',
    user: { uid: 'demo-eva', displayName: 'Eva Magnús', username: 'eva', bio: 'Volcanoes, glaciers, hot springs in that order.' },
    query: 'iceland waterfall nature',
    location: { latitude: 63.6157, longitude: -19.9929, label: 'Skógafoss, Iceland' },
    caption: 'Skógafoss roars all year. Wear a raincoat or get soaked, you choose.',
    hashtags: ['iceland', 'waterfall', 'nature', 'travel', 'cold'],
  },
  {
    label: 'Bali rice terraces',
    user: { uid: 'demo-ketut', displayName: 'Ketut Wirawan', username: 'ketut', bio: 'Bali born. Showing the green parts.' },
    query: 'bali rice terrace green',
    location: { latitude: -8.4309, longitude: 115.2741, label: 'Tegalalang, Bali' },
    caption: 'Tegalalang in the morning haze before the tour buses arrive.',
    hashtags: ['bali', 'indonesia', 'rice', 'green', 'travel'],
  },
  {
    label: 'New York skyline',
    user: { uid: 'demo-maya', displayName: 'Maya Rivera', username: 'maya', bio: 'Brooklyn → everywhere → back.' },
    query: 'new york city skyline',
    location: { latitude: 40.7484, longitude: -73.9857, label: 'Manhattan, New York' },
    caption: 'Empire State view that never gets old. NYC rooftops at golden hour.',
    hashtags: ['nyc', 'newyork', 'skyline', 'usa', 'city'],
  },
  {
    label: 'Santorini sunset',
    user: { uid: 'demo-nikos', displayName: 'Nikos Pappas', username: 'nikos', bio: 'White houses, blue doors, tomatoes.' },
    query: 'greece santorini white village',
    location: { latitude: 36.4615, longitude: 25.3760, label: 'Oia, Santorini' },
    caption: 'Oia at sunset. Yes, the cliché. Yes, still worth it.',
    hashtags: ['greece', 'santorini', 'sunset', 'islands', 'europe'],
  },
  {
    label: 'Patagonia glacier',
    user: { uid: 'demo-luca', displayName: 'Luca Fernández', username: 'luca', bio: 'South of south. Always cold.' },
    query: 'patagonia glacier ice',
    location: { latitude: -50.4974, longitude: -73.1377, label: 'Perito Moreno, Argentina' },
    caption: 'The crack and boom of glacier ice calving in Patagonia.',
    hashtags: ['patagonia', 'argentina', 'glacier', 'ice', 'adventure'],
  },
  {
    label: 'Sahara dunes',
    user: { uid: 'demo-yasmin', displayName: 'Yasmin El Idrissi', username: 'yasmin', bio: 'Desert sunrises and mint tea.' },
    query: 'sahara desert dunes morocco',
    location: { latitude: 31.1366, longitude: -4.0103, label: 'Erg Chebbi, Morocco' },
    caption: 'Sunrise over Erg Chebbi. The desert is louder than people think.',
    hashtags: ['sahara', 'morocco', 'desert', 'sunrise', 'travel'],
  },
  {
    label: 'Norway fjord',
    user: { uid: 'demo-sigrid', displayName: 'Sigrid Olsen', username: 'sigrid', bio: 'Boat captain. Cold-water swimmer.' },
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

// 1) Upsert one demo user per preset.
console.log('Creating demo users…');
for (const p of PRESETS) {
  await db.collection('users').doc(p.user.uid).set(
    {
      uid: p.user.uid,
      email: `${p.user.username}@demo.flytok.app`,
      displayName: p.user.displayName,
      username: p.user.username,
      bio: p.user.bio,
      isDemo: true,
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

// 2) Build the video docs. Track the resulting (videoId, ownerId) for activity.
const seededVideos = [];
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

    const docId = `seed-${preset.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const ref = db.collection('videos').doc(docId);
    const existing = await ref.get();
    const ownerId = preset.user.uid;
    const ownerEmail = `${preset.user.username}@demo.flytok.app`;

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
        createdAt: existing.exists
          ? existing.data().createdAt ?? FieldValue.serverTimestamp()
          : FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    seededVideos.push({ id: docId, ownerId });

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

// 3) Simulate cross-user activity: each demo user likes a random subset of
//    *other* users' videos and leaves a few comments. Idempotent because the
//    like doc id is the user's uid (one like per user per video) and comment
//    docs use stable ids per (uid, videoId).
const COMMENT_TEMPLATES = [
  'okay this just got added to the bucket list',
  'how was the weather there?',
  'incredible shot 🌍',
  'i was here last summer — pure magic',
  'what camera did you use?',
  'saving this one for later',
  'the colors are unreal',
  'taking notes for my next trip',
  'this place is on a different planet',
  'did you go alone or with friends?',
  'sound on for this one',
  'wow',
];

function pickN(arr, n) {
  const copy = [...arr];
  const out = [];
  for (let i = 0; i < n && copy.length; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

console.log('\nSimulating activity…');
let likeWrites = 0;
let commentWrites = 0;

for (const video of seededVideos) {
  const otherUsers = PRESETS.filter((p) => p.user.uid !== video.ownerId).map((p) => p.user);

  // 4–8 random likers per video
  const likerCount = 4 + Math.floor(Math.random() * 5);
  const likers = pickN(otherUsers, Math.min(likerCount, otherUsers.length));

  for (const liker of likers) {
    await db
      .collection('videos')
      .doc(video.id)
      .collection('likes')
      .doc(liker.uid)
      .set({ createdAt: FieldValue.serverTimestamp() }, { merge: true });
    likeWrites++;
  }

  await db
    .collection('videos')
    .doc(video.id)
    .set({ likeCount: likers.length }, { merge: true });

  // 1–4 random commenters per video
  const commenterCount = 1 + Math.floor(Math.random() * 4);
  const commenters = pickN(otherUsers, Math.min(commenterCount, otherUsers.length));

  for (const commenter of commenters) {
    const text = COMMENT_TEMPLATES[Math.floor(Math.random() * COMMENT_TEMPLATES.length)];
    const commentId = `seed-${commenter.uid}`;
    await db
      .collection('videos')
      .doc(video.id)
      .collection('comments')
      .doc(commentId)
      .set(
        {
          authorId: commenter.uid,
          authorEmail: `${commenter.username}@demo.flytok.app`,
          text,
          seed: true,
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    commentWrites++;
  }
}

console.log(`Likes written: ${likeWrites}`);
console.log(`Comments written: ${commentWrites}`);

console.log('');
console.log(`Done — videos inserted ${inserted}, updated ${updated}, skipped ${skipped}.`);
console.log(`Demo users: ${PRESETS.map((p) => p.user.uid).join(', ')}`);
process.exit(0);
