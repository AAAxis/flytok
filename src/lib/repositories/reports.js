import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { ref as storageRef, deleteObject } from 'firebase/storage';
import { firestore, firebaseStorage } from '@/lib/firebase';

const reportsCol = () => collection(firestore, 'reports');

export const reportsRepo = {
  list: async ({ status = 'open', pageSize = 100 } = {}) => {
    try {
      const q = query(
        reportsCol(),
        where('status', '==', status),
        orderBy('createdAt', 'desc'),
        limit(pageSize),
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch {
      const snap = await getDocs(query(reportsCol(), where('status', '==', status), limit(pageSize)));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }
  },

  resolve: (id, action = 'resolved') =>
    updateDoc(doc(firestore, 'reports', id), {
      status: action,
      resolvedAt: serverTimestamp(),
    }),

  dismiss: (id) =>
    updateDoc(doc(firestore, 'reports', id), {
      status: 'dismissed',
      resolvedAt: serverTimestamp(),
    }),
};

async function deleteCollection(colRef, batchSize = 50) {
  const snap = await getDocs(query(colRef, limit(batchSize)));
  if (snap.empty) return;
  const batch = writeBatch(firestore);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  if (snap.size === batchSize) await deleteCollection(colRef, batchSize);
}

export const moderationRepo = {
  deleteVideo: async (videoId) => {
    const videoRef = doc(firestore, 'videos', videoId);
    const videoSnap = await getDoc(videoRef);
    const data = videoSnap.exists() ? videoSnap.data() : null;

    await deleteCollection(collection(firestore, 'videos', videoId, 'comments'));

    if (data?.storagePath) {
      try {
        await deleteObject(storageRef(firebaseStorage, data.storagePath));
      } catch (err) {
        // file may already be gone — proceed
        if (err?.code !== 'storage/object-not-found') throw err;
      }
    }

    await deleteDoc(videoRef);
  },

  deleteComment: async (videoId, commentId) => {
    await deleteDoc(doc(firestore, 'videos', videoId, 'comments', commentId));
    // Keep the denormalised count honest — clamp at 0.
    try {
      const videoRef = doc(firestore, 'videos', videoId);
      const snap = await getDoc(videoRef);
      const current = (snap.data()?.commentCount ?? 0) | 0;
      await updateDoc(videoRef, { commentCount: Math.max(0, current - 1) });
    } catch {
      // best-effort
    }
  },

  blockUser: (uid) =>
    updateDoc(doc(firestore, 'users', uid), {
      disabled: true,
      disabledAt: serverTimestamp(),
    }),

  unblockUser: (uid) =>
    updateDoc(doc(firestore, 'users', uid), {
      disabled: false,
      disabledAt: null,
    }),

  reportedVideoIds: async () => {
    try {
      const q = query(
        reportsCol(),
        where('status', '==', 'open'),
        where('target.kind', '==', 'video'),
        limit(500),
      );
      const snap = await getDocs(q);
      const counts = new Map();
      snap.docs.forEach((d) => {
        const id = d.data()?.target?.videoId;
        if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
      });
      return counts;
    } catch {
      return new Map();
    }
  },
};

export const commentsRepo = {
  recentReported: async ({ pageSize = 100 } = {}) => {
    try {
      const q = query(
        reportsCol(),
        where('status', '==', 'open'),
        where('target.kind', '==', 'comment'),
        orderBy('createdAt', 'desc'),
        limit(pageSize),
      );
      const snap = await getDocs(q);
      const ids = snap.docs.map((d) => d.data().target);
      const out = [];
      for (const t of ids) {
        if (!t?.videoId || !t?.commentId) continue;
        const c = await getDoc(doc(firestore, 'videos', t.videoId, 'comments', t.commentId));
        if (c.exists()) {
          out.push({ id: c.id, videoId: t.videoId, ...c.data() });
        }
      }
      return out;
    } catch {
      return [];
    }
  },

  // Best-effort — requires a collection-group index on "comments" with createdAt desc
  recent: async ({ pageSize = 100 } = {}) => {
    try {
      const q = query(
        collectionGroup(firestore, 'comments'),
        orderBy('createdAt', 'desc'),
        limit(pageSize),
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const videoId = d.ref.parent.parent?.id ?? null;
        return { id: d.id, videoId, ...d.data() };
      });
    } catch {
      return [];
    }
  },
};
