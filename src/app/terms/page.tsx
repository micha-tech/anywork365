import Link from 'next/link'

export const metadata = {
  title: 'Terms of Service - Anywork365',
  description: 'Anywork365 terms of service — rules and conditions for using our platform.',
}

const sections = [
  {
    title: 'Acceptance of Terms',
    content: `By creating an account or using Anywork365, you agree to be bound by these Terms of Service. If you do not agree, do not use the platform. We may update these terms at any time, and continued use constitutes acceptance of the updated terms.`,
  },
  {
    title: 'Eligibility',
    content: `You must be at least 18 years old to use Anywork365. By using the platform, you represent that you have the legal capacity to enter into binding contracts. You must provide accurate and complete information during registration and keep your account details up to date.`,
  },
  {
    title: 'Account Responsibilities',
    content: `You are solely responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must notify us immediately of any unauthorized use of your account. We are not liable for any loss or damage arising from your failure to safeguard your account.`,
  },
  {
    title: 'Vendor Obligations',
    content: `Vendors listing services on Anywork365 agree to:
• Provide accurate descriptions of their services, qualifications, and pricing
• Complete booked jobs professionally and within agreed timelines
• Maintain valid identification and business documentation for verification
• Not engage in fraudulent, misleading, or deceptive practices
• Comply with all applicable Nigerian laws and regulations

Failure to meet these obligations may result in account suspension or permanent ban.`,
  },
  {
    title: 'Client Obligations',
    content: `Clients using Anywork365 agree to:
• Provide accurate job descriptions and requirements
• Pay agreed amounts through the platform's escrow system
• Communicate respectfully with vendors
• Release payments promptly upon satisfactory completion of work
• Not attempt to circumvent the platform to engage vendors off-platform`,
  },
  {
    title: 'Payments & Fees',
    content: `All payments are processed through Paystack. Funds are held in escrow until job completion is confirmed. Anywork365 charges a service fee on completed transactions, which is disclosed before payment. Withdrawals are processed within 1-2 business days to verified bank accounts.

We reserve the right to adjust fees with notice to users.`,
  },
  {
    title: 'Dispute Resolution',
    content: `If a dispute arises between a client and vendor, both parties agree to first attempt resolution through the platform's dispute resolution process. Anywork365 may review evidence and make a determination, which both parties agree to accept as binding.

For unresolved disputes, the matter shall be referred to mediation in Lagos, Nigeria, before any court action.`,
  },
  {
    title: 'Prohibited Activities',
    content: `You may not use Anywork365 for:
• Fraudulent, illegal, or unauthorized purposes
• Posting false, misleading, or deceptive listings
• Harassing, threatening, or abusing other users
• Attempting to breach platform security or access other users' data
• Violating any applicable Nigerian laws or regulations
• Engaging in money laundering or other financial crimes

Violation of these prohibitions will result in immediate account termination and may be reported to law enforcement.`,
  },
  {
    title: 'Intellectual Property',
    content: `The Anywork365 name, logo, and platform design are our intellectual property. You may not reproduce, distribute, or create derivative works without our express written permission. Content you post on the platform (listings, reviews, profile information) remains your property, but you grant us a license to display it on the platform.`,
  },
  {
    title: 'Limitation of Liability',
    content: `Anywork365 acts as a marketplace connecting clients and vendors. We are not a party to any service agreement between users and are not liable for the quality, safety, or legality of services provided. Our liability is limited to the maximum extent permitted by Nigerian law.

The platform is provided "as is" without warranties of merchantability or fitness for a particular purpose.`,
  },
  {
    title: 'Termination',
    content: `We reserve the right to suspend or terminate accounts that violate these terms, engage in fraudulent activity, or pose a risk to other users. You may terminate your account at any time by contacting support@anywork365.ng. Upon termination, you remain liable for any outstanding obligations.`,
  },
  {
    title: 'Governing Law',
    content: `These terms are governed by the laws of the Federal Republic of Nigeria. Any disputes arising from these terms shall be subject to the exclusive jurisdiction of the courts in Lagos, Nigeria.`,
  },
  {
    title: 'Contact',
    content: `For questions about these terms, contact:

Email: support@anywork365.ng
Address: Lagos, Nigeria`,
  },
]

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 mb-2">Terms of Service</h1>
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
