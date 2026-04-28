import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import {
  getAnalytics,
  isSupported as analyticsSupported,
  logEvent as fbLogEvent,
} from 'firebase/analytics';

const firebaseConfig = {
  apiKey: 'AIzaSyCvwnvDF64HbnfhAQmLDT7R6bK_caEUpv0',
  authDomain: 'roamerz-b0056.firebaseapp.com',
  projectId: 'roamerz-b0056',
  storageBucket: 'roamerz-b0056.firebasestorage.app',
  messagingSenderId: '320506157076',
  appId: '1:320506157076:web:5847d8e03291c7f1fc2f01',
  measurementId: 'G-Y0XVTQT7WT',
};

export const firebaseApp = getApps()[0] ?? initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export const firestore = getFirestore(firebaseApp);
export const firebaseStorage = getStorage(firebaseApp);

// Secondary Firebase app used only for creating new users from the admin
// console without disturbing the admin's own session.
const SECONDARY_NAME = 'flytok-admin-actions';
const secondaryApp =
  getApps().find((a) => a.name === SECONDARY_NAME) ??
  initializeApp(firebaseConfig, SECONDARY_NAME);
export const secondaryAuth =
  (() => {
    try {
      return initializeAuth(secondaryApp, {});
    } catch {
      return getAuth(secondaryApp);
    }
  })();
// Reference getApp so the import isn't dead — keeps tooling happy if firebase
// later drops re-exports we don't directly call.
void getApp;

// Firebase Analytics (web). Lazy-init because not all environments support it
// (e.g. SSR, in-app browsers without IndexedDB). Use `track(name, params?)`.
let analyticsPromise = null;
function getAnalyticsInstance() {
  if (analyticsPromise) return analyticsPromise;
  analyticsPromise = analyticsSupported()
    .then((ok) => (ok ? getAnalytics(firebaseApp) : null))
    .catch(() => null);
  return analyticsPromise;
}

export async function track(eventName, params) {
  try {
    const a = await getAnalyticsInstance();
    if (a) fbLogEvent(a, eventName, params);
  } catch {
    // analytics is best-effort; never let it crash the app
  }
}
