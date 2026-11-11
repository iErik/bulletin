import { describe, expect, it, vi } from 'vitest'
import { EXPENSES_CHANNELS } from '@shared/expenses'
import { HABITS_CHANNELS } from '@shared/habits'
import { MOOD_CHANNELS } from '@shared/mood'
import { SLEEP_CHANNELS } from '@shared/sleep'
import { WEIGHT_CHANNELS } from '@shared/weight'
import { StorageFailure } from './errors'
import { handleStorage, runOperation } from './ipc'
import { memoryDatabase } from './testing'

type Handler =
  (event: object, payload: unknown) => Promise<unknown>

const serve = () => {
  const handlers = new Map<string, Handler>()
  const ipc = {
    handle: vi.fn((channel: string, fn: Handler) => {
      handlers.set(channel, fn)
    })
  }
  handleStorage(ipc, memoryDatabase())
  return (channel: string, payload: unknown) =>
    handlers.get(channel)!({}, payload)
}

describe('runOperation', () => {
  const db = memoryDatabase()

  it('wraps the value', async () => {
    expect(await runOperation(async () => 1, db, null))
      .toEqual({ ok: true, value: 1 })
  })

  it('returns a typed failure', async () => {
    const fail = async (): Promise<never> => {
      throw new StorageFailure({ code: 'not-found' })
    }

    expect(await runOperation(fail, db, null)).toEqual({
      ok: false,
      error: { code: 'not-found' }
    })
  })

  it('hides unexpected errors', async () => {
    const log = vi.spyOn(console, 'error')
      .mockImplementation(() => {})
    const fail = async (): Promise<never> => {
      throw new Error('SQLITE_ERROR: no such table')
    }

    expect(await runOperation(fail, db, null)).toEqual({
      ok: false,
      error: { code: 'internal' }
    })
    expect(log).toHaveBeenCalledOnce()
    log.mockRestore()
  })
})

describe('handleStorage', () => {
  it('handles every Weight channel', async () => {
    const call = serve()
    const entry = { date: '2026-01-01', grams: 70_000 }

    expect(await call(WEIGHT_CHANNELS.create, entry))
      .toEqual({ ok: true, value: entry })
    expect(await call(WEIGHT_CHANNELS.update, entry))
      .toEqual({ ok: true, value: entry })
    expect(await call(WEIGHT_CHANNELS.list, {
      from: '2026-01-01',
      to: '2026-01-01'
    })).toEqual({ ok: true, value: [entry] })
    expect(await call(WEIGHT_CHANNELS.delete, entry.date))
      .toEqual({ ok: true, value: null })
  })

  it('handles every Sleep channel', async () => {
    const call = serve()
    const start = new Date(2026, 0, 1, 23).getTime()
    const end = start + 8 * 60 * 60 * 1000
    const period = { id: 1, start, end }

    expect(await call(SLEEP_CHANNELS.create, {
      start,
      end
    })).toEqual({ ok: true, value: period })
    expect(await call(SLEEP_CHANNELS.update, period))
      .toEqual({ ok: true, value: period })
    expect(await call(SLEEP_CHANNELS.list, {
      from: '2026-01-01',
      to: '2026-01-01'
    })).toEqual({ ok: true, value: [period] })
    expect(await call(SLEEP_CHANNELS.delete, 1))
      .toEqual({ ok: true, value: null })
  })

  it('handles every Mood channel', async () => {
    const call = serve()
    const entry = { date: '2026-01-01', mood: 'okay' }

    expect(await call(MOOD_CHANNELS.create, entry))
      .toEqual({ ok: true, value: entry })
    expect(await call(MOOD_CHANNELS.update, entry))
      .toEqual({ ok: true, value: entry })
    expect(await call(MOOD_CHANNELS.list, {
      from: '2026-01-01',
      to: '2026-01-01'
    })).toEqual({ ok: true, value: [entry] })
    expect(await call(MOOD_CHANNELS.delete, entry.date))
      .toEqual({ ok: true, value: null })
  })

  it('handles every Habits channel', async () => {
    const call = serve()
    const habit = { name: 'Read', icon: 'reading' }
    const entry = { habitId: 1, date: '2026-01-01' }
    const ok = (value: unknown): object =>
      ({ ok: true, value })

    expect(await call(HABITS_CHANNELS.create, habit))
      .toMatchObject(ok({ id: 1, ...habit }))
    expect(await call(HABITS_CHANNELS.update, {
      id: 1,
      icon: 'study'
    })).toMatchObject(ok({ icon: 'study' }))
    expect(await call(HABITS_CHANNELS.createEntry, entry))
      .toEqual(ok(entry))
    expect(await call(HABITS_CHANNELS.listEntries, {
      from: '2026-01-01',
      to: '2026-01-01'
    })).toEqual(ok([entry]))
    expect(await call(HABITS_CHANNELS.deleteEntry, entry))
      .toEqual(ok(null))
    expect(await call(HABITS_CHANNELS.archive, 1))
      .toMatchObject(ok({ archived: true }))
    expect(await call(HABITS_CHANNELS.unarchive, 1))
      .toMatchObject(ok({ archived: false }))
    expect(await call(HABITS_CHANNELS.list, 'active'))
      .toMatchObject(ok([{ id: 1 }]))
  })

  it('handles every Expenses channel', async () => {
    const call = serve()
    const transaction = {
      date: '2026-01-01',
      description: 'Salary',
      categoryId: 1,
      amount: 2_500_000
    }
    const ok = (value: unknown): object =>
      ({ ok: true, value })

    expect(await call(
      EXPENSES_CHANNELS.create,
      transaction
    )).toEqual(ok({ id: 1, ...transaction }))
    expect(await call(EXPENSES_CHANNELS.update, {
      ...transaction,
      id: 1,
      amount: -3000
    })).toMatchObject(ok({ amount: -3000 }))
    expect(await call(EXPENSES_CHANNELS.list, {
      from: '2026-01-01',
      to: '2026-01-01'
    })).toMatchObject(ok([{ id: 1 }]))
    expect(await call(EXPENSES_CHANNELS.delete, 1))
      .toEqual(ok(null))
    expect(await call(
      EXPENSES_CHANNELS.createCategory,
      'Books'
    )).toEqual(ok({ id: 10, name: 'Books' }))
    expect(await call(
      EXPENSES_CHANNELS.listCategories,
      undefined
    )).toMatchObject(ok(
      expect.arrayContaining([{ id: 10, name: 'Books' }])
    ))
  })

  it('rejects invalid payloads', async () => {
    const call = serve()

    expect(await call(WEIGHT_CHANNELS.create, {}))
      .toMatchObject({
        ok: false,
        error: { code: 'invalid-payload' }
      })
  })
})
