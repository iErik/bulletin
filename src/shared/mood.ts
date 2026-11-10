import type {
  DateRange,
  LocalDate,
  StorageResult
} from './storage'

/**
 * The fixed set of Moods, in the order of the Figma
 * mood picker. `colour` names the Palette token that
 * paints the Mood.
 */
export const MOODS = [
  { key: 'happy', label: 'Happy', colour: 'mood-happy' },
  { key: 'okay', label: 'Okay', colour: 'mood-okay' },
  {
    key: 'stressed',
    label: 'Stressed',
    colour: 'mood-stressed'
  },
  {
    key: 'neutral',
    label: 'Neutral',
    colour: 'mood-neutral'
  },
  { key: 'angry', label: 'Angry', colour: 'mood-angry' },
  {
    key: 'anxious',
    label: 'Anxious',
    colour: 'mood-anxious'
  }
] as const satisfies readonly {
  key: string
  label: string
  colour: `mood-${string}`
}[]

export type Mood = (typeof MOODS)[number]
export type MoodKey = Mood['key']

/** A Mood Entry: one day's Mood. */
export interface MoodEntry {
  readonly date: LocalDate
  readonly mood: MoodKey
}

/** `window.bulletin.mood`. */
export interface MoodApi {
  /** Entries in the range, oldest first. */
  list(range: DateRange): Promise<
    StorageResult<MoodEntry[]>
  >
  /** Sets a day's Mood, replacing its Entry if any. */
  create(entry: MoodEntry): Promise<
    StorageResult<MoodEntry>
  >
  /** Changes the Mood of an existing day's Entry. */
  update(entry: MoodEntry): Promise<
    StorageResult<MoodEntry>
  >
  /** Clears a day's Mood by deleting its Entry. */
  delete(date: LocalDate): Promise<StorageResult<null>>
}

/** IPC channel per `MoodApi` method. */
export const MOOD_CHANNELS = {
  list: 'mood:list',
  create: 'mood:create',
  update: 'mood:update',
  delete: 'mood:delete'
} as const satisfies Record<keyof MoodApi, string>
