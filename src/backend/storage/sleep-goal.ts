import { eq } from 'drizzle-orm'
import { z } from 'zod'
import {
  SLEEP_GOAL_DEFAULT_MINUTES,
  SLEEP_GOAL_MAX_MINUTES,
  SLEEP_GOAL_MIN_MINUTES
} from '@shared/sleep'
import type { Database } from './database'
import { parse } from './errors'
import { sleepGoal } from './schema'

/** The only `sleep_goal` row. */
const ROW_ID = 1

const minutesSchema = z
  .int()
  .min(SLEEP_GOAL_MIN_MINUTES)
  .max(SLEEP_GOAL_MAX_MINUTES)

/**
 * The Sleep Goal in minutes, or 8 hours when nothing
 * is stored.
 */
export const getSleepGoal = async (
  db: Database
): Promise<number> => {
  const [row] = await db
    .select()
    .from(sleepGoal)
    .where(eq(sleepGoal.id, ROW_ID))
    .limit(1)
  return row?.minutes ?? SLEEP_GOAL_DEFAULT_MINUTES
}

/**
 * Sets the Sleep Goal, in minutes. An integer from 4
 * hours to 12; anything else is `invalid-payload`.
 */
export const setSleepGoal = async (
  db: Database,
  value: unknown
): Promise<number> => {
  const minutes = parse(minutesSchema, value)
  const [row] = await db
    .insert(sleepGoal)
    .values({ id: ROW_ID, minutes })
    .onConflictDoUpdate({
      target: sleepGoal.id,
      set: { minutes }
    })
    .returning()
  return row.minutes
}
