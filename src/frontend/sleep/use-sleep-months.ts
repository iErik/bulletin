/**
 * The Sleep Widget's loaded months: a contiguous range
 * that grows one month at a time in either direction,
 * never past the current month, and the Periods whose
 * Head falls in it.
 */
import {
  computed,
  ref,
  shallowRef,
  toValue,
  type MaybeRefOrGetter,
  type Ref
} from 'vue'
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  isAfter,
  isBefore,
  min,
  startOfMonth
} from 'date-fns'
import { localDate } from '@shared/dates'
import type { SleepPeriod } from '@shared/sleep'

export interface SleepMonths {
  /** Every day of the range, oldest first. */
  readonly days: Readonly<Ref<Date[]>>
  /** Loaded Periods, oldest first. */
  readonly periods: Readonly<Ref<SleepPeriod[]>>
  /** Whether the last load failed. */
  readonly failed: Readonly<Ref<boolean>>
  /** Whether `day`'s month is loaded. */
  contains(day: Date): boolean
  /**
   * Replaces the range with `day`'s month and its
   * neighbours, up to the current month.
   */
  reset(day: Date): Promise<void>
  /** Adds the month before; false if it didn't. */
  loadEarlier(): Promise<boolean>
  /** Adds the month after, unless it's the future. */
  loadLater(): Promise<boolean>
  /**
   * Adds a Period just saved, in order, or replaces
   * the one with its `id`.
   */
  add(period: SleepPeriod): void
}

export const useSleepMonths = (
  today: MaybeRefOrGetter<Date>
): SleepMonths => {
  const first = shallowRef<Date | null>(null)
  const last = shallowRef<Date | null>(null)
  const periods = shallowRef<SleepPeriod[]>([])
  const failed = ref(false)
  // Bumped by `reset`, so loads it overtook are dropped.
  let generation = 0

  const thisMonth = (): Date =>
    startOfMonth(toValue(today))

  /**
   * Loads `from`'s month to `to`'s, plus the day before
   * them: its Period may continue onto the first row.
   * Resolves false when the load failed or is stale.
   */
  const load = async (
    from: Date,
    to: Date
  ): Promise<boolean> => {
    const asked = generation
    const result = await window.bulletin.sleep.list({
      from: localDate(addDays(from, -1)),
      to: localDate(endOfMonth(to))
    })
    if (asked !== generation) return false
    failed.value = !result.ok
    if (!result.ok) return false
    merge(result.value)
    return true
  }

  /** Adds or replaces `added`, by id, oldest first. */
  const merge = (added: readonly SleepPeriod[]): void => {
    const byId = new Map(
      periods.value.map(p => [p.id, p])
    )
    for (const p of added) byId.set(p.id, p)
    periods.value = [...byId.values()]
      .sort((a, b) => a.start - b.start)
  }

  const contains = (day: Date): boolean =>
    first.value !== null && last.value !== null
    && !isBefore(day, first.value)
    && !isAfter(day, endOfMonth(last.value))

  const reset = async (day: Date): Promise<void> => {
    generation++
    const month = startOfMonth(day)
    const from = addMonths(month, -1)
    const to = min([addMonths(month, 1), thisMonth()])
    periods.value = []
    first.value = from
    last.value = to
    await load(from, to)
  }

  const loadEarlier = async (): Promise<boolean> => {
    if (first.value === null) return false
    const month = addMonths(first.value, -1)
    if (!await load(month, month)) return false
    first.value = month
    return true
  }

  const loadLater = async (): Promise<boolean> => {
    if (last.value === null) return false
    const month = addMonths(last.value, 1)
    if (isAfter(month, thisMonth())) return false
    if (!await load(month, month)) return false
    last.value = month
    return true
  }

  const days = computed<Date[]>(() =>
    first.value && last.value
      ? eachDayOfInterval({
          start: first.value,
          end: endOfMonth(last.value)
        })
      : []
  )

  return {
    days,
    periods,
    failed,
    contains,
    reset,
    loadEarlier,
    loadLater,
    add: period => merge([period])
  }
}
