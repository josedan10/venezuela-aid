import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../lib/firebase";

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  // Keep initial state identical on server and client to avoid hydration mismatches.
  const [user, setUser] = useState(null);
  const [dbUser, setDbUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";

  useEffect(() => {
    // E2E token helper for mock environment (matching finance-bot context pattern)
    const e2eToken = window.localStorage.getItem('firebase:token');

    if (e2eToken && !window.localStorage.getItem('firebase:user')) {
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
              const freshToken = await firebaseUser.getIdToken(true);
              idToken = freshToken;
              setToken(freshToken);
              localStorage.setItem('firebase:token', freshToken);
            } else {
              break;
            }
          } catch (err) {
            console.error('AuthContext: Network error syncing profile', err);
            break;
          }
        }
        if (data) {
          setDbUser((prev) => {
            const next = data.user;
            if (prev?.id === next?.id && prev?.updatedAt === next?.updatedAt) {
              return prev;
            }
            localStorage.setItem('firebase:dbUser', JSON.stringify(next));
            return next;
          });
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
    localStorage.removeItem('firebase:token');
    localStorage.removeItem('firebase:user');
    localStorage.removeItem('firebase:dbUser');
    sessionStorage.clear();
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
