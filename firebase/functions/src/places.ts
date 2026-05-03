/**
 * Places aggregator + scheduled trending rebuild for Wave 3 search.
 *
 *   onVideoCreatePlaceCounter — Firestore v2 trigger on `videos/{vid}` create.
 *     Slugifies the location.label, upserts `places/{slug}` with
 *     videoCount++ and a running bbox of the (lat, lng) seen so far. Doc has
 *     `label_lower` for prefix-search by the search screen.
 *
 *   rebuildTrendingPlaces — Scheduled. Reads places with activity in the last
 *     7 days, sorts by videoCount desc, writes the top 20 to
 *     `trending_places/snapshot` (one doc; cheap to read from the client).
 *
 * Both are idempotent and safe to re-deploy.
 */

import {
  onDocumentCreated,
  type FirestoreEvent,
  type QueryDocumentSnapshot,
} from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;

const TRENDING_DOC = db.collection('trending_places').doc('snapshot');
const TRENDING_LIMIT = 20;
const TRENDING_WINDOW_DAYS = 7;
const SLUG_MAX = 80;

type VideoLocation = { latitude?: number; longitude?: number; label?: string };

type VideoDocShape = {
  ownerId?: string;
  location?: VideoLocation | null;
  createdAt?: FirebaseFirestore.Timestamp;
};

/**
 * Conservative ASCII-only slugifier. Strips diacritics, replaces non-alnum
 * runs with a single `-`, and trims to 80 chars. "Berlin, Germany" and
 * "Berlin" therefore live at different slugs — that's intentional for v1;
 * we re-visit dedupe in v3 once we have a geocoder-backed place id.
 */
export function slugify(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX);
}

export const onVideoCreatePlaceCounter = onDocumentCreated(
  {
    document: 'videos/{vid}',
    region: 'us-central1',
  },
  async (event: FirestoreEvent<QueryDocumentSnapshot | undefined, { vid: string }>) => {
    const snap = event.data;
    if (!snap) {
      logger.warn('places: no snapshot on event');
      return;
    }
    const video = snap.data() as VideoDocShape | undefined;
    const loc = video?.location;
    const label = loc?.label?.trim();
    if (!label) {
      logger.debug('places: no location label, skipping', { videoId: event.params.vid });
      return;
    }

    const slug = slugify(label);
    if (!slug) {
      logger.warn('places: slugify produced empty string, skipping', { label });
      return;
    }

    const lat = typeof loc?.latitude === 'number' ? loc.latitude : null;
    const lng = typeof loc?.longitude === 'number' ? loc.longitude : null;

    const ref = db.collection('places').doc(slug);

    // Transaction so concurrent video creates don't clobber each other's bbox.
    await db
      .runTransaction(async (tx) => {
        const cur = await tx.get(ref);
        const data = cur.data() ?? {};

        const next: Record<string, unknown> = {
          slug,
          label,
          label_lower: label.toLowerCase(),
          videoCount: FieldValue.increment(1),
          lastVideoAt: FieldValue.serverTimestamp(),
        };

        if (lat !== null && lng !== null) {
          const oldMin = data.bbox?.[0] as
            | { latitude: number; longitude: number }
            | undefined;
          const oldMax = data.bbox?.[1] as
            | { latitude: number; longitude: number }
            | undefined;
          const minLat = oldMin ? Math.min(oldMin.latitude, lat) : lat;
          const minLng = oldMin ? Math.min(oldMin.longitude, lng) : lng;
          const maxLat = oldMax ? Math.max(oldMax.latitude, lat) : lat;
          const maxLng = oldMax ? Math.max(oldMax.longitude, lng) : lng;
          next.bbox = [
            new admin.firestore.GeoPoint(minLat, minLng),
            new admin.firestore.GeoPoint(maxLat, maxLng),
          ];
        }

        if (!cur.exists) {
          // Initial doc creation — seed firstVideoAt as well so a future job
          // can age out stale slugs.
          next.firstVideoAt = FieldValue.serverTimestamp();
        }

        tx.set(ref, next, { merge: true });
      })
      .catch((err) => {
        logger.error('places: counter txn failed', {
          slug,
          err: err?.message,
        });
      });
  },
);

export const rebuildTrendingPlaces = onSchedule(
  {
    schedule: 'every 360 minutes',
    region: 'us-central1',
  },
  async () => {
    const cutoff = Timestamp.fromMillis(
      Date.now() - TRENDING_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );

    let docs: FirebaseFirestore.QueryDocumentSnapshot[];
    try {
      const snap = await db
        .collection('places')
        .where('lastVideoAt', '>=', cutoff)
        .orderBy('lastVideoAt', 'desc')
        // Pull more than we need so the in-memory videoCount sort has room
        // when many places were active in the same window.
        .limit(200)
        .get();
      docs = snap.docs;
    } catch (err: any) {
      // If the (lastVideoAt + videoCount) composite index isn't available
      // we fall back to a plain ordered scan. The function logs a one-click
      // index URL on the first failure.
      logger.warn('trending: indexed query failed, falling back', {
        err: err?.message,
      });
      const snap = await db
        .collection('places')
        .orderBy('lastVideoAt', 'desc')
        .limit(200)
        .get();
      docs = snap.docs;
    }

    const top = docs
      .map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          slug: d.id,
          label: (data.label as string | undefined) ?? d.id,
          count: (data.videoCount as number | undefined) ?? 0,
        };
      })
      .filter((p) => p.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, TRENDING_LIMIT);

    await TRENDING_DOC.set({
      generatedAt: FieldValue.serverTimestamp(),
      topPlaces: top,
    });

    logger.info('trending: rebuilt', { count: top.length });
  },
);
