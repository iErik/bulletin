import { desc, lte } from 'drizzle-orm'
import { createInsertSchema } from 'drizzle-orm/zod'
import { z } from 'zod'
import type { Budget } from '@shared/expenses'
import type { Database } from './database'
import { parse } from './errors'
import { budget } from './schema'

const monthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/)

const budgetSchema = createInsertSchema(budget, {
  month: monthSchema,
  amount: schema => schema.nonnegative()
}).strict()

/**
 * The month's Budget or, without one, the most recent
 * earlier month's; `null` if neither exists. A Budget
 * isn't an Entry, so future months are allowed.
 */
export const getBudget = async (
  db: Database,
  value: unknown
): Promise<Budget | null> => {
  const month = parse(monthSchema, value)
  const [row] = await db
    .select()
    .from(budget)
    .where(lte(budget.month, month))
    .orderBy(desc(budget.month))
    .limit(1)
  return row ?? null
}

/** Sets a month's Budget, replacing any it had. */
export const setBudget = async (
  db: Database,
  value: unknown
): Promise<Budget> => {
  const entry = parse(budgetSchema, value)
  const [row] = await db
    .insert(budget)
    .values(entry)
    .onConflictDoUpdate({
      target: budget.month,
      set: { amount: entry.amount }
    })
    .returning()
  return row
}
