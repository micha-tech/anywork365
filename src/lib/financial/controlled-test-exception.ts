export type ControlledWithdrawalTestException = {
  active: boolean
  expiresAt: string | null
}

export function getControlledWithdrawalTestException(
  artisanUid: string
): ControlledWithdrawalTestException {
  const configuredUid = process.env.CONTROLLED_WITHDRAWAL_TEST_ARTISAN_UID?.trim()
  const configuredExpiry = process.env.CONTROLLED_WITHDRAWAL_TEST_EXPIRES_AT?.trim()

  if (!configuredUid || configuredUid !== artisanUid || !configuredExpiry) {
    return { active: false, expiresAt: null }
  }

  const expiresAtMs = Date.parse(configuredExpiry)
  if (!Number.isFinite(expiresAtMs) || Date.now() >= expiresAtMs) {
    return { active: false, expiresAt: configuredExpiry }
  }

  return { active: true, expiresAt: configuredExpiry }
}
