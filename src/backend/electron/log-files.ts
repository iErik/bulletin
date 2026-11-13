import { readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { formatWithOptions } from 'node:util'

/** How many runs' log files are kept, this run's included. */
export const KEPT_RUNS = 5

const RUN_FILE = /^main-\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d\.log$/

/**
 * The log file name for a run started at `start`, in
 * UTC: `main-2026-11-13T04-30-00.log`. Names sort in
 * start order.
 */
export const logFileName = (start: Date): string =>
  `main-${start.toISOString().slice(0, 19)
    .replaceAll(':', '-')}.log`

/**
 * Deletes the oldest run files in `dir`, so that with
 * `current` (which may not exist yet) at most `keep`
 * remain. Other files are left alone. Never throws: a
 * file that can't be read or deleted is skipped.
 */
export const pruneLogs = (
  dir: string,
  current: string,
  keep = KEPT_RUNS
): void => {
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return
  }
  const older = names
    .filter(name => RUN_FILE.test(name) && name !== current)
    .sort()
  const extra = older.length - (keep - 1)
  for (const name of older.slice(0, Math.max(extra, 0))) {
    try {
      rmSync(join(dir, name), { force: true })
    } catch {
      // Logging never stops the app.
    }
  }
}

/**
 * One log entry: ISO time, level and message, then each
 * value as Node prints it, so errors keep their stack,
 * cause chain and extra properties.
 */
export const formatEntry = (
  date: Date,
  level: string,
  data: unknown[]
): string =>
  `${date.toISOString()} [${level}] `
  + formatWithOptions({ depth: 8 }, ...data)
