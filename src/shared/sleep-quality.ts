import type {
  DateRange,
  LocalDate,
  StorageResult
} from './storage'

/**
 * The fixed five-step Sleep Quality scale, Poor to
 * Great. Labels for 2–4 aren't named in Figma; they
 * follow the approved plan for Part 2's picker.
 */
export const SLEEP_QUALITY_STEPS = [
  { value: 1, label: 'Poor' },
  { value: 2, label: 'Fair' },
  { value: 3, label: 'Okay' },
  { value: 4, label: 'Good' },
  { value: 5, label: 'Great' }
] as const satisfies readonly {
  value: number
  label: string
}[]

export type SleepQualityStep =
  (typeof SLEEP_QUALITY_STEPS)[number]
export type SleepQualityRating = SleepQualityStep['value']

/** A Sleep Quality Entry: one day's rating. */
export interface SleepQualityEntry {
  readonly date: LocalDate
  readonly rating: SleepQualityRating
}

/** `window.bulletin.sleepQuality`. */
export interface SleepQualityApi {
  /** Entries in the range, oldest first. */
  list(range: DateRange): Promise<
    StorageResult<SleepQualityEntry[]>
  >
  /** Sets a day's rating, replacing its Entry if any. */
  create(entry: SleepQualityEntry): Promise<
    StorageResult<SleepQualityEntry>
  >
  /** Clears a day's rating by deleting its Entry. */
  delete(date: LocalDate): Promise<StorageResult<null>>
}

/** IPC channel per `SleepQualityApi` method. */
export const SLEEP_QUALITY_CHANNELS = {
  list: 'sleep-quality:list',
  create: 'sleep-quality:create',
  delete: 'sleep-quality:delete'
} as const satisfies Record<keyof SleepQualityApi, string>
