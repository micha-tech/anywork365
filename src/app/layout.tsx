import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import { Navbar } from '@/components/layout/Navbar'
import { OfflineBanner } from '@/components/ui/OfflineBanner'
import { Toaster } from 'sonner'
import { OnboardingGuard } from '@/components/OnboardingGuard'

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
  title: "Anywork365 - Nigeria's Work Platform",
  description: 'Connect with verified artisans, technicians, and vendors across Nigeria.',
  keywords: ['Nigeria', 'freelance', 'artisans', 'technicians', 'vendors', 'Lagos', 'Abuja'],
  openGraph: {
    title: 'Anywork365',
    description: 'Find skilled vendors for any job in Nigeria',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="font-body bg-surface-base text-slate-900 antialiased capacitor-status-bar">
        <OnboardingGuard>
          <Navbar />
          <OfflineBanner />
          <main className="page-enter">{children}</main>
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
              background: '#1e293b',
              color: '#f8fafc',
              border: '1px solid #334155',
              borderRadius: '16px',
              padding: '16px 20px',
              fontSize: '15px',
              fontWeight: 500,
              lineHeight: 1.5,
              boxShadow: '0 12px 40px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.15)',
              WebkitFontSmoothing: 'antialiased',
            },
            success: {
              style: { background: '#0f172a', border: '1px solid #166534' },
            },
            error: {
              style: { background: '#0f172a', border: '1px solid #854d0e' },
            },
          } as any}
          style={{ padding: '0 max(env(safe-area-inset-right), 12px) 0 max(env(safe-area-inset-left), 12px)' }}
        />
      </body>
    </html>
  )
}
