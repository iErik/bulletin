import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { setLocaleOverride } from '@/locale/format'
import { today, useFixedToday } from '@/testing/clock'
import { useSelectedDateStore }
  from '@/stores/selected-date'
import DatePicker from './DatePicker.vue'

// Today is November 9th, 2026. Months are 0-based.
const mountOn = (day?: Date) => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useSelectedDateStore()
  if (day) store.setDay(day)
  const picker = mount(DatePicker, {
    global: { plugins: [pinia] }
  })
  return { picker, store }
}

const options = (
  picker: ReturnType<typeof mountOn>['picker'],
  label: string
) =>
  picker
    .findAll(`[aria-label="${label}"] option`)
    .map(option => option.text())

describe('DatePicker', () => {
  useFixedToday()

  it('shows the Selected Date', () => {
    const { picker } = mountOn(new Date(2025, 2, 4))

    const value = (label: string) =>
      (picker.get(`[aria-label="${label}"]`)
        .element as HTMLSelectElement).value

    expect(value('Day')).toBe('4')
    expect(value('Month')).toBe('2')
    expect(value('Year')).toBe('2025')
  })

  it('offers no future month or day', () => {
    const { picker } = mountOn()

    expect(options(picker, 'Month').at(-1))
      .toBe('November')
    expect(options(picker, 'Month')).toHaveLength(11)
    expect(options(picker, 'Day')).toHaveLength(9)
    expect(options(picker, 'Year')[0]).toBe('2026')
  })

  it.each([
    [new Date(2025, 1, 10), 28],
    [new Date(2024, 1, 10), 29],
    [new Date(2025, 3, 10), 30],
    [new Date(2025, 0, 10), 31]
  ])(
    'follows the length of %s\'s month',
    (day, length) => {
      const { picker } = mountOn(day)

      expect(options(picker, 'Day')).toHaveLength(length)
      // A past year offers every month.
      expect(options(picker, 'Month')).toHaveLength(12)
    }
  )

  it('names months in the Locale', () => {
    setLocaleOverride('pt-BR')
    const { picker } = mountOn()

    expect(options(picker, 'Month')[0])
      .toBe('janeiro')
  })

  it('lists 20 years, and an older selected one', () => {
    expect(options(mountOn().picker, 'Year'))
      .toHaveLength(20)

    const years = options(
      mountOn(new Date(1999, 5, 1)).picker,
      'Year'
    )
    expect(years.at(-1)).toBe('1999')
  })

  it('changes the Selected Date', async () => {
    const { picker, store } =
      mountOn(new Date(2025, 2, 4))

    await picker.get('[aria-label="Day"]').setValue('20')
    expect(store.day).toEqual(new Date(2025, 2, 20))

    await picker.get('[aria-label="Month"]').setValue('6')
    expect(store.day).toEqual(new Date(2025, 6, 20))

    await picker.get('[aria-label="Year"]')
      .setValue('2020')
    expect(store.day).toEqual(new Date(2020, 6, 20))
  })

  it.each([
    ['Month', new Date(2026, 0, 31), '1', 2026],
    ['Year', new Date(2024, 1, 29), '2025', 2025]
  ])(
    'clamps the day on a %s change',
    async (label, from, value, year) => {
      const { picker, store } = mountOn(from)

      await picker.get(`[aria-label="${label}"]`)
        .setValue(value)

      expect(store.day).toEqual(new Date(year, 1, 28))
    }
  )

  it('never selects a future date', async () => {
    const { picker, store } =
      mountOn(new Date(2025, 11, 20))

    await picker.get('[aria-label="Year"]')
      .setValue('2026')

    expect(store.day).toEqual(today)
  })
})
