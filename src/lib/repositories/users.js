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

const usersCol = collection(firestore, 'users');

async function safeCount(col) {
  try {
    const snap = await getCountFromServer(col);
    return snap.data().count;
  } catch {
    return 0;
  }
}

export const usersRepo = {
  count: () => safeCount(usersCol),

  list: async ({ pageSize = 50 } = {}) => {
    try {
      const q = query(usersCol, orderBy('createdAt', 'desc'), limit(pageSize));
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch {
      const snap = await getDocs(query(usersCol, limit(pageSize)));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }
  },

  get: async (id) => {
    const snap = await getDoc(doc(firestore, 'users', id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  },
};
