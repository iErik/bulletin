import {
  cpSync,
  mkdtempSync,
  readdirSync,
  rmSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { Database } from './database'
import { openDatabase } from './database'
import { listHabitEntries, listHabits } from './habits'
import { migrationsFolder } from './testing'

/**
 * The last migration before Archive Periods. The test
 * seeds the schema it leaves, then applies the rest.
 */
const BEFORE = '20261124032143_habit_goal'

describe('the Archive Period migration', () => {
  let dir: string | undefined
  afterEach(() => {
    if (dir !== undefined)
      rmSync(dir, { recursive: true, force: true })
  })

  it('opens a period from the day after the last Entry',
    async () => {
      dir = mkdtempSync(join(tmpdir(), 'bulletin-habits-'))
      const folder = join(dir, 'migrations')
      cpSync(migrationsFolder, folder, { recursive: true })
      // Only the three Archive Period migrations, so
      // later tables like sleep_quality don't count.
      const later = readdirSync(folder)
        .filter(name => name > BEFORE)
        .filter(name =>
          /habit_archive|drop_habits_archived/
            .test(name)
        )
      expect(later).toHaveLength(3)
      for (const name of later)
        rmSync(join(folder, name), { recursive: true })

      const file = join(dir, 'bulletin.db')
      const seeded = openDatabase({
        file,
        migrationsFolder: folder
      })
      seed(seeded)
      seeded.$client.close()

      for (const name of later) {
        cpSync(
          join(migrationsFolder, name),
          join(folder, name),
          { recursive: true }
        )
      }
      const db = openDatabase({
        file,
        migrationsFolder: folder
      })

      expect(await listHabits(db, 'all')).toEqual([
        {
          id: 1,
          name: 'Walk',
          icon: 'walking',
          created: '2026-07-01',
          archived: false,
          archivePeriods: []
        },
        {
          id: 2,
          name: 'Run',
          icon: 'running',
          created: '2026-08-01',
          archived: true,
          archivePeriods: [
            { start: '2026-08-01', end: null }
          ]
        },
        {
          id: 3,
          name: 'Read',
          icon: 'reading',
          created: '2026-09-01',
          archived: true,
          archivePeriods: [
            { start: '2026-10-11', end: null }
          ]
        }
      ])
      expect(await listHabitEntries(db, {
        from: '2026-01-01',
        to: '2026-12-31'
      })).toEqual([
        { habitId: 1, date: '2026-07-15' },
        { habitId: 3, date: '2026-09-20' },
        { habitId: 3, date: '2026-10-10' }
      ])
      const columns = db.$client
        .prepare('PRAGMA table_info(habits)')
        .all()
        .map(row => String(row.name))
      expect(columns).toEqual([
        'id',
        'name',
        'icon',
        'created'
      ])
      const indexes = db.$client
        .prepare(
          'SELECT name FROM sqlite_master'
            + ' WHERE type = ? AND name = ?'
        )
        .all('index', 'habits_name')
        .map(row => String(row.name))
      expect(indexes).toEqual(['habits_name'])
      expect(() => db.$client.prepare(
        'INSERT INTO habits (name, icon, created)'
          + ' VALUES (?, ?, ?)'
      ).run('walk', 'walking', '2026-07-01'))
        .toThrow(/UNIQUE constraint failed/)
      db.$client.close()
    })
})

/** Archived and active Habits on the pre-migration schema. */
const seed = (db: Database): void => {
  const habit = db.$client.prepare(
    'INSERT INTO habits (name, icon, created, archived)'
      + ' VALUES (?, ?, ?, ?)'
  )
  habit.run('Walk', 'walking', '2026-07-01', 0)
  habit.run('Run', 'running', '2026-08-01', 1)
  habit.run('Read', 'reading', '2026-09-01', 1)
  const entry = db.$client.prepare(
    'INSERT INTO habit_entries (habit_id, date)'
      + ' VALUES (?, ?)'
  )
  entry.run(1, '2026-07-15')
  entry.run(3, '2026-09-20')
  entry.run(3, '2026-10-10')
}
