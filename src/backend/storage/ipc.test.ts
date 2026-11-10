import { describe, expect, it, vi } from 'vitest'
import { SLEEP_CHANNELS } from '@shared/sleep'
import { WEIGHT_CHANNELS } from '@shared/weight'
import { StorageFailure } from './errors'
import { handleStorage, runOperation } from './ipc'
import { memoryDatabase } from './testing'

type Handler = (event: object, payload: unknown) =>
  Promise<unknown>

const serve = () => {
  const handlers = new Map<string, Handler>()
  const ipc = {
    handle: vi.fn((channel: string, fn: Handler) => {
      handlers.set(channel, fn)
    })
  }
  handleStorage(ipc as never, memoryDatabase())
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
    const fail = async () => {
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
    const fail = async () => {
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

  it('rejects invalid payloads', async () => {
    const call = serve()

    expect(await call(WEIGHT_CHANNELS.create, {}))
      .toMatchObject({
        ok: false,
        error: { code: 'invalid-payload' }
      })
  })
})
