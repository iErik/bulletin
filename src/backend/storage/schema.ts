import { sql } from 'drizzle-orm'
import {
  check,
  integer,
  sqliteTable,
  text
} from 'drizzle-orm/sqlite-core'

/**
 * Weight Entries: one per day, keyed by the local
 * calendar date (`YYYY-MM-DD`), in integer grams.
 * SQLite lets a text primary key be NULL, so a check
 * keeps one row per day.
 */
export const weight = sqliteTable(
  'weight',
  {
    date: text().primaryKey(),
    grams: integer().notNull()
  },
  table => [
    check(
      'weight_date_not_null',
      sql`${table.date} IS NOT NULL`
    )
  ]
)
