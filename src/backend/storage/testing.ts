import { fileURLToPath } from 'node:url'
import { type Database, openDatabase } from './database'

/** The project's migrations folder. */
export const migrationsFolder = fileURLToPath(
  new URL('./migrations', import.meta.url)
)

/** A fresh, fully migrated in-memory database. */
export const memoryDatabase = (): Database =>
  openDatabase({ file: ':memory:', migrationsFolder })
