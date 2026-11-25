import { vi, type Mock } from 'vitest'
import type { BulletinApi } from '@shared/bridge'
import {
  DATA_SOURCE_WRITES,
  type DataSource
} from '@shared/data-sources'
import type {
  ExpensesApi,
  NewTransaction
} from '@shared/expenses'
import {
  HABIT_GOAL,
  type Habit,
  type HabitsApi
} from '@shared/habits'
import type { MoodApi } from '@shared/mood'
import type {
  NewRecurringTask,
  Occurrence,
  OccurrenceDone,
  OccurrenceUpdate,
  RecurringTask,
  RecurringTasksApi,
  RecurringTaskUpdate
} from '@shared/recurring-tasks'
import type { RemindersApi } from '@shared/reminders'
import {
  SLEEP_GOAL_DEFAULT_MINUTES,
  type NewSleepPeriod,
  type SleepApi
} from '@shared/sleep'
import type { SleepQualityApi } from '@shared/sleep-quality'
import type {
  NewTask,
  TaskDone,
  TasksApi
} from '@shared/tasks'
import type { WeightApi } from '@shared/weight'

/** Resolves every call with `value`, successfully. */
const resolves = (value: unknown): Mock =>
  vi.fn().mockResolvedValue({ ok: true, value })

/** Resolves every call with its own payload. */
const echoes = <T>(
  make = (value: T) => value
): Mock<(value: T) => Promise<{ ok: true; value: T }>> =>
  vi.fn(async (value: T) => ({
    ok: true as const,
    value: make(value)
  }))

/**
 * Empty storage: lists are empty, writes echo their
 * payload and deletes succeed.
 */
const fakeWeight = (): WeightApi => ({
  list: resolves([]),
  create: echoes(),
  update: echoes(),
  delete: resolves(null)
})

/** Empty Sleep storage; created Periods get id 1. */
const fakeSleep = (): SleepApi => ({
  list: resolves([]),
  create: echoes((period: NewSleepPeriod) =>
    ({ id: 1, ...period })),
  update: echoes(),
  delete: resolves(null),
  getGoal: resolves(SLEEP_GOAL_DEFAULT_MINUTES),
  setGoal: echoes()
})

/** Empty Sleep Quality storage, like `fakeWeight`. */
const fakeSleepQuality = (): SleepQualityApi => ({
  list: resolves([]),
  create: echoes(),
  delete: resolves(null)
})

/** Empty Mood storage, like `fakeWeight`. */
const fakeMood = (): MoodApi => ({
  list: resolves([]),
  create: echoes(),
  update: echoes(),
  delete: resolves(null)
})

/**
 * No Habits yet: created and changed Habits are
 * Habit 1, created 2026-01-01, with the payload's
 * fields. Its Entries work like `fakeWeight`.
 */
const fakeHabits = (): HabitsApi => {
  const habit: Habit = {
    id: 1,
    name: 'Habit',
    icon: 'meditation',
    created: '2026-01-01',
    archived: false,
    archivePeriods: []
  }
  return {
    list: resolves([]),
    create: echoes(changes => ({ ...habit, ...changes })),
    update: echoes(changes => ({ ...habit, ...changes })),
    archive: resolves({ ...habit, archived: true }),
    unarchive: resolves(habit),
    listEntries: resolves([]),
    createEntry: echoes(),
    deleteEntry: resolves(null),
    getGoal: resolves(HABIT_GOAL.default),
    setGoal: echoes()
  }
}

/**
 * No Transactions, Categories or Budgets: created
 * Transactions get id 1, created Categories are
 * Category 1 with the given name, and set Budgets
 * echo back.
 */
const fakeExpenses = (): ExpensesApi => ({
  list: resolves([]),
  create: echoes((transaction: NewTransaction) =>
    ({ id: 1, ...transaction })),
  update: echoes(),
  delete: resolves(null),
  listCategories: resolves([]),
  createCategory: vi.fn(async (name: string) => ({
    ok: true as const,
    value: { id: 1, name }
  })),
  getBudget: resolves(null),
  setBudget: echoes()
})

/** No Tasks: created get id 1; updates merge onto it. */
const fakeTasks = (): TasksApi => {
  const task = {
    id: 1,
    title: 'Task',
    day: '2026-01-01' as const,
    time: null,
    reminder: null,
    doneAt: null,
    created: 0,
    moves: 0
  }
  return {
    list: resolves([]),
    listSomeday: resolves([]),
    create: echoes((value: NewTask) => ({
      ...task,
      ...value,
      reminder: value.reminder ?? null
    })),
    update: echoes(changes => ({ ...task, ...changes })),
    setDone: vi.fn(async ({ id, done }: TaskDone) => ({
      ok: true as const,
      value: { ...task, id, doneAt: done ? 1 : null }
    })),
    delete: resolves(null)
  }
}

/** No Recurring Tasks: created get id 1. */
const fakeRecurringTasks = (): RecurringTasksApi => {
  const rule: RecurringTask = {
    id: 1,
    title: 'Recurring Task',
    time: null,
    reminder: null,
    schedule: { kind: 'days', every: 1 },
    firstDay: '2026-01-01',
    lastDay: null,
    created: 0
  }
  const occ = (
    ruleId: number,
    scheduled: string
  ): Occurrence => ({
    ruleId,
    scheduled,
    title: rule.title,
    day: scheduled,
    time: rule.time,
    reminder: rule.reminder,
    doneAt: null,
    moves: 0,
    created: rule.created
  })
  return {
    list: resolves([]),
    create: echoes((value: NewRecurringTask) => ({
      ...rule,
      ...value,
      reminder: value.reminder ?? null
    })),
    update: echoes((changes: RecurringTaskUpdate) =>
      ({ ...rule, ...changes })),
    stop: resolves({ ...rule, lastDay: '2026-01-01' }),
    delete: resolves(null),
    listOccurrences: resolves([]),
    updateOccurrence: vi.fn(
      async (changes: OccurrenceUpdate) => ({
        ok: true as const,
        value: {
          ...occ(changes.ruleId, changes.scheduled),
          ...changes
        }
      })
    ),
    setOccurrenceDone: vi.fn(
      async ({ ruleId, scheduled, done }: OccurrenceDone) => ({
        ok: true as const,
        value: {
          ...occ(ruleId, scheduled),
          doneAt: done ? 1 : null
        }
      })
    ),
    skipOccurrence: resolves(null)
  }
}

/** Empty Reminders: none due; markNotified resolves to 1. */
const fakeReminders = (): RemindersApi => ({
  listDue: resolves([]),
  markNotified: resolves(1)
})

type AnyFn = (...args: unknown[]) => unknown

// Maps a wrapped Proxy back to its target so spreading
// `{ ...stubBulletin().sleep }` rebinds notifications
// without stacking Proxies.
const originals = new WeakMap<AnyFn, AnyFn>()

const isOk = (result: unknown): boolean =>
  typeof result === 'object'
  && result !== null
  && (result as { ok?: unknown }).ok === true

const wrapWrite = (
  fn: AnyFn,
  source: DataSource,
  notify: (changed: DataSource) => void
): AnyFn => {
  const target = originals.get(fn) ?? fn
  const proxy = new Proxy(target, {
    apply(raw, thisArg, args: unknown[]) {
      const result: unknown = Reflect.apply(
        raw, thisArg, args)
      if (!(result instanceof Promise)) return result
      return result.then((resolved: unknown) => {
        if (isOk(resolved)) notify(source)
        return resolved
      })
    }
  })
  originals.set(proxy, target)
  return proxy
}

const wrapNamespace = (
  namespace: object,
  writes: Record<string, DataSource | null>,
  notify: (changed: DataSource) => void
): Record<string, unknown> => {
  const wrapped = { ...namespace } as Record<
    string, unknown
  >
  for (const [method, source] of Object.entries(writes)) {
    const fn = wrapped[method]
    if (source !== null && typeof fn === 'function')
      wrapped[method] = wrapWrite(fn as AnyFn, source, notify)
  }
  return wrapped
}

/**
 * A fake preload API for renderer tests. Typed against
 * `BulletinApi`, so it stops compiling when the bridge
 * changes: add new members here with test defaults.
 */
export const fakeBulletin = (
  overrides: Partial<BulletinApi> = {}
): BulletinApi => {
  const listeners = new Set<(source: DataSource) => void>()
  const notify = (source: DataSource): void => {
    for (const listener of listeners) {
      try {
        listener(source)
      } catch {
        // Match preload: one throw does not stop others.
      }
    }
  }
  const api: BulletinApi = {
    platform: 'testos',
    setWindowControlsColours: vi.fn(),
    onDataChange: listener => {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    weight: fakeWeight(),
    sleep: fakeSleep(),
    sleepQuality: fakeSleepQuality(),
    mood: fakeMood(),
    habits: fakeHabits(),
    expenses: fakeExpenses(),
    tasks: fakeTasks(),
    recurringTasks: fakeRecurringTasks(),
    reminders: fakeReminders(),
    ...overrides
  }
  const wrapped = { ...api } as Record<string, unknown>
  for (const [ns, writes] of
    Object.entries(DATA_SOURCE_WRITES)) {
    wrapped[ns] = wrapNamespace(
      wrapped[ns] as object, writes, notify)
  }
  return wrapped as unknown as BulletinApi
}

/**
 * Replaces `window.bulletin` for the current test only;
 * globals are unstubbed after each test.
 */
export const stubBulletin = (
  overrides: Partial<BulletinApi> = {}
): BulletinApi => {
  const api = fakeBulletin(overrides)
  vi.stubGlobal('bulletin', api)
  return api
}
