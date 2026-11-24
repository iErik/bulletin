import type { DateRange, StorageResult } from './storage'

/** Milliseconds since the Unix epoch. */
export type EpochMs = number

/** Sleep Goal when none is stored: 8 hours. */
export const SLEEP_GOAL_DEFAULT_MINUTES = 8 * 60

/** Shortest Sleep Goal main accepts: 4 hours. */
export const SLEEP_GOAL_MIN_MINUTES = 4 * 60

/** Longest Sleep Goal main accepts: 12 hours. */
export const SLEEP_GOAL_MAX_MINUTES = 12 * 60

/**
 * A Sleep Entry: one stretch of sleep, from its Head
 * (`start`) to its Tail (`end`), at most 24 hours. It
 * belongs to its Head's calendar day, local time.
 */
export interface SleepPeriod {
  readonly id: number
  readonly start: EpochMs
  readonly end: EpochMs
}

/** A Period to create: it has no `id` yet. */
export type NewSleepPeriod = Omit<SleepPeriod, 'id'>

/** `window.bulletin.sleep`. */
export interface SleepApi {
  /**
   * Periods whose Head falls in the range's calendar
   * days, local time. Oldest first.
   */
  list(range: DateRange): Promise<
    StorageResult<SleepPeriod[]>
  >
  /** Saves a new Period. */
  create(period: NewSleepPeriod): Promise<
    StorageResult<SleepPeriod>
  >
  /** Moves an existing Period's Head and Tail. */
  update(period: SleepPeriod): Promise<
    StorageResult<SleepPeriod>
  >
  /** Deletes a Period by its `id`. */
  delete(id: number): Promise<StorageResult<null>>
  /**
   * The Sleep Goal in minutes: the stored value, or
   * 8 hours when none is stored.
   */
  getGoal(): Promise<StorageResult<number>>
  /**
   * Sets the Sleep Goal, in minutes. Main accepts an
   * integer from 4 hours to 12.
   */
  setGoal(minutes: number): Promise<StorageResult<number>>
}

/** IPC channel per `SleepApi` method. */
export const SLEEP_CHANNELS = {
  list: 'sleep:list',
  create: 'sleep:create',
  update: 'sleep:update',
  delete: 'sleep:delete',
  getGoal: 'sleep:get-goal',
  setGoal: 'sleep:set-goal'
} as const satisfies Record<keyof SleepApi, string>
