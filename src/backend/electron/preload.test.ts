import { describe, expect, it, vi } from 'vitest'
import { contextBridge } from 'electron'
import { BRIDGE_KEY } from '@shared/bridge'

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: vi.fn() }
}))

describe('preload', () => {
  it('exposes the API under BRIDGE_KEY', async () => {
    await import('./preload')

    expect(contextBridge.exposeInMainWorld)
      .toHaveBeenCalledWith(BRIDGE_KEY, {
        platform: process.platform
      })
  })
})
