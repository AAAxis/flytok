import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { ensureUserDoc } from '@/lib/firestore';

type AuthState = {
  user: FirebaseAuthTypes.User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<FirebaseAuthTypes.UserCredential>;
  signup: (email: string, password: string) => Promise<FirebaseAuthTypes.UserCredential>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return auth().onAuthStateChanged((u) => {
      setUser(u);
      setLoading(false);
      if (u) ensureUserDoc().catch(() => {});
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login: (email, password) => auth().signInWithEmailAndPassword(email, password),
        signup: (email, password) => auth().createUserWithEmailAndPassword(email, password),
        logout: () => auth().signOut(),
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
