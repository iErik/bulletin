import { vi } from 'vitest'
import type { BulletinApi } from '@shared/bridge'

/**
 * A fake preload API for renderer tests. Typed against
 * `BulletinApi`, so it stops compiling when the bridge
 * changes: add new members here with test defaults.
 */
export const fakeBulletin = (
  overrides: Partial<BulletinApi> = {}
): BulletinApi => ({
  platform: 'testos',
  ...overrides
})

/**
 * Replaces `window.bulletin` for the current test only;
 * globals are unstubbed after each test.
 */
export const stubBulletin = (
  overrides: Partial<BulletinApi> = {}
): BulletinApi => {
  const api = fakeBulletin(overrides)
  vi.stubGlobal('bulletin', api)
  return api
}
