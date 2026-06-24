import * as admin from 'firebase-admin'

function getApp(): admin.app.App {
  if (admin.apps.length) return admin.apps[0]!

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (raw) {
    try {
      const sa = JSON.parse(raw)
      if (sa.private_key) {
        return admin.initializeApp({
          credential: admin.credential.cert(sa),
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        })
      }
    } catch {
      // Invalid JSON or missing private_key — fall through
    }
  }

  return admin.initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  })
}

const app = getApp()

export const firebaseAdminApp = app
export const auth = admin.auth(app)
export default admin
