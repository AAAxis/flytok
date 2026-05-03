import auth from '@react-native-firebase/auth';
import { followingCol, usersCol } from './firestore';

export type UserDoc = {
  uid: string;
  displayName: string | null;
  username: string | null;
  photoURL: string | null;
  email: string | null;
  discoverable?: boolean;
};

function shapeUser(uid: string, data: Record<string, unknown> | undefined): UserDoc {
  const d = data ?? {};
  return {
    uid,
    displayName: (d.displayName as string | null) ?? null,
    username: (d.username as string | null) ?? null,
    photoURL: (d.photoURL as string | null) ?? null,
    email: (d.email as string | null) ?? null,
    discoverable: (d.discoverable as boolean | undefined) ?? undefined,
  };
}

/**
 * Fetches the current user's followed-user profiles. Used by the inbox new-chat
 * picker to default to people you actually know — instead of showing every
 * registered user. Caps at 200 follows; chunks profile lookups by 10.
 */
export async function getFollowedUserProfiles(opts: { limit?: number } = {}): Promise<UserDoc[]> {
  const me = auth().currentUser;
  if (!me) return [];

  const followSnap = await followingCol(me.uid).limit(opts.limit ?? 200).get();
  const ids = followSnap.docs.map((d) => d.id);
  if (ids.length === 0) return [];

  const profileSnaps = await Promise.all(
    ids.map((id) => usersCol().doc(id).get().catch(() => null)),
  );
  const out: UserDoc[] = [];
  for (let i = 0; i < profileSnaps.length; i++) {
    const snap = profileSnaps[i];
    if (!snap || !snap.exists) continue;
    out.push(shapeUser(ids[i], snap.data() as Record<string, unknown>));
  }
  return out;
}

/**
 * Prefix-search users by displayName / username on the denormalised
 * `displayNameLower` field. Firestore has no full-text search, so we cap at a
 * `>= q && < q + ''` range query — standard prefix-match technique.
 *
 * Filters to `discoverable === true` so users who opt out are excluded.
 *
 * Requires a composite index on `(displayNameLower asc, discoverable asc)`.
 * On first run Firebase logs a one-click create URL — see
 * `firestore.indexes.json` for the declared index.
 */
export async function searchUsersByHandle(
  query: string,
  opts: { limit?: number; excludeUid?: string } = {},
): Promise<UserDoc[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const snap = await usersCol()
    .where('displayNameLower', '>=', q)
    .where('displayNameLower', '<', q + '')
    .where('discoverable', '==', true)
    .limit(opts.limit ?? 25)
    .get();

  return snap.docs
    .map((d) => shapeUser(d.id, d.data() as Record<string, unknown>))
    .filter((u) => u.uid !== opts.excludeUid);
}
