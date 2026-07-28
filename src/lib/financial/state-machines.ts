import { FinancialError } from './errors'

export const paymentIntentTransitions = {
  created: ['initialized', 'failed', 'cancelled'],
  initialized: ['pending', 'succeeded', 'failed', 'cancelled'],
  pending: ['succeeded', 'failed', 'cancelled'],
  succeeded: ['partially_refunded', 'refunded', 'chargeback'],
  failed: [],
  cancelled: [],
  partially_refunded: ['refunded', 'chargeback'],
  refunded: ['chargeback'],
  chargeback: [],
} as const

export const jobFundsTransitions = {
  awaiting_funding: ['funding_pending', 'cancelled'],
  funding_pending: ['locked', 'cancel_requested'],
  cancel_requested: ['locked', 'refund_pending'],
  locked: ['released', 'refund_pending', 'disputed'],
  released: ['disputed'],
  refund_pending: ['refunded', 'locked', 'disputed'],
  refunded: ['disputed'],
  disputed: ['released', 'refunded'],
  cancelled: [],
} as const

export const withdrawalTransitions = {
  requested: ['under_review', 'approved', 'cancelled'],
  under_review: ['approved', 'cancelled'],
  approved: ['processing', 'cancelled'],
  processing: ['success', 'failed', 'reversed'],
  success: ['reversed'],
  failed: ['approved', 'cancelled'],
  reversed: [],
  cancelled: [],
} as const

export function assertTransition<
  TMap extends Record<string, readonly string[]>,
  TState extends keyof TMap & string,
>(
  transitions: TMap,
  from: TState,
  to: string,
  entity: string
): void {
  if (!transitions[from]?.includes(to)) {
    throw new FinancialError(
      'INVALID_STATE',
      `${entity} cannot transition from ${from} to ${to}`,
      409
    )
  }
}
