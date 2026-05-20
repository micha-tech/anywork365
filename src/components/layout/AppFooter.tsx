import Link from 'next/link'

export function AppFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white px-4 py-6">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <p>&copy; {new Date().getFullYear()} Anywork365. All rights reserved.</p>
        <div className="flex items-center gap-4">
          <Link href="/privacy" className="hover:text-brand-500 transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-brand-500 transition-colors">Terms of Service</Link>
          <a href="mailto:support@anywork365.ng" className="hover:text-brand-500 transition-colors">Contact</a>
        </div>
      </div>
    </footer>
  )
}
