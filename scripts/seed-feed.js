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

// 10 demo users; each has 3 different video themes -> 30 videos total.
const PRESETS = [
  {
    user: { uid: 'demo-aria', displayName: 'Aria Lindberg', username: 'aria', bio: 'Beach scout. Probably barefoot.' },
    posts: [
      { query: 'beach palm tropical', location: { latitude: 4.1755, longitude: 73.5093, label: 'Maldives' }, caption: 'Palm-fringed white sand. Maldives at low tide.', hashtags: ['beach', 'maldives', 'travel'] },
      { query: 'turquoise water snorkel', location: { latitude: 4.1755, longitude: 73.5093, label: 'Maldives' }, caption: 'Stuck my GoPro in. Turtles came over.', hashtags: ['snorkel', 'ocean', 'maldives'] },
      { query: 'sunset ocean tropical', location: { latitude: 0.7893, longitude: 113.9213, label: 'Indonesia' }, caption: "Last light before the rain. Wouldn't trade it.", hashtags: ['sunset', 'tropical', 'travel'] },
    ],
  },
  {
    user: { uid: 'demo-jonas', displayName: 'Jonas Beck', username: 'jonas', bio: 'Mountains, granola, no signal.' },
    posts: [
      { query: 'mountain hiking alps snow', location: { latitude: 46.5547, longitude: 8.1009, label: 'Swiss Alps' }, caption: 'Above the cloud line. Worth every step.', hashtags: ['alps', 'hiking', 'switzerland'] },
      { query: 'mountain peak sunrise', location: { latitude: 46.0207, longitude: 7.7491, label: 'Matterhorn, Switzerland' }, caption: 'First light on the Matterhorn. Cold fingers, warm coffee.', hashtags: ['mountains', 'sunrise', 'matterhorn'] },
      { query: 'snowy forest winter', location: { latitude: 47.0667, longitude: 8.5333, label: 'Lucerne, Switzerland' }, caption: 'Quiet woods after fresh snow. Just me and the squirrels.', hashtags: ['winter', 'forest', 'snow'] },
    ],
  },
  {
    user: { uid: 'demo-kenji', displayName: 'Kenji Sato', username: 'kenji', bio: 'Tokyo nights, ramen, walking 20km a day.' },
    posts: [
      { query: 'tokyo city night neon', location: { latitude: 35.6595, longitude: 139.7005, label: 'Shibuya, Tokyo' }, caption: 'Shibuya scramble after dark. The whole city is a screen.', hashtags: ['tokyo', 'night', 'neon'] },
      { query: 'tokyo street rain', location: { latitude: 35.6938, longitude: 139.7036, label: 'Shinjuku, Tokyo' }, caption: 'Shinjuku in the rain hits different. Umbrella optional.', hashtags: ['tokyo', 'rain', 'street'] },
      { query: 'cherry blossom japan', location: { latitude: 35.7148, longitude: 139.7967, label: 'Ueno Park, Tokyo' }, caption: 'Sakura week. Crowd, but worth it.', hashtags: ['sakura', 'japan', 'spring'] },
    ],
  },
  {
    user: { uid: 'demo-eva', displayName: 'Eva Magnús', username: 'eva', bio: 'Volcanoes, glaciers, hot springs in that order.' },
    posts: [
      { query: 'iceland waterfall nature', location: { latitude: 63.6157, longitude: -19.9929, label: 'Skógafoss, Iceland' }, caption: 'Skógafoss roars all year. Wear a raincoat or get soaked.', hashtags: ['iceland', 'waterfall'] },
      { query: 'northern lights aurora', location: { latitude: 64.1466, longitude: -21.9426, label: 'Reykjavik, Iceland' }, caption: 'Aurora finally showed up at 2am. Still buzzing.', hashtags: ['aurora', 'iceland', 'night'] },
      { query: 'volcano black sand beach', location: { latitude: 63.4054, longitude: -19.0644, label: 'Reynisfjara, Iceland' }, caption: 'Reynisfjara on a windy day. Respect the sneaker waves.', hashtags: ['iceland', 'beach', 'volcano'] },
    ],
  },
  {
    user: { uid: 'demo-ketut', displayName: 'Ketut Wirawan', username: 'ketut', bio: 'Bali born. Showing the green parts.' },
    posts: [
      { query: 'bali rice terrace green', location: { latitude: -8.4309, longitude: 115.2741, label: 'Tegalalang, Bali' }, caption: 'Tegalalang in the morning haze before the tour buses.', hashtags: ['bali', 'rice', 'travel'] },
      { query: 'jungle waterfall tropical', location: { latitude: -8.3725, longitude: 115.2533, label: 'Tibumana, Bali' }, caption: 'Tibumana is a 5-min walk from the road. Almost empty at 7am.', hashtags: ['waterfall', 'bali', 'jungle'] },
      { query: 'temple bali sunrise', location: { latitude: -8.5215, longitude: 115.2630, label: 'Uluwatu, Bali' }, caption: 'Uluwatu cliffs at sunrise. Monkeys still asleep, thankfully.', hashtags: ['bali', 'temple', 'sunrise'] },
    ],
  },
  {
    user: { uid: 'demo-maya', displayName: 'Maya Rivera', username: 'maya', bio: 'Brooklyn → everywhere → back.' },
    posts: [
      { query: 'new york city skyline', location: { latitude: 40.7484, longitude: -73.9857, label: 'Manhattan, New York' }, caption: 'Empire State view that never gets old.', hashtags: ['nyc', 'skyline', 'usa'] },
      { query: 'brooklyn bridge', location: { latitude: 40.7061, longitude: -73.9969, label: 'Brooklyn Bridge, NY' }, caption: 'Bridge run at dawn. Lower Manhattan in the haze.', hashtags: ['brooklyn', 'nyc', 'running'] },
      { query: 'subway new york city', location: { latitude: 40.7527, longitude: -73.9772, label: 'Grand Central, NY' }, caption: 'Grand Central rush hour. Choreography no one practices.', hashtags: ['nyc', 'subway', 'city'] },
    ],
  },
  {
    user: { uid: 'demo-nikos', displayName: 'Nikos Pappas', username: 'nikos', bio: 'White houses, blue doors, tomatoes.' },
    posts: [
      { query: 'greece santorini white village', location: { latitude: 36.4615, longitude: 25.3760, label: 'Oia, Santorini' }, caption: 'Oia at sunset. Yes, the cliché. Yes, still worth it.', hashtags: ['greece', 'santorini', 'sunset'] },
      { query: 'mediterranean beach boat', location: { latitude: 36.4007, longitude: 25.4319, label: 'Red Beach, Santorini' }, caption: 'Red Beach via boat. Skip the hike.', hashtags: ['greece', 'beach', 'boat'] },
      { query: 'greek food taverna', location: { latitude: 37.9838, longitude: 23.7275, label: 'Athens, Greece' }, caption: 'Athens taverna lunch. Octopus, lemon, ouzo, repeat.', hashtags: ['greece', 'food', 'athens'] },
    ],
  },
  {
    user: { uid: 'demo-luca', displayName: 'Luca Fernández', username: 'luca', bio: 'South of south. Always cold.' },
    posts: [
      { query: 'patagonia glacier ice', location: { latitude: -50.4974, longitude: -73.1377, label: 'Perito Moreno, Argentina' }, caption: 'Crack and boom of glacier ice in Patagonia.', hashtags: ['patagonia', 'glacier', 'argentina'] },
      { query: 'andes mountain wind', location: { latitude: -50.9423, longitude: -73.4068, label: 'El Chaltén, Argentina' }, caption: 'El Chaltén wind tried to take my hat. Won.', hashtags: ['andes', 'patagonia', 'hiking'] },
      { query: 'horse wild patagonia', location: { latitude: -41.1335, longitude: -71.3103, label: 'Bariloche, Argentina' }, caption: 'Wild horses outside Bariloche. Said hi from a respectful distance.', hashtags: ['patagonia', 'wildlife', 'argentina'] },
    ],
  },
  {
    user: { uid: 'demo-yasmin', displayName: 'Yasmin El Idrissi', username: 'yasmin', bio: 'Desert sunrises and mint tea.' },
    posts: [
      { query: 'sahara desert dunes morocco', location: { latitude: 31.1366, longitude: -4.0103, label: 'Erg Chebbi, Morocco' }, caption: 'Sunrise over Erg Chebbi. The desert is louder than people think.', hashtags: ['sahara', 'morocco', 'desert'] },
      { query: 'morocco souk market', location: { latitude: 31.6295, longitude: -7.9811, label: 'Marrakesh, Morocco' }, caption: 'Marrakesh souks. Get lost on purpose.', hashtags: ['marrakesh', 'morocco', 'market'] },
      { query: 'camel desert sunset', location: { latitude: 31.1366, longitude: -4.0103, label: 'Erg Chebbi, Morocco' }, caption: 'Camel ride at golden hour. The silence is the best part.', hashtags: ['sahara', 'sunset', 'travel'] },
    ],
  },
  {
    user: { uid: 'demo-sigrid', displayName: 'Sigrid Olsen', username: 'sigrid', bio: 'Boat captain. Cold-water swimmer.' },
    posts: [
      { query: 'norway fjord water', location: { latitude: 60.8676, longitude: 7.0855, label: 'Geirangerfjord, Norway' }, caption: 'Geirangerfjord from the deck. Cliffs, waterfalls, drinkable water.', hashtags: ['norway', 'fjord', 'europe'] },
      { query: 'lofoten norway mountain', location: { latitude: 68.0667, longitude: 13.6833, label: 'Lofoten, Norway' }, caption: "Lofoten in summer light that won't end.", hashtags: ['lofoten', 'norway', 'mountains'] },
      { query: 'cold water swim ocean', location: { latitude: 59.9139, longitude: 10.7522, label: 'Oslo, Norway' }, caption: 'Morning dip, 7°C. Fully awake now.', hashtags: ['coldwater', 'swim', 'norway'] },
    ],
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

// 1) Upsert one demo user per preset, including a stable avatar photo from
//    pravatar.cc (free, no key, returns a real-looking portrait keyed by the
//    `u=...` parameter so the same username always gets the same face).
console.log('Creating demo users…');
for (const p of PRESETS) {
  const photoURL = `https://i.pravatar.cc/300?u=flytok-${p.user.username}`;
  await db.collection('users').doc(p.user.uid).set(
    {
      uid: p.user.uid,
      email: `${p.user.username}@demo.flytok.app`,
      displayName: p.user.displayName,
      username: p.user.username,
      bio: p.user.bio,
      photoURL,
      isDemo: true,
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

// 2) Build the video docs (3 per user). Track each (videoId, ownerId) pair.
const seededVideos = [];
let inserted = 0;
let updated = 0;
let skipped = 0;

for (const preset of PRESETS) {
  const ownerId = preset.user.uid;
  const ownerEmail = `${preset.user.username}@demo.flytok.app`;

  for (let i = 0; i < preset.posts.length; i++) {
    const post = preset.posts[i];
    const slugLabel = `${preset.user.username}-${i + 1}`;
    process.stdout.write(`• ${preset.user.displayName} #${i + 1} (${post.query}) … `);
    try {
      const video = await findPortraitVideo(post.query);
      if (!video) {
        console.log('no result');
        skipped++;
        continue;
      }

      const docId = `seed-${slugLabel}`;
      const ref = db.collection('videos').doc(docId);
      const existing = await ref.get();

      await ref.set(
        {
          ownerId,
          ownerEmail,
          downloadURL: video.url,
          thumbnailUrl: video.thumbnail,
          storagePath: null,
          caption: post.caption,
          hashtags: post.hashtags,
          location: post.location,
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

// 4) Simulate a follow graph between demo users so each profile shows real
//    counts and the Following list is non-empty. Each user follows 3–6
//    random other demo users. We write the mirror entry in
//    /users/{target}/followers/{me} so the live followers count works too.
console.log('\nBuilding follow graph…');
let followWrites = 0;
const allUsers = PRESETS.map((p) => p.user);

for (const me of allUsers) {
  const others = allUsers.filter((u) => u.uid !== me.uid);
  const followCount = 3 + Math.floor(Math.random() * 4); // 3–6
  const targets = pickN(others, Math.min(followCount, others.length));

  for (const target of targets) {
    const ts = FieldValue.serverTimestamp();
    await Promise.all([
      db
        .collection('users')
        .doc(me.uid)
        .collection('following')
        .doc(target.uid)
        .set({ createdAt: ts, seed: true }, { merge: true }),
      db
        .collection('users')
        .doc(target.uid)
        .collection('followers')
        .doc(me.uid)
        .set({ createdAt: ts, seed: true }, { merge: true }),
    ]);
    followWrites++;
  }
}

console.log(`Follow edges written: ${followWrites}`);

console.log('');
console.log(`Done — videos inserted ${inserted}, updated ${updated}, skipped ${skipped}.`);
console.log(`Demo users: ${PRESETS.map((p) => p.user.uid).join(', ')}`);
process.exit(0);
