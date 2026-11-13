import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { LogMessage } from 'electron-log'
import log from 'electron-log/main'
import {
  formatEntry,
  logFileName,
  pruneLogs
} from './log-files'

export interface LogOptions {
  /** `app.getPath('userData')`. */
  userData: string
  version: string
  platform: string
  arch: string
  /** Also log to the console. */
  dev: boolean
  now?: Date
}

const format = (
  { message }: { message: LogMessage }
): string[] => [
  formatEntry(message.date, message.level, message.data)
]

/**
 * Sets the main process's log up for this run: one file
 * in `userData/logs`, keeping the last runs', and the
 * console in development. Writes the startup line.
 * Returns the file's path, or `undefined` when it
 * couldn't be written. Never throws.
 */
export const startLog = (
  options: LogOptions
): string | undefined => {
  try {
    const dir = join(options.userData, 'logs')
    const name = logFileName(options.now ?? new Date())
    const file = join(dir, name)
    pruneLogs(dir, name)

    const { console: term, file: disk, ipc } =
      log.transports
    disk.resolvePathFn = () => file
    disk.format = format
    disk.level = 'info'
    disk.maxSize = 0
    term.format = format
    term.level = options.dev ? 'info' : false
    ipc.level = false

    log.info(`Bulletin ${options.version} on`
      + ` ${options.platform} ${options.arch}`)
    return existsSync(file) ? file : undefined
  } catch {
    return undefined
  }
}

/** Logs an error, with `error` in full. */
export const logError = (
  message: string,
  error: unknown
): void => {
  log.error(message, error)
}

/** Logs a warning. */
export const logWarning = (
  message: string,
  ...data: unknown[]
): void => {
  log.warn(message, ...data)
}
