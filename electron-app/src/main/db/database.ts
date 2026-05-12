import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
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
  dbPath = join(app.getPath('userData'), 'zazzy-pos.db')

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')  // wait up to 5s instead of throwing immediately

  db.exec(schema)
}
