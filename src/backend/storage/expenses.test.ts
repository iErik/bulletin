import { beforeEach, describe, expect, it } from 'vitest'
import type { Transaction } from '@shared/expenses'
import type { Database } from './database'
import {
  createCategory,
  createTransaction,
  deleteTransaction,
  listCategories,
  listTransactions,
  updateTransaction
} from './expenses'
import { memoryDatabase } from './testing'

// Noon on 15 June 2026, local time.
const now = new Date(2026, 5, 15, 12)
const today = '2026-06-15'

/** The seeded Categories, in seeding order. */
const SEEDED = [
  'Payment',
  'Vice',
  'Cats',
  'Health',
  'Food',
  'Entertainment',
  'Taxes',
  'Subscription',
  'Equipment'
]

let db: Database
beforeEach(() => {
  db = memoryDatabase()
})

const salary = {
  date: today,
  description: 'Salary',
  categoryId: 1,
  amount: 2_500_000
}

const create = (value: unknown): Promise<Transaction> =>
  createTransaction(db, value, now)
const update = (value: unknown): Promise<Transaction> =>
  updateTransaction(db, value, now)
const everything = (): Promise<Transaction[]> =>
  listTransactions(db, { from: '2000-01-01', to: today })
const failsWith = (
  promise: Promise<unknown>,
  error: object
): Promise<void> =>
  expect(promise).rejects.toMatchObject({ error })

describe('listCategories', () => {
  it('lists the seeded Categories by name', async () => {
    expect(await listCategories(db)).toEqual(
      SEEDED
        .map((name, i) => ({ id: i + 1, name }))
        .sort((a, b) => a.name.localeCompare(b.name))
    )
  })
})

describe('createCategory', () => {
  it('saves a trimmed name', async () => {
    const books = await createCategory(db, '  Books ')

    expect(books).toEqual({ id: 10, name: 'Books' })
    expect(await listCategories(db))
      .toContainEqual(books)
  })

  it.each(['food', ' FOOD ', 'Food'])(
    'returns the existing Category for %j',
    async name => {
      expect(await createCategory(db, name))
        .toEqual({ id: 5, name: 'Food' })
      expect(await listCategories(db))
        .toHaveLength(SEEDED.length)
    }
  )

  it('ignores case beyond ASCII', async () => {
    const health = await createCategory(db, 'Saúde')

    expect(await createCategory(db, 'SAÚDE'))
      .toEqual(health)
  })

  it.each([['   '], [''], [3], [null]])(
    'rejects the name %j',
    name => failsWith(createCategory(db, name), {
      code: 'invalid-payload',
      field: ''
    })
  )
})

describe('createTransaction', () => {
  it('saves a Transaction, trimmed', async () => {
    const saved = await create({
      ...salary,
      description: '  Salary '
    })

    expect(saved).toEqual({ id: 1, ...salary })
    expect(await everything()).toEqual([saved])
  })

  it.each([
    ['an Expense', -3000],
    ['zero', 0],
    ['Income', 1]
  ])('allows %s', async (_kind, amount) => {
    expect(await create({ ...salary, amount }))
      .toMatchObject({ amount })
  })

  it('allows an empty description', async () => {
    expect(await create({ ...salary, description: ' ' }))
      .toMatchObject({ description: '' })
  })

  it('rejects a future day', () =>
    failsWith(create({ ...salary, date: '2026-06-16' }), {
      code: 'future-date'
    }))

  it('rejects an unknown Category', () =>
    failsWith(create({ ...salary, categoryId: 99 }), {
      code: 'invalid-payload',
      field: 'categoryId'
    }))

  it.each([
    ['date', { ...salary, date: '2026-02-30' }],
    ['date', { ...salary, date: undefined }],
    ['description', { ...salary, description: 1 }],
    ['categoryId', { ...salary, categoryId: 0 }],
    ['amount', { ...salary, amount: 1.5 }],
    ['amount', { ...salary, amount: '100' }],
    ['', { ...salary, type: 'income' }],
    ['', { ...salary, currency: 'BRL' }],
    ['', null]
  ])('rejects an invalid %s: %j', (field, value) =>
    failsWith(create(value), {
      code: 'invalid-payload',
      field
    }))
})

describe('listTransactions', () => {
  it('lists the range by day, then id', async () => {
    const late = await create(salary)
    const early = await create({
      ...salary,
      date: '2026-06-01'
    })
    const late2 = await create({
      ...salary,
      amount: -100
    })
    await create({ ...salary, date: '2026-05-31' })

    expect(await listTransactions(db, {
      from: '2026-06-01',
      to: today
    })).toEqual([early, late, late2])
  })

  it('rejects a reversed range', () =>
    failsWith(listTransactions(db, {
      from: today,
      to: '2026-06-01'
    }), { code: 'invalid-payload', field: 'to' }))
})

describe('updateTransaction', () => {
  it('replaces every field', async () => {
    const { id } = await create(salary)
    const changed = {
      id,
      date: '2026-06-10',
      description: 'Cat food',
      categoryId: 3,
      amount: -10_245
    }

    expect(await update(changed)).toEqual(changed)
    expect(await everything()).toEqual([changed])
  })

  it('rejects a missing Transaction', () =>
    failsWith(update({ ...salary, id: 7 }), {
      code: 'not-found'
    }))

  it('rejects a future day', async () => {
    const { id } = await create(salary)

    await failsWith(
      update({ ...salary, id, date: '2026-07-01' }),
      { code: 'future-date' }
    )
  })

  it('rejects an unknown Category', async () => {
    const { id } = await create(salary)

    await failsWith(
      update({ ...salary, id, categoryId: 42 }),
      { code: 'invalid-payload', field: 'categoryId' }
    )
  })

  it('rejects a missing id', () =>
    failsWith(update(salary), {
      code: 'invalid-payload',
      field: 'id'
    }))
})

describe('deleteTransaction', () => {
  it('deletes by id', async () => {
    const { id } = await create(salary)

    expect(await deleteTransaction(db, id)).toBeNull()
    expect(await everything()).toEqual([])
  })

  it('rejects a missing Transaction', () =>
    failsWith(deleteTransaction(db, 1), {
      code: 'not-found'
    }))

  it('rejects an invalid id', () =>
    failsWith(deleteTransaction(db, -1), {
      code: 'invalid-payload',
      field: ''
    }))
})
