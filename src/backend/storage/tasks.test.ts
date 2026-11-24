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
import { moveIncrement, type NewTask, type Task } from
  '@shared/tasks'
import {
  openDatabase,
  pendingMigrations,
  type Database
} from './database'
import {
  createTask,
  deleteTask,
  listSomedayTasks,
  listTasks,
  setTaskDone,
  updateTask
} from './tasks'
import { memoryDatabase, migrationsFolder } from './testing'

const now = new Date(2026, 5, 15, 12)
const created = now.getTime()

let db: Database
beforeEach(() => {
  db = memoryDatabase()
})

const create = (value: unknown): Promise<Task> =>
  createTask(db, value, now)
const failsWith = (
  promise: Promise<unknown>,
  error: object
): Promise<void> =>
  expect(promise).rejects.toMatchObject({ error })

const base = (o: Partial<NewTask> = {}): NewTask => ({
  title: 'Buy milk',
  day: '2026-06-15',
  time: null,
  ...o
})

const saved = (
  o: Partial<Task> & Pick<Task, 'id'>
): Task => ({
  title: 'Buy milk',
  day: '2026-06-15',
  time: null,
  doneAt: null,
  created,
  moves: 0,
  ...o
})

describe('moveIncrement', () => {
  it.each([
    ['2026-06-01', '2026-06-03', 1],
    ['2026-06-03', '2026-06-01', 0],
    ['2026-06-01', '2026-06-01', 0],
    [null, '2026-06-03', 0],
    ['2026-06-01', null, 0],
    [null, null, 0]
  ] as const)('%j → %j is %s', (from, to, n) => {
    expect(moveIncrement(from, to)).toBe(n)
  })
})

describe('createTask', () => {
  it('saves a day Task and a timed Someday Task',
    async () => {
      expect(await create(base())).toEqual(saved({ id: 1 }))
      expect(await create(base({
        day: null,
        time: '09:30'
      }))).toEqual(saved({
        id: 2,
        day: null,
        time: '09:30'
      }))
      expect(await create(base({ title: '  Walk  ' })))
        .toMatchObject({ title: 'Walk' })
    })

  it.each([
    ['title', { ...base(), title: '' }],
    ['title', { ...base(), title: '   ' }],
    ['day', { ...base(), day: '2026-02-30' }],
    ['time', { ...base(), time: '9:30' }],
    ['time', { ...base(), time: '24:00' }],
    ['', { ...base(), extra: true }],
    ['', null]
  ])('rejects an invalid %s: %j', (field, value) =>
    failsWith(create(value), {
      code: 'invalid-payload',
      field
    }))
})

describe('listTasks / listSomedayTasks', () => {
  it('orders by day, time, then id; Someday oldest',
    async () => {
      for (const task of [
        { title: 'Any A', day: '2026-06-02', time: null },
        { title: 'Late', day: '2026-06-02', time: '18:00' },
        { title: 'Early', day: '2026-06-02', time: '09:00' },
        { title: 'Any B', day: '2026-06-02', time: null },
        { title: 'Out', day: '2026-06-10', time: null }
      ] as const) await create(base(task))
      await createTask(db, base({
        title: 'Later',
        day: null
      }), new Date(2026, 5, 15, 12))
      await createTask(db, base({
        title: 'Earlier',
        day: null
      }), new Date(2026, 5, 14, 12))

      expect((await listTasks(db, {
        from: '2026-06-01',
        to: '2026-06-02'
      })).map(t => t.title)).toEqual([
        'Early',
        'Late',
        'Any A',
        'Any B'
      ])
      expect((await listSomedayTasks(db)).map(t => t.title))
        .toEqual(['Earlier', 'Later'])
    })

  it('rejects an invalid range', () =>
    failsWith(listTasks(db, { from: '2026-06-15' }), {
      code: 'invalid-payload',
      field: 'to'
    }))
})

describe('updateTask', () => {
  it('counts later-day moves; Someday does not',
    async () => {
      await create(base({ day: '2026-06-01', time: '10:00' }))
      expect(await updateTask(db, {
        id: 1,
        title: 'Walk',
        day: '2026-06-03',
        time: '07:00'
      })).toEqual(saved({
        id: 1,
        title: 'Walk',
        day: '2026-06-03',
        time: '07:00',
        moves: 1
      }))
      expect(await updateTask(db, { id: 1, day: '2026-06-02' }))
        .toMatchObject({ moves: 1, day: '2026-06-02' })
      expect(await updateTask(db, { id: 1, day: null }))
        .toMatchObject({ moves: 1, day: null, time: '07:00' })
      expect(await updateTask(db, { id: 1, day: '2026-06-10' }))
        .toMatchObject({ moves: 1, day: '2026-06-10' })
    })

  it('rejects a missing Task or empty change', async () => {
    await failsWith(updateTask(db, { id: 1, title: 'X' }), {
      code: 'not-found'
    })
    await create(base())
    await failsWith(updateTask(db, { id: 1 }), {
      code: 'invalid-payload',
      field: ''
    })
  })
})

describe('setTaskDone / deleteTask', () => {
  it('marks done, keeps first doneAt, clears, deletes',
    async () => {
      await create(base())
      expect(await setTaskDone(db, { id: 1, done: true }, now))
        .toEqual(saved({ id: 1, doneAt: created }))
      expect(await setTaskDone(
        db,
        { id: 1, done: true },
        new Date(2026, 5, 16, 12)
      )).toEqual(saved({ id: 1, doneAt: created }))
      expect(await setTaskDone(db, { id: 1, done: false }))
        .toEqual(saved({ id: 1, doneAt: null }))
      expect(await deleteTask(db, 1)).toBeNull()
      expect(await listTasks(db, {
        from: '2026-06-15',
        to: '2026-06-15'
      })).toEqual([])
    })

  it('rejects missing Tasks', async () => {
    await failsWith(
      setTaskDone(db, { id: 1, done: true }),
      { code: 'not-found' }
    )
    await failsWith(deleteTask(db, 1), { code: 'not-found' })
  })
})

describe('the tasks table', () => {
  it('rejects a blank title and negative moves', () => {
    const insert = db.$client.prepare(
      'INSERT INTO tasks '
      + '(title, day, time, done_at, created, moves) '
      + 'VALUES (?, ?, ?, ?, ?, ?)'
    )
    insert.run('Ok', '2026-06-15', null, null, created, 0)
    expect(() => insert.run(
      '   ',
      '2026-06-15',
      null,
      null,
      created,
      0
    )).toThrow(/CHECK constraint failed/)
    expect(() => insert.run(
      'Ok',
      '2026-06-15',
      null,
      null,
      created,
      -1
    )).toThrow(/CHECK constraint failed/)
  })
})

describe('tasks migration', () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'bulletin-tasks-'))
  })
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('persists a Task across restarts', async () => {
    const file = join(dir, 'bulletin.db')
    const folder = join(dir, 'migrations')
    cpSync(migrationsFolder, folder, { recursive: true })
    const first = openDatabase({
      file,
      migrationsFolder: folder
    })
    expect(pendingMigrations(first.$client, folder))
      .toEqual([])
    expect(await createTask(first, base({
      title: 'Ship',
      time: '14:00'
    }), now)).toEqual(saved({
      id: 1,
      title: 'Ship',
      time: '14:00'
    }))
    first.$client.close()
    const second = openDatabase({
      file,
      migrationsFolder: folder
    })
    expect(await listTasks(second, {
      from: '2026-06-15',
      to: '2026-06-15'
    })).toEqual([saved({
      id: 1,
      title: 'Ship',
      time: '14:00'
    })])
    expect(await deleteTask(second, 1)).toBeNull()
    second.$client.close()
  })
})
