# Firebase Setup Guide

## 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" → Name it (e.g., "anywork365")
3. Disable Google Analytics (optional) → Create project
4. Wait for project to be created

## 2. Add Apps

### For Web App:
1. In project dashboard, click the web icon `</>` (Add app)
2. Register app with nickname "Anywork365 Web"
3. Copy the `firebaseConfig` object shown
4. Add to `.env.local`:
```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

### For iOS (optional):
1. Click iOS icon → Add iOS app
2. Enter bundle ID (e.g., com.anywork365.app)
3. Download GoogleService-Info.plist

### For Android (optional):
1. Click Android icon → Add Android app
2. Enter package name (e.g., com.anywork365.app)
3. Download google-services.json

## 3. Enable Cloud Messaging

1. Go to **Build** → **Messaging** in sidebar
2. Click **Get started**
3. Accept terms → Continue
4. Your project is now ready for FCM

## 4. Get VAPID Key (Web Push)

1. In Firebase Console → **Project Settings** → **Cloud Messaging**
2. Scroll to **Web configuration**
3. Click **Generate key pair** under Web Push certificates
4. Copy the VAPID key to `.env.local`:
```
NEXT_PUBLIC_FIREBASE_VAPID_KEY=B8... (long string)
```

## 5. Get Firebase Service Account (for Admin SDK)

1. Go to **Project Settings** → **Service accounts**
2. Click **Generate new private key**
3. Save the JSON file securely
4. Set environment variable (for server-side only):
```
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
```

Or use Vercel Environment Variables:
- Add entire JSON as one line
- Key: `FIREBASE_SERVICE_ACCOUNT`

## 6. Configure firebase-messaging-sw.js (Optional)

For background notifications, create `public/firebase-messaging-sw.js`:

```javascript
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: '...',
  authDomain: '...',
  projectId: '...',
  storageBucket: '...',
  messagingSenderId: '...',
  appId: '...',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo.png',
    badge: '/logo.png',
    data: payload.data,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
```

## 7. Test Notifications

```typescript
import { sendPushNotification } from '@/lib/firebase/admin'
import admin from 'firebase-admin'

// Send test notification
await sendPushNotification(
  'USER_FCM_TOKEN',
  {
    title: 'New Booking!',
    body: 'You have a new service request',
  },
  { url: '/bookings' }
)
```

## Troubleshooting

### Email verification says "app domain is not authorized"?
- In Firebase Console, open **Authentication** -> **Settings** -> **Authorized domains**
- Add every domain that serves the app (domain names only, without `https://` or a path):
  - `anywork365.ng`
  - `www.anywork365.ng` if the site is available on `www`
  - your active Vercel preview/production domain, for example `anywork-365-inky.vercel.app`
  - `localhost` for local development
- Verification links use the origin currently serving the signup page, so each deployed origin must be authorized.
- **Authentication authorized domains** and **Hosting custom-domain verification** are different settings. If the app is hosted by Vercel or Hostinger, do not connect the domain under Firebase Hosting just to enable Auth.
- Redeploy after changing Firebase-related environment variables, then resend the verification email.

### Notifications not working on localhost?
- Use HTTPS or localhost (Chrome blocks notifications on HTTP)
- Check browser console for errors
- Verify FCM token is being generated

### Background notifications not showing?
- Ensure `firebase-messaging-sw.js` is in `/public` folder
- Check that service worker is registered
- Verify VAPID key is correct

### Token not saving to database?
- Check Supabase RLS policies for `user_fcm_tokens` table
- Verify user is authenticated before saving token

## Environment Variables Summary

```bash
# Client-side (public)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_VAPID_KEY=
NEXT_PUBLIC_APP_URL=https://anywork365.ng

# Server-side only (secret)
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
```
