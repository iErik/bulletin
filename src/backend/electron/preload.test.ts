import { describe, expect, it, vi } from 'vitest'
import { contextBridge, ipcRenderer } from 'electron'
import {
  BRIDGE_KEY,
  WINDOW_CONTROLS_CHANNEL,
  type BulletinApi
} from '@shared/bridge'

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: vi.fn() },
  ipcRenderer: { send: vi.fn() }
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
})
