import { and, asc, eq, gte, lte } from 'drizzle-orm'
import {
  createInsertSchema,
  createSelectSchema
} from 'drizzle-orm/zod'
import { z } from 'zod'
import type {
  Category,
  NewTransaction,
  Transaction
} from '@shared/expenses'
import type { DateRange } from '@shared/storage'
import type { Database } from './database'
import {
  assertNotFuture,
  dateRangeSchema,
  localDateSchema
} from './dates'
import { parse, StorageFailure } from './errors'
import { categories, transactions } from './schema'

const nameSchema = createInsertSchema(categories, {
  name: z.string().trim().min(1)
}).shape.name

const newTransactionSchema = createInsertSchema(
  transactions,
  {
    date: localDateSchema,
    description: z.string().trim(),
    categoryId: schema => schema.positive()
  }
).omit({ id: true }).strict()

const transactionSchema = createSelectSchema(
  transactions,
  {
    id: schema => schema.positive(),
    date: localDateSchema,
    description: z.string().trim(),
    categoryId: schema => schema.positive()
  }
).strict()

const idSchema = transactionSchema.shape.id

type Reader = Pick<Database, 'select'>

// Rows and the shared types must stay in step.
const toTransaction = (
  row: typeof transactions.$inferSelect
): Transaction => row

const toCategory = (
  row: typeof categories.$inferSelect
): Category => row

/**
 * Throws unless the Transaction is dated today or
 * earlier, and its Category exists.
 */
const assertTransactionRules = (
  tx: Reader,
  { date, categoryId }: NewTransaction,
  now: Date
): void => {
  assertNotFuture(date, now)
  const category = tx
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.id, categoryId))
    .get()
  if (!category) {
    throw new StorageFailure({
      code: 'invalid-payload',
      field: 'categoryId'
    })
  }
}

/** Transactions from the range's days, by day, then id. */
export const listTransactions = async (
  db: Database,
  range: unknown
): Promise<Transaction[]> => {
  const { from, to }: DateRange =
    parse(dateRangeSchema, range)
  const rows = await db
    .select()
    .from(transactions)
    .where(and(
      gte(transactions.date, from),
      lte(transactions.date, to)
    ))
    .orderBy(asc(transactions.date), asc(transactions.id))
  return rows.map(toTransaction)
}

/** Saves a new Transaction. */
export const createTransaction = async (
  db: Database,
  value: unknown,
  now = new Date()
): Promise<Transaction> => {
  const transaction = parse(newTransactionSchema, value)
  return db.transaction(tx => {
    assertTransactionRules(tx, transaction, now)
    const row = tx
      .insert(transactions)
      .values(transaction)
      .returning()
      .get()
    return toTransaction(row)
  })
}

/** Replaces an existing Transaction's fields. */
export const updateTransaction = async (
  db: Database,
  value: unknown,
  now = new Date()
): Promise<Transaction> => {
  const { id, ...changes } =
    parse(transactionSchema, value)
  return db.transaction(tx => {
    assertTransactionRules(tx, changes, now)
    const row = tx
      .update(transactions)
      .set(changes)
      .where(eq(transactions.id, id))
      .returning()
      .get()
    if (!row)
      throw new StorageFailure({ code: 'not-found' })
    return toTransaction(row)
  })
}

/** Deletes a Transaction by its id. */
export const deleteTransaction = async (
  db: Database,
  value: unknown
): Promise<null> => {
  const id = parse(idSchema, value)
  const deleted = await db
    .delete(transactions)
    .where(eq(transactions.id, id))
    .returning()
  if (deleted.length === 0)
    throw new StorageFailure({ code: 'not-found' })
  return null
}

/** Every Category, by name. */
export const listCategories = async (
  db: Database
): Promise<Category[]> => {
  const rows = await db.select().from(categories)
  return rows
    .map(toCategory)
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Creates a Category with a trimmed name. If one has
 * the name, ignoring case, returns that one instead.
 */
export const createCategory = async (
  db: Database,
  value: unknown
): Promise<Category> => {
  const name = parse(nameSchema, value)
  const key = name.toLowerCase()
  return db.transaction(tx => {
    const match = tx.select().from(categories).all().find(
      category => category.name.toLowerCase() === key
    )
    if (match) return toCategory(match)
    const row = tx
      .insert(categories)
      .values({ name })
      .returning()
      .get()
    return toCategory(row)
  })
}
