'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { formatCurrency } from '@/lib/utils'

type Receipt = {
  receiptNumber: string
  reference: string
  providerTransactionId: string
  customerEmail: string
  currency: 'NGN'
  requestedAmountMinor: number
  chargedAmountMinor: number
  creditedAmountMinor: number
  providerFeeMinor: number
  paymentMethod: string | null
  paidAt: string | null
  confirmedAt: string | null
  status: string
}

export default function WalletFundingReceiptPage({
  params,
}: {
  params: Promise<{ reference: string }>
}) {
  const { reference } = use(params)
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/wallet/receipts/${encodeURIComponent(reference)}`)
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok || !body.success) throw new Error(body.error || 'Receipt not found')
        setReceipt(body.data)
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Receipt not found'))
  }, [reference])

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <div className="card text-center">
          <h1 className="font-display text-xl font-semibold">Receipt unavailable</h1>
          <p className="mt-2 text-sm text-slate-500">{error}</p>
          <Link href="/wallet" className="btn-primary mt-5 inline-flex">Return to wallet</Link>
        </div>
      </main>
    )
  }

  if (!receipt) {
    return <main className="mx-auto max-w-2xl px-4 py-12 text-sm text-slate-500">Loading receipt…</main>
  }

  const credited = receipt.creditedAmountMinor / 100
  const charged = receipt.chargedAmountMinor / 100
  const providerFee = receipt.providerFeeMinor / 100
  const paidAt = receipt.paidAt || receipt.confirmedAt

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/wallet" className="text-sm font-medium text-brand-600">← Back to wallet</Link>
        <button type="button" onClick={() => window.print()} className="btn-primary px-5 py-2">
          Print / Save PDF
        </button>
      </div>
      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-start justify-between gap-6 border-b border-slate-200 pb-6">
          <div>
            <BrandLogo />
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">
              Wallet funding receipt
            </p>
            <h1 className="mt-1 font-display text-2xl font-semibold text-slate-950">
              Payment confirmed
            </h1>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase text-emerald-700">
            {receipt.status}
          </span>
        </div>

        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <ReceiptItem label="Receipt number" value={receipt.receiptNumber} />
          <ReceiptItem label="Paystack transaction ID" value={receipt.providerTransactionId} />
          <ReceiptItem label="Payment reference" value={receipt.reference} />
          <ReceiptItem label="Customer" value={receipt.customerEmail} />
          <ReceiptItem label="Payment method" value={receipt.paymentMethod || 'Paystack'} />
          <ReceiptItem
            label="Paid at"
            value={paidAt ? new Date(paidAt).toLocaleString('en-NG') : 'Confirmed'}
          />
        </dl>

        <div className="mt-7 rounded-xl bg-brand-50 p-5">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-brand-700">Wallet amount credited</span>
            <strong className="font-display text-2xl text-brand-700">{formatCurrency(credited)}</strong>
          </div>
          <div className="mt-3 flex items-center justify-between gap-4 border-t border-brand-100 pt-3 text-xs text-brand-700">
            <span>Total charged by Paystack</span>
            <span className="font-semibold">{formatCurrency(charged)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-4 text-xs text-brand-700">
            <span>Paystack processing fee recorded</span>
            <span className="font-semibold">{formatCurrency(providerFee)}</span>
          </div>
        </div>

        <p className="mt-6 text-xs leading-5 text-slate-500">
          Anywork365 credits only the verified wallet amount shown above. This receipt was created
          atomically with the wallet ledger entry and can be verified using the payment reference
          and Paystack transaction ID.
        </p>
      </article>
    </main>
  )
}

function ReceiptItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 break-all font-medium text-slate-900">{value}</dd>
    </div>
  )
}
