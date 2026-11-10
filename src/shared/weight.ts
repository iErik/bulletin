import type {
  DateRange,
  LocalDate,
  StorageResult
} from './storage'

/** A Weight Entry: one per day, in integer grams. */
export interface WeightEntry {
  readonly date: LocalDate
  readonly grams: number
}

/** `window.bulletin.weight`. */
export interface WeightApi {
  /** Entries in the range, oldest first. */
  list(range: DateRange): Promise<
    StorageResult<WeightEntry[]>
  >
  /** Saves an Entry, replacing that day's if any. */
  create(entry: WeightEntry): Promise<
    StorageResult<WeightEntry>
  >
  /** Changes the grams of an existing day's Entry. */
  update(entry: WeightEntry): Promise<
    StorageResult<WeightEntry>
  >
  /** Deletes a day's Entry. */
  delete(date: LocalDate): Promise<StorageResult<null>>
}

/** IPC channel per `WeightApi` method. */
export const WEIGHT_CHANNELS = {
  list: 'weight:list',
  create: 'weight:create',
  update: 'weight:update',
  delete: 'weight:delete'
} as const satisfies Record<keyof WeightApi, string>
