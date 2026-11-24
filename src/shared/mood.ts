import type {
  DateRange,
  LocalDate,
  StorageResult
} from './storage'

/** Whether a Mood is Good, Hard, or neither. */
export type MoodKind = 'good' | 'hard' | 'neither'

/**
 * The fixed set of Moods, in the order of the Figma
 * mood picker. `colour` names the Palette token that
 * paints the Mood, and `kind` classifies it as Good,
 * Hard, or neither (see `CONTEXT.md`).
 */
export const MOODS = [
  { key: 'happy', label: 'Happy', colour: 'mood-happy', kind: 'good' },
  { key: 'okay', label: 'Okay', colour: 'mood-okay', kind: 'good' },
  {
    key: 'stressed',
    label: 'Stressed',
    colour: 'mood-stressed',
    kind: 'hard'
  },
  {
    key: 'neutral',
    label: 'Neutral',
    colour: 'mood-neutral',
    kind: 'neither'
  },
  { key: 'angry', label: 'Angry', colour: 'mood-angry', kind: 'hard' },
  {
    key: 'anxious',
    label: 'Anxious',
    colour: 'mood-anxious',
    kind: 'hard'
  }
] as const satisfies readonly {
  key: string
  label: string
  colour: `mood-${string}`
  kind: MoodKind
}[]

export type Mood = (typeof MOODS)[number]
export type MoodKey = Mood['key']

/**
 * The order Moods are shown in wherever they're laid
 * out together, as in Figma's stacked bars: Happy
 * first (at the bottom or left), Angry last. It
 * differs from `MOODS`, which follows the picker.
 */
export const MOOD_DISPLAY_ORDER = [
  'happy',
  'okay',
  'neutral',
  'stressed',
  'anxious',
  'angry'
] as const satisfies readonly MoodKey[]

const kindOf = (mood: Mood | MoodKey): MoodKind | undefined =>
  typeof mood === 'string'
    ? MOODS.find(item => item.key === mood)?.kind
    : mood.kind

/** Whether `mood` is a Good Mood (see `CONTEXT.md`). */
export const isGoodMood = (mood: Mood | MoodKey): boolean =>
  kindOf(mood) === 'good'

/** Whether `mood` is a Hard Mood (see `CONTEXT.md`). */
export const isHardMood = (mood: Mood | MoodKey): boolean =>
  kindOf(mood) === 'hard'

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
