import {
  integer,
  sqliteTable,
  text
} from 'drizzle-orm/sqlite-core'

/**
 * Weight Entries: one per day, keyed by the local
 * calendar date (`YYYY-MM-DD`), in integer grams.
 */
export const weight = sqliteTable('weight', {
  date: text().primaryKey(),
  grams: integer().notNull()
})
