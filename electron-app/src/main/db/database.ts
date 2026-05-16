import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'
import schema from './schema.sql?raw'

let db: Database.Database | null = null
let dbPath: string | null = null

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.')
  return db
}

export function getDbPath(): string {
  if (!dbPath) throw new Error('Database not initialized. Call initDatabase() first.')
  return dbPath
}

export function initDatabase(): void {
  const userDataPath = app.getPath('userData')
  mkdirSync(userDataPath, { recursive: true })
  dbPath = join(userDataPath, 'zazzy-pos.db')

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')  // wait up to 5s instead of throwing immediately

  db.exec(schema)

  // Column migrations — safe for existing databases
  const cols = db.prepare('PRAGMA table_info(pos_customers)').all() as { name: string }[]
  if (!cols.find((c) => c.name === 'type')) {
    db.exec("ALTER TABLE pos_customers ADD COLUMN type TEXT DEFAULT 'customer'")
  }

  const mediaCols = db.prepare('PRAGMA table_info(media)').all() as { name: string }[]
  if (!mediaCols.find((c) => c.name === 'local_path')) {
    db.exec('ALTER TABLE media ADD COLUMN local_path TEXT')
  }

  const invoiceCols = db.prepare('PRAGMA table_info(sales_invoices)').all() as { name: string }[]
  if (!invoiceCols.find((c) => c.name === 'split_payments')) {
    db.exec('ALTER TABLE sales_invoices ADD COLUMN split_payments TEXT DEFAULT NULL')
  }
}
