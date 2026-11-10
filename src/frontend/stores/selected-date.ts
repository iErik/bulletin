import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'
import {
  addDays,
  isAfter,
  isSameDay,
  startOfDay,
  startOfTomorrow
} from 'date-fns'

/**
 * Today at local midnight, from the system clock.
 * Tests fake it with `vi.useFakeTimers`.
 */
const startOfToday = (): Date => startOfDay(new Date())

/**
 * The Selected Date (see `CONTEXT.md`): the day the
 * Dashboard is focused on. Days are `Date`s at local
 * midnight; treat them as immutable.
 *
 * It opens on today, is never later than today, and
 * isn't persisted. When the local date rolls over, it
 * follows to the new day only if it was on today. Only
 * the date header changes it; Widgets read `day`.
 */
export const useSelectedDateStore = defineStore(
  'selected-date',
  () => {
    const today = shallowRef(startOfToday())
    const selected = shallowRef(today.value)

    const rollOver = (): void => {
      const now = startOfToday()
      if (isSameDay(selected.value, today.value))
        selected.value = now
      today.value = now
      scheduleRollOver()
    }

    // Fires at the next local midnight, or on wake if
    // the machine slept through it.
    const scheduleRollOver = (): void => {
      const wait = startOfTomorrow().getTime()
        - Date.now()
      setTimeout(rollOver, wait)
    }
    scheduleRollOver()

    const isToday = computed(() =>
      isSameDay(selected.value, today.value)
    )

    /** Selects `date`'s day, clamped to today. */
    const setDay = (date: Date): void => {
      const day = startOfDay(date)
      selected.value = isAfter(day, today.value)
        ? today.value
        : day
    }

    /** Moves one day back (-1) or forward (1). */
    const step = (delta: -1 | 1): void =>
      setDay(addDays(selected.value, delta))

    const goToday = (): void => {
      selected.value = today.value
    }

    return {
      day: computed(() => selected.value),
      today: computed(() => today.value),
      isToday,
      setDay,
      step,
      goToday
    }
  }
)
