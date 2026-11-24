import { beforeEach, describe, expect, it } from 'vitest'
import type { Transaction } from '@shared/expenses'
import { setLocaleOverride } from '@/locale/format'
import {
  recurringCaption,
  recurringExpenses,
  recurringFooter
} from './recurring'

let nextId = 1

const tx = (
  date: string,
  amount: number,
  description = 'Spotify'
): Transaction => ({
  id: nextId++,
  date,
  description,
  categoryId: 1,
  amount
})

/** One Expense per date, all with `description`. */
const monthly = (
  description: string,
  amount: number,
  ...dates: string[]
): Transaction[] =>
  dates.map(date => tx(date, amount, description))

const NOV_20 = new Date(2026, 10, 20)

// Intl separates some parts with no-break spaces.
const plain = (text: string): string =>
  text.replace(/[  ]/g, ' ')

beforeEach(() => setLocaleOverride('en-US'))

describe('recurringExpenses', () => {
  it('detects Sep 8, Oct 8 and Nov 8 on Nov 20', () => {
    const { expenses } = recurringExpenses(
      monthly(
        'Spotify', -2_190,
        '2026-09-08', '2026-10-08', '2026-11-08'
      ),
      NOV_20
    )

    expect(expenses).toEqual([{
      description: 'Spotify',
      amount: 2_190,
      latest: '2026-11-08',
      nextDue: '2026-12-08',
      daysUntilDue: 18
    }])
    expect(recurringCaption(expenses[0]))
      .toBe('Monthly · 8th · next Dec 8')
  })

  it('ignores case and surrounding spaces', () => {
    const { expenses } = recurringExpenses(
      [
        tx('2026-09-08', -2_190, 'spotify '),
        tx('2026-10-08', -2_190, ' SPOTIFY'),
        tx('2026-11-08', -2_190, 'Spotify')
      ],
      NOV_20
    )

    expect(expenses.map(e => e.description))
      .toEqual(['Spotify'])
  })

  it('writes the description as its latest occurrence does', () => {
    const { expenses } = recurringExpenses(
      [
        tx('2026-11-08', -2_190, ' spotify '),
        tx('2026-09-08', -2_190, 'Spotify'),
        tx('2026-10-08', -2_190, 'SPOTIFY')
      ],
      NOV_20
    )

    expect(expenses[0].description).toBe('spotify')
  })

  it('skips a month gap', () => {
    const { expenses } = recurringExpenses(
      monthly('Spotify', -2_190, '2026-09-08', '2026-11-08'),
      NOV_20
    )

    expect(expenses).toEqual([])
  })

  it('needs the months to end with the Selected Date’s when it has one', () => {
    // Jul–Sep recur, but November's occurrence makes
    // Sep–Nov the months, and October is missing.
    const { expenses } = recurringExpenses(
      monthly(
        'Gym', -10_000,
        '2026-07-05', '2026-08-05', '2026-09-05',
        '2026-11-05'
      ),
      NOV_20
    )

    expect(expenses).toEqual([])
  })

  it('still detects Aug–Oct before November’s occurrence', () => {
    const transactions = monthly(
      'Internet', -11_990,
      '2026-08-15', '2026-09-15', '2026-10-15'
    )

    const early = recurringExpenses(
      transactions,
      new Date(2026, 10, 10)
    ).expenses[0]
    expect(early.nextDue).toBe('2026-11-15')
    expect(recurringCaption(early))
      .toBe('Monthly · 15th · next in 5 days')

    const late = recurringExpenses(
      transactions,
      NOV_20
    ).expenses[0]
    expect(late.daysUntilDue).toBe(-5)
    expect(recurringCaption(late))
      .toBe('Monthly · 15th · due Nov 15')
  })

  it('stops detecting it once two months are missing', () => {
    const { expenses } = recurringExpenses(
      monthly(
        'Internet', -11_990,
        '2026-07-15', '2026-08-15', '2026-09-15'
      ),
      NOV_20
    )

    expect(expenses).toEqual([])
  })

  it.each([
    ['2027-01-31', '2027-02-28', new Date(2027, 1, 1)],
    ['2028-01-31', '2028-02-29', new Date(2028, 1, 1)]
  ])(
    'caps a %s occurrence’s next due date at %s',
    (latest, nextDue, day) => {
      const [year] = latest.split('-').map(Number)
      const { expenses } = recurringExpenses(
        monthly(
          'Rent', -150_000,
          `${year - 1}-11-30`, `${year - 1}-12-31`, latest
        ),
        day
      )

      expect(expenses[0].nextDue).toBe(nextDue)
      expect(recurringCaption(expenses[0]))
        .toBe(`Monthly · 31st · next Feb ${nextDue.slice(8)}`)
    }
  )

  it('uses the latest occurrence’s amount', () => {
    const { expenses, monthly: total } = recurringExpenses(
      [
        ...monthly(
          'Spotify', -1_990,
          '2026-09-08', '2026-10-08'
        ),
        // Created first on the same day: not the latest.
        tx('2026-11-08', -999, 'Spotify'),
        tx('2026-11-08', -2_190, 'Spotify'),
        ...monthly(
          'Internet', -11_990,
          '2026-09-15', '2026-10-15', '2026-11-15'
        )
      ].sort((a, b) => b.id - a.id),
      NOV_20
    )

    expect(expenses.map(e => [e.description, e.amount]))
      .toEqual([['Internet', 11_990], ['Spotify', 2_190]])
    expect(total).toBe(14_180)
  })

  it('ignores Expenses after the Selected Date', () => {
    const { expenses } = recurringExpenses(
      monthly(
        'Spotify', -2_190,
        '2026-09-08', '2026-10-08', '2026-11-08'
      ),
      new Date(2026, 10, 7)
    )

    expect(expenses).toEqual([])
  })

  it('ignores Income, zero amounts and blank descriptions', () => {
    const dates = ['2026-09-01', '2026-10-01', '2026-11-01']
    const { expenses } = recurringExpenses(
      [
        ...monthly('Salary', 1_000_000, ...dates),
        ...monthly('Refund', 0, ...dates),
        ...monthly('  ', -5_000, ...dates)
      ],
      NOV_20
    )

    expect(expenses).toEqual([])
  })

  it('sorts by amount, largest first, then description', () => {
    const dates = ['2026-09-03', '2026-10-03', '2026-11-03']
    const { expenses } = recurringExpenses(
      [
        ...monthly('pCloud', -5_337, ...dates),
        ...monthly('DAS', -228_218, ...dates),
        ...monthly('Netflix', -5_337, ...dates)
      ],
      NOV_20
    )

    expect(expenses.map(e => e.description))
      .toEqual(['DAS', 'Netflix', 'pCloud'])
  })

  it('counts down due dates up to 7 days ahead', () => {
    const transactions = monthly(
      'DAS', -228_218,
      '2026-08-20', '2026-09-20', '2026-10-20'
    )
    const caption = (day: number): string =>
      recurringCaption(recurringExpenses(
        transactions,
        new Date(2026, 10, day)
      ).expenses[0])

    expect(caption(12)).toBe('Monthly · 20th · next Nov 20')
    expect(caption(13))
      .toBe('Monthly · 20th · next in 7 days')
    expect(caption(19))
      .toBe('Monthly · 20th · next in 1 day')
    expect(caption(20)).toBe('Monthly · 20th · next today')
    expect(caption(21)).toBe('Monthly · 20th · due Nov 20')
  })
})

describe('income share and footer', () => {
  const recurring = [
    ...monthly(
      'DAS', -228_218,
      '2026-09-20', '2026-10-20', '2026-11-20'
    ),
    ...monthly(
      'Internet', -11_990,
      '2026-09-15', '2026-10-15', '2026-11-15'
    ),
    ...monthly(
      'pCloud', -5_337,
      '2026-09-03', '2026-10-03', '2026-11-03'
    ),
    ...monthly(
      'Spotify', -2_190,
      '2026-09-08', '2026-10-08', '2026-11-08'
    )
  ]

  it('shares the Selected Date month’s Income so far', () => {
    const result = recurringExpenses(
      [
        ...recurring,
        // Only November's Income up to Nov 20 counts.
        tx('2026-10-05', 9_000_000, 'Salary'),
        tx('2026-11-05', 2_400_000, 'Salary'),
        tx('2026-11-21', 9_000_000, 'Bonus')
      ],
      NOV_20
    )

    expect(result.monthly).toBe(247_735)
    expect(result.incomeShare).toBe(10)
    expect(plain(recurringFooter(result)))
      .toBe('R$2,477.35 / month fixed · 10% of income')
  })

  it('drops the share without Income', () => {
    const result = recurringExpenses(recurring, NOV_20)

    expect(result.incomeShare).toBeNull()
    expect(plain(recurringFooter(result)))
      .toBe('R$2,477.35 / month fixed')
  })

  it('totals nothing without Recurring Expenses', () => {
    expect(recurringExpenses([], NOV_20)).toEqual({
      expenses: [],
      monthly: 0,
      incomeShare: null
    })
  })
})
