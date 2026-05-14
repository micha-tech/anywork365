import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans, DM_Sans } from 'next/font/google'
import './globals.css'
import { Navbar } from '@/components/layout/Navbar'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

const dm = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm',
  weight: ['400', '500'],
  display: 'swap',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0F4F4A',
}

export const metadata: Metadata = {
  title: "Anywork365 – Nigeria's Work Platform",
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
    <html lang="en" className={`${jakarta.variable} ${dm.variable}`}>
      <body className="font-body bg-surface-base text-slate-900 antialiased">
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  )
}