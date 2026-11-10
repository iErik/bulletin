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
  openDatabase,
  pendingMigrations
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

const open = () =>
  openDatabase({
    file,
    migrationsFolder: folder,
    now: () => now
  })

/** Adds a migration to the temp folder. */
const addMigration = (name: string, sql: string) => {
  mkdirSync(join(folder, name))
  writeFileSync(join(folder, name, 'migration.sql'), sql)
}

const backups = () =>
  readdirSync(dir).filter(name => name.includes('.bak-'))

describe('openDatabase', () => {
  it('creates and migrates a new file', () => {
    const db = open()

    const tables = db.$client
      .prepare("SELECT name FROM sqlite_master")
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
})
