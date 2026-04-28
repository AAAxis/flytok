import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getCountFromServer,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { firestore } from '@/lib/firebase';

const usersCol = () => collection(firestore, 'users');

async function safeCount(col) {
  try {
    const snap = await getCountFromServer(col);
    return snap.data().count;
  } catch {
    return 0;
  }
}

function clean(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

export const usersRepo = {
  count: () => safeCount(usersCol()),

  list: async ({ pageSize = 50 } = {}) => {
    try {
      const q = query(usersCol(), orderBy('createdAt', 'desc'), limit(pageSize));
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch {
      const snap = await getDocs(query(usersCol(), limit(pageSize)));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }
  },

  get: async (id) => {
    const snap = await getDoc(doc(firestore, 'users', id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  },

  // Creates a Firestore user profile doc. Does NOT create a Firebase Auth account
  // (that requires the Admin SDK on a backend).
  create: async ({ id, ...fields }) => {
    if (!id) throw new Error('User id is required');
    const ref = doc(firestore, 'users', id);
    const existing = await getDoc(ref);
    if (existing.exists()) throw new Error(`User ${id} already exists`);
    await setDoc(
      ref,
      clean({
        ...fields,
        createdAt: serverTimestamp(),
      }),
    );
    return id;
  },

  update: (id, fields) =>
    updateDoc(
      doc(firestore, 'users', id),
      clean({ ...fields, updatedAt: serverTimestamp() }),
    ),

  // Deletes the Firestore profile doc only. The Auth account, if any, must be
  // removed via the Admin SDK on a backend.
  delete: (id) => deleteDoc(doc(firestore, 'users', id)),
};
