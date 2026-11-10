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
export const backupPath = (file: string, now: Date): string =>
  `${file}.bak-${now.toISOString().replace(/[:.]/g, '-')}`

/** Deletes a database file and its journal files. */
const removeFile = (file: string): void => {
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
 * Why opening the database failed, worded for the
 * startup dialog: the innermost cause's message (for
 * SQLite, its own reason rather than the SQL), the
 * migration that failed, and the backup, if any.
 */
export class OpenDatabaseError extends Error {
  constructor(
    readonly reason: string,
    readonly migration: string | undefined,
    readonly backup: string | undefined,
    cause: unknown
  ) {
    super(reason, { cause })
    this.name = 'OpenDatabaseError'
  }
}

/** The message of the innermost `cause` in a chain. */
const innermostReason = (error: unknown): string => {
  let inner = error
  while (inner instanceof Error && inner.cause)
    inner = inner.cause
  return inner instanceof Error
    ? inner.message
    : String(inner)
}

/** The pending migration that ran the failed query. */
const failedMigration = (
  error: unknown,
  folder: string
): string | undefined => {
  const query = (error as { query?: unknown }).query
  if (typeof query !== 'string') return undefined
  try {
    return readMigrationFiles({ migrationsFolder: folder })
      .find(migration => migration.sql.some(
        statement => statement.trim() === query.trim()
      ))?.name
  } catch {
    return undefined
  }
}

/**
 * Opens the database and applies pending migrations.
 * An existing file is first copied to `backupPath`.
 * Migrations run in one transaction: if one fails, it
 * rolls back, the database is closed and an
 * `OpenDatabaseError` is thrown, so the app never opens
 * a half-migrated file. Drizzle creates its bookkeeping
 * table before that transaction, so a file this call
 * created is removed.
 */
export const openDatabase = ({
  file,
  migrationsFolder,
  now = () => new Date()
}: OpenOptions): Database => {
  const existed = file !== ':memory:' && existsSync(file)
  const client = new DatabaseSync(file)
  let backup: string | undefined
  try {
    const pending = pendingMigrations(
      client,
      migrationsFolder
    )
    if (pending.length > 0 && existed) {
      backup = backupPath(file, now())
      copyFileSync(file, backup)
    }
    const db = drizzle({ client })
    migrate(db, { migrationsFolder })
    return db
  } catch (error) {
    client.close()
    if (file !== ':memory:' && !existed) removeFile(file)
    throw new OpenDatabaseError(
      innermostReason(error),
      failedMigration(error, migrationsFolder),
      backup,
      error
    )
  }
}

/** The startup dialog's text for a failed open. */
export const openErrorMessage = (
  error: unknown
): string => {
  if (!(error instanceof OpenDatabaseError)) {
    return `Your data was not changed.\n\n`
      + `Details: ${innermostReason(error)}`
  }
  const copy = error.backup
    ? ` A copy was saved to\n${error.backup}`
    : ''
  const migration = error.migration
    ? `\n(migration ${error.migration})`
    : ''
  return `Your data was not changed.${copy}\n\n`
    + `Details: ${error.reason}${migration}`
}
