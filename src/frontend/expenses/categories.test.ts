import { describe, expect, it } from 'vitest'
import type { Category } from '@shared/expenses'
import { useFixedToday } from '@/testing/clock'
import { categoryChoices } from './categories'

const CATEGORIES: Category[] = [
  { id: 1, name: 'Transport' },
  { id: 2, name: 'Food' },
  { id: 3, name: 'Fast food' },
  { id: 4, name: 'Bills' }
]

/** Each choice as a short label. */
const labels = (query: string): string[] =>
  categoryChoices(CATEGORIES, query).map(choice =>
    choice.kind === 'pick'
      ? choice.category.name
      : `+ ${choice.name}`)

describe('categoryChoices', () => {
  useFixedToday()

  it('offers every Category alphabetically', () => {
    expect(labels(''))
      .toEqual(['Bills', 'Fast food', 'Food', 'Transport'])
  })

  it('filters by name, ignoring case', () => {
    expect(labels('FOO')).toEqual(['Fast food', 'Food', '+ FOO'])
  })

  it('puts an exact match first, with nothing to create',
    () => {
      expect(labels(' food ')).toEqual(['Food', 'Fast food'])
    })

  it('offers to create a name nothing matches', () => {
    expect(labels('  Gym ')).toEqual(['+ Gym'])
  })

  it('ignores blank text', () => {
    expect(labels('   ')).toHaveLength(4)
  })
})
