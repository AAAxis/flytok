// Audio library + user-upload helpers for Wave 4 (Upload v2).
//
// Library tracks live in `tracks/{trackId}` (read-only, seeded by us via
// `scripts/seed-tracks.mjs`) with the file at `audio_library/{trackId}.mp3`.
// User-uploaded audio lands at `audio_user/{uid}/{timestamp}.{ext}` and the
// path is what we persist on the video doc (`audioUserPath`) so the playback
// layer can resolve a download URL on demand.
//
// On muxing: the spec called for client-side mux of audio onto the trimmed
// video at upload time. The two viable libraries don't deliver that today —
// `react-native-video-trim`'s headless `merge()` runs FFmpeg's concat filter
// (sequential merge, not stream replacement) and `ffmpeg-kit-react-native`
// has been deprecated by its upstream maintainer and no longer ships a
// supported binary. Until a replacement is picked we store only the audio
// metadata on the video doc (`audioSource`/`audioTrackId`/`audioUserPath`)
// and leave the original audio in the file. A future wave can either ship
// a server-side Cloud Function that muxes after upload or render the chosen
// track as a playback overlay in the feed.

import storage from '@react-native-firebase/storage';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import type { UploadProgressCallback } from './uploadProgress';

export type TrackLicense = 'cc0' | 'cc-by';

export type Track = {
  id: string;
  title: string;
  artist: string;
  durationSec: number;
  storagePath: string;
  category?: string;
  license: TrackLicense;
  attributionURL?: string | null;
  /** Resolved at read-time so the picker can stream without an extra round-trip. */
  downloadURL?: string;
};

export type AudioSource = 'library' | 'user_upload' | 'original';

/**
 * Audio selection persisted on the video doc. Discriminated by `source`.
 * `original` keeps the video's own audio (no swap). The other two record
 * what the user picked so a future mux/overlay step can resolve the file.
 */
export type AudioSelection =
  | { source: 'original' }
  | { source: 'library'; track: Track }
  | { source: 'user_upload'; storagePath: string; downloadURL: string; durationSec?: number; title: string };

const TRACKS_COLLECTION = 'tracks';
const MAX_USER_AUDIO_BYTES = 15 * 1024 * 1024; // matches storage.rules

export function tracksCol() {
  return firestore().collection(TRACKS_COLLECTION);
}

/**
 * Loads every curated track. Small collection (~20 docs) — fetching all
 * client-side keeps the picker snappy and lets us filter by category in JS.
 * Caller can pass `category` to filter server-side once we add categories.
 */
export async function loadTracks(): Promise<Track[]> {
  try {
    const snap = await tracksCol().orderBy('title').get();
    return Promise.all(snap.docs.map(toTrack));
  } catch (err) {
    console.warn('[audio] ordered tracks query failed, falling back:', err);
    const snap = await tracksCol().limit(100).get();
    const tracks = await Promise.all(snap.docs.map(toTrack));
    tracks.sort((a, b) => a.title.localeCompare(b.title));
    return tracks;
  }
}

async function toTrack(doc: FirebaseFirestoreTypes.QueryDocumentSnapshot): Promise<Track> {
  const data = doc.data() as Omit<Track, 'id' | 'downloadURL'> & { storagePath: string };
  let downloadURL: string | undefined;
  try {
    downloadURL = await storage().ref(data.storagePath).getDownloadURL();
  } catch (err) {
    console.warn(`[audio] could not resolve storagePath for ${doc.id}:`, err);
  }
  return {
    id: doc.id,
    title: data.title ?? 'Untitled',
    artist: data.artist ?? 'Unknown',
    durationSec: data.durationSec ?? 0,
    storagePath: data.storagePath,
    category: data.category ?? undefined,
    license: (data.license as TrackLicense) ?? 'cc0',
    attributionURL: data.attributionURL ?? null,
    downloadURL,
  };
}

/**
 * Uploads a user-picked audio file to `audio_user/{uid}/{ts}.{ext}` and
 * resolves to the storage path + a public-read download URL. Reports byte
 * progress via the optional callback so the music picker can render a bar.
 *
 * Throws on >15 MB up front — matches the storage rule and avoids burning
 * the user's bandwidth on a request that would be rejected anyway.
 */
export async function uploadUserAudio(
  localUri: string,
  meta: { contentType?: string; sizeBytes?: number; ext?: string; onProgress?: UploadProgressCallback },
): Promise<{ storagePath: string; downloadURL: string }> {
  const user = requireUser();
  if (meta.sizeBytes != null && meta.sizeBytes > MAX_USER_AUDIO_BYTES) {
    throw new Error(`Audio is too large (max ${Math.round(MAX_USER_AUDIO_BYTES / 1024 / 1024)} MB).`);
  }
  const ts = Date.now();
  const ext = sanitiseExt(meta.ext ?? localUri.split('.').pop());
  const storagePath = `audio_user/${user.uid}/${ts}.${ext}`;
  const ref = storage().ref(storagePath);
  const contentType = meta.contentType ?? `audio/${ext === 'm4a' ? 'mp4' : ext}`;

  const task = ref.putFile(localUri, { contentType });
  if (meta.onProgress) {
    task.on('state_changed', (snap) => {
      const total = snap.totalBytes || 1;
      meta.onProgress?.({
        phase: 'audio',
        percent: Math.min(1, snap.bytesTransferred / total),
      });
    });
  }
  await task;
  const downloadURL = await ref.getDownloadURL();
  return { storagePath, downloadURL };
}

/**
 * Best-effort cleanup if the user replaces or removes a previously uploaded
 * audio file before the video doc is written. Silently swallows
 * `object-not-found` so a double-tap doesn't error.
 */
export async function deleteUserAudio(storagePath: string) {
  try {
    await storage().ref(storagePath).delete();
  } catch (err: any) {
    if (err?.code !== 'storage/object-not-found') {
      console.warn('[audio] delete failed:', err);
    }
  }
}

function sanitiseExt(raw: string | undefined): string {
  const cleaned = (raw ?? 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!cleaned) return 'mp3';
  // Allow common audio extensions; coerce anything weird back to mp3 so we
  // don't ship an unparseable file to Storage.
  const allowed = ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'flac'];
  return allowed.includes(cleaned) ? cleaned : 'mp3';
}

function requireUser() {
  const u = auth().currentUser;
  if (!u) throw new Error('Not signed in');
  return u;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
