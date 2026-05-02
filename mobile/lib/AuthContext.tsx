import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { ensureUserDoc } from '@/lib/firestore';
import {
  registerFcmTokenForUser,
  unregisterCurrentDeviceToken,
} from '@/lib/messaging';
import { setUserId, track } from '@/lib/analytics';

type AuthState = {
  user: FirebaseAuthTypes.User | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<FirebaseAuthTypes.UserCredential>;
  signup: (email: string, password: string) => Promise<FirebaseAuthTypes.UserCredential>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return auth().onAuthStateChanged(async (u) => {
      setUser(u);
      setLoading(false);
      setUserId(u?.uid ?? null);
      if (u) {
        ensureUserDoc()
          .then(() => registerFcmTokenForUser())
          .catch(() => {});
        try {
          const tokenResult = await u.getIdTokenResult();
          setIsAdmin(tokenResult.claims.role === 'admin');
        } catch {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAdmin,
        login: async (email, password) => {
          const cred = await auth().signInWithEmailAndPassword(email, password);
          track.login('password');
          return cred;
        },
        signup: async (email, password) => {
          const cred = await auth().createUserWithEmailAndPassword(email, password);
          track.signup('password');
          return cred;
        },
        logout: async () => {
          // Drop this device's token before clearing the auth principal so
          // notifications don't keep arriving for the previous user.
          await unregisterCurrentDeviceToken().catch(() => {});
          await auth().signOut();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
