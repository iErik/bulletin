import { describe, expect, it } from 'vitest'
import {
  DATA_SOURCES,
  DATA_SOURCE_WRITES,
  type DataSource
} from './data-sources'
import { EXPENSES_CHANNELS } from './expenses'
import { HABITS_CHANNELS } from './habits'
import { MOOD_CHANNELS } from './mood'
import { SLEEP_CHANNELS } from './sleep'
import { SLEEP_QUALITY_CHANNELS } from './sleep-quality'
import { TASKS_CHANNELS } from './tasks'
import { WEIGHT_CHANNELS } from './weight'

const CHANNELS = {
  weight: WEIGHT_CHANNELS,
  sleep: SLEEP_CHANNELS,
  sleepQuality: SLEEP_QUALITY_CHANNELS,
  mood: MOOD_CHANNELS,
  habits: HABITS_CHANNELS,
  expenses: EXPENSES_CHANNELS,
  tasks: TASKS_CHANNELS
} as const

describe('DATA_SOURCE_WRITES', () => {
  it('covers every Data Source at least once', () => {
    const used = new Set<DataSource>()
    for (const methods of Object.values(DATA_SOURCE_WRITES)) {
      for (const source of Object.values(methods))
        if (source !== null) used.add(source)
    }

    expect(new Set(DATA_SOURCES).size)
      .toBe(DATA_SOURCES.length)
    expect([...used].sort())
      .toEqual([...DATA_SOURCES].sort())
  })

  it('matches every namespace channel map', () => {
    expect(Object.keys(DATA_SOURCE_WRITES).sort())
      .toEqual(Object.keys(CHANNELS).sort())
    for (const [ns, channels] of Object.entries(CHANNELS)) {
      const writes = DATA_SOURCE_WRITES[
        ns as keyof typeof DATA_SOURCE_WRITES
      ]
      expect(Object.keys(writes).sort())
        .toEqual(Object.keys(channels).sort())
    }
  })

  it('marks reads null and maps sub-source writes', () => {
    const { sleep, habits, expenses, tasks } =
      DATA_SOURCE_WRITES
    expect([
      sleep.list, sleep.getGoal, habits.listEntries,
      expenses.listCategories, expenses.getBudget,
      tasks.listSomeday
    ]).toEqual([null, null, null, null, null, null])
    expect([
      sleep.setGoal, habits.createEntry, habits.setGoal,
      expenses.createCategory, expenses.setBudget,
      tasks.setDone
    ]).toEqual([
      'sleepGoal', 'habitEntries', 'habitGoal',
      'categories', 'budget', 'tasks'
    ])
  })
})
