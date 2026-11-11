import { afterEach, describe, expect, it } from 'vitest'
import { setLocaleOverride } from '@/locale/format'
import {
  formatAxisKg,
  formatWeight,
  parseKg
} from './format'

describe('weight format', () => {
  afterEach(() => setLocaleOverride(null))

  it.each([
    ['en-US', '63.4 kg', '60 kg'],
    ['pt-BR', '63,4 kg', '60 kg']
  ])(
    'writes grams as kg in %s',
    (tag, weight, axis) => {
      setLocaleOverride(tag)

      expect(formatWeight(63_400)).toBe(weight)
      expect(formatAxisKg(60)).toBe(axis)
    }
  )

  it('always shows one decimal place', () => {
    setLocaleOverride('en-US')

    expect(formatWeight(70_000)).toBe('70.0 kg')
    expect(formatWeight(70_049)).toBe('70.0 kg')
    expect(formatWeight(70_051)).toBe('70.1 kg')
  })

  it.each([
    ['63,4', 63_400],
    ['63.4', 63_400],
    [' 63 ', 63_000],
    ['20', 20_000],
    ['300', 300_000],
    ['300,0', 300_000]
  ])('reads "%s" as %d g', (text, grams) => {
    expect(parseKg(text)).toBe(grams)
  })

  it.each([
    '', '63,45', '63.', ',4', '19,9', '300.1', '-63',
    '63 kg', '6e1', '63,4,1'
  ])('rejects "%s"', text => {
    expect(parseKg(text)).toBeNull()
  })
})
