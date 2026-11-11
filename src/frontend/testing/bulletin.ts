import { vi, type Mock } from 'vitest'
import type { BulletinApi } from '@shared/bridge'
import type { Habit, HabitsApi } from '@shared/habits'
import type { MoodApi } from '@shared/mood'
import type {
  NewSleepPeriod,
  SleepApi
} from '@shared/sleep'
import type { WeightApi } from '@shared/weight'

/** Resolves every call with `value`, successfully. */
const resolves = (value: unknown): Mock =>
  vi.fn().mockResolvedValue({ ok: true, value })

/** Resolves every call with its own payload. */
const echoes = <T>(
  make = (value: T) => value
): Mock<(value: T) => Promise<{ ok: true; value: T }>> =>
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

/** Empty Mood storage, like `fakeWeight`. */
const fakeMood = (): MoodApi => ({
  list: resolves([]),
  create: echoes(),
  update: echoes(),
  delete: resolves(null)
})

/**
 * No Habits yet: created and changed Habits are
 * Habit 1, created 2026-01-01, with the payload's
 * fields. Its Entries work like `fakeWeight`.
 */
const fakeHabits = (): HabitsApi => {
  const habit: Habit = {
    id: 1,
    name: 'Habit',
    icon: 'meditation',
    created: '2026-01-01',
    archived: false
  }
  return {
    list: resolves([]),
    create: echoes(changes => ({ ...habit, ...changes })),
    update: echoes(changes => ({ ...habit, ...changes })),
    archive: resolves({ ...habit, archived: true }),
    unarchive: resolves(habit),
    listEntries: resolves([]),
    createEntry: echoes(),
    deleteEntry: resolves(null)
  }
}

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
  mood: fakeMood(),
  habits: fakeHabits(),
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
