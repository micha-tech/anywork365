import { z } from 'zod'

const positiveInteger = z.coerce.number().int().positive()
const nonnegativeInteger = z.coerce.number().int().nonnegative()

const financialConfigSchema = z.object({
  PAYSTACK_SECRET_KEY: z.string().min(10),
  PAYSTACK_PUBLIC_KEY: z.string().min(10),
  PAYSTACK_WEBHOOK_SECRET_OR_SIGNATURE_CONFIGURATION: z
    .literal('paystack-secret-key-hmac-sha512')
    .default('paystack-secret-key-hmac-sha512'),
  PAYSTACK_BASE_URL: z.string().url().default('https://api.paystack.co'),
  PAYSTACK_ENVIRONMENT: z.enum(['test', 'live']),
  DEFAULT_CURRENCY: z.literal('NGN').default('NGN'),
  MINIMUM_WITHDRAWAL_AMOUNT: positiveInteger.default(500),
  MAXIMUM_WITHDRAWAL_AMOUNT: positiveInteger.default(5_000_000),
  DAILY_WITHDRAWAL_LIMIT: positiveInteger.default(1_000_000),
  MONTHLY_WITHDRAWAL_LIMIT: positiveInteger.default(5_000_000),
  DEFAULT_WITHDRAWAL_HOLD_HOURS: nonnegativeInteger.default(72),
  BANK_CHANGE_HOLD_HOURS: nonnegativeInteger.default(24),
  AUTOMATIC_WITHDRAWAL_LIMIT: nonnegativeInteger.default(200_000),
  PLATFORM_FEE_RULE: z.string().min(1).default('marketplace-standard'),
  WITHDRAWAL_MODE: z.enum(['AUTOMATIC', 'MANUAL', 'RISK_BASED']).default('RISK_BASED'),
  RECONCILIATION_SCHEDULE: z.string().min(1).default('*/5 * * * *'),
  WEBHOOK_MAX_ATTEMPTS: positiveInteger.default(10),
  FINANCIAL_EVENT_RETENTION_DAYS: positiveInteger.default(2555),
  FINANCIAL_WORKER_SECRET: z.string().min(32),
})

export type FinancialConfig = z.infer<typeof financialConfigSchema>

let cached: FinancialConfig | null = null

export function getFinancialConfig(): FinancialConfig {
  if (cached) return cached
  const inferredEnvironment = process.env.PAYSTACK_SECRET_KEY?.startsWith('sk_live_')
    ? 'live'
    : 'test'
  const parsed = financialConfigSchema.safeParse({
    ...process.env,
    PAYSTACK_PUBLIC_KEY:
      process.env.PAYSTACK_PUBLIC_KEY || process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
    PAYSTACK_ENVIRONMENT: process.env.PAYSTACK_ENVIRONMENT || inferredEnvironment,
    FINANCIAL_WORKER_SECRET:
      process.env.FINANCIAL_WORKER_SECRET || process.env.RECONCILIATION_SECRET,
  })
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ')
    throw new Error(`Invalid financial configuration: ${fields}`)
  }
  cached = parsed.data
  return cached
}

export function resetFinancialConfigForTests(): void {
  cached = null
}
