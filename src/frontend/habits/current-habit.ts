import type { Habit } from '@shared/habits'

/**
 * The current Habit: the one the Habits Widget shows.
 * Its id is a per-device preference, like the Theme.
 */
export const CURRENT_HABIT_KEY = 'bulletin.habit'

/** The stored id; `null` if absent or unreadable. */
export const readCurrentHabit = (): number | null => {
  try {
    const value = localStorage.getItem(CURRENT_HABIT_KEY)
    const id = Number(value)
    return value && Number.isInteger(id) ? id : null
  } catch {
    return null
  }
}

export const writeCurrentHabit = (id: number): void => {
  try {
    localStorage.setItem(CURRENT_HABIT_KEY, String(id))
  } catch {
    // Storage is unavailable: keep the choice in memory.
  }
}

/**
 * The Habit with `id` among the active `habits`,
 * oldest first, else the oldest one, else `null`.
 */
export const pickCurrentHabit = (
  habits: readonly Habit[],
  id: number | null
): Habit | null =>
  habits.find(habit => habit.id === id)
    ?? habits[0]
    ?? null
