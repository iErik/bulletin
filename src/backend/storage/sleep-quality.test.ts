import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it
} from 'vitest'
import { cpSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  SLEEP_QUALITY_STEPS,
  type SleepQualityEntry
} from '@shared/sleep-quality'
import {
  openDatabase,
  pendingMigrations,
  type Database
} from './database'
import {
  createSleepQuality,
  deleteSleepQuality,
  listSleepQuality
} from './sleep-quality'
import { memoryDatabase, migrationsFolder } from './testing'

// Noon on 15 June 2026, local time.
const now = new Date(2026, 5, 15, 12)
const today = '2026-06-15'

let db: Database
beforeEach(() => {
  db = memoryDatabase()
})

const create = (
  value: unknown
): Promise<SleepQualityEntry> =>
  createSleepQuality(db, value, now)
const all = (): Promise<SleepQualityEntry[]> =>
  listSleepQuality(db, { from: '2000-01-01', to: today })
const failsWith = (
  promise: Promise<unknown>,
  error: object
): Promise<void> =>
  expect(promise).rejects.toMatchObject({ error })

describe('SLEEP_QUALITY_STEPS', () => {
  it('is Poor to Great, values 1 to 5', () => {
    expect(SLEEP_QUALITY_STEPS.map(step => step.value))
      .toEqual([1, 2, 3, 4, 5])
    expect(SLEEP_QUALITY_STEPS.map(step => step.label))
      .toEqual(['Poor', 'Fair', 'Okay', 'Good', 'Great'])
  })
})

describe('createSleepQuality', () => {
  it.each(SLEEP_QUALITY_STEPS.map(step => step.value))(
    'saves the rating %s',
    async rating => {
      const entry = { date: today, rating }

      expect(await create(entry)).toEqual(entry)
      expect(await all()).toEqual([entry])
    }
  )

  it('replaces the same day', async () => {
    await create({ date: today, rating: 2 })
    await create({ date: today, rating: 4 })

    expect(await all()).toEqual([
      { date: today, rating: 4 }
    ])
  })

  it('rejects a future date', async () => {
    await failsWith(
      create({ date: '2026-06-16', rating: 4 }),
      { code: 'future-date' }
    )
    expect(await all()).toEqual([])
  })

  it.each([
    ['rating', { date: today, rating: 0 }],
    ['rating', { date: today, rating: 6 }],
    ['rating', { date: today, rating: 3.5 }],
    ['rating', { date: today, rating: '4' }],
    ['rating', { date: today }],
    ['date', { date: '2026-02-30', rating: 3 }],
    ['', { date: today, rating: 3, extra: true }],
    ['', null]
  ])('rejects an invalid %s: %j', (field, value) =>
    failsWith(create(value), {
      code: 'invalid-payload',
      field
    }))
})

describe('listSleepQuality', () => {
  it('lists the range, both ends included', async () => {
    for (const date of [
      '2026-05-31',
      '2026-06-03',
      '2026-06-01',
      '2026-06-10',
      '2026-06-11'
    ]) await create({ date, rating: 3 })

    const listed = await listSleepQuality(db, {
      from: '2026-06-01',
      to: '2026-06-10'
    })

    expect(listed.map(entry => entry.date)).toEqual([
      '2026-06-01',
      '2026-06-03',
      '2026-06-10'
    ])
  })

  it('rejects an invalid range', () =>
    failsWith(listSleepQuality(db, { from: today }), {
      code: 'invalid-payload',
      field: 'to'
    }))
})

describe('deleteSleepQuality', () => {
  it("clears the day's rating", async () => {
    await create({ date: today, rating: 4 })

    expect(await deleteSleepQuality(db, today)).toBeNull()
    expect(await all()).toEqual([])
  })

  it('rejects a day without an Entry', () =>
    failsWith(deleteSleepQuality(db, today), {
      code: 'not-found'
    }))
})

describe('the sleep_quality table', () => {
  it('keeps one Entry per day, 1 to 5, never undated',
    () => {
      const insert = db.$client.prepare(
        'INSERT INTO sleep_quality (date, rating) '
        + 'VALUES (?, ?)'
      )
      insert.run(today, 4)

      expect(() => insert.run(today, 2))
        .toThrow(/UNIQUE constraint failed/)
      expect(() => insert.run(null, 3))
        .toThrow(/CHECK constraint failed/)
      expect(() => insert.run('2026-06-14', 0))
        .toThrow(/CHECK constraint failed/)
      expect(() => insert.run('2026-06-14', 6))
        .toThrow(/CHECK constraint failed/)
    })
})

describe('sleep_quality migration', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'bulletin-sq-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('persists a rating across restarts', async () => {
    const file = join(dir, 'bulletin.db')
    const folder = join(dir, 'migrations')
    cpSync(migrationsFolder, folder, { recursive: true })

    const first = openDatabase({
      file,
      migrationsFolder: folder
    })
    expect(pendingMigrations(first.$client, folder))
      .toEqual([])
    expect(await createSleepQuality(
      first,
      { date: '2026-06-14', rating: 4 },
      now
    )).toEqual({ date: '2026-06-14', rating: 4 })
    first.$client.close()

    const second = openDatabase({
      file,
      migrationsFolder: folder
    })
    expect(await listSleepQuality(second, {
      from: '2026-06-01',
      to: '2026-06-30'
    })).toEqual([{ date: '2026-06-14', rating: 4 }])
    expect(await deleteSleepQuality(second, '2026-06-14'))
      .toBeNull()
    expect(await listSleepQuality(second, {
      from: '2026-06-01',
      to: '2026-06-30'
    })).toEqual([])
    second.$client.close()
  })
})
