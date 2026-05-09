import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import schema from './schema.sql?raw'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.')
  return db
}

export function initDatabase(): void {
  const dbPath = join(app.getPath('userData'), 'zazzy-pos.db')

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(schema)
}
