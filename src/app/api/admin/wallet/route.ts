import { NextRequest, NextResponse } from 'next/server'
import { getConnection } from '@/lib/db'
import type { RowDataPacket } from 'mysql2/promise'
import { requireAdminApi, unauthorized, logAdminAction } from '@/lib/admin'

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdminApi()
    const body = await request.json()
    const { uid, amount, description, type } = body

    if (!uid || !amount || !type || !['credit', 'debit'].includes(type)) {
      return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 })
    }

    const ngnAmount = Math.abs(Number(amount))
    if (ngnAmount <= 0 || ngnAmount > 10_000_000) {
      return NextResponse.json({ success: false, error: 'Amount must be between 1 and 10,000,000' }, { status: 400 })
    }

    const conn = await getConnection()
    try {
      await conn.execute('BEGIN')

      const [userRows] = await conn.execute<RowDataPacket[]>(
        'SELECT userId FROM users WHERE uid = ? AND deleted = 0 FOR UPDATE', [uid]
      )
      const userRow = userRows[0] as { userId: number } | undefined
      if (!userRow) {
        await conn.execute('ROLLBACK')
        return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
      }

      const [walletRows] = await conn.execute<RowDataPacket[]>(
        'SELECT id FROM wallets WHERE user_id = ? AND wallet_type = ? FOR UPDATE', [userRow.userId, 'user']
      )
      const wallet = walletRows[0] as { id: number } | undefined
      if (!wallet) {
        await conn.execute('ROLLBACK')
        return NextResponse.json({ success: false, error: 'Wallet not found' }, { status: 404 })
      }

      const ref = `admin_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

      const [ledgerRows] = await conn.execute<RowDataPacket[]>(
        'SELECT COALESCE(SUM(CASE WHEN direction = ? THEN amount ELSE -amount END), 0) AS balance FROM wallet_ledger WHERE wallet_id = ?',
        ['credit', wallet.id]
      )
      const currentBalance = (ledgerRows[0] as { balance: number } | undefined)?.balance ?? 0

      if (type === 'debit' && currentBalance < ngnAmount) {
        await conn.execute('ROLLBACK')
        return NextResponse.json({ success: false, error: 'Insufficient balance' }, { status: 400 })
      }

      const balanceAfter = type === 'credit' ? currentBalance + ngnAmount : currentBalance - ngnAmount

      await conn.execute(
        `INSERT INTO wallet_ledger (wallet_id, amount, direction, balance_after, description, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [wallet.id, ngnAmount, type, balanceAfter, ref]
      )

      await conn.execute(
        `INSERT INTO wallet_transactions (reference, type, status, metadata, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [ref, `admin_${type}`, 'success', JSON.stringify({ adminUid: session.id, description: description || `Admin ${type}` })]
      )

      await conn.execute('COMMIT')

      await logAdminAction(session.id, `wallet_${type}`, 'wallet', uid, { amount: ngnAmount, description })

      return NextResponse.json({ success: true, data: { reference: ref, balanceAfter } })
    } catch (txErr) {
      await conn.execute('ROLLBACK').catch(() => {})
      throw txErr
    } finally {
      conn.release()
    }
  } catch (err) {
    console.error('admin wallet POST error:', err)
    if (err instanceof Error && err.message === 'Unauthorized') return unauthorized()
    return NextResponse.json({ success: false, error: 'Something went wrong' }, { status: 500 })
  }
}
