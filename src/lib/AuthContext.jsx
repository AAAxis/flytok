import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(firebaseAuth, async (u) => {
      if (u) {
        let tokenResult = await u.getIdTokenResult();
        // If the admin claim is missing, force-refresh once — handles the case
        // where the claim was just granted server-side and the cached token
        // is stale.
        if (tokenResult.claims.role !== 'admin') {
          try {
            tokenResult = await u.getIdTokenResult(true);
          } catch {
            await signOut(firebaseAuth);
            return;
          }
        }
        setIsAdmin(tokenResult.claims.role === 'admin');
        setUser(u);
      } else {
        setUser(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });
  }, []);

  const login = (email, password) =>
    signInWithEmailAndPassword(firebaseAuth, email, password);

  const logout = () => signOut(firebaseAuth);

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
