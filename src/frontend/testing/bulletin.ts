import { vi } from 'vitest'
import type { BulletinApi } from '@shared/bridge'
import type {
  NewSleepPeriod,
  SleepApi
} from '@shared/sleep'
import type { WeightApi } from '@shared/weight'

/** Resolves every call with `value`, successfully. */
const resolves = (value: unknown) =>
  vi.fn().mockResolvedValue({ ok: true, value })

/** Resolves every call with its own payload. */
const echoes = <T>(make = (value: T) => value) =>
  vi.fn(async (value: T) => ({
    ok: true as const,
    value: make(value)
  }))

/**
 * Empty storage: lists are empty, writes echo their
 * payload and deletes succeed.
 */
const fakeWeight = (): WeightApi => ({
  list: resolves([]),
  create: echoes(),
  update: echoes(),
  delete: resolves(null)
})

/** Empty Sleep storage; created Periods get id 1. */
const fakeSleep = (): SleepApi => ({
  list: resolves([]),
  create: echoes((period: NewSleepPeriod) =>
    ({ id: 1, ...period })),
  update: echoes(),
  delete: resolves(null)
})

/**
 * A fake preload API for renderer tests. Typed against
 * `BulletinApi`, so it stops compiling when the bridge
 * changes: add new members here with test defaults.
 */
export const fakeBulletin = (
  overrides: Partial<BulletinApi> = {}
): BulletinApi => ({
  platform: 'testos',
  setWindowControlsColours: vi.fn(),
  weight: fakeWeight(),
  sleep: fakeSleep(),
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
