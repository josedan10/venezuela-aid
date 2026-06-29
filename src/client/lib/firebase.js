import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, EmailAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "dummy-api-key",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "dummy-domain",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "dummy-id",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "dummy-bucket",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "dummy-sender",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "dummy-app-id"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Auth Providers
export const googleProvider = new GoogleAuthProvider();
export const emailProvider = new EmailAuthProvider();
