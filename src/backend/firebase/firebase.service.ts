import { Injectable, OnModuleInit } from '@nestjs/common';
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { cert } from 'firebase-admin';
import { getAuth, Auth } from 'firebase-admin/auth';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private firebaseApp: App;

  onModuleInit() {
    const apps = getApps();
    if (apps.length > 0) {
      this.firebaseApp = apps[0];
      return;
    }

    const serviceAccountPath =
      process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(process.cwd(), 'firebase-service-account.json');
    const serviceAccountFileExists = fs.existsSync(serviceAccountPath);

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS && serviceAccountFileExists) {
      this.firebaseApp = initializeApp({
        credential: cert(serviceAccountPath),
      });
    } else if (process.env.FIREBASE_PRIVATE_KEY) {
      this.firebaseApp = initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        } as any),
      });
    } else {
      try {
        this.firebaseApp = initializeApp({
          credential: cert(serviceAccountPath),
        });
      } catch (err) {
        console.warn('Firebase Admin default cert init failed, trying default initialization:', err);
        this.firebaseApp = initializeApp();
      }
    }
  }

  getAuth(): Auth {
    return getAuth(this.firebaseApp);
  }
}
