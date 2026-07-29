import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getMessaging } from 'firebase-admin/messaging'

function getApp(): App {
  const existingApp = getApps()[0]
  if (existingApp) return existingApp

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (raw) {
    try {
      const sa = JSON.parse(raw)
      if (sa.private_key) {
        return initializeApp({
          credential: cert(sa),
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        })
      }
    } catch {
      // Invalid JSON or missing private_key — fall through
    }
  }

  return initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  })
}

const app = getApp()

export const firebaseAdminApp = app
export const auth = getAuth(app)
export const messaging = getMessaging(app)
