import { contextBridge, ipcRenderer } from 'electron'
import {
  BRIDGE_KEY,
  WINDOW_CONTROLS_CHANNEL,
  type BulletinApi
} from '@shared/bridge'
import {
  DATA_SOURCE_WRITES,
  type DataSource
} from '@shared/data-sources'
import {
  EXPENSES_CHANNELS,
  type ExpensesApi
} from '@shared/expenses'
import {
  HABITS_CHANNELS,
  type HabitsApi
} from '@shared/habits'
import { MOOD_CHANNELS, type MoodApi } from '@shared/mood'
import {
  RECURRING_TASKS_CHANNELS,
  type RecurringTasksApi
} from '@shared/recurring-tasks'
import {
  REMINDERS_CHANNELS,
  type RemindersApi
} from '@shared/reminders'
import {
  SLEEP_CHANNELS,
  type SleepApi
} from '@shared/sleep'
import {
  SLEEP_QUALITY_CHANNELS,
  type SleepQualityApi
} from '@shared/sleep-quality'
import {
  TASKS_CHANNELS,
  type TasksApi
} from '@shared/tasks'
import {
  WEIGHT_CHANNELS,
  type WeightApi
} from '@shared/weight'

const listeners = new Set<(source: DataSource) => void>()

const notify = (source: DataSource): void => {
  for (const listener of listeners) {
    try {
      listener(source)
    } catch {
      // One throwing listener must not stop the rest.
    }
  }
}

const isOk = (result: unknown): boolean =>
  typeof result === 'object'
  && result !== null
  && (result as { ok?: unknown }).ok === true

/**
 * A bridge namespace whose methods invoke `channels`,
 * passing their one payload argument through. Writes
 * in `writes` signal listeners on `{ ok: true }`.
 */
const invoker = <T>(
  channels: Readonly<Record<keyof T, string>>,
  writes: Readonly<Record<keyof T, DataSource | null>>
): T =>
  Object.fromEntries(
    Object.entries<string>(channels).map(
      ([method, channel]) => {
        const source = writes[method as keyof T]
        return [
          method,
          source === null
            ? (payload: unknown) =>
                ipcRenderer.invoke(channel, payload)
            : async (payload: unknown) => {
              const result: unknown = await ipcRenderer
                .invoke(channel, payload)
              if (isOk(result)) notify(source)
              return result
            }
        ]
      }
    )
  ) as T

const api: BulletinApi = {
  platform: process.platform,
  setWindowControlsColours: colours =>
    ipcRenderer.send(WINDOW_CONTROLS_CHANNEL, colours),
  onDataChange: listener => {
    listeners.add(listener)
    return () => void listeners.delete(listener)
  },
  weight: invoker<WeightApi>(
    WEIGHT_CHANNELS, DATA_SOURCE_WRITES.weight),
  sleep: invoker<SleepApi>(
    SLEEP_CHANNELS, DATA_SOURCE_WRITES.sleep),
  sleepQuality: invoker<SleepQualityApi>(
    SLEEP_QUALITY_CHANNELS,
    DATA_SOURCE_WRITES.sleepQuality),
  mood: invoker<MoodApi>(
    MOOD_CHANNELS, DATA_SOURCE_WRITES.mood),
  habits: invoker<HabitsApi>(
    HABITS_CHANNELS, DATA_SOURCE_WRITES.habits),
  expenses: invoker<ExpensesApi>(
    EXPENSES_CHANNELS, DATA_SOURCE_WRITES.expenses),
  tasks: invoker<TasksApi>(
    TASKS_CHANNELS, DATA_SOURCE_WRITES.tasks),
  recurringTasks: invoker<RecurringTasksApi>(
    RECURRING_TASKS_CHANNELS,
    DATA_SOURCE_WRITES.recurringTasks),
  reminders: invoker<RemindersApi>(
    REMINDERS_CHANNELS, DATA_SOURCE_WRITES.reminders)
}

contextBridge.exposeInMainWorld(BRIDGE_KEY, api)
