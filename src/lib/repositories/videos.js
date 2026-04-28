import {
  collection,
  doc,
  getDoc,
  getDocs,
  getCountFromServer,
  limit,
  orderBy,
  query,
} from 'firebase/firestore';
import { firestore } from '@/lib/firebase';

const videosCol = collection(firestore, 'videos');

async function safeCount(col) {
  try {
    const snap = await getCountFromServer(col);
    return snap.data().count;
  } catch {
    return 0;
  }
}

export const videosRepo = {
  count: () => safeCount(videosCol),

  list: async ({ pageSize = 50 } = {}) => {
    try {
      const q = query(videosCol, orderBy('createdAt', 'desc'), limit(pageSize));
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch {
      const snap = await getDocs(query(videosCol, limit(pageSize)));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }
  },

  get: async (id) => {
    const snap = await getDoc(doc(firestore, 'videos', id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  },
};
