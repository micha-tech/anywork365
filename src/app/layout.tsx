import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import { Navbar } from '@/components/layout/Navbar'
import { OfflineBanner } from '@/components/ui/OfflineBanner'
import { Toaster } from 'sonner'
import { OnboardingGuard } from '@/components/OnboardingGuard'
import { MobileBottomNav } from '@/components/layout/MobileBottomNav'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})


export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0F4F4A',
  minimumScale: 1,
  interactiveWidget: 'resizes-content',
}

export const metadata: Metadata = {
  title: "Nigeria's work marketplace",
  description: 'Find artisans, professional opportunities and candidates across Nigeria.',
  keywords: ['Nigeria', 'freelance', 'artisans', 'professionals', 'recruiters', 'Lagos', 'Abuja'],
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/icons/icon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/icons/icon-512.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', type: 'image/png', sizes: '180x180' },
    ],
    shortcut: ['/favicon.ico'],
  },
  openGraph: {
    title: 'Anywork365',
    description: 'Find skilled artisans and professionals in Nigeria',
    type: 'website',
    images: [
      {
        url: '/icons/icon-512.png',
        width: 512,
        height: 512,
        alt: 'Anywork365',
      },
    ],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="font-body bg-surface-base text-slate-900 antialiased capacitor-status-bar">
        <OnboardingGuard>
          <Navbar />
          <OfflineBanner />
          <main className="page-enter mobile-content-clearance">{children}</main>
          <MobileBottomNav />
        </OnboardingGuard>
        <Toaster
          position="top-center"
          gap={12}
          offset="80px"
          visibleToasts={4}
          closeButton
          toastOptions={{
            duration: 3500,
            style: {
              background: '#ffffff',
              color: '#0f172a',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '14px 18px',
              fontSize: '14px',
              fontWeight: 600,
              lineHeight: 1.5,
              boxShadow: '0 16px 40px rgba(15,23,42,0.14), 0 2px 8px rgba(15,23,42,0.06)',
              WebkitFontSmoothing: 'antialiased',
            },
            success: {
              style: { background: '#ffffff', color: '#0f172a', border: '1px solid #b8e0e0' },
            },
            error: {
              style: { background: '#ffffff', color: '#0f172a', border: '1px solid #fcd34d' },
            },
          } as any}
          style={{ padding: '0 max(env(safe-area-inset-right), 12px) 0 max(env(safe-area-inset-left), 12px)' }}
        />
      </body>
    </html>
  )
}
