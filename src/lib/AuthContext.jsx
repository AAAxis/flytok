import { createContext, useContext, useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(firebaseAuth, async (u) => {
      if (u) {
        let tokenResult = await u.getIdTokenResult();
        const knownRoles = ['admin', 'advertiser'];
        // Force-refresh once if no known role yet — handles the case
        // where a claim was just granted and the cached token is stale.
        if (!knownRoles.includes(tokenResult.claims.role)) {
          try {
            tokenResult = await u.getIdTokenResult(true);
          } catch {
            // ignore — surface the user without a role; pages will gate
          }
        }
        setRole(tokenResult.claims.role ?? null);
        setUser(u);
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });
  }, []);

  const login = (email, password) =>
    signInWithEmailAndPassword(firebaseAuth, email, password);

  const loginWithGoogle = () =>
    signInWithPopup(firebaseAuth, new GoogleAuthProvider());

  const loginWithApple = () =>
    signInWithPopup(firebaseAuth, new OAuthProvider('apple.com'));

  const sendReset = (email) => sendPasswordResetEmail(firebaseAuth, email);

  const logout = () => signOut(firebaseAuth);

  const isAdmin = role === 'admin';
  const isAdvertiser = role === 'advertiser';

  return (
    <AuthContext.Provider
      value={{ user, role, isAdmin, isAdvertiser, loading, login, loginWithGoogle, loginWithApple, sendReset, logout }}
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
