import {
  addDoc,
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  getCountFromServer,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { firebaseAuth, firebaseStorage, firestore } from '@/lib/firebase';

const videosCol = () => collection(firestore, 'videos');

async function safeCount(col) {
  try {
    const snap = await getCountFromServer(col);
    return snap.data().count;
  } catch {
    return 0;
  }
}

export const videosRepo = {
  count: () => safeCount(videosCol()),

  list: async ({ pageSize = 50 } = {}) => {
    try {
      const q = query(videosCol(), orderBy('createdAt', 'desc'), limit(pageSize));
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch {
      const snap = await getDocs(query(videosCol(), limit(pageSize)));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }
  },

  get: async (id) => {
    const snap = await getDoc(doc(firestore, 'videos', id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  },

  byOwner: async (uid, { pageSize = 50 } = {}) => {
    try {
      const q = query(
        videosCol(),
        where('ownerId', '==', uid),
        orderBy('createdAt', 'desc'),
        limit(pageSize),
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch {
      const q = query(videosCol(), where('ownerId', '==', uid), limit(pageSize));
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }
  },

  byIds: async (ids) => {
    if (!ids?.length) return [];
    const out = [];
    for (const id of ids) {
      const v = await getDoc(doc(firestore, 'videos', id));
      if (v.exists()) out.push({ id: v.id, ...v.data() });
    }
    return out;
  },

  commentsByAuthor: async (uid, { pageSize = 50 } = {}) => {
    try {
      const q = query(
        collectionGroup(firestore, 'comments'),
        where('authorId', '==', uid),
        orderBy('createdAt', 'desc'),
        limit(pageSize),
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({
        id: d.id,
        videoId: d.ref.parent.parent?.id ?? null,
        ...d.data(),
      }));
    } catch (err) {
      // Likely a missing collection-group index. Surface so the UI can show
      // a helpful link.
      throw err;
    }
  },

  // Uploads a video file to Storage and writes the Firestore doc.
  // onProgress receives a 0..1 fraction.
  upload: async ({ file, caption = '', location = null, onProgress }) => {
    const user = firebaseAuth.currentUser;
    if (!user) throw new Error('Not signed in');
    if (!file) throw new Error('No file selected');

    const ts = Date.now();
    const ext = (file.name?.split('.').pop() || 'mp4').toLowerCase();
    const path = `videos/${user.uid}/${ts}.${ext}`;
    const ref = storageRef(firebaseStorage, path);

    const task = uploadBytesResumable(ref, file, { contentType: file.type || 'video/mp4' });
    await new Promise((resolve, reject) => {
      task.on(
        'state_changed',
        (s) => {
          if (onProgress && s.totalBytes) onProgress(s.bytesTransferred / s.totalBytes);
        },
        reject,
        resolve,
      );
    });
    const downloadURL = await getDownloadURL(ref);

    const docRef = await addDoc(videosCol(), {
      ownerId: user.uid,
      ownerEmail: user.email ?? null,
      storagePath: path,
      downloadURL,
      caption: caption.trim(),
      location,
      createdAt: serverTimestamp(),
      adminUploaded: true,
    });

    return { id: docRef.id, storagePath: path, downloadURL };
  },
};
