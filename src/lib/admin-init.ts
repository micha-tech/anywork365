import { getConnection } from './db'

let _adminInitDone = false

export async function ensureAdminTables(): Promise<void> {
  if (_adminInitDone) return
  _adminInitDone = true

  try {
    const conn = await getConnection()

    await conn.execute(
      `ALTER TABLE users ADD COLUMN role ENUM('client','vendor','admin') DEFAULT NULL AFTER hasBusinessAccount`
    ).catch(() => {})

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS disputes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        bookingId INT NOT NULL,
        clientUid VARCHAR(128) NOT NULL,
        vendorUid VARCHAR(128) NOT NULL,
        raisedBy VARCHAR(128) NOT NULL,
        reason TEXT NOT NULL,
        status ENUM('open','investigating','resolved','dismissed') DEFAULT 'open',
        resolution TEXT,
        resolvedBy VARCHAR(128),
        resolvedAt DATETIME,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `)

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS admin_audit_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        adminUid VARCHAR(128) NOT NULL,
        action VARCHAR(255) NOT NULL,
        targetType VARCHAR(64),
        targetId VARCHAR(128),
        details JSON,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    conn.release()
  } catch (err) {
    console.error('ensureAdminTables error:', err)
  }
}
