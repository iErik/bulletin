import {
  cpSync,
  mkdtempSync,
  readdirSync,
  rmSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it
} from 'vitest'
import { openDatabase, pendingMigrations, type Database }
  from './database'
import { getHabitGoal, setHabitGoal } from './habit-goal'
import {
  memoryDatabase,
  migrationsFolder
} from './testing'

let db: Database
beforeEach(() => {
  db = memoryDatabase()
})

const failsWith = (
  promise: Promise<unknown>,
  error: object
): Promise<void> =>
  expect(promise).rejects.toMatchObject({ error })

describe('getHabitGoal', () => {
  it('reads 75 when nothing is stored', async () => {
    expect(await getHabitGoal(db)).toBe(75)
  })
})

describe('setHabitGoal', () => {
  it('stores a goal and reads it back', async () => {
    expect(await setHabitGoal(db, 80)).toBe(80)
    expect(await getHabitGoal(db)).toBe(80)
  })

  it('replaces an existing goal', async () => {
    await setHabitGoal(db, 80)

    expect(await setHabitGoal(db, 65)).toBe(65)
    expect(await getHabitGoal(db)).toBe(65)
  })

  it.each([10, 100])('accepts %s', async percent => {
    expect(await setHabitGoal(db, percent)).toBe(percent)
    expect(await getHabitGoal(db)).toBe(percent)
  })

  it.each([
    5,
    105,
    77,
    72.5,
    '75',
    null,
    undefined,
    Number.NaN,
    { percent: 75 }
  ])('refuses %j without changing the stored value',
    async value => {
      await setHabitGoal(db, 80)

      await failsWith(setHabitGoal(db, value), {
        code: 'invalid-payload',
        field: ''
      })
      expect(await getHabitGoal(db)).toBe(80)
    })
})

describe('the habit_goal table', () => {
  it('keeps one row, 10 to 100 in steps of 5', () => {
    const insert = db.$client.prepare(
      'INSERT INTO habit_goal (id, percent) VALUES (?, ?)'
    )
    const clear = (): void => {
      db.$client.exec('DELETE FROM habit_goal')
    }

    insert.run(1, 10)
    clear()
    insert.run(1, 100)
    clear()

    expect(() => insert.run(1, 5))
      .toThrow(/CHECK constraint failed/)
    expect(() => insert.run(1, 105))
      .toThrow(/CHECK constraint failed/)
    expect(() => insert.run(1, 77))
      .toThrow(/CHECK constraint failed/)
    expect(() => insert.run(2, 75))
      .toThrow(/CHECK constraint failed/)
  })
})

describe('habit_goal migration', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'bulletin-goal-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('applies on top of existing migrations', async () => {
    const file = join(dir, 'bulletin.db')
    const prior = join(dir, 'migrations')
    cpSync(migrationsFolder, prior, { recursive: true })
    for (const entry of readdirSync(prior)) {
      if (entry.endsWith('_habit_goal'))
        rmSync(join(prior, entry), { recursive: true })
    }

    openDatabase({ file, migrationsFolder: prior })
      .$client.close()

    const migrated = openDatabase({
      file,
      migrationsFolder
    })
    expect(pendingMigrations(
      migrated.$client,
      migrationsFolder
    )).toEqual([])
    expect(await getHabitGoal(migrated)).toBe(75)
    expect(await setHabitGoal(migrated, 85)).toBe(85)
    migrated.$client.close()

    const reopened = openDatabase({
      file,
      migrationsFolder
    })
    expect(await getHabitGoal(reopened)).toBe(85)
    reopened.$client.close()
  })
})
