import { describe, expect, it, vi } from 'vitest'
import { defineComponent, effectScope, type Ref } from 'vue'
import { mount } from '@vue/test-utils'
import type { DataSource } from '@shared/data-sources'
import { stubBulletin } from '@/testing/bulletin'
import { useDataVersion } from './use-data-version'

const mountVersion = (...sources: DataSource[]): {
  version: Readonly<Ref<number>>
  unmount: () => void
} => {
  let version!: Readonly<Ref<number>>
  const Host = defineComponent(() => {
    version = useDataVersion(...sources)
    return () => null
  })
  const wrapper = mount(Host)
  return { version, unmount: () => wrapper.unmount() }
}

describe('useDataVersion', () => {
  it('increments for subscribed sources only', async () => {
    const api = stubBulletin()
    const { version, unmount } = mountVersion(
      'sleep', 'sleepGoal')

    expect(version.value).toBe(0)
    await api.mood.create({
      date: '2026-01-01', mood: 'happy'
    })
    vi.mocked(api.sleep.delete).mockResolvedValueOnce({
      ok: false, error: { code: 'not-found' }
    })
    await api.sleep.delete(1)
    expect(version.value).toBe(0)

    await api.sleep.create({ start: 1, end: 2 })
    expect(version.value).toBe(1)
    await api.sleep.setGoal(480)
    expect(version.value).toBe(2)
    unmount()
  })

  it('unsubscribes on unmount and scope stop', async () => {
    const api = stubBulletin()
    const mounted = mountVersion('weight')
    const scope = effectScope()
    const scoped = scope.run(() => useDataVersion('tasks'))!

    await api.weight.delete('2026-01-01')
    await api.tasks.delete(1)
    expect(mounted.version.value).toBe(1)
    expect(scoped.value).toBe(1)

    mounted.unmount()
    scope.stop()
    await api.weight.delete('2026-01-01')
    await api.tasks.delete(1)
    expect(mounted.version.value).toBe(1)
    expect(scoped.value).toBe(1)
  })
})
