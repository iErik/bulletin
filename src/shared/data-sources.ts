import type { BulletinApi } from './bridge'

/**
 * Named slices of stored data Widgets reload when a
 * bridge write succeeds (see ADR 0007).
 */
export const DATA_SOURCES = [
  'weight', 'sleep', 'sleepGoal', 'sleepQuality',
  'mood', 'habits', 'habitEntries', 'habitGoal',
  'transactions', 'categories', 'budget', 'tasks'
] as const

export type DataSource = (typeof DATA_SOURCES)[number]

/** Storage namespaces exposed on `BulletinApi`. */
export type BridgeNamespace = {
  [K in keyof BulletinApi]:
  BulletinApi[K] extends (...args: never[]) => unknown
    ? never
    : BulletinApi[K] extends object
      ? K
      : never
}[keyof BulletinApi]

/**
 * Exhaustive map of every `BulletinApi` method to its
 * `DataSource` (writes) or `null` (reads).
 */
export type DataSourceWrites = {
  readonly [N in BridgeNamespace]: Readonly<
    Record<keyof BulletinApi[N], DataSource | null>
  >
}

export const DATA_SOURCE_WRITES = {
  weight: {
    list: null,
    create: 'weight',
    update: 'weight',
    delete: 'weight'
  },
  sleep: {
    list: null,
    create: 'sleep',
    update: 'sleep',
    delete: 'sleep',
    getGoal: null,
    setGoal: 'sleepGoal'
  },
  sleepQuality: {
    list: null,
    create: 'sleepQuality',
    delete: 'sleepQuality'
  },
  mood: {
    list: null,
    create: 'mood',
    update: 'mood',
    delete: 'mood'
  },
  habits: {
    list: null,
    create: 'habits',
    update: 'habits',
    archive: 'habits',
    unarchive: 'habits',
    listEntries: null,
    createEntry: 'habitEntries',
    deleteEntry: 'habitEntries',
    getGoal: null,
    setGoal: 'habitGoal'
  },
  expenses: {
    list: null,
    create: 'transactions',
    update: 'transactions',
    delete: 'transactions',
    listCategories: null,
    createCategory: 'categories',
    getBudget: null,
    setBudget: 'budget'
  },
  tasks: {
    list: null,
    listSomeday: null,
    create: 'tasks',
    update: 'tasks',
    setDone: 'tasks',
    delete: 'tasks'
  }
} as const satisfies DataSourceWrites
