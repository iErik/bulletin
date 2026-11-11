import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

// The override is module state: import a fresh copy in
// each test.
const loadIn = async (
  tag: string
): Promise<typeof import('./format')> => {
  const format = await import('./format')
  format.setLocaleOverride(tag)
  return format
}

const SEP_1 = new Date(2026, 8, 1)
const SEP_14 = new Date(2026, 8, 14) // a Monday

// Intl separates some parts with no-break spaces.
const plain = (text: string): string =>
  text.replace(/[  ]/g, ' ')

describe('format', () => {
  beforeEach(() => vi.resetModules())

  it.each([
    ['en-US', 'September 1st, 2026'],
    ['pt-BR', '1 de setembro de 2026']
  ])('writes a long date in %s', async (tag, text) => {
    const { formatDate } = await loadIn(tag)

    expect(formatDate(SEP_1, 'long')).toBe(text)
  })

  it.each([
    ['en-US', 'Sep 14', 'September', 'Mon'],
    ['pt-BR', '14 de set.', 'setembro', 'seg.']
  ])(
    'writes short dates and names in %s',
    async (tag, short, month, weekday) => {
      const { formatDate } = await loadIn(tag)

      expect(formatDate(SEP_14, 'short')).toBe(short)
      expect(formatDate(SEP_14, 'month')).toBe(month)
      expect(formatDate(SEP_14, 'weekday'))
        .toBe(weekday)
    }
  )

  it.each([
    ['en-US', 'Sep', 'September 2026'],
    ['pt-BR', 'set.', 'setembro de 2026']
  ])(
    'writes short months and months with years in %s',
    async (tag, monthShort, monthYear) => {
      const { formatDate } = await loadIn(tag)

      expect(formatDate(SEP_14, 'monthShort'))
        .toBe(monthShort)
      expect(formatDate(SEP_14, 'monthYear'))
        .toBe(monthYear)
    }
  )

  it.each([
    ['en-US', '2:05 AM', '2:30 PM'],
    ['pt-BR', '2:05', '14:30']
  ])(
    "writes times on %s's clock",
    async (tag, night, afternoon) => {
      const { formatTime } = await loadIn(tag)
      const at = (h: number, m: number): Date =>
        new Date(2026, 8, 1, h, m)

      expect(plain(formatTime(at(2, 5)))).toBe(night)
      expect(plain(formatTime(at(14, 30))))
        .toBe(afternoon)
    }
  )

  it.each([
    ['en-US', '24,000.5', 'R$24,000.00'],
    ['pt-BR', '24.000,5', 'R$ 24.000,00']
  ])(
    'writes numbers and money in %s',
    async (tag, number, money) => {
      const { formatNumber, formatMoney } =
        await loadIn(tag)

      expect(formatNumber(24000.5)).toBe(number)
      expect(plain(formatMoney(24000))).toBe(money)
    }
  )

  it.each([
    ['en-US', 0],
    ['pt-BR', 0],
    ['en-GB', 1]
  ])('starts weeks in %s on %i', async (tag, day) => {
    const { firstDayOfWeek } = await loadIn(tag)

    expect(firstDayOfWeek()).toBe(day)
  })

  it('falls back to the language, then en-US', async () => {
    const format = await loadIn('pt-AO')
    expect(format.formatDate(SEP_1, 'long'))
      .toBe('1 de setembro de 2026')

    format.setLocaleOverride('xx')
    expect(format.formatDate(SEP_1, 'long'))
      .toBe('September 1st, 2026')
  })

  it('follows the OS until overridden', async () => {
    vi.stubGlobal('navigator', { language: 'pt-BR' })
    const format = await import('./format')
    expect(format.locale()).toBe('pt-BR')

    format.setLocaleOverride('en-GB')
    expect(format.locale()).toBe('en-GB')

    format.setLocaleOverride(null)
    expect(format.locale()).toBe('pt-BR')
  })
})
