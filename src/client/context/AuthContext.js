import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../lib/firebase";

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    if (typeof window !== 'undefined') {
      const u = localStorage.getItem('firebase:user');
      return u ? JSON.parse(u) : null;
    }
    return null;
  });
  const [dbUser, setDbUser] = useState(() => {
    if (typeof window !== 'undefined') {
      const dbU = localStorage.getItem('firebase:dbUser');
      return dbU ? JSON.parse(dbU) : null;
    }
    return null;
  });
  const [token, setToken] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('firebase:token');
    }
    return null;
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      const u = localStorage.getItem('firebase:user');
      const t = localStorage.getItem('firebase:token');
      if (u && t) return false;
    }
    return true;
  });

  const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";

  useEffect(() => {
    // E2E token helper for mock environment (matching finance-bot context pattern)
    const e2eToken = typeof window !== 'undefined' ? window.localStorage.getItem('firebase:token') : null;

    if (e2eToken && typeof window !== 'undefined' && !window.localStorage.getItem('firebase:user')) {
      const mockUser = {
        uid: 'e2e-user',
        email: 'e2e@example.com',
        getIdToken: async () => e2eToken,
      };

      setUser(mockUser);
      const mockDb = {
        id: 'e2e-user-id',
        email: 'e2e@example.com',
        roles: 'ADMIN',
        firebaseId: 'e2e-user',
        name: 'E2E Test User',
      };
      setDbUser(mockDb);
      setToken(e2eToken);
      localStorage.setItem('firebase:user', JSON.stringify({ uid: 'e2e-user', email: 'e2e@example.com' }));
      localStorage.setItem('firebase:dbUser', JSON.stringify(mockDb));
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!localStorage.getItem('firebase:user')) {
        setLoading(true);
      }
      
      if (firebaseUser) {
        const serializableUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
        };
        setUser(firebaseUser);
        localStorage.setItem('firebase:user', JSON.stringify(serializableUser));

        let idToken = await firebaseUser.getIdToken();
        setToken(idToken);
        localStorage.setItem('firebase:token', idToken);

        // Fetch DB user profile.
        // - 200: success, store profile.
        // - 401: token may not be propagated yet → force-refresh and retry (up to 2 extra attempts).
        // - 404: Firebase user exists but has no DB account yet (e.g. mid-registration) → silent, don't retry.
        // - other: unexpected, bail silently.
        let data = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            if (attempt > 0) await new Promise(r => setTimeout(r, attempt * 800));
            const response = await fetch(`${API_URL}/users/me`, {
              headers: { Authorization: `Bearer ${idToken}` },
            });
            if (response.ok) {
              data = await response.json();
              break;
            } else if (response.status === 401 && attempt < 2) {
              // Real token rejection — force-refresh and retry
              const freshToken = await firebaseUser.getIdToken(true);
              idToken = freshToken;
              setToken(freshToken);
              localStorage.setItem('firebase:token', freshToken);
            } else {
              // 404 = not in DB yet (new user), or unrecoverable error → stop silently
              break;
            }
          } catch (err) {
            console.error('AuthContext: Network error syncing profile', err);
            break;
          }
        }
        if (data) {
          setDbUser(data.user);
          localStorage.setItem('firebase:dbUser', JSON.stringify(data.user));
        } else {
          setDbUser(null);
          localStorage.removeItem('firebase:dbUser');
        }
      } else {
        setUser(null);
        setDbUser(null);
        setToken(null);
        localStorage.removeItem('firebase:user');
        localStorage.removeItem('firebase:dbUser');
        localStorage.removeItem('firebase:token');
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, [API_URL]);

  const logout = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('firebase:token');
      localStorage.removeItem('firebase:user');
      localStorage.removeItem('firebase:dbUser');
      sessionStorage.clear();
    }
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, dbUser, loading, token, logout, setDbUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
