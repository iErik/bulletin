import { afterEach, describe, expect, it } from 'vitest'
import {
  type DOMWrapper,
  enableAutoUnmount,
  mount,
  type VueWrapper
} from '@vue/test-utils'
import type { Budget, Transaction } from '@shared/expenses'
import {
  monthPace,
  type MonthPace
} from '@/expenses/month-pace'
import { setLocaleOverride } from '@/locale/format'
import MonthPaceBars from './MonthPaceBars.vue'

let nextId = 1

const tx = (
  date: string,
  amount: number,
  description = 'Item'
): Transaction => ({
  id: nextId++,
  date,
  description,
  categoryId: 1,
  amount
})

const budget = (amount: number): Budget => ({
  month: '2026-11',
  amount
})

const nov = (day: number): Date => new Date(2026, 10, day)

const mountBars = (
  pace: MonthPace,
  extra: Partial<{
    padLeft: number
    padRight: number
  }> = {}
): VueWrapper => mount(MonthPaceBars, {
  props: { pace, ...extra }
})

const barOf = (
  wrapper: VueWrapper,
  day: number
): DOMWrapper<Element> =>
  wrapper.find(`.bar[data-day="${day}"]`)

describe('MonthPaceBars', () => {
  enableAutoUnmount(afterEach)
  afterEach(() => setLocaleOverride(null))

  it('draws normal and bright bars, and skips 0-spend days', () => {
    // 1,000 over 5 days -> avg 200; bright from 400.
    // Day 1: 100 (normal), Day 2: 0 (no bar),
    // Day 3: 400 (bright, 2x avg), Day 4: 500 (bright),
    // Day 5: 0 (no bar). Cap is 800.
    const pace = monthPace(
      [
        tx('2026-11-01', -100),
        tx('2026-11-03', -400),
        tx('2026-11-04', -500)
      ],
      null,
      nov(5)
    )
    const wrapper = mountBars(pace)

    expect(wrapper.findAll('.bar')).toHaveLength(3)
    expect(barOf(wrapper, 1).classes())
      .not.toContain('-bright')
    expect(Number(barOf(wrapper, 1).attributes('height')))
      .toBeCloseTo(11.5)
    expect(barOf(wrapper, 1).attributes('rx')).toBe('3')
    expect(barOf(wrapper, 1).attributes('width')).toBe('12')

    expect(barOf(wrapper, 2).exists()).toBe(false)
    expect(wrapper.find('.rest[data-day="2"]').exists())
      .toBe(false)

    expect(barOf(wrapper, 3).classes()).toContain('-bright')
    expect(Number(barOf(wrapper, 3).attributes('height')))
      .toBeCloseTo(46)

    expect(barOf(wrapper, 4).classes()).toContain('-bright')
    expect(Number(barOf(wrapper, 4).attributes('height')))
      .toBeCloseTo(57.5)

    expect(barOf(wrapper, 5).exists()).toBe(false)
    expect(wrapper.findAll('.cap')).toHaveLength(0)
  })

  it('caps bars above 4x average at 92px with an arrow', () => {
    // 2,500 over 10 days -> avg 250, cap 1,000.
    // Day 10 spends 1,300 -> capped at 92px with `↑`.
    const spends = [
      100, 400, 100, 100, 100, 100, 100, 100, 100, 1_300
    ]
    const pace = monthPace(
      spends.map((amount, i) =>
        tx(
          `2026-11-${String(i + 1).padStart(2, '0')}`,
          -amount
        )),
      null,
      nov(10)
    )
    const wrapper = mountBars(pace)

    const capped = barOf(wrapper, 10)
    expect(capped.classes()).toContain('-bright')
    expect(Number(capped.attributes('height'))).toBe(92)

    const caps = wrapper.findAll('.cap')
    expect(caps).toHaveLength(1)
    expect(caps[0].text()).toBe('↑')
    expect(caps[0].attributes('data-day')).toBe('10')
    expect(Number(caps[0].attributes('y')))
      .toBeLessThan(Number(capped.attributes('y')))
  })

  it('draws placeholder dashes only for days left', () => {
    const pace = monthPace(
      [tx('2026-11-01', -10_000)],
      null,
      nov(21)
    )
    const wrapper = mountBars(pace)

    const rests = wrapper.findAll('.rest')
    expect(rests).toHaveLength(9)
    expect(rests.map(el => el.attributes('data-day'))).toEqual(
      ['22', '23', '24', '25', '26', '27', '28', '29', '30']
    )
    expect(rests[0].attributes()).toMatchObject({
      width: '12',
      height: '2',
      rx: '1'
    })
    // The dashes share the bars' baseline.
    const bar = barOf(wrapper, 1)
    const barBottom = Number(bar.attributes('y'))
      + Number(bar.attributes('height'))
    const restBottom = Number(rests[0].attributes('y'))
      + Number(rests[0].attributes('height'))
    expect(restBottom).toBeCloseTo(barBottom)
  })

  it('shows average with cents and omits excl. without Large', () => {
    setLocaleOverride('en-US')
    const pace = monthPace(
      [tx('2026-11-01', -18_100)],
      null,
      nov(1)
    )
    const wrapper = mountBars(pace)

    expect(wrapper.get('.heading').text()).toBe('Daily spend')
    expect(wrapper.get('.caption').text())
      .toBe('avg R$181.00 / day')
    expect(wrapper.get('svg').attributes('role')).toBe('img')
    expect(wrapper.get('svg').attributes('aria-label'))
      .toBe('Daily spend, average R$181.00 per day')
  })

  it('appends Large Expense label and +N count to caption', () => {
    setLocaleOverride('en-US')
    const oneLarge = monthPace(
      [
        tx('2026-11-05', -379_500, 'Groceries'),
        tx('2026-11-12', -1_299_300, 'MPB M5')
      ],
      budget(2_400_000),
      nov(21)
    )
    const first = mountBars(oneLarge)
    expect(first.get('.caption').text())
      .toBe('avg R$180.71 / day  (excl. MPB M5)')
    expect(first.get('svg').attributes('aria-label'))
      .toBe(
        'Daily spend, average R$180.71 per day, '
        + 'excluding MPB M5'
      )

    const manyLarge = monthPace(
      [
        tx('2026-11-05', -379_500, 'Groceries'),
        tx('2026-11-12', -1_299_300, 'MPB M5'),
        tx('2026-11-14', -700_000, 'Sofa'),
        tx('2026-11-16', -650_000, 'Rent')
      ],
      budget(2_400_000),
      nov(21)
    )
    expect(mountBars(manyLarge).get('.caption').text())
      .toBe('avg R$180.71 / day  (excl. MPB M5 +2)')
  })

  it('formats caption currency according to Locale', () => {
    const pace = monthPace(
      [
        tx('2026-11-01', -18_150),
        tx('2026-11-02', -1_200_000, 'MPB M5')
      ],
      budget(2_400_000),
      nov(2)
    )

    setLocaleOverride('en-US')
    const us = mountBars(pace)
    expect(us.get('.caption').text())
      .toBe('avg R$90.75 / day  (excl. MPB M5)')

    setLocaleOverride('pt-BR')
    const br = mountBars(pace)
    expect(br.get('.caption').text())
      .toBe('avg R$\u00a090,75 / day  (excl. MPB M5)')
  })

  it('handles zero average when all spend is Large without NaN', () => {
    setLocaleOverride('en-US')
    const pace = monthPace(
      [
        tx('2026-11-02', -1_000_000, 'Laptop'),
        tx('2026-11-04', -500_000, 'Monitor')
      ],
      budget(1_000_000),
      nov(5)
    )
    const wrapper = mountBars(pace)

    expect(pace.averagePerDay).toBe(0)
    expect(wrapper.get('.caption').text())
      .toBe('avg R$0.00 / day  (excl. Laptop +1)')
    expect(Number(barOf(wrapper, 2).attributes('height')))
      .toBe(92)
    expect(Number(barOf(wrapper, 4).attributes('height')))
      .toBeCloseTo(46)
    expect(wrapper.findAll('.cap')).toHaveLength(0)

    for (const rect of wrapper.findAll('rect')) {
      for (const attr of ['x', 'y', 'width', 'height']) {
        expect(Number.isNaN(Number(rect.attributes(attr))))
          .toBe(false)
      }
    }
  })

  it('renders day labels aligned with their bars', () => {
    const pace = monthPace([], null, nov(10))
    const wrapper = mountBars(pace)

    const labels = wrapper.findAll('.day')
    expect(labels.map(el => el.text()))
      .toEqual(['1', '5', '10', '15', '20', '25', '30'])

    // Day 1 at padLeft (56), day 30 at 700 - padRight (690).
    expect(Number(labels[0].attributes('x'))).toBeCloseTo(56)
    expect(Number(labels[6].attributes('x'))).toBeCloseTo(690)

    // Day 30's rest dash is centred on label 30's x.
    const rest30 = wrapper.get('.rest[data-day="30"]')
    const restCentre = Number(rest30.attributes('x'))
      + Number(rest30.attributes('width')) / 2
    expect(restCentre).toBeCloseTo(
      Number(labels[6].attributes('x'))
    )
  })

  it('omits 30 on a 28-day month', () => {
    const pace = monthPace([], null, new Date(2026, 1, 10))
    const wrapper = mountBars(pace)

    expect(wrapper.findAll('.day').map(el => el.text()))
      .toEqual(['1', '5', '10', '15', '20', '25'])
  })
})
