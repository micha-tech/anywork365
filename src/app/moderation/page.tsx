'use client'

import { FormEvent, ReactNode, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

type View = 'overview' | 'ledger' | 'job_funds' | 'withdrawals' | 'refunds' | 'risk' | 'users' | 'audit'
type RecordRow = Record<string, unknown>

type Overview = {
  accounts: Array<{ purpose: string; classification: string; balanceMinor: number }>
  jobFunds: Array<{ status: string; count: number; amountMinor: number }>
  withdrawals: Array<{ status: string; count: number; amountMinor: number }>
  refunds: Array<{ status: string; count: number; amountMinor: number }>
  operations: {
    providerDeadLetters: number
    staleProviderEvents: number
    outboxDeadLetters: number
    staleOutbox: number
    activeRiskHolds: number
    openDisputes: number
    pendingWithdrawals: number
    pendingRefunds: number
  } | null
  latestReconciliation: {
    id: number
    status: string
    issueCount: number
    startedAt: string
    completedAt: string | null
  } | null
  recentActivity: RecordRow[]
  paystackBalance: { status: 'available' | 'unavailable'; balanceMinor: number | null; currency: string }
  generatedAt: string
}

type ModalState =
  | { kind: 'adjustment'; row?: RecordRow }
  | { kind: 'withdrawal'; row: RecordRow; action: 'approve' | 'reconcile' | 'cancel_unsubmitted' }
  | { kind: 'job_refund'; row: RecordRow }
  | { kind: 'submit_refund'; row: RecordRow }
  | { kind: 'chargeback'; row: RecordRow }
  | { kind: 'reconciliation' }
  | null

const viewCopy: Record<View, { title: string; description: string }> = {
  overview: {
    title: 'Financial operations',
    description: 'Provider liquidity, customer liabilities, job funds and queues requiring operator review.',
  },
  ledger: {
    title: 'Ledger journal',
    description: 'Immutable financial transactions posted by customers, operators, workers and Paystack.',
  },
  job_funds: {
    title: 'Job funds',
    description: 'Funding, locked value, authorised releases and refund state by booking.',
  },
  withdrawals: {
    title: 'Withdrawals',
    description: 'Review, submit and reconcile artisan payouts against their Paystack transfer reference.',
  },
  refunds: {
    title: 'Refunds',
    description: 'Refund reservations and their provider-processing state.',
  },
  risk: {
    title: 'Risk and disputes',
    description: 'Provider disputes, chargebacks and earnings held against financial exposure.',
  },
  users: {
    title: 'Customer accounts',
    description: 'Find a customer or artisan before reviewing balances or posting an exceptional adjustment.',
  },
  audit: {
    title: 'Audit history',
    description: 'Attributable financial actions and the resources they affected.',
  },
}

const statusOptions: Partial<Record<View, string[]>> = {
  ledger: ['success', 'pending', 'failed'],
  job_funds: ['awaiting_funding', 'funding_pending', 'cancel_requested', 'locked', 'released', 'refund_pending', 'refunded', 'disputed', 'cancelled'],
  withdrawals: ['requested', 'under_review', 'approved', 'processing', 'success', 'failed', 'reversed', 'cancelled'],
  refunds: ['requested', 'processing', 'completed', 'failed', 'needs_attention'],
  risk: ['open', 'under_review', 'won', 'lost', 'closed'],
}

export default function ModerationPage() {
  const searchParams = useSearchParams()
  const requestedView = searchParams.get('view') as View | null
  const view: View = requestedView && requestedView in viewCopy ? requestedView : 'overview'
  const [overview, setOverview] = useState<Overview | null>(null)
  const [rows, setRows] = useState<RecordRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState<ModalState>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    setPage(1)
    setStatus('')
    setSearch('')
    setSearchInput('')
  }, [view])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      let url = `/api/admin/moderation?view=${view}&page=${page}&limit=25`
      if (view === 'withdrawals') url = `/api/admin/withdrawals?page=${page}&limit=25`
      if (view === 'users') {
        const params = new URLSearchParams({ page: String(page), limit: '25' })
        if (search) params.set('search', search)
        url = `/api/admin/support-users?${params}`
      } else {
        if (search) url += `&search=${encodeURIComponent(search)}`
        if (status) url += `&status=${encodeURIComponent(status)}`
      }
      if (view === 'withdrawals' && status) url += `&status=${encodeURIComponent(status)}`
      url += `${url.includes('?') ? '&' : '?'}refresh=${refreshKey}`
      const response = await fetch(url, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Could not load records')
      if (view === 'overview') {
        setOverview(payload.data)
        setRows([])
        setTotal(0)
      } else {
        setRows(payload.data || [])
        setTotal(Number(payload.total || 0))
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load financial records')
    } finally {
      setLoading(false)
    }
  }, [page, refreshKey, search, status, view])

  useEffect(() => {
    void load()
  }, [load])

  const refresh = () => setRefreshKey((current) => current + 1)
  const copy = viewCopy[view]

  function submitSearch(event: FormEvent) {
    event.preventDefault()
    setPage(1)
    setSearch(searchInput.trim())
  }

  return (
    <div className="mx-auto max-w-[1680px]">
      <section className="mb-5 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span>Moderation</span>
            <span className="text-slate-300">/</span>
            <span>{copy.title}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">{copy.title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">{copy.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {view === 'overview' && (
            <button type="button" onClick={() => setModal({ kind: 'reconciliation' })} className="btn-outline min-h-10 px-4 py-2">
              Run reconciliation
            </button>
          )}
          {(view === 'overview' || view === 'users' || view === 'ledger') && (
            <button type="button" onClick={() => setModal({ kind: 'adjustment' })} className="btn-primary-sm min-h-10">
              Post adjustment
            </button>
          )}
          <button type="button" onClick={refresh} className="btn-ghost min-h-10 px-4 py-2">
            Refresh
          </button>
        </div>
      </section>

      {view !== 'overview' && (
        <section className="mb-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <form onSubmit={submitSearch} className="flex flex-col gap-2 sm:flex-row">
            <label className="sr-only" htmlFor="moderation-search">Search records</label>
            <input
              id="moderation-search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={searchPlaceholder(view)}
              className="min-h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
            />
            {statusOptions[view] && (
              <select
                value={status}
                onChange={(event) => { setStatus(event.target.value); setPage(1) }}
                className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-brand-400"
                aria-label="Filter by status"
              >
                <option value="">All statuses</option>
                {statusOptions[view]?.map((option) => (
                  <option key={option} value={option}>{humanize(option)}</option>
                ))}
              </select>
            )}
            <button type="submit" className="btn-primary-sm min-h-10">Search</button>
          </form>
        </section>
      )}

      {error ? (
        <ErrorPanel message={error} retry={refresh} />
      ) : view === 'overview' ? (
        <OverviewPanel data={overview} loading={loading} openModal={setModal} />
      ) : (
        <RecordsPanel
          view={view}
          rows={rows}
          loading={loading}
          total={total}
          page={page}
          setPage={setPage}
          openModal={setModal}
        />
      )}

      {modal && (
        <OperationModal
          modal={modal}
          close={() => setModal(null)}
          completed={() => {
            setModal(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}

function OverviewPanel({
  data,
  loading,
  openModal,
}: {
  data: Overview | null
  loading: boolean
  openModal: (modal: ModalState) => void
}) {
  if (loading || !data) return <LoadingPanel />
  const account = (purpose: string) =>
    Number(data.accounts.find((item) => item.purpose === purpose)?.balanceMinor || 0)
  const locked = account('client_locked_job_funds')
  const clientAvailable = account('client_available') + account('client_refundable')
  const artisanAvailable = account('artisan_available_earnings')
  const pendingWithdrawalMinor = data.withdrawals
    .filter((item) => ['requested', 'under_review', 'approved', 'processing'].includes(item.status))
    .reduce((total, item) => total + item.amountMinor, 0)
  const operationIssues =
    Number(data.operations?.providerDeadLetters || 0) +
    Number(data.operations?.staleProviderEvents || 0) +
    Number(data.operations?.outboxDeadLetters || 0) +
    Number(data.operations?.staleOutbox || 0)

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Paystack transfer balance"
          value={data.paystackBalance.balanceMinor === null ? 'Unavailable' : money(data.paystackBalance.balanceMinor)}
          note="Available for provider transfers"
          tone={data.paystackBalance.balanceMinor === null ? 'warning' : 'brand'}
        />
        <Metric label="Client wallet balances" value={money(clientAvailable)} note="Available and refundable liabilities" />
        <Metric label="Locked job funds" value={money(locked)} note="Funded bookings awaiting business outcome" />
        <Metric label="Artisan available earnings" value={money(artisanAvailable)} note="Eligible for withdrawal requests" />
        <Metric label="Withdrawals in progress" value={money(pendingWithdrawalMinor)} note={`${data.operations?.pendingWithdrawals || 0} requests`} />
        <Metric label="Refunds requiring action" value={String(data.operations?.pendingRefunds || 0)} note="Requested, processing or needs attention" tone={data.operations?.pendingRefunds ? 'warning' : 'default'} />
        <Metric label="Risk holds" value={String(data.operations?.activeRiskHolds || 0)} note={`${data.operations?.openDisputes || 0} open provider disputes`} tone={data.operations?.activeRiskHolds ? 'warning' : 'default'} />
        <Metric label="Processing exceptions" value={String(operationIssues)} note="Provider and delivery queues" tone={operationIssues ? 'danger' : 'success'} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <SectionHeading title="Operational queues" note="Current records grouped by provider-facing state" />
          <div className="grid gap-px bg-slate-200 sm:grid-cols-3">
            <QueueColumn title="Job funds" rows={data.jobFunds} />
            <QueueColumn title="Withdrawals" rows={data.withdrawals} />
            <QueueColumn title="Refunds" rows={data.refunds} />
          </div>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <SectionHeading title="Reconciliation" note="Latest recorded ledger integrity run" />
          <div className="p-5">
            {data.latestReconciliation ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <Status value={data.latestReconciliation.status} />
                  <span className="text-xs text-slate-400">Run #{data.latestReconciliation.id}</span>
                </div>
                <p className="mt-5 text-3xl font-bold text-slate-950">{data.latestReconciliation.issueCount}</p>
                <p className="text-sm text-slate-500">recorded reconciliation issues</p>
                <p className="mt-4 text-xs text-slate-400">
                  Started {dateTime(data.latestReconciliation.startedAt)}
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-500">No recorded reconciliation run.</p>
            )}
            <button type="button" onClick={() => openModal({ kind: 'reconciliation' })} className="btn-outline mt-5 min-h-10 w-full py-2">
              Run reconciliation
            </button>
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <SectionHeading title="Recent financial activity" note={`Updated ${dateTime(data.generatedAt)}`} />
        <div className="divide-y divide-slate-100">
          {data.recentActivity.length === 0 ? (
            <EmptyRow message="No financial audit activity has been recorded." />
          ) : data.recentActivity.map((item) => (
            <div key={String(item.id)} className="grid gap-1 px-5 py-3.5 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <p className="text-sm font-semibold text-slate-800">{humanize(String(item.action || 'activity'))}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {humanize(String(item.resourceType || 'resource'))} {String(item.resourceId || '')}
                  {item.internalReference ? ` · ${String(item.internalReference)}` : ''}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-xs font-medium text-slate-600">{String(item.actorId || 'system')}</p>
                <p className="text-xs text-slate-400">{dateTime(String(item.createdAt || ''))}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function RecordsPanel({
  view,
  rows,
  loading,
  total,
  page,
  setPage,
  openModal,
}: {
  view: View
  rows: RecordRow[]
  loading: boolean
  total: number
  page: number
  setPage: (page: number) => void
  openModal: (modal: ModalState) => void
}) {
  const pages = Math.max(1, Math.ceil(total / 25))
  if (loading) return <LoadingPanel />

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <p className="text-sm font-semibold text-slate-800">
          {total.toLocaleString()} {recordLabel(view, total)}
        </p>
        <p className="text-xs text-slate-400">Page {page} of {pages}</p>
      </div>
      <div className="overflow-x-auto">
        {view === 'ledger' && <LedgerTable rows={rows} />}
        {view === 'job_funds' && <JobFundsTable rows={rows} openModal={openModal} />}
        {view === 'withdrawals' && <WithdrawalsTable rows={rows} openModal={openModal} />}
        {view === 'refunds' && <RefundsTable rows={rows} openModal={openModal} />}
        {view === 'risk' && <RiskTable rows={rows} openModal={openModal} />}
        {view === 'users' && <UsersTable rows={rows} openModal={openModal} />}
        {view === 'audit' && <AuditTable rows={rows} />}
      </div>
      {total > 25 && (
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn-ghost min-h-9 px-3 py-1.5 disabled:opacity-40">
            Previous
          </button>
          <span className="text-xs text-slate-500">{Math.min((page - 1) * 25 + 1, total)}–{Math.min(page * 25, total)} of {total}</span>
          <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} className="btn-ghost min-h-9 px-3 py-1.5 disabled:opacity-40">
            Next
          </button>
        </div>
      )}
    </section>
  )
}

function LedgerTable({ rows }: { rows: RecordRow[] }) {
  return (
    <Table headers={['Reference', 'Customer', 'Entry', 'Amount', 'Status', 'Provider reference', 'Posted']}>
      {rows.map((row) => (
        <tr key={String(row.id)} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
          <Cell mono>{String(row.reference || '—')}</Cell>
          <Cell title={String(row.fullName || row.email || row.userUid || 'System')}>
            <Secondary>{String(row.email || row.userUid || 'Platform account')}</Secondary>
          </Cell>
          <Cell title={humanize(String(row.transactionType || ''))}>
            <Secondary>{String(row.description || '')}</Secondary>
          </Cell>
          <Cell title={money(Number(row.amountMinor || 0))}>{String(row.currency || 'NGN')}</Cell>
          <Cell><Status value={String(row.status || '')} /></Cell>
          <Cell mono>{String(row.providerReference || '—')}</Cell>
          <Cell>{dateTime(String(row.createdAt || ''))}</Cell>
        </tr>
      ))}
      {rows.length === 0 && <EmptyTable columns={7} message="No ledger entries match this filter." />}
    </Table>
  )
}

function JobFundsTable({ rows, openModal }: { rows: RecordRow[]; openModal: (modal: ModalState) => void }) {
  return (
    <Table headers={['Booking', 'Client', 'Artisan', 'Gross amount', 'Position', 'Status', 'Action']}>
      {rows.map((row) => (
        <tr key={String(row.id)} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
          <Cell title={`#${String(row.bookingId)}`}><Secondary>{dateTime(String(row.createdAt || ''))}</Secondary></Cell>
          <Cell title={String(row.clientName || row.clientUid || '—')}><Secondary>{String(row.clientEmail || '')}</Secondary></Cell>
          <Cell title={String(row.artisanName || row.artisanUid || '—')}><Secondary>{String(row.artisanEmail || '')}</Secondary></Cell>
          <Cell title={money(Number(row.amountMinor || 0))}><Secondary>Fee {money(Number(row.feeMinor || 0))}</Secondary></Cell>
          <Cell>
            <Secondary>Locked {money(Number(row.lockedMinor || 0))}</Secondary>
            <Secondary>Released {money(Number(row.releasedMinor || 0))}</Secondary>
          </Cell>
          <Cell><Status value={String(row.status || '')} /></Cell>
          <Cell>
            {row.status === 'locked' ? (
              <ActionButton onClick={() => openModal({ kind: 'job_refund', row })}>Request refund</ActionButton>
            ) : <span className="text-xs text-slate-400">No action available</span>}
          </Cell>
        </tr>
      ))}
      {rows.length === 0 && <EmptyTable columns={7} message="No job-fund records match this filter." />}
    </Table>
  )
}

function WithdrawalsTable({ rows, openModal }: { rows: RecordRow[]; openModal: (modal: ModalState) => void }) {
  return (
    <Table headers={['Reference', 'Artisan', 'Amount', 'Destination', 'Risk', 'Status', 'Actions']}>
      {rows.map((row) => {
        const current = String(row.status || '')
        const canApprove = ['requested', 'under_review', 'failed'].includes(current)
        const canCancel = ['requested', 'under_review', 'approved', 'failed'].includes(current)
        const canReconcile = ['approved', 'processing'].includes(current) || Boolean(row.providerReference)
        return (
          <tr key={String(row.id)} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
            <Cell mono>{String(row.reference || '—')}<Secondary>{dateTime(String(row.createdAt || ''))}</Secondary></Cell>
            <Cell title={String(row.fullName || row.user_uid || '—')}><Secondary>{String(row.email || row.user_uid || '')}</Secondary></Cell>
            <Cell title={moneyMajor(Number(row.amount || 0))} />
            <Cell title={String(row.bankName || '—')}><Secondary>•••• {String(row.accountLast4 || '')}</Secondary></Cell>
            <Cell><Status value={String(row.riskStatus || 'pending')} /></Cell>
            <Cell><Status value={current} /></Cell>
            <Cell>
              <div className="flex min-w-[190px] flex-wrap gap-1.5">
                {canApprove && <ActionButton onClick={() => openModal({ kind: 'withdrawal', row, action: 'approve' })}>Approve and send</ActionButton>}
                {canReconcile && <ActionButton onClick={() => openModal({ kind: 'withdrawal', row, action: 'reconcile' })}>Reconcile</ActionButton>}
                {canCancel && <ActionButton tone="danger" onClick={() => openModal({ kind: 'withdrawal', row, action: 'cancel_unsubmitted' })}>Cancel</ActionButton>}
                {!canApprove && !canReconcile && !canCancel && <span className="text-xs text-slate-400">Final state</span>}
              </div>
            </Cell>
          </tr>
        )
      })}
      {rows.length === 0 && <EmptyTable columns={7} message="No withdrawal requests match this filter." />}
    </Table>
  )
}

function RefundsTable({ rows, openModal }: { rows: RecordRow[]; openModal: (modal: ModalState) => void }) {
  return (
    <Table headers={['Reference', 'Booking', 'Client', 'Amount', 'Provider reference', 'Status', 'Action']}>
      {rows.map((row) => (
        <tr key={String(row.id)} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
          <Cell mono>{String(row.reference || '—')}<Secondary>{dateTime(String(row.createdAt || ''))}</Secondary></Cell>
          <Cell title={`#${String(row.bookingId || '—')}`} />
          <Cell title={String(row.clientName || row.clientUid || '—')}><Secondary>{String(row.clientEmail || '')}</Secondary></Cell>
          <Cell title={money(Number(row.amountMinor || 0))} />
          <Cell mono>{String(row.providerReference || '—')}</Cell>
          <Cell><Status value={String(row.status || '')} /></Cell>
          <Cell>
            {row.status === 'requested' ? (
              <ActionButton onClick={() => openModal({ kind: 'submit_refund', row })}>Submit to Paystack</ActionButton>
            ) : <span className="text-xs text-slate-400">Await provider outcome</span>}
          </Cell>
        </tr>
      ))}
      {rows.length === 0 && <EmptyTable columns={7} message="No refund requests match this filter." />}
    </Table>
  )
}

function RiskTable({ rows, openModal }: { rows: RecordRow[]; openModal: (modal: ModalState) => void }) {
  return (
    <Table headers={['Dispute', 'Booking', 'Parties', 'Amount', 'Earnings held', 'Status', 'Action']}>
      {rows.map((row) => (
        <tr key={String(row.id)} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
          <Cell title={`#${String(row.id)}`}><Secondary>{String(row.providerDisputeId || row.provider || 'Paystack')}</Secondary></Cell>
          <Cell title={`#${String(row.bookingId || '—')}`}><Secondary>{dateTime(String(row.createdAt || ''))}</Secondary></Cell>
          <Cell title={String(row.clientName || row.clientUid || 'Client')}><Secondary>{String(row.artisanName || row.artisanUid || 'Artisan')}</Secondary></Cell>
          <Cell title={money(Number(row.amountMinor || 0))} />
          <Cell title={money(Number(row.heldMinor || 0))} />
          <Cell><Status value={String(row.status || '')} /></Cell>
          <Cell>
            {['open', 'under_review'].includes(String(row.status)) ? (
              <ActionButton tone="danger" onClick={() => openModal({ kind: 'chargeback', row })}>Record chargeback</ActionButton>
            ) : <span className="text-xs text-slate-400">Resolved</span>}
          </Cell>
        </tr>
      ))}
      {rows.length === 0 && <EmptyTable columns={7} message="No provider disputes match this filter." />}
    </Table>
  )
}

function UsersTable({ rows, openModal }: { rows: RecordRow[]; openModal: (modal: ModalState) => void }) {
  return (
    <Table headers={['Customer', 'Role', 'Contact', 'Profile', 'Wallet balance', 'Bookings', 'Action']}>
      {rows.map((row) => (
        <tr key={String(row.uid)} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
          <Cell title={String(row.fullName || '—')}><Secondary mono>{String(row.uid || '')}</Secondary></Cell>
          <Cell><Status value={String(row.role || 'client')} /></Cell>
          <Cell title={String(row.email || '—')}><Secondary>{String(row.phoneNumber || '')}</Secondary></Cell>
          <Cell title={`${Number(row.profileProgress || 0)}%`}><Secondary>{String(row.primaryCategory || 'No category')}</Secondary></Cell>
          <Cell title={moneyMajor(Number(row.walletBalance || 0))} />
          <Cell title={String(row.bookingCount || 0)} />
          <Cell><ActionButton onClick={() => openModal({ kind: 'adjustment', row })}>Post adjustment</ActionButton></Cell>
        </tr>
      ))}
      {rows.length === 0 && <EmptyTable columns={7} message="No customer accounts match this search." />}
    </Table>
  )
}

function AuditTable({ rows }: { rows: RecordRow[] }) {
  return (
    <Table headers={['Time', 'Operator', 'Action', 'Resource', 'Reference', 'Reason']}>
      {rows.map((row) => (
        <tr key={String(row.id)} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
          <Cell>{dateTime(String(row.createdAt || ''))}</Cell>
          <Cell title={String(row.actorName || row.actorId || 'System')}><Secondary>{String(row.actorEmail || row.actorType || '')}</Secondary></Cell>
          <Cell title={humanize(String(row.action || ''))} />
          <Cell title={`${humanize(String(row.resourceType || 'resource'))} ${String(row.resourceId || '')}`} />
          <Cell mono>{String(row.internalReference || '—')}</Cell>
          <Cell>{String(row.reason || '—')}</Cell>
        </tr>
      ))}
      {rows.length === 0 && <EmptyTable columns={6} message="No audit records match this search." />}
    </Table>
  )
}

function OperationModal({
  modal,
  close,
  completed,
}: {
  modal: Exclude<ModalState, null>
  close: () => void
  completed: () => void
}) {
  const [reason, setReason] = useState('')
  const [ticketReference, setTicketReference] = useState('')
  const [userUid, setUserUid] = useState(String(modal.kind === 'adjustment' ? modal.row?.uid || '' : ''))
  const [target, setTarget] = useState<'client_refundable' | 'artisan_available_earnings'>(
    modal.kind === 'adjustment' && modal.row?.role === 'artisan' ? 'artisan_available_earnings' : 'client_refundable'
  )
  const [direction, setDirection] = useState<'credit' | 'debit'>('credit')
  const [amount, setAmount] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const details = modalDetails(modal)
  const expectedConfirmation = modal.kind === 'adjustment'
    ? `${direction.toUpperCase()} ${amount || '0'}`
    : details.confirmation

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (confirmation.trim() !== expectedConfirmation) {
      toast.error(`Type ${expectedConfirmation} to confirm`)
      return
    }
    setSubmitting(true)
    try {
      const { url, body } = operationRequest(modal, {
        reason,
        ticketReference,
        userUid,
        target,
        direction,
        amount,
      })
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Operation failed')
      toast.success(details.success)
      completed()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Operation failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="operation-title">
      <div className="max-h-[94vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="operation-title" className="text-lg font-bold text-slate-950">{details.title}</h2>
              <p className="mt-1 text-sm text-slate-500">{details.description}</p>
            </div>
            <button type="button" onClick={close} className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-slate-100" aria-label="Close">×</button>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4 p-5 sm:p-6">
          {modal.kind === 'adjustment' && (
            <>
              <Field label="Customer UID">
                <input required value={userUid} onChange={(event) => setUserUid(event.target.value)} className="input-field" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Account">
                  <select value={target} onChange={(event) => setTarget(event.target.value as typeof target)} className="input-field">
                    <option value="client_refundable">Client refundable balance</option>
                    <option value="artisan_available_earnings">Artisan available earnings</option>
                  </select>
                </Field>
                <Field label="Direction">
                  <select value={direction} onChange={(event) => setDirection(event.target.value as typeof direction)} className="input-field">
                    <option value="credit">Credit</option>
                    <option value="debit">Debit</option>
                  </select>
                </Field>
              </div>
              <Field label="Amount (NGN)">
                <input required inputMode="decimal" pattern="\d+(\.\d{1,2})?" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" className="input-field" />
              </Field>
            </>
          )}
          {details.summary && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              {details.summary}
            </div>
          )}
          <Field label="Incident or support ticket">
            <input required minLength={3} maxLength={160} value={ticketReference} onChange={(event) => setTicketReference(event.target.value)} placeholder="FIN-2026-0001" className="input-field" />
          </Field>
          <Field label="Operational reason">
            <textarea required minLength={20} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} rows={4} placeholder="Record the verified business reason and evidence reviewed." className="input-field resize-none" />
          </Field>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Confirmation required</p>
            <p className="mt-1 text-sm text-amber-900">Type <strong>{expectedConfirmation}</strong> to confirm this operation.</p>
            <input required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-3 min-h-11 w-full rounded-lg border border-amber-300 bg-white px-3 text-sm outline-none focus:ring-4 focus:ring-amber-500/10" />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={close} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={submitting} className={details.danger ? 'min-h-11 rounded-lg bg-red-600 px-5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50' : 'btn-primary min-h-11 py-2'}>
              {submitting ? 'Processing…' : details.submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function operationRequest(
  modal: Exclude<ModalState, null>,
  form: {
    reason: string
    ticketReference: string
    userUid: string
    target: 'client_refundable' | 'artisan_available_earnings'
    direction: 'credit' | 'debit'
    amount: string
  }
): { url: string; body: Record<string, unknown> } {
  if (modal.kind === 'adjustment') {
    return {
      url: '/api/admin/finance/adjustments',
      body: {
        targetUserUid: form.userUid.trim(),
        target: form.target,
        direction: form.direction,
        amountNGN: form.amount,
        reason: form.reason,
        ticketReference: form.ticketReference,
        idempotencyKey: crypto.randomUUID(),
      },
    }
  }
  if (modal.kind === 'withdrawal') {
    return {
      url: `/api/admin/withdrawals/${String(modal.row.id)}`,
      body: {
        action: modal.action,
        reason: form.reason,
        ticketReference: form.ticketReference,
      },
    }
  }
  if (modal.kind === 'job_refund') {
    return {
      url: `/api/admin/moderation/job-funds/${String(modal.row.id)}`,
      body: { action: 'request_refund', reason: form.reason, ticketReference: form.ticketReference },
    }
  }
  if (modal.kind === 'submit_refund') {
    return {
      url: `/api/admin/moderation/refunds/${String(modal.row.id)}`,
      body: { action: 'submit', reason: form.reason, ticketReference: form.ticketReference },
    }
  }
  if (modal.kind === 'chargeback') {
    return {
      url: `/api/admin/finance/disputes/${String(modal.row.id)}`,
      body: { action: 'record_chargeback', reason: `${form.reason} [${form.ticketReference}]` },
    }
  }
  return {
    url: '/api/admin/moderation/reconcile',
    body: { reason: form.reason, ticketReference: form.ticketReference },
  }
}

function modalDetails(modal: Exclude<ModalState, null>) {
  if (modal.kind === 'adjustment') return {
    title: 'Post balancing adjustment',
    description: 'Create a balanced, immutable journal entry against the system adjustment account.',
    confirmation: '',
    submitLabel: 'Post adjustment',
    success: 'Financial adjustment posted',
    danger: true,
    summary: null,
  }
  if (modal.kind === 'withdrawal') {
    const reference = String(modal.row.reference || modal.row.id)
    const amount = moneyMajor(Number(modal.row.amount || 0))
    if (modal.action === 'approve') return {
      title: 'Approve and submit withdrawal',
      description: 'Approve the reviewed request and submit one transfer to Paystack.',
      confirmation: `SEND ${reference}`,
      submitLabel: 'Approve and send',
      success: 'Withdrawal approved and submitted',
      danger: true,
      summary: `${amount} to ${String(modal.row.bankName || 'the verified bank')} •••• ${String(modal.row.accountLast4 || '')}`,
    }
    if (modal.action === 'cancel_unsubmitted') return {
      title: 'Cancel unsubmitted withdrawal',
      description: 'This is allowed only when no provider transfer exists. Reserved earnings will be returned by a compensating ledger entry.',
      confirmation: `CANCEL ${reference}`,
      submitLabel: 'Cancel withdrawal',
      success: 'Withdrawal cancelled and reservation returned',
      danger: true,
      summary: `${amount} · ${reference}`,
    }
    return {
      title: 'Reconcile withdrawal',
      description: 'Verify the existing transfer reference with Paystack and apply only the confirmed provider state.',
      confirmation: `RECONCILE ${reference}`,
      submitLabel: 'Verify with Paystack',
      success: 'Withdrawal reconciled',
      danger: false,
      summary: `${amount} · ${reference}`,
    }
  }
  if (modal.kind === 'job_refund') return {
    title: 'Reserve job refund',
    description: 'Move locked job funds into refund pending. The customer is credited only after Paystack confirms the refund outcome.',
    confirmation: `REFUND BOOKING ${String(modal.row.bookingId)}`,
    submitLabel: 'Request refund',
    success: 'Refund requested',
    danger: true,
    summary: `${money(Number(modal.row.amountMinor || 0))} for booking #${String(modal.row.bookingId)}`,
  }
  if (modal.kind === 'submit_refund') return {
    title: 'Submit refund to Paystack',
    description: 'Send the reserved refund through the original verified Paystack payment.',
    confirmation: `SUBMIT ${String(modal.row.reference)}`,
    submitLabel: 'Submit refund',
    success: 'Refund submitted to Paystack',
    danger: true,
    summary: `${money(Number(modal.row.amountMinor || 0))} · ${String(modal.row.reference)}`,
  }
  if (modal.kind === 'chargeback') return {
    title: 'Record provider chargeback',
    description: 'Consume held earnings and platform exposure according to the recorded Paystack dispute.',
    confirmation: `CHARGEBACK ${String(modal.row.id)}`,
    submitLabel: 'Record chargeback',
    success: 'Chargeback recorded',
    danger: true,
    summary: `${money(Number(modal.row.amountMinor || 0))} for booking #${String(modal.row.bookingId)}`,
  }
  return {
    title: 'Run financial reconciliation',
    description: 'Check ledger balance, job-fund coverage, withdrawals, refunds, provider events and delivery queues.',
    confirmation: 'RUN RECONCILIATION',
    submitLabel: 'Run reconciliation',
    success: 'Reconciliation completed',
    danger: false,
    summary: 'The run is recorded and any mismatches are added to the reconciliation queue.',
  }
}

function Metric({ label, value, note, tone = 'default' }: { label: string; value: string; note: string; tone?: 'default' | 'brand' | 'success' | 'warning' | 'danger' }) {
  const tones = {
    default: 'border-slate-200',
    brand: 'border-brand-200 bg-gradient-to-br from-white to-brand-50/60',
    success: 'border-emerald-200 bg-emerald-50/35',
    warning: 'border-amber-200 bg-amber-50/35',
    danger: 'border-red-200 bg-red-50/35',
  }
  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm ${tones[tone]}`}>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-bold tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-400">{note}</p>
    </div>
  )
}

function QueueColumn({ title, rows }: { title: string; rows: Array<{ status: string; count: number; amountMinor: number }> }) {
  return (
    <div className="bg-white p-4">
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{title}</p>
      <div className="space-y-2.5">
        {rows.length === 0 ? <p className="text-sm text-slate-400">No records</p> : rows.map((row) => (
          <div key={row.status} className="flex items-center justify-between gap-3">
            <Status value={row.status} />
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-800">{row.count}</p>
              <p className="text-[11px] text-slate-400">{money(row.amountMinor)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <table className="min-w-full text-left text-sm">
      <thead className="bg-slate-50">
        <tr className="border-b border-slate-200">
          {headers.map((header) => (
            <th key={header} className="whitespace-nowrap px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{header}</th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  )
}

function Cell({ children, title, mono = false }: { children?: ReactNode; title?: string; mono?: boolean }) {
  return (
    <td className={`max-w-[260px] px-4 py-3 align-top text-xs text-slate-600 ${mono ? 'font-mono' : ''}`}>
      {title && <p className={`truncate font-semibold text-slate-800 ${mono ? 'font-mono' : ''}`}>{title}</p>}
      {children}
    </td>
  )
}

function Secondary({ children, mono = false }: { children: ReactNode; mono?: boolean }) {
  return <p className={`mt-0.5 max-w-[260px] truncate text-[11px] text-slate-400 ${mono ? 'font-mono' : ''}`}>{children}</p>
}

function Status({ value }: { value: string }) {
  const normalized = value.toLowerCase()
  const tone =
    ['success', 'succeeded', 'completed', 'released', 'refunded', 'passed', 'won', 'verified', 'active'].includes(normalized)
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : ['failed', 'dead_letter', 'lost', 'blocked', 'chargeback'].includes(normalized)
        ? 'border-red-200 bg-red-50 text-red-700'
        : ['pending', 'requested', 'processing', 'under_review', 'refund_pending', 'funding_pending', 'needs_attention', 'review'].includes(normalized)
          ? 'border-amber-200 bg-amber-50 text-amber-700'
          : 'border-slate-200 bg-slate-100 text-slate-600'
  return <span className={`inline-flex whitespace-nowrap rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${tone}`}>{humanize(value)}</span>
}

function ActionButton({ children, onClick, tone = 'default' }: { children: ReactNode; onClick: () => void; tone?: 'default' | 'danger' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-8 whitespace-nowrap rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
        tone === 'danger'
          ? 'border-red-200 text-red-700 hover:bg-red-50'
          : 'border-brand-200 text-brand-700 hover:bg-brand-50'
      }`}
    >
      {children}
    </button>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-sm font-semibold text-slate-700">{label}<div className="mt-2">{children}</div></label>
}

function SectionHeading({ title, note }: { title: string; note: string }) {
  return (
    <div className="border-b border-slate-200 px-5 py-4">
      <h2 className="text-sm font-bold text-slate-900">{title}</h2>
      <p className="mt-0.5 text-xs text-slate-400">{note}</p>
    </div>
  )
}

function LoadingPanel() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="h-3 w-32 animate-pulse rounded bg-slate-200" />
      <div className="mt-5 space-y-3">
        {[1, 2, 3, 4].map((item) => <div key={item} className="h-11 animate-pulse rounded-lg bg-slate-100" />)}
      </div>
    </div>
  )
}

function ErrorPanel({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-white p-6 shadow-sm">
      <h2 className="font-bold text-slate-900">Financial records could not be loaded</h2>
      <p className="mt-1 text-sm text-red-600">{message}</p>
      <button type="button" onClick={retry} className="btn-outline mt-4 min-h-10 py-2">Try again</button>
    </div>
  )
}

function EmptyTable({ columns, message }: { columns: number; message: string }) {
  return <tr><td colSpan={columns} className="px-4 py-12 text-center text-sm text-slate-400">{message}</td></tr>
}

function EmptyRow({ message }: { message: string }) {
  return <p className="px-5 py-10 text-center text-sm text-slate-400">{message}</p>
}

function money(minor: number): string {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format(minor / 100)
}

function moneyMajor(major: number): string {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format(major)
}

function dateTime(value: string): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' }).format(date)
}

function humanize(value: string): string {
  return value.replace(/[._-]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

function searchPlaceholder(view: View): string {
  if (view === 'users') return 'Name, email, phone or category'
  if (view === 'job_funds') return 'Booking, client or artisan'
  if (view === 'withdrawals') return 'Use status to narrow the withdrawal queue'
  if (view === 'refunds') return 'Refund reference, booking or client'
  if (view === 'risk') return 'Dispute reference, booking or customer'
  if (view === 'audit') return 'Action, operator, reference or resource'
  return 'Reference, provider reference or customer'
}

function recordLabel(view: View, total: number): string {
  const labels: Partial<Record<View, string>> = {
    ledger: 'journal entries',
    job_funds: 'job-fund records',
    withdrawals: 'withdrawal requests',
    refunds: 'refund requests',
    risk: 'provider disputes',
    users: 'customer accounts',
    audit: 'audit records',
  }
  const label = labels[view] || 'records'
  return total === 1 ? label.replace(/s$/, '') : label
}
