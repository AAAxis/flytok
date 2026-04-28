import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';
import { firestore } from '@/lib/firebase';

async function fetchRecent(name, kind, mapper) {
  try {
    const q = query(
      collection(firestore, name),
      orderBy('createdAt', 'desc'),
      limit(10),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: `${kind}_${d.id}`,
        kind,
        timestamp: data.createdAt,
        ...mapper(data, d.id),
      };
    });
  } catch {
    return [];
  }
}

export const activityRepo = {
  recent: async ({ pageSize = 15 } = {}) => {
    const [videos, signups] = await Promise.all([
      fetchRecent('videos', 'video', (v) => ({
        title: `${v.authorUsername ?? 'A user'} uploaded a video`,
        subtitle: v.caption ?? null,
      })),
      fetchRecent('users', 'signup', (u) => ({
        title: `${u.displayName ?? u.email ?? 'New user'} signed up`,
        subtitle: u.email ?? null,
      })),
    ]);

    return [...videos, ...signups]
      .filter((x) => x.timestamp)
      .sort((a, b) => {
        const ta = a.timestamp.toDate?.()?.getTime() ?? 0;
        const tb = b.timestamp.toDate?.()?.getTime() ?? 0;
        return tb - ta;
      })
      .slice(0, pageSize);
  },
};
