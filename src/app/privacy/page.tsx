import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy - Anywork365',
  description: 'Anywork365 privacy policy — how we collect, use, and protect your data.',
}

const sections = [
  {
    title: 'Information We Collect',
    content: `We collect information you provide when creating an account: name, email address, phone number, and National Identification Number (NIN), if provided, for verification purposes. If you are an artisan, we may collect business details, portfolio items, and bank account information for payments.

We also collect data automatically: device information, IP address, browser type, pages visited, and usage patterns to improve our service.`,
  },
  {
    title: 'How We Use Your Information',
    content: `Your information is used to:
• Create and manage your account
• Process bookings and payments
• Verify artisan identities and business credentials
• Send notifications about bookings, messages, and account updates
• Improve platform performance and user experience
• Comply with legal and regulatory obligations in Nigeria`,
  },
  {
    title: 'Payment Processing',
    content: `All payments are processed through Paystack (a PCI-DSS compliant payment processor). Your card details are never stored on our servers. Paystack handles all sensitive payment data in accordance with their own privacy policy and security standards.`,
  },
  {
    title: 'Data Storage & Security',
    content: `Your data is stored securely on cloud infrastructure provided by Aiven (MySQL) and Google Cloud Platform (Firebase). We implement industry-standard security measures including encryption in transit (TLS) and at rest, rate limiting on sensitive endpoints, and regular security audits.

We retain your data for as long as your account is active or as needed to provide our services. You may request deletion of your account and associated data by contacting support@anywork365.ng.`,
  },
  {
    title: 'Third-Party Services',
    content: `We use the following third-party services:
• Firebase (Google) — authentication, push notifications
• Paystack — payment processing and bank account verification
• Aiven — MySQL database hosting
• Vercel — application hosting

Each service provider has its own privacy policy governing the handling of your data.`,
  },
  {
    title: 'Your Rights',
    content: `Under the Nigeria Data Protection Regulation (NDPR), you have the right to:
• Access the personal data we hold about you
• Request correction of inaccurate data
• Request deletion of your data
• Withdraw consent for data processing where applicable
• Lodge a complaint with the Nigeria Data Protection Commission

To exercise these rights, contact us at support@anywork365.ng.`,
  },
  {
    title: 'Cookies',
    content: `We use essential cookies for authentication and session management. We do not use tracking cookies or third-party advertising cookies. You can control cookie settings through your browser preferences.`,
  },
  {
    title: 'Changes to This Policy',
    content: `We may update this privacy policy from time to time. We will notify registered users of material changes via email or platform notification. Continued use of the platform after changes constitutes acceptance of the updated policy.`,
  },
  {
    title: 'Contact Us',
    content: `For questions about this privacy policy or to exercise your data rights, contact us at:

Email: support@anywork365.ng
Address: Lagos, Nigeria`,
  },
]

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-slate-500 mb-8">Last updated: May 2026</p>

        <div className="prose prose-slate max-w-none">
          {sections.map((s) => (
            <div key={s.title} className="mb-8">
              <h2 className="font-display text-lg font-semibold text-slate-900 mb-2">{s.title}</h2>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{s.content}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-slate-200 text-center">
          <Link href="/" className="text-sm text-brand-500 hover:text-brand-600 font-medium">
            Back to Anywork365
          </Link>
        </div>
      </div>
    </div>
  )
}
