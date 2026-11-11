import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex
} from 'drizzle-orm/sqlite-core'

/** A Period's longest length: 24 hours, in ms. */
export const MAX_PERIOD_MS = 24 * 60 * 60 * 1000

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

/**
 * Sleep Periods, from Head (`start`) to Tail (`end`) in
 * epoch milliseconds. The checks back up the rules
 * main validates: the end is after the start, at most
 * 24 hours later. Overlaps are checked in main.
 */
export const sleep = sqliteTable(
  'sleep',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    start: integer().notNull(),
    end: integer().notNull()
  },
  table => [
    index('sleep_start').on(table.start),
    check(
      'sleep_end_after_start',
      sql`${table.end} > ${table.start}`
    ),
    check(
      'sleep_at_most_24_hours',
      sql`${table.end} - ${table.start} <= ${
        sql.raw(String(MAX_PERIOD_MS))}`
    )
  ]
)

/**
 * Mood Entries: at most one per day, keyed by the local
 * calendar date, holding a Mood key. Like Weight's, the
 * text primary key needs a check to rule out NULL.
 */
export const mood = sqliteTable(
  'mood',
  {
    date: text().primaryKey(),
    mood: text().notNull()
  },
  table => [
    check(
      'mood_date_not_null',
      sql`${table.date} IS NOT NULL`
    )
  ]
)

/**
 * Habits, archived rather than deleted. `created` is
 * the local date it was created. Main checks that
 * names are unique ignoring case; the index backs it
 * up for ASCII letters.
 */
export const habits = sqliteTable(
  'habits',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    name: text().notNull(),
    icon: text().notNull(),
    created: text().notNull(),
    archived: integer({ mode: 'boolean' })
      .notNull()
      .default(false)
  },
  table => [
    uniqueIndex('habits_name')
      .on(sql`lower(${table.name})`),
    check(
      'habits_name_not_blank',
      sql`trim(${table.name}) <> ''`
    )
  ]
)
