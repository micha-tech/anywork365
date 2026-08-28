import Link from 'next/link'

export function AppFooter() {
  return (
    <footer className="border-t border-brand-900 bg-brand-900 px-4 py-7 pb-20 md:pb-7">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/60">
        <p>&copy; {new Date().getFullYear()} Anywork365. All rights reserved.</p>
        <div className="flex items-center gap-4">
          <Link href="/privacy" className="transition-colors hover:text-[#d8ffad]">Privacy Policy</Link>
          <Link href="/terms" className="transition-colors hover:text-[#d8ffad]">Terms of Service</Link>
          <a href="mailto:support@anywork365.ng" className="transition-colors hover:text-[#d8ffad]">Contact</a>
        </div>
      </div>
    </footer>
  )
}
