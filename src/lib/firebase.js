import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

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
