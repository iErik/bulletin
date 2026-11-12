import { describe, expect, it } from 'vitest'
import { amountTone, orderRows } from './rows'

describe('orderRows', () => {
  it('puts the oldest first', () => {
    const rows = [
      { id: 1, date: '2026-11-12' },
      { id: 2, date: '2026-11-03' },
      { id: 3, date: '2026-11-30' }
    ]

    expect(orderRows(rows).map(row => row.id))
      .toEqual([2, 1, 3])
  })

  it('keeps the order they were added on a tie', () => {
    const rows = [
      { id: 7, date: '2026-11-03' },
      { id: 2, date: '2026-11-03' },
      { id: 5, date: '2026-11-03' }
    ]

    expect(orderRows(rows).map(row => row.id))
      .toEqual([2, 5, 7])
  })

  it('leaves its argument alone', () => {
    const rows = [
      { id: 2, date: '2026-11-12' },
      { id: 1, date: '2026-11-03' }
    ]

    orderRows(rows)

    expect(rows[0].id).toBe(2)
  })
})

describe('amountTone', () => {
  it.each([
    [2_500_000, 'income'],
    [-3000, 'expense'],
    [0, 'zero']
  ] as const)('calls %i %s', (amount, tone) => {
    expect(amountTone(amount)).toBe(tone)
  })
})
