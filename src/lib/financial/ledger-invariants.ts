export type JournalLine = {
  accountKey: string
  currency: string
  deltaMinor: bigint
}

export function assertBalancedJournal(lines: JournalLine[], currency = 'NGN'): void {
  if (lines.length < 2) throw new Error('A journal requires at least two entries')
  if (lines.some((line) => line.currency !== currency)) {
    throw new Error('Journal currencies do not match')
  }
  if (lines.some((line) => line.deltaMinor === BigInt(0))) {
    throw new Error('Journal entries cannot be zero')
  }
  const consolidated = consolidateJournal(lines)
  if (consolidated.length < 2) throw new Error('A journal requires at least two accounts')
  const total = consolidated.reduce((sum, line) => sum + line.deltaMinor, BigInt(0))
  if (total !== BigInt(0)) throw new Error('Journal is not balanced')
}

export function consolidateJournal(lines: JournalLine[]): JournalLine[] {
  const grouped = new Map<string, JournalLine>()
  for (const line of lines) {
    const current = grouped.get(line.accountKey)
    grouped.set(line.accountKey, {
      accountKey: line.accountKey,
      currency: line.currency,
      deltaMinor: (current?.deltaMinor ?? BigInt(0)) + line.deltaMinor,
    })
  }
  return [...grouped.values()].filter((line) => line.deltaMinor !== BigInt(0))
}
