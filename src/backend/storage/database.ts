import {
  copyFileSync,
  existsSync,
  rmSync
} from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { drizzle } from 'drizzle-orm/node-sqlite'
import { migrate } from 'drizzle-orm/node-sqlite/migrator'
import { readMigrationFiles } from 'drizzle-orm/migrator'

export type Database = ReturnType<typeof drizzle>

/** Drizzle's default migrations table. */
const MIGRATIONS_TABLE = '__drizzle_migrations'

/** Names of the migrations `client` has applied. */
const appliedMigrations = (
  client: DatabaseSync
): Set<string> => {
  const table = client
    .prepare(
      'SELECT 1 FROM sqlite_master'
        + ' WHERE type = ? AND name = ?'
    )
    .get('table', MIGRATIONS_TABLE)
  if (!table) return new Set()
  const rows = client
    .prepare(`SELECT name FROM ${MIGRATIONS_TABLE}`)
    .all()
  return new Set(rows.map(row => String(row.name)))
}

/** Names of the migrations in `folder` not yet applied. */
export const pendingMigrations = (
  client: DatabaseSync,
  folder: string
): string[] => {
  const applied = appliedMigrations(client)
  return readMigrationFiles({ migrationsFolder: folder })
    .map(migration => migration.name)
    .filter(name => !applied.has(name))
}

/** Where `file` is backed up before migrating. */
export const backupPath = (file: string, now: Date) =>
  `${file}.bak-${now.toISOString().replace(/[:.]/g, '-')}`

/** Deletes a database file and its journal files. */
const removeFile = (file: string) => {
  for (const suffix of ['', '-journal', '-wal', '-shm'])
    rmSync(file + suffix, { force: true })
}

export interface OpenOptions {
  /** The database file, or `:memory:`. */
  readonly file: string
  /** Drizzle's migrations folder. */
  readonly migrationsFolder: string
  readonly now?: () => Date
}

/**
 * Opens the database and applies pending migrations.
 * An existing file is first copied to `backupPath`.
 * Migrations run in one transaction: if one fails, it
 * rolls back, the database is closed and the error is
 * thrown, so the app never opens a half-migrated file.
 * Drizzle creates its bookkeeping table before that
 * transaction, so a file this call created is removed.
 */
export const openDatabase = ({
  file,
  migrationsFolder,
  now = () => new Date()
}: OpenOptions): Database => {
  const existed = file !== ':memory:' && existsSync(file)
  const client = new DatabaseSync(file)
  try {
    const pending = pendingMigrations(
      client,
      migrationsFolder
    )
    if (pending.length > 0 && existed)
      copyFileSync(file, backupPath(file, now()))
    const db = drizzle({ client })
    migrate(db, { migrationsFolder })
    return db
  } catch (error) {
    client.close()
    if (file !== ':memory:' && !existed) removeFile(file)
    throw error
  }
}
