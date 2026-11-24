import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex
} from 'drizzle-orm/sqlite-core'
// Relative: `pnpm db:generate` can't resolve `@shared`.
import { HABIT_GOAL } from '../../shared/habits'
import {
  SLEEP_GOAL_MAX_MINUTES,
  SLEEP_GOAL_MIN_MINUTES
} from '../../shared/sleep'

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
 * Habits. `created` is the local date it was created.
 * Archiving is recorded in `habit_archive_periods`:
 * an open period means the Habit is archived. Main
 * checks that names are unique ignoring case; the
 * index backs it up for ASCII letters.
 */
export const habits = sqliteTable(
  'habits',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    name: text().notNull(),
    icon: text().notNull(),
    created: text().notNull()
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

/**
 * Archive Periods: the days a Habit spent archived,
 * from `start` through `end`, or still open when
 * `end` is null. An open period is what "archived"
 * means. A period covers at least its start, so
 * `end` is null or on that day or later. Foreign
 * keys are off, so main checks the Habit exists.
 */
export const habitArchivePeriods = sqliteTable(
  'habit_archive_periods',
  {
    habitId: integer('habit_id').notNull(),
    start: text().notNull(),
    end: text()
  },
  table => [
    primaryKey({
      columns: [table.habitId, table.start]
    }),
    check(
      'habit_archive_period_end',
      sql`${table.end} IS NULL OR ${table.end} >= ${table.start}`
    )
  ]
)

/**
 * Habit Entries: a row means the Habit was done that
 * day (a local date), and no row means it wasn't.
 * Foreign keys are off, so main checks the Habit
 * exists. Unlike a single text primary key, these
 * `notNull` columns keep `NOT NULL` in SQL, so no
 * check is needed.
 */
export const habitEntries = sqliteTable(
  'habit_entries',
  {
    habitId: integer('habit_id').notNull(),
    date: text().notNull()
  },
  table => [
    primaryKey({ columns: [table.habitId, table.date] }),
    index('habit_entries_date').on(table.date)
  ]
)

/**
 * Categories, which group Transactions. They can't be
 * renamed or deleted. Like Habits, main checks that
 * names are unique ignoring case, and the index backs
 * it up for ASCII letters.
 */
export const categories = sqliteTable(
  'categories',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    name: text().notNull()
  },
  table => [
    uniqueIndex('categories_name')
      .on(sql`lower(${table.name})`),
    check(
      'categories_name_not_blank',
      sql`trim(${table.name}) <> ''`
    )
  ]
)

/**
 * Transactions: a local date, a description, a
 * Category and a signed amount in centavos (positive
 * is Income, negative an Expense). Foreign keys are
 * off, so main checks the Category exists.
 */
export const transactions = sqliteTable(
  'transactions',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    date: text().notNull(),
    description: text().notNull(),
    categoryId: integer('category_id').notNull(),
    amount: integer().notNull()
  },
  table => [
    index('transactions_date').on(table.date)
  ]
)

/**
 * Budgets: at most one per month (`YYYY-MM`), in
 * centavos, never negative. Like Weight's, the text
 * primary key needs a check to rule out NULL.
 */
export const budget = sqliteTable(
  'budget',
  {
    month: text().primaryKey(),
    amount: integer().notNull()
  },
  table => [
    check(
      'budget_month_not_null',
      sql`${table.month} IS NOT NULL`
    ),
    check(
      'budget_amount_not_negative',
      sql`${table.amount} >= 0`
    )
  ]
)

/**
 * Sleep Quality Entries: at most one per day, keyed
 * by the local calendar date, holding a rating from
 * 1 (Poor) to 5 (Great). Like Mood's, the text
 * primary key needs a check to rule out NULL; the
 * rating check backs up the 1–5 range main validates.
 */
export const sleepQuality = sqliteTable(
  'sleep_quality',
  {
    date: text().primaryKey(),
    rating: integer().notNull()
  },
  table => [
    check(
      'sleep_quality_date_not_null',
      sql`${table.date} IS NOT NULL`
    ),
    check(
      'sleep_quality_rating_range',
      sql`${table.rating} BETWEEN ${sql.raw('1')} AND ${
        sql.raw('5')}`
    )
  ]
)

/**
 * The Sleep Goal: one row, how long the user wants
 * each Night to last, in minutes. Not an Entry. The
 * checks back up the rules main validates: only row
 * 1, between 4 and 12 hours.
 */
export const sleepGoal = sqliteTable(
  'sleep_goal',
  {
    id: integer().primaryKey(),
    minutes: integer().notNull()
  },
  table => [
    check(
      'sleep_goal_one_row',
      sql`${table.id} = ${sql.raw('1')}`
    ),
    check(
      'sleep_goal_minutes_range',
      sql`${table.minutes} BETWEEN ${sql.raw(
        String(SLEEP_GOAL_MIN_MINUTES)
      )} AND ${sql.raw(
        String(SLEEP_GOAL_MAX_MINUTES)
      )}`
    )
  ]
)

/**
 * The Habit Goal: one row, the weekly Completion Rate
 * the user aims for, in percent. Not an Entry. The
 * checks back up the rules main validates: only row
 * 1, 10 to 100 in steps of 5.
 */
export const habitGoal = sqliteTable(
  'habit_goal',
  {
    id: integer().primaryKey(),
    percent: integer().notNull()
  },
  table => [
    check(
      'habit_goal_one_row',
      sql`${table.id} = ${sql.raw('1')}`
    ),
    check(
      'habit_goal_percent_range',
      sql`${table.percent} BETWEEN ${sql.raw(
        String(HABIT_GOAL.min)
      )} AND ${sql.raw(String(HABIT_GOAL.max))}`
    ),
    check(
      'habit_goal_percent_step',
      sql`${table.percent} % ${sql.raw(
        String(HABIT_GOAL.step)
      )} = ${sql.raw('0')}`
    )
  ]
)

/**
 * One-off Tasks. `day` null is Someday; `time` is
 * optional. `done_at` null means not done. Checks back
 * up a non-blank title and non-negative `moves`.
 */
export const tasks = sqliteTable(
  'tasks',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    title: text().notNull(),
    day: text(),
    time: text(),
    doneAt: integer('done_at'),
    created: integer().notNull(),
    moves: integer().notNull().default(0)
  },
  table => [
    index('tasks_day').on(table.day),
    check(
      'tasks_title_not_blank',
      sql`trim(${table.title}) <> ''`
    ),
    check(
      'tasks_moves_not_negative',
      sql`${table.moves} >= 0`
    )
  ]
)
