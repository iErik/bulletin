import type { IpcMain } from 'electron'
import type { StorageResult } from '@shared/storage'
import { EXPENSES_CHANNELS } from '@shared/expenses'
import { HABITS_CHANNELS } from '@shared/habits'
import { MOOD_CHANNELS } from '@shared/mood'
import { SLEEP_CHANNELS } from '@shared/sleep'
import { WEIGHT_CHANNELS } from '@shared/weight'
import { getBudget, setBudget } from './budget'
import type { Database } from './database'
import { StorageFailure } from './errors'
import {
  createCategory,
  createTransaction,
  deleteTransaction,
  listCategories,
  listTransactions,
  updateTransaction
} from './expenses'
import {
  archiveHabit,
  createHabit,
  createHabitEntry,
  deleteHabitEntry,
  listHabitEntries,
  listHabits,
  unarchiveHabit,
  updateHabit
} from './habits'
import {
  createMood,
  deleteMood,
  listMood,
  updateMood
} from './mood'
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
  [SLEEP_CHANNELS.delete]: deleteSleep,
  [MOOD_CHANNELS.list]: listMood,
  [MOOD_CHANNELS.create]: (db, p) => createMood(db, p),
  [MOOD_CHANNELS.update]: (db, p) => updateMood(db, p),
  [MOOD_CHANNELS.delete]: deleteMood,
  [HABITS_CHANNELS.list]: listHabits,
  [HABITS_CHANNELS.create]: (db, p) => createHabit(db, p),
  [HABITS_CHANNELS.update]: updateHabit,
  [HABITS_CHANNELS.archive]: archiveHabit,
  [HABITS_CHANNELS.unarchive]: unarchiveHabit,
  [HABITS_CHANNELS.listEntries]: listHabitEntries,
  [HABITS_CHANNELS.createEntry]: (db, p) =>
    createHabitEntry(db, p),
  [HABITS_CHANNELS.deleteEntry]: deleteHabitEntry,
  [EXPENSES_CHANNELS.list]: listTransactions,
  [EXPENSES_CHANNELS.create]: (db, p) =>
    createTransaction(db, p),
  [EXPENSES_CHANNELS.update]: (db, p) =>
    updateTransaction(db, p),
  [EXPENSES_CHANNELS.delete]: deleteTransaction,
  [EXPENSES_CHANNELS.listCategories]: listCategories,
  [EXPENSES_CHANNELS.createCategory]: createCategory,
  [EXPENSES_CHANNELS.getBudget]: getBudget,
  [EXPENSES_CHANNELS.setBudget]: setBudget
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
