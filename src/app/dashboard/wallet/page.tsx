'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { formatCurrency } from '@/lib/utils'
import { PullToRefresh } from '@/components/ui/PullToRefresh'
import type { Wallet, WalletTransaction, NigerianBank } from '@/types'

interface WalletData {
  wallet: Wallet
  transactions: WalletTransaction[]
}

const TX_META: Record<string, { label: string; color: string; sign: string }> = {
  credit: { label: 'Credit', color: 'text-green-600', sign: '+' },
  earning: { label: 'Earnings', color: 'text-green-600', sign: '+' },
  debit: { label: 'Withdrawal', color: 'text-red-500', sign: '-' },
  escrow_lock: { label: 'Escrow Lock', color: 'text-amber-600', sign: '-' },
  escrow_release: { label: 'Escrow Released', color: 'text-green-600', sign: '+' },
  refund: { label: 'Refund', color: 'text-blue-600', sign: '+' },
}

function WalletPageContent() {
  const { user, loading: userLoading } = useCurrentUser()
  const searchParams = useSearchParams()

  const [walletData, setWalletData] = useState<WalletData | null>(null)
  const [banks, setBanks] = useState<NigerianBank[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'fund' | 'withdraw' | 'bank'>('overview')

  const [fundAmount, setFundAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [bankCode, setBankCode] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [resolvedName, setResolvedName] = useState('')
  const [bankLookupError, setBankLookupError] = useState('')
  const [resolvingBank, setResolvingBank] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const payStatus = searchParams.get('status')
  const payAmount = searchParams.get('amount')
  const payMsg = searchParams.get('msg')

  const fetchWallet = useCallback(async () => {
    setLoadingData(true)
    try {
      const res = await fetch('/api/wallet')
      const data = await res.json()
      if (data.success) setWalletData(data.data)
    } finally {
      setLoadingData(false)
    }
  }, [])

  useEffect(() => {
    fetchWallet()
  }, [fetchWallet])

  useEffect(() => {
    fetch('/api/wallet/banks')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setBanks(d.data)
      })
  }, [])

  useEffect(() => {
    if (payStatus === 'success' && payAmount) {
      setMessage({ type: 'success', text: `Wallet funded with ${formatCurrency(Number(payAmount))} successfully.` })
      fetchWallet()
    } else if (payStatus === 'failed') {
      setMessage({ type: 'error', text: 'Payment was not completed. Please try again.' })
    } else if (payStatus === 'error') {
      setMessage({ type: 'error', text: payMsg ? decodeURIComponent(payMsg) : 'Wallet verification failed.' })
    }
  }, [fetchWallet, payAmount, payMsg, payStatus])

  useEffect(() => {
    setResolvedName('')
    setBankLookupError('')

    if (accountNumber.length !== 10 || !bankCode) {
      setResolvingBank(false)
      return
    }

    let cancelled = false
    setResolvingBank(true)

    fetch(`/api/wallet/bank-account?accountNumber=${accountNumber}&bankCode=${bankCode}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (data.success) {
          setResolvedName(data.data.accountName)
        } else {
          setBankLookupError(data.error ?? 'Unable to verify bank account details.')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBankLookupError('Unable to verify bank account details.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setResolvingBank(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [accountNumber, bankCode])

  async function handleFund(e: React.FormEvent) {
    e.preventDefault()
    const amount = Number(fundAmount)
    if (!amount || amount < 100) {
      setMessage({ type: 'error', text: 'Minimum amount is NGN 100' })
      return
    }

    setSubmitting(true)
    setMessage(null)
    try {
      const res = await fetch('/api/wallet/fund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountNGN: amount }),
      })
      const data = await res.json()
      if (data.success) {
        window.location.href = data.data.authorizationUrl
      } else {
        setMessage({ type: 'error', text: data.error ?? 'Failed to initialize payment' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSaveBankAccount(e: React.FormEvent) {
    e.preventDefault()
    if (!accountNumber || !bankCode) {
      setMessage({ type: 'error', text: 'Please fill in all fields' })
      return
    }

    const selectedBank = banks.find((b) => b.code === bankCode)
    setSubmitting(true)
    setMessage(null)
    try {
      const res = await fetch('/api/wallet/bank-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountNumber, bankCode, bankName: selectedBank?.name ?? '' }),
      })
      const data = await res.json()
      if (data.success) {
        setMessage({ type: 'success', text: `Bank account verified: ${data.data.accountName} - ${data.data.bankName}` })
        setAccountNumber('')
        setBankCode('')
        setResolvedName('')
        setBankLookupError('')
        fetchWallet()
        setActiveTab('overview')
      } else {
        setMessage({ type: 'error', text: data.error ?? 'Verification failed' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault()
    const amount = Number(withdrawAmount)
    if (!amount || amount < 500) {
      setMessage({ type: 'error', text: 'Minimum withdrawal is NGN 500' })
      return
    }

    setSubmitting(true)
    setMessage(null)
    try {
      const res = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountNGN: amount }),
      })
      const data = await res.json()
      if (data.success) {
        setMessage({ type: 'success', text: `Withdrawal of ${formatCurrency(amount)} initiated. Funds arrive in 1-2 business days.` })
        setWithdrawAmount('')
        fetchWallet()
        setActiveTab('overview')
      } else {
        setMessage({ type: 'error', text: data.error ?? 'Withdrawal failed' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  const isPro = user?.role === 'vendor'
  const wallet = walletData?.wallet
  const txHistory = walletData?.transactions ?? []
  const quickAmounts = [5000, 10000, 25000, 50000]

  return (
    <PullToRefresh onRefresh={fetchWallet}>
      <div className="mb-5 sm:mb-7">
        <h1 className="font-display text-xl sm:text-2xl font-semibold">Wallet</h1>
        <p className="text-sm text-slate-500 mt-1">
          {isPro ? 'Manage your earnings and withdrawals' : 'Manage your payments'}
        </p>
      </div>

      {message && (
        <div
          className={`px-4 py-3 rounded-xl mb-5 text-sm border ${
            message.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-600'
          }`}
        >
          {message.text}
        </div>
      )}

      {loadingData || userLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl h-28" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-brand-500 text-white rounded-2xl p-4 sm:p-5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-white/70">Available Balance</p>
            <p className="font-display text-2xl sm:text-3xl font-semibold mt-1 mb-1 break-words">
              {formatCurrency(wallet?.availableBalance ?? 0)}
            </p>
            <p className="text-xs text-white/60">Ready to withdraw</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">In Escrow</p>
            <p className="font-display text-2xl sm:text-3xl font-semibold mt-1 mb-1 text-amber-600 break-words">
              {formatCurrency(wallet?.escrowBalance ?? 0)}
            </p>
            <p className="text-xs text-slate-500">Pending job completion</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Total Earned</p>
            <p className="font-display text-2xl sm:text-3xl font-semibold mt-1 mb-1 text-slate-900 break-words">
              {formatCurrency(wallet?.totalEarned ?? 0)}
            </p>
            <p className="text-xs text-slate-500">All time</p>
          </div>
        </div>
      )}

      {isPro && !wallet?.isVerified && !loadingData && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-amber-800">Add a bank account to withdraw</p>
            <p className="text-xs text-amber-700 mt-0.5">Your earnings will stay in your wallet until you add a verified bank account.</p>
          </div>
          <button
            onClick={() => setActiveTab('bank')}
            className="btn-primary text-xs px-4 py-2 w-full sm:w-auto flex-shrink-0 bg-amber-600 hover:bg-amber-700"
          >
            Add Bank
          </button>
        </div>
      )}

      {wallet?.isVerified && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-5 flex items-start gap-3">
          <span className="text-green-600 text-lg leading-none mt-0.5">✓</span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-green-800">Bank account verified</p>
            <p className="text-xs text-green-700 break-words">
              {wallet.bankName} ****{wallet.bankAccountNumber?.slice(-4)}
            </p>
          </div>
        </div>
      )}

      <div className="-mx-4 sm:mx-0 mb-6 border-b border-slate-200 px-4 sm:px-0 overflow-x-auto scrollbar-none">
        <div className="flex min-w-max gap-1 sm:gap-0">
          {([
            { id: 'overview', label: 'Transactions' },
            { id: 'fund', label: 'Add Money' },
            ...(isPro
              ? [
                  { id: 'withdraw', label: 'Withdraw' },
                  { id: 'bank', label: 'Bank Account' },
                ]
              : []),
          ] as { id: typeof activeTab; label: string }[]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id)
                setMessage(null)
              }}
              className={`px-4 sm:px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-brand-500 text-brand-500'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="card">
          <h2 className="font-medium text-base mb-4">Transaction History</h2>
          {txHistory.length === 0 ? (
            <div className="text-center py-12">
              <p className="font-medium text-sm text-slate-900 mb-1">No transactions yet</p>
              <p className="text-xs text-slate-500">Your transaction history will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {txHistory.map((tx) => {
                const meta = TX_META[tx.type] ?? { label: tx.type, color: 'text-slate-900', sign: '' }
                const direction = tx.type === 'credit' || tx.type === 'escrow_release' || tx.type === 'refund' ? '↓' : '↑'

                return (
                  <div key={tx.id} className="py-3.5">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-brand-50 flex items-center justify-center flex-shrink-0 text-sm">
                        {direction}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 leading-snug break-words">{tx.description}</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {meta.label} - {new Date(tx.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                          <div className="sm:text-right">
                            <p className={`text-sm font-semibold ${meta.color}`}>
                              {meta.sign}
                              {formatCurrency(tx.amountNGN)}
                            </p>
                            <p
                              className={`text-xs mt-0.5 capitalize ${
                                tx.status === 'success'
                                  ? 'text-green-600'
                                  : tx.status === 'failed'
                                    ? 'text-red-500'
                                    : 'text-amber-600'
                              }`}
                            >
                              {tx.status}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'fund' && (
        <div className="card max-w-xl">
          <h2 className="font-medium text-base mb-1">Add Money to Wallet</h2>
          <p className="text-sm text-slate-500 mb-5">
            Pay securely via card, bank transfer, or USSD. Powered by Paystack.
          </p>
          <form onSubmit={handleFund}>
            <div className="form-group">
              <label className="label">Amount (NGN)</label>
              <input
                type="number"
                inputMode="numeric"
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
                className="input-field"
                placeholder="e.g. 50000"
                min="100"
                required
              />
              <p className="text-xs text-slate-500 mt-1.5">Minimum: NGN 100 - Maximum: NGN 10,000,000</p>
            </div>

            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 mb-5">
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setFundAmount(String(amt))}
                  className={`px-3 py-2 rounded-xl text-sm border transition-colors ${
                    fundAmount === String(amt)
                      ? 'border-brand-500 bg-brand-50 text-brand-600'
                      : 'border-slate-200 text-slate-500 hover:border-brand-500'
                  }`}
                >
                  {formatCurrency(amt)}
                </button>
              ))}
            </div>

            <button type="submit" disabled={submitting} className="btn-primary w-full py-3 justify-center">
              {submitting ? 'Redirecting to Paystack...' : 'Pay with Paystack'}
            </button>
            <p className="text-xs text-slate-500 text-center mt-3">
              Secured by Paystack - Card, Bank Transfer, USSD supported
            </p>
          </form>
        </div>
      )}

      {activeTab === 'withdraw' && isPro && (
        <div className="card max-w-xl">
          <h2 className="font-medium text-base mb-1">Withdraw Funds</h2>
          <p className="text-sm text-slate-500 mb-5">Funds arrive in your bank account within 1-2 business days.</p>

          {!wallet?.isVerified ? (
            <div className="text-center py-8">
              <p className="font-medium text-sm mb-2">No bank account added</p>
              <p className="text-xs text-slate-500 mb-4">Add a bank account first to withdraw your earnings</p>
              <button onClick={() => setActiveTab('bank')} className="btn-primary px-6">
                Add Bank Account
              </button>
            </div>
          ) : (
            <form onSubmit={handleWithdraw}>
              <div className="bg-brand-50 rounded-xl px-4 py-3 mb-5">
                <p className="text-xs text-brand-600 font-medium">Available to withdraw</p>
                <p className="font-display text-2xl font-semibold text-brand-500 mt-0.5 break-words">
                  {formatCurrency(wallet?.availableBalance ?? 0)}
                </p>
              </div>

              <div className="form-group">
                <label className="label">Withdrawal Amount (NGN)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="input-field"
                  placeholder="e.g. 25000"
                  min="500"
                  max={wallet?.availableBalance}
                  required
                />
                <p className="text-xs text-slate-500 mt-1.5">Minimum: NGN 500</p>
              </div>

              <div className="bg-gray-50 border border-slate-200 rounded-xl px-4 py-3 mb-5">
                <p className="text-xs text-slate-500 mb-1">Sending to</p>
                <p className="text-sm font-medium break-words">{wallet.bankName}</p>
                <p className="text-xs text-slate-500">****{wallet.bankAccountNumber?.slice(-4)}</p>
              </div>

              <button
                type="submit"
                disabled={submitting || !withdrawAmount || Number(withdrawAmount) > (wallet?.availableBalance ?? 0)}
                className="btn-primary w-full py-3 justify-center"
              >
                {submitting ? 'Processing...' : `Withdraw ${withdrawAmount ? formatCurrency(Number(withdrawAmount)) : ''}`}
              </button>
            </form>
          )}
        </div>
      )}

      {activeTab === 'bank' && isPro && (
        <div className="card max-w-xl">
          <h2 className="font-medium text-base mb-1">Bank Account</h2>
          <p className="text-sm text-slate-500 mb-5">
            Add your bank account to receive withdrawals. We verify your account with Paystack.
          </p>

          {wallet?.isVerified && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-5">
              <p className="text-sm font-medium text-green-800">Verified bank account</p>
              <p className="text-xs text-green-700 mt-0.5 break-words">
                {wallet.bankName} - ****{wallet.bankAccountNumber?.slice(-4)}
              </p>
              <p className="text-xs text-green-600 mt-2">You can update this by adding a new account below.</p>
            </div>
          )}

          <form onSubmit={handleSaveBankAccount}>
            <div className="form-group">
              <label className="label">Bank</label>
              <select
                value={bankCode}
                onChange={(e) => setBankCode(e.target.value)}
                className="input-field appearance-none"
                required
              >
                <option value="">Select your bank</option>
                {banks.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="label">Account Number</label>
              <input
                type="text"
                inputMode="numeric"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className="input-field"
                placeholder="10-digit account number"
                maxLength={10}
                required
              />
              {resolvingBank && <p className="text-xs text-slate-500 mt-1.5">Verifying account...</p>}
              {resolvedName && !resolvingBank && (
                <p className="text-xs text-green-600 mt-1.5 font-medium">Verified name: {resolvedName}</p>
              )}
              {bankLookupError && !resolvingBank && (
                <p className="text-xs text-red-500 mt-1.5">{bankLookupError}</p>
              )}
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 text-xs text-amber-700">
              Ensure the account belongs to you. Withdrawals go directly to this account and cannot be reversed.
            </div>

            <button
              type="submit"
              disabled={submitting || accountNumber.length !== 10 || !bankCode || resolvingBank || !!bankLookupError}
              className="btn-primary w-full py-3 justify-center"
            >
              {submitting ? 'Verifying...' : 'Verify & Save Bank Account'}
            </button>
          </form>
        </div>
      )}
    </PullToRefresh>
  )
}

export default function WalletPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-slate-500">Loading wallet...</div>}>
      <WalletPageContent />
    </Suspense>
  )
}
