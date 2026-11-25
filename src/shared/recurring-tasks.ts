import type {
  DateRange,
  LocalDate,
  StorageResult
} from './storage'
import type { LocalTime, Task } from './tasks'

/** A day of the week, Sunday 0, like `Date.getDay()`. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

/**
 * Which days a Recurring Task falls on. Monthly and
 * yearly days that a month lacks (the 31st, Feb 29)
 * fall on that month's last day.
 */
export type TaskSchedule =
  | {
    /** Every `every` days from the first day. */
    readonly kind: 'days'
    /** 1 or more. */
    readonly every: number
  }
  | {
    readonly kind: 'weekly'
    /** One or more, without repeats. */
    readonly weekdays: readonly Weekday[]
  }
  | {
    readonly kind: 'monthly'
    /** 1–31. */
    readonly day: number
  }
  | {
    readonly kind: 'yearly'
    /** 1–12. */
    readonly month: number
    /** A day that month can have (Feb 29 too). */
    readonly day: number
  }

/** When a schedule applies, and from where it counts. */
export interface Recurrence {
  readonly schedule: TaskSchedule
  /** The earliest Occurrence; anchors `days`. */
  readonly firstDay: LocalDate
  /** The last day kept by "Stop repeating", or null. */
  readonly lastDay: LocalDate | null
}

/** A Recurring Task: a rule, never stored as copies. */
export interface RecurringTask extends Recurrence {
  readonly id: number
  /** Trimmed, not empty. */
  readonly title: string
  readonly time: LocalTime | null
  /** Epoch ms when created. */
  readonly created: number
}

/**
 * One scheduled day of a Recurring Task, with its own
 * changes applied. Keyed by `ruleId` and `scheduled`.
 */
export interface Occurrence {
  readonly ruleId: number
  /** The day the schedule names. */
  readonly scheduled: LocalDate
  readonly title: string
  /** Where it shows: `scheduled`, or where it moved. */
  readonly day: LocalDate
  readonly time: LocalTime | null
  /** Epoch ms when marked done, or `null`. */
  readonly doneAt: number | null
  /** Later-day moves, as for a Task. */
  readonly moves: number
  /** Its Recurring Task's, for the day's order. */
  readonly created: number
}

const DAY_MS = 86_400_000

/** Days since 1970-01-01; no time zone, so no DST. */
const dayNumber = (date: LocalDate): number => {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / DAY_MS
}

const pad = (n: number): string =>
  String(n).padStart(2, '0')

const fromDayNumber = (n: number): LocalDate => {
  const date = new Date(n * DAY_MS)
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate())
  ].join('-')
}

const daysInMonth = (
  year: number,
  month: number
): number =>
  new Date(Date.UTC(year, month, 0)).getUTCDate()

/** Whether `n` is a day the schedule names. */
const named = (
  schedule: TaskSchedule,
  anchor: number,
  n: number
): boolean => {
  const date = new Date(n * DAY_MS)
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1
  const day = date.getUTCDate()
  const clamped = (wanted: number): boolean =>
    day === Math.min(wanted, daysInMonth(year, month))
  switch (schedule.kind) {
    case 'days':
      return (n - anchor) % schedule.every === 0
    case 'weekly':
      return schedule.weekdays.includes(
        date.getUTCDay() as Weekday
      )
    case 'monthly':
      return clamped(schedule.day)
    case 'yearly':
      return month === schedule.month
        && clamped(schedule.day)
  }
}

/**
 * Whether `day` is one of the recurrence's scheduled
 * days: named by its schedule, from its first day up
 * to its last.
 */
export const occursOn = (
  recurrence: Recurrence,
  day: LocalDate
): boolean => {
  const { schedule, firstDay, lastDay } = recurrence
  if (day < firstDay) return false
  if (lastDay !== null && day > lastDay) return false
  return named(schedule, dayNumber(firstDay), dayNumber(day))
}

/** The recurrence's scheduled days in a span, in order. */
export const scheduledDays = (
  recurrence: Recurrence,
  { from, to }: DateRange
): LocalDate[] => {
  const { schedule, firstDay, lastDay } = recurrence
  const anchor = dayNumber(firstDay)
  const start = Math.max(dayNumber(from), anchor)
  const end = lastDay === null
    ? dayNumber(to)
    : Math.min(dayNumber(to), dayNumber(lastDay))
  const days: LocalDate[] = []
  for (let n = start; n <= end; n++) {
    if (named(schedule, anchor, n))
      days.push(fromDayNumber(n))
  }
  return days
}

/** What `compareForDay` needs of a Task or Occurrence. */
export type DayItem = Pick<Task, 'time' | 'created'> & {
  readonly day: LocalDate | null
}

/**
 * Orders Tasks and Occurrences together: by day
 * (Someday last), then timed ones by time, then
 * "any time" ones in the order they were added.
 */
export const compareForDay = (
  a: DayItem,
  b: DayItem
): number => {
  if (a.day !== b.day) {
    if (a.day === null) return 1
    if (b.day === null) return -1
    return a.day < b.day ? -1 : 1
  }
  if (a.time !== b.time) {
    if (a.time === null) return 1
    if (b.time === null) return -1
    return a.time < b.time ? -1 : 1
  }
  return a.created - b.created
}

/** A Recurring Task to create. */
export interface NewRecurringTask {
  readonly title: string
  readonly time: LocalTime | null
  readonly schedule: TaskSchedule
  readonly firstDay: LocalDate
}

/** Changes to a Recurring Task from today on. */
export interface RecurringTaskUpdate {
  readonly id: number
  readonly title?: string
  readonly time?: LocalTime | null
  readonly schedule?: TaskSchedule
  readonly firstDay?: LocalDate
}

/** Identifies one Occurrence of a Recurring Task. */
export interface OccurrenceKey {
  readonly ruleId: number
  readonly scheduled: LocalDate
}

/** Changes to an Occurrence's title, day, time, or any mix. */
export interface OccurrenceUpdate extends OccurrenceKey {
  readonly title?: string
  readonly day?: LocalDate
  readonly time?: LocalTime | null
}

/** Mark an Occurrence done or not. */
export interface OccurrenceDone extends OccurrenceKey {
  readonly done: boolean
}

/** `window.bulletin.recurringTasks`. */
export interface RecurringTasksApi {
  /** Every Recurring Task, stopped ones included. */
  list(): Promise<StorageResult<RecurringTask[]>>
  /** Creates a Recurring Task; `created` is now. */
  create(
    task: NewRecurringTask
  ): Promise<StorageResult<RecurringTask>>
  /** Changes a rule from today on; past keeps old values. */
  update(
    changes: RecurringTaskUpdate
  ): Promise<StorageResult<RecurringTask>>
  /** Sets `lastDay` to today, keeping today's. */
  stop(id: number): Promise<StorageResult<RecurringTask>>
  /** Deletes a Recurring Task by its `id`. */
  delete(id: number): Promise<StorageResult<null>>
  /** Expands rules over the span, ordered for the day. */
  listOccurrences(
    range: DateRange
  ): Promise<StorageResult<Occurrence[]>>
  /** Changes one Occurrence; a later day raises `moves`. */
  updateOccurrence(
    changes: OccurrenceUpdate
  ): Promise<StorageResult<Occurrence>>
  /** Sets or clears `doneAt`; redone keeps the first. */
  setOccurrenceDone(
    done: OccurrenceDone
  ): Promise<StorageResult<Occurrence>>
  /** Drops one Occurrence without changing the rule. */
  skipOccurrence(
    key: OccurrenceKey
  ): Promise<StorageResult<null>>
}

/** IPC channel per `RecurringTasksApi` method. */
export const RECURRING_TASKS_CHANNELS = {
  list: 'recurring-tasks:list',
  create: 'recurring-tasks:create',
  update: 'recurring-tasks:update',
  stop: 'recurring-tasks:stop',
  delete: 'recurring-tasks:delete',
  listOccurrences: 'recurring-tasks:list-occurrences',
  updateOccurrence: 'recurring-tasks:update-occurrence',
  setOccurrenceDone: 'recurring-tasks:set-occurrence-done',
  skipOccurrence: 'recurring-tasks:skip-occurrence'
} as const satisfies Record<keyof RecurringTasksApi, string>
