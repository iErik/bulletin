import { beforeEach, describe, expect, it } from 'vitest'
import { HABIT_ICONS, type Habit } from '@shared/habits'
import type { Database } from './database'
import {
  archiveHabit,
  createHabit,
  listHabits,
  unarchiveHabit,
  updateHabit
} from './habits'
import { memoryDatabase } from './testing'

// Noon on 15 June 2026, local time.
const now = new Date(2026, 5, 15, 12)
const today = '2026-06-15'

let db: Database
beforeEach(() => {
  db = memoryDatabase()
})

const create = (value: unknown): Promise<Habit> =>
  createHabit(db, value, now)
const read = (): Promise<Habit> =>
  create({ name: 'Read', icon: 'reading' })
const failsWith = (
  promise: Promise<unknown>,
  error: object
): Promise<void> =>
  expect(promise).rejects.toMatchObject({ error })

describe('HABIT_ICONS', () => {
  it('has unique keys', () => {
    expect(new Set(HABIT_ICONS).size)
      .toBe(HABIT_ICONS.length)
  })
})

describe('createHabit', () => {
  it('saves a trimmed name, dated today', async () => {
    const habit = await create({
      name: '  Read  ',
      icon: 'reading'
    })

    expect(habit).toEqual({
      id: 1,
      name: 'Read',
      icon: 'reading',
      created: today,
      archived: false
    })
    expect(await listHabits(db, 'active'))
      .toEqual([habit])
  })

  it("rejects an active Habit's name", async () => {
    await read()

    await failsWith(
      create({ name: 'rEAD', icon: 'water' }),
      { code: 'name-taken', habit: 'active' }
    )
  })

  it('restores an archived Habit by name', async () => {
    const habit = await read()
    await archiveHabit(db, habit.id)

    const restored = await createHabit(
      db,
      { name: ' READ ', icon: 'study' },
      new Date(2026, 6, 1)
    )

    expect(restored).toEqual({
      ...habit,
      icon: 'study'
    })
    expect(await listHabits(db, 'active'))
      .toEqual([restored])
  })

  it.each([
    ['name', { name: '   ', icon: 'water' }],
    ['name', { icon: 'water' }],
    ['icon', { name: 'Drink', icon: 'beer' }],
    ['icon', { name: 'Drink' }],
    ['', { name: 'Drink', icon: 'water', id: 3 }],
    ['', null]
  ])('rejects an invalid %s: %j', (field, value) =>
    failsWith(create(value), {
      code: 'invalid-payload',
      field
    }))
})

describe('listHabits', () => {
  it('lists active or archived, oldest first', async () => {
    const run = await createHabit(
      db,
      { name: 'Run', icon: 'running' },
      new Date(2026, 5, 10)
    )
    const read2 = await read()
    const walk = await createHabit(
      db,
      { name: 'Walk', icon: 'walking' },
      new Date(2026, 5, 1)
    )
    await archiveHabit(db, read2.id)

    expect(await listHabits(db, 'active'))
      .toEqual([walk, run])
    expect(await listHabits(db, 'archived'))
      .toEqual([{ ...read2, archived: true }])
  })

  it('rejects an unknown status', () =>
    failsWith(listHabits(db, 'all'), {
      code: 'invalid-payload',
      field: ''
    }))
})

describe('updateHabit', () => {
  it('changes the name and icon', async () => {
    const { id } = await read()

    expect(await updateHabit(db, {
      id,
      name: ' Read books ',
      icon: 'study'
    })).toMatchObject({ name: 'Read books', icon: 'study' })
    expect(await updateHabit(db, { id, icon: 'reading' }))
      .toMatchObject({ name: 'Read books', icon: 'reading' })
  })

  it('may change only the case', async () => {
    const { id } = await read()

    expect(await updateHabit(db, { id, name: 'READ' }))
      .toMatchObject({ name: 'READ' })
  })

  it.each([
    ['active', false],
    ['archived', true]
  ])("rejects an %s Habit's name", async (
    habit,
    archived
  ) => {
    const taken = await read()
    if (archived) await archiveHabit(db, taken.id)
    const { id } = await create({
      name: 'Run',
      icon: 'running'
    })

    await failsWith(
      updateHabit(db, { id, name: 'read' }),
      { code: 'name-taken', habit }
    )
  })

  it('rejects a missing Habit', () =>
    failsWith(updateHabit(db, { id: 9, icon: 'yoga' }), {
      code: 'not-found'
    }))

  it.each([
    ['', { id: 1 }],
    ['name', { id: 1, name: '' }],
    ['icon', { id: 1, icon: 'beer' }],
    ['id', { id: 0, icon: 'yoga' }]
  ])('rejects an invalid %s: %j', (field, value) =>
    failsWith(updateHabit(db, value), {
      code: 'invalid-payload',
      field
    }))
})

describe('archiveHabit and unarchiveHabit', () => {
  it('archive and restore a Habit', async () => {
    const habit = await read()

    expect(await archiveHabit(db, habit.id))
      .toEqual({ ...habit, archived: true })
    expect(await listHabits(db, 'active')).toEqual([])
    expect(await unarchiveHabit(db, habit.id))
      .toEqual(habit)
  })

  it('reject a missing Habit', async () => {
    await failsWith(archiveHabit(db, 9), {
      code: 'not-found'
    })
    await failsWith(unarchiveHabit(db, 9), {
      code: 'not-found'
    })
  })
})

describe('the habits table', () => {
  it('backs up the name rules', () => {
    const habit = db.$client.prepare(
      'INSERT INTO habits (name, icon, created)'
        + ' VALUES (?, ?, ?)'
    )
    habit.run('Read', 'reading', today)

    expect(() => habit.run('READ', 'reading', today))
      .toThrow(/UNIQUE constraint failed/)
    expect(() => habit.run(' ', 'reading', today))
      .toThrow(/CHECK constraint failed/)
  })
})
