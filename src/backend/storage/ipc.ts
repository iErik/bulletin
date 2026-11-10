import type { IpcMain } from 'electron'
import type { StorageResult } from '@shared/storage'
import { SLEEP_CHANNELS } from '@shared/sleep'
import { WEIGHT_CHANNELS } from '@shared/weight'
import type { Database } from './database'
import { StorageFailure } from './errors'
import {
  createSleep,
  deleteSleep,
  listSleep,
  updateSleep
} from './sleep'
import {
  createWeight,
  deleteWeight,
  listWeight,
  updateWeight
} from './weight'

type Operation = (
  db: Database,
  payload: unknown
) => Promise<unknown>

/**
 * Runs `operation`, turning any failure into a typed
 * error. Unexpected errors are logged and reported as
 * `internal`, never with their message or SQL.
 */
export const runOperation = async (
  operation: Operation,
  db: Database,
  payload: unknown
): Promise<StorageResult<unknown>> => {
  try {
    return { ok: true, value: await operation(db, payload) }
  } catch (error) {
    if (error instanceof StorageFailure)
      return { ok: false, error: error.error }
    console.error('Storage operation failed:', error)
    return { ok: false, error: { code: 'internal' } }
  }
}

/** Every storage operation, by IPC channel. */
const OPERATIONS: Record<string, Operation> = {
  [WEIGHT_CHANNELS.list]: listWeight,
  [WEIGHT_CHANNELS.create]: (db, p) => createWeight(db, p),
  [WEIGHT_CHANNELS.update]: (db, p) => updateWeight(db, p),
  [WEIGHT_CHANNELS.delete]: deleteWeight,
  [SLEEP_CHANNELS.list]: listSleep,
  [SLEEP_CHANNELS.create]: (db, p) => createSleep(db, p),
  [SLEEP_CHANNELS.update]: (db, p) => updateSleep(db, p),
  [SLEEP_CHANNELS.delete]: deleteSleep
}

/** Registers one `ipc.handle` per storage operation. */
export const handleStorage = (
  ipc: Pick<IpcMain, 'handle'>,
  db: Database
): void => {
  for (const [channel, operation] of
    Object.entries(OPERATIONS)) {
    ipc.handle(channel, (_event, payload: unknown) =>
      runOperation(operation, db, payload))
  }
}
