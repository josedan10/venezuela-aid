import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../lib/firebase";

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [dbUser, setDbUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";

  useEffect(() => {
    // E2E token helper for mock environment (matching finance-bot context pattern)
    const e2eToken = typeof window !== 'undefined' ? window.localStorage.getItem('firebase:token') : null;

    if (e2eToken) {
      const mockUser = {
        uid: 'e2e-user',
        email: 'e2e@example.com',
        getIdToken: async () => e2eToken,
      };

      setUser(mockUser);
      setDbUser({
        id: 'e2e-user-id',
        email: 'e2e@example.com',
        role: 'ADMIN',
        firebaseId: 'e2e-user',
        name: 'E2E Test User',
      });
      setToken(e2eToken);
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      
      if (firebaseUser) {
        setUser(firebaseUser);
        const idToken = await firebaseUser.getIdToken();
        setToken(idToken);

        // Fetch DB user profile
        try {
          console.log('AuthContext: Syncing user profile with backend');
          const response = await fetch(`${API_URL}/users/me`, {
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log('AuthContext: Profile sync success', data.user.email);
            setDbUser(data.user);
          } else {
            console.warn('AuthContext: Profile sync failed or user not yet in DB', response.status);
            setDbUser(null);
          }
        } catch (error) {
          console.error("Failed to fetch DB user profile:", error);
          setDbUser(null);
        }
      } else {
        setUser(null);
        setDbUser(null);
        setToken(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, [API_URL]);

  const logout = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('firebase:token');
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
