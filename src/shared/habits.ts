import type {
  DateRange,
  LocalDate,
  StorageResult
} from './storage'

/**
 * The stable keys of the Habit icons. Storage keeps
 * only the key; the UI maps each one to an icon.
 */
export const HABIT_ICONS = [
  'meditation',
  'exercise',
  'reading',
  'water',
  'sleep',
  'diet',
  'running',
  'coding',
  'music',
  'language',
  'journaling',
  'cleaning',
  'walking',
  'stretching',
  'cycling',
  'swimming',
  'yoga',
  'vitamins',
  'no-smoking',
  'no-alcohol',
  'study',
  'drawing',
  'gratitude',
  'screen-free'
] as const

export type HabitIcon = (typeof HABIT_ICONS)[number]

/** Something the user wants to do regularly. */
export interface Habit {
  readonly id: number
  /** Trimmed, unique among all Habits ignoring case. */
  readonly name: string
  readonly icon: HabitIcon
  /** The day it was created. */
  readonly created: LocalDate
  /** Archived Habits leave the list, keeping Entries. */
  readonly archived: boolean
}

/** A Habit to create. */
export interface NewHabit {
  readonly name: string
  readonly icon: HabitIcon
}

/** Changes to a Habit's name, icon, or both. */
export interface HabitChanges {
  readonly id: number
  readonly name?: string
  readonly icon?: HabitIcon
}

/** Which Habits to list. */
export type HabitStatus = 'active' | 'archived'

/** A Habit Entry: the Habit was done on that day. */
export interface HabitEntry {
  readonly habitId: number
  readonly date: LocalDate
}

/** `window.bulletin.habits`. */
export interface HabitsApi {
  /** Active or archived Habits, oldest first. */
  list(status: HabitStatus): Promise<
    StorageResult<Habit[]>
  >
  /**
   * Creates a Habit. With an archived Habit's name, it
   * restores that Habit with the given icon instead.
   */
  create(habit: NewHabit): Promise<StorageResult<Habit>>
  /** Changes a Habit's name, icon, or both. */
  update(changes: HabitChanges): Promise<
    StorageResult<Habit>
  >
  /** Archives a Habit by its `id`. */
  archive(id: number): Promise<StorageResult<Habit>>
  /** Unarchives a Habit by its `id`. */
  unarchive(id: number): Promise<StorageResult<Habit>>
  /**
   * Every Habit's Entries in the range, archived ones
   * included, by day then Habit.
   */
  listEntries(range: DateRange): Promise<
    StorageResult<HabitEntry[]>
  >
  /**
   * Marks an active Habit done on a day. If it already
   * is, returns the existing Entry.
   */
  createEntry(entry: HabitEntry): Promise<
    StorageResult<HabitEntry>
  >
  /** Marks a Habit not done on a day. */
  deleteEntry(entry: HabitEntry): Promise<
    StorageResult<null>
  >
}

/** IPC channel per `HabitsApi` method. */
export const HABITS_CHANNELS = {
  list: 'habits:list',
  create: 'habits:create',
  update: 'habits:update',
  archive: 'habits:archive',
  unarchive: 'habits:unarchive',
  listEntries: 'habits:list-entries',
  createEntry: 'habits:create-entry',
  deleteEntry: 'habits:delete-entry'
} as const satisfies Record<keyof HabitsApi, string>
