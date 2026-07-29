import { config } from 'dotenv'

config({ path: ['.env.local', '.env.production', '.env'], quiet: true })

// The worker secret is not used for provider verification, but the complete
// financial configuration is validated when the Paystack gateway is loaded.
process.env.FINANCIAL_WORKER_SECRET ??=
  'local-wallet-reconciliation-config-validation-only'

async function main() {
  const [{ reconcilePendingWalletFundings }, { default: pool }] = await Promise.all([
    import('../src/lib/financial/wallet-funding-service'),
    import('../src/lib/db'),
  ])
  try {
    const summary = await reconcilePendingWalletFundings(25)
    console.log(JSON.stringify({ status: 'complete', summary }, null, 2))
    if (summary.failed > 0) process.exitCode = 2
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
