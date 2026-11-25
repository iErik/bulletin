import { describe, expect, it, vi } from 'vitest'
import type { DataSource } from '@shared/data-sources'
import { fakeBulletin, stubBulletin } from './bulletin'

describe('fakeBulletin', () => {
  it('signals after successful writes, not reads/errors',
    async () => {
      const api = fakeBulletin()
      const seen: DataSource[] = []
      api.onDataChange(source => seen.push(source))

      await api.weight.list({
        from: '2026-01-01', to: '2026-01-07'
      })
      vi.mocked(api.weight.delete).mockResolvedValueOnce({
        ok: false, error: { code: 'not-found' }
      })
      await api.weight.delete('2026-01-01')
      await api.sleep.create({ start: 1, end: 2 })
      await api.sleep.setGoal(480)
      await api.expenses.createCategory('Food')
      await api.reminders.listDue({ from: 0, to: 1 })
      await api.reminders.markNotified({ kind: 'task', id: 1 })

      expect(seen).toEqual([
        'sleep', 'sleepGoal', 'categories', 'tasks'
      ])
    })

  it('preserves vi.mocked and call assertions', async () => {
    const api = fakeBulletin()
    const listener = vi.fn()
    api.onDataChange(listener)

    const entry = { date: '2026-01-01', grams: 70_000 }
    vi.mocked(api.weight.create).mockResolvedValue({
      ok: true, value: entry
    })

    expect(await api.weight.create(entry))
      .toEqual({ ok: true, value: entry })
    expect(api.weight.create).toHaveBeenCalledWith(entry)
    expect(listener).toHaveBeenCalledWith('weight')
  })

  it('rebinds notifications across spread overrides',
    async () => {
      const inner = stubBulletin()
      const innerListener = vi.fn()
      inner.onDataChange(innerListener)

      const list = vi.fn().mockResolvedValue({
        ok: true, value: []
      })
      const outer = stubBulletin({
        sleep: { ...inner.sleep, list }
      })
      const outerListener = vi.fn()
      outer.onDataChange(outerListener)

      await outer.sleep.create({ start: 1, end: 2 })

      expect(outerListener).toHaveBeenCalledTimes(1)
      expect(outerListener).toHaveBeenCalledWith('sleep')
      expect(innerListener).not.toHaveBeenCalled()
      expect(outer.sleep.create).toHaveBeenCalledTimes(1)
    })

  it('wraps custom write overrides and supports stop',
    async () => {
      const create = vi.fn().mockResolvedValue({
        ok: true, value: { date: '2026-01-01', mood: 'happy' }
      })
      const api = fakeBulletin({
        mood: { ...fakeBulletin().mood, create }
      })
      const listener = vi.fn()
      const stop = api.onDataChange(listener)

      await api.mood.create({
        date: '2026-01-01', mood: 'happy'
      })
      stop()
      await api.mood.create({
        date: '2026-01-02', mood: 'okay'
      })

      expect(listener).toHaveBeenCalledTimes(1)
      expect(listener).toHaveBeenCalledWith('mood')
    })
})
