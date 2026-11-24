import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'
import { contextBridge, ipcRenderer } from 'electron'
import {
  BRIDGE_KEY,
  WINDOW_CONTROLS_CHANNEL,
  type BulletinApi
} from '@shared/bridge'
import { WEIGHT_CHANNELS } from '@shared/weight'

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: vi.fn() },
  ipcRenderer: { send: vi.fn(), invoke: vi.fn() }
}))

const exposed = async (): Promise<BulletinApi> => {
  vi.resetModules()
  await import('./preload')
  const [key, api] = vi.mocked(
    contextBridge.exposeInMainWorld
  ).mock.lastCall ?? []

  expect(key).toBe(BRIDGE_KEY)
  return api as BulletinApi
}

describe('preload', () => {
  beforeEach(() => {
    vi.mocked(contextBridge.exposeInMainWorld).mockClear()
    vi.mocked(ipcRenderer.send).mockReset()
    vi.mocked(ipcRenderer.invoke).mockReset()
  })

  it('exposes the platform under BRIDGE_KEY', async () => {
    expect((await exposed()).platform)
      .toBe(process.platform)
  })

  it('sends window control colours over IPC', async () => {
    const colours = {
      background: '#101010',
      symbol: '#f0f0f0'
    }

    const api = await exposed()
    api.setWindowControlsColours(colours)

    expect(ipcRenderer.send).toHaveBeenCalledWith(
      WINDOW_CONTROLS_CHANNEL,
      colours
    )
  })

  it.each(Object.entries(WEIGHT_CHANNELS))(
    'invokes weight.%s on %s',
    async (method, channel) => {
      const api = await exposed()
      const call = api.weight[
        method as keyof BulletinApi['weight']
      ] as (payload: unknown) => unknown
      await call('payload')

      expect(ipcRenderer.invoke).toHaveBeenCalledWith(
        channel,
        'payload'
      )
    }
  )

  it.each([
    ['weight', 'create', 'weight'],
    ['sleep', 'setGoal', 'sleepGoal'],
    ['habits', 'createEntry', 'habitEntries'],
    ['expenses', 'createCategory', 'categories'],
    ['expenses', 'setBudget', 'budget'],
    ['tasks', 'setDone', 'tasks']
  ] as const)(
    'signals %s.%s as %s when ok',
    async (ns, method, expected) => {
      const ok = { ok: true, value: 'result' }
      vi.mocked(ipcRenderer.invoke).mockResolvedValue(ok)
      const api = await exposed()
      const listener = vi.fn()
      api.onDataChange(listener)

      const group = api[ns] as unknown as Record<
        string, (payload: unknown) => Promise<unknown>
      >
      expect(await group[method]('payload')).toBe(ok)
      expect(listener).toHaveBeenCalledWith(expected)
    }
  )

  it('signals nothing for reads or failed writes',
    async () => {
      const api = await exposed()
      const listener = vi.fn()
      api.onDataChange(listener)

      const fail = { ok: false, error: { code: 'internal' } }
      vi.mocked(ipcRenderer.invoke)
        .mockResolvedValueOnce({ ok: true, value: [] })
        .mockResolvedValueOnce(fail)
      await api.weight.list({
        from: '2026-01-01', to: '2026-01-07'
      })
      expect(await api.weight.delete('2026-01-01'))
        .toBe(fail)
      expect(listener).not.toHaveBeenCalled()
    })

  it('stops notifying after unsubscribe', async () => {
    vi.mocked(ipcRenderer.invoke)
      .mockResolvedValue({ ok: true, value: null })
    const api = await exposed()
    const [first, second] = [vi.fn(), vi.fn()]
    const stop = api.onDataChange(first)
    api.onDataChange(second)

    stop()
    await api.weight.delete('2026-01-01')

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledWith('weight')
  })

  it('keeps notifying others if a listener throws',
    async () => {
      const ok = { ok: true, value: null }
      vi.mocked(ipcRenderer.invoke).mockResolvedValue(ok)
      const api = await exposed()
      const bad = vi.fn(() => {
        throw new Error('boom')
      })
      const good = vi.fn()
      api.onDataChange(bad)
      api.onDataChange(good)

      expect(await api.sleep.delete(1)).toBe(ok)
      expect(good).toHaveBeenCalledWith('sleep')
    })
})
