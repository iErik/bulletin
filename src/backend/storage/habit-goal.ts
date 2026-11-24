import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { HABIT_GOAL } from '@shared/habits'
import type { Database } from './database'
import { parse } from './errors'
import { habitGoal } from './schema'

/** The only `habit_goal` row. */
const ROW_ID = 1

const percentSchema = z
  .int()
  .min(HABIT_GOAL.min)
  .max(HABIT_GOAL.max)
  .multipleOf(HABIT_GOAL.step)

/**
 * The Habit Goal in percent, or 75 when nothing is
 * stored.
 */
export const getHabitGoal = async (
  db: Database
): Promise<number> => {
  const [row] = await db
    .select()
    .from(habitGoal)
    .where(eq(habitGoal.id, ROW_ID))
    .limit(1)
  return row?.percent ?? HABIT_GOAL.default
}

/**
 * Sets the Habit Goal, in percent. An integer from 10
 * to 100 in steps of 5; anything else is
 * `invalid-payload`.
 */
export const setHabitGoal = async (
  db: Database,
  value: unknown
): Promise<number> => {
  const percent = parse(percentSchema, value)
  const [row] = await db
    .insert(habitGoal)
    .values({ id: ROW_ID, percent })
    .onConflictDoUpdate({
      target: habitGoal.id,
      set: { percent }
    })
    .returning()
  return row.percent
}
