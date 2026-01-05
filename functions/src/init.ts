
import { initializeApp, getApps, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

let app: App;

if (getApps().length === 0) {
  app = initializeApp();
} else {
  app = getApps()[0];
}

export const adminApp = app;
export const db = getFirestore(app);
export const auth = getAuth(app);
