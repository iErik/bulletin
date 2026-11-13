import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it }
  from 'vitest'
import {
  backupPath,
  OpenDatabaseError,
  openDatabase,
  openErrorMessage,
  pendingMigrations,
  type Database
} from './database'
import {
  memoryDatabase,
  migrationsFolder
} from './testing'

const now = new Date('2026-06-15T12:34:56.789Z')
let dir: string
let file: string
let folder: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'bulletin-db-'))
  file = join(dir, 'bulletin.db')
  folder = join(dir, 'migrations')
  cpSync(migrationsFolder, folder, { recursive: true })
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

const open = (): Database =>
  openDatabase({
    file,
    migrationsFolder: folder,
    now: () => now
  })

/** Adds a migration to the temp folder. */
const addMigration = (name: string, sql: string): void => {
  mkdirSync(join(folder, name))
  writeFileSync(join(folder, name, 'migration.sql'), sql)
}

const backups = (): string[] =>
  readdirSync(dir).filter(name => name.includes('.bak-'))

describe('openDatabase', () => {
  it('creates and migrates a new file', () => {
    const db = open()

    const tables = db.$client
      .prepare('SELECT name FROM sqlite_master')
      .all()
      .map(row => row.name)

    expect(existsSync(file)).toBe(true)
    expect(tables).toContain('weight')
    expect(tables).toContain('__drizzle_migrations')
    expect(backups()).toEqual([])
  })

  it('keeps one Weight Entry per day', () => {
    const insert = open().$client.prepare(
      'INSERT INTO weight (date, grams) VALUES (?, ?)'
    )

    expect(() => insert.run(null, 70000)).toThrow()
    insert.run('2026-06-15', 70000)
    expect(() => insert.run('2026-06-15', 71000))
      .toThrow()
  })

  it('opens a migrated in-memory database', () => {
    const db = memoryDatabase()

    expect(pendingMigrations(db.$client, folder))
      .toEqual([])
  })

  it('backs up before pending migrations', () => {
    open().$client.close()
    const before = readFileSync(file)
    addMigration(
      '20990101000000_next',
      'CREATE TABLE next (id integer);'
    )

    open().$client.close()

    const backup = backupPath(file, now)
    expect(backup).toBe(
      `${file}.bak-2026-06-15T12-34-56-789Z`
    )
    expect(readFileSync(backup)).toEqual(before)
  })

  it('skips the backup with nothing pending', () => {
    open().$client.close()
    open().$client.close()

    expect(backups()).toEqual([])
  })

  it('leaves the file unchanged when one fails', () => {
    open().$client.close()
    const before = readFileSync(file)
    addMigration(
      '20990101000000_ok',
      'CREATE TABLE ok (id integer);'
    )
    addMigration(
      '20990102000000_broken',
      'CREATE TABLE ok (id integer);'
    )

    expect(open).toThrow()

    expect(readFileSync(file)).toEqual(before)
  })

  it('removes a new file when the first one fails', () => {
    rmSync(folder, { recursive: true })
    mkdirSync(folder)
    addMigration('20990101000000_broken', 'CREATE TABLE (')

    expect(open).toThrow()

    expect(readdirSync(dir)).toEqual(['migrations'])
  })

  it('reports why a migration failed', () => {
    open().$client.close()
    addMigration(
      '20990101000000_ok',
      'CREATE TABLE ok (id integer);'
    )
    addMigration(
      '20990102000000_broken',
      'CREATE TABLE ok (name text);'
    )

    const error = catchError(open)

    expect(error).toBeInstanceOf(OpenDatabaseError)
    expect(error).toMatchObject({
      reason: 'table ok already exists',
      migration: '20990102000000_broken',
      backup: backupPath(file, now)
    })
  })
})

/** Runs `fn` and returns what it throws. */
const catchError = (fn: () => unknown): unknown => {
  try {
    fn()
  } catch (error) {
    return error
  }
  throw new Error('expected a throw')
}

describe('openErrorMessage', () => {
  it('names the reason, migration and copy', () => {
    const error = new OpenDatabaseError(
      'disk I/O error',
      '20990101000000_next',
      '/data/bulletin.db.bak-1',
      undefined
    )

    expect(openErrorMessage(error)).toBe(
      'Your data was not changed. A copy was saved'
        + ' to\n/data/bulletin.db.bak-1\n\n'
        + 'Details: disk I/O error\n'
        + '(migration 20990101000000_next)'
    )
  })

  it('leaves out what is unknown', () => {
    const error = new OpenDatabaseError(
      'database is locked',
      undefined,
      undefined,
      undefined
    )

    expect(openErrorMessage(error)).toBe(
      'Your data was not changed.\n\n'
        + 'Details: database is locked'
    )
  })

  it('says where the log file is', () => {
    const error = new OpenDatabaseError(
      'database is locked',
      undefined,
      undefined,
      undefined
    )

    expect(openErrorMessage(error, '/logs/main.log')).toBe(
      'Your data was not changed.\n\n'
        + 'Details: database is locked\n\n'
        + 'The full error is in this log file:\n'
        + '/logs/main.log'
    )
    expect(openErrorMessage(new Error('x'), '/a.log'))
      .toBe('Your data was not changed.\n\nDetails: x'
        + '\n\nThe full error is in this log file:\n/a.log')
  })

  it('falls back to the innermost cause', () => {
    const error = new Error('outer', {
      cause: new Error('inner')
    })

    expect(openErrorMessage(error)).toBe(
      'Your data was not changed.\n\nDetails: inner'
    )
  })
})
