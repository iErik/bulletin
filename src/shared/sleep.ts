import type { DateRange, StorageResult } from './storage'

/** Milliseconds since the Unix epoch. */
export type EpochMs = number

/**
 * A Sleep Entry: one stretch of sleep, from its Head
 * (`start`) to its Tail (`end`), at most 24 hours. It
 * belongs to the day whose noon-to-noon window, local
 * time, contains its Head.
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
   * Periods whose Head falls in the range's days, each
   * day running noon to noon. Oldest first.
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
}

/** IPC channel per `SleepApi` method. */
export const SLEEP_CHANNELS = {
  list: 'sleep:list',
  create: 'sleep:create',
  update: 'sleep:update',
  delete: 'sleep:delete'
} as const satisfies Record<keyof SleepApi, string>
