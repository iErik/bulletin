import { describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { stubBulletin } from '@/testing/bulletin'
import { useSleepGoalStore } from './sleep-goal'

const freshStore = (): ReturnType<
  typeof useSleepGoalStore
> => {
  setActivePinia(createPinia())
  return useSleepGoalStore()
}

const refused = {
  ok: false as const,
  error: { code: 'invalid-payload' as const, field: '' }
}

describe('useSleepGoalStore', () => {
  it('starts at 8 hours', () => {
    const store = freshStore()

    expect(store.minutes).toBe(8 * 60)
    expect(store.failed).toBe(false)
  })

  it('loads the stored goal', async () => {
    const api = stubBulletin()
    vi.mocked(api.sleep.getGoal).mockResolvedValue({
      ok: true,
      value: 7 * 60 + 30
    })
    const store = freshStore()

    await store.load()

    expect(store.minutes).toBe(7 * 60 + 30)
    expect(store.failed).toBe(false)
  })

  it('flags a failed load and keeps 8 hours', async () => {
    const api = stubBulletin()
    vi.mocked(api.sleep.getGoal).mockResolvedValue({
      ok: false,
      error: { code: 'internal' }
    })
    const store = freshStore()

    await store.load()

    expect(store.failed).toBe(true)
    expect(store.minutes).toBe(8 * 60)
  })

  it('sets a new goal', async () => {
    const api = stubBulletin()
    const store = freshStore()

    await store.set(7 * 60 + 30)

    expect(store.minutes).toBe(7 * 60 + 30)
    expect(api.sleep.setGoal)
      .toHaveBeenCalledExactlyOnceWith(7 * 60 + 30)
  })

  it('keeps the previous goal when main refuses',
    async () => {
      const api = stubBulletin()
      vi.mocked(api.sleep.getGoal).mockResolvedValue({
        ok: true,
        value: 7 * 60 + 30
      })
      vi.mocked(api.sleep.setGoal)
        .mockResolvedValue(refused)
      const store = freshStore()
      await store.load()

      await store.set(3 * 60)

      expect(store.minutes).toBe(7 * 60 + 30)
      expect(store.failed).toBe(false)
    })
})
