import { describe, expect, it } from 'vitest'
import { useFixedToday } from '@/testing/clock'
import { amountText, parseAmount } from './amount'

describe('parseAmount', () => {
  it.each([
    ['-1.234,56', -123_456],
    ['-1234.56', -123_456],
    ['30', 3_000],
    ['30,5', 3_050],
    ['1,234.56', 123_456],
    ['1.234.567', 123_456_700],
    ['1,234', 123_400],
    ['0,05', 5],
    [',5', 50],
    ['30,', 3_000],
    ['  12.30  ', 1_230],
    ['−7,25', -725],
    ['-0', 0]
  ])('reads %j as %i centavos', (text, centavos) => {
    expect(parseAmount(text)).toBe(centavos)
  })

  it.each([
    '',
    '   ',
    '-',
    ',',
    '.,',
    'abc',
    '12a',
    'R$ 30,00',
    '30 00',
    '--30',
    '30-',
    '+30',
    '1e5',
    '9'.repeat(20)
  ])('rejects %j', text => {
    expect(parseAmount(text)).toBeNull()
  })
})

describe('amountText', () => {
  useFixedToday()

  it('writes a plain en-US number', () => {
    expect(amountText(123_456)).toBe('1234.56')
    expect(amountText(-3_000)).toBe('-30.00')
  })

  it('writes a plain pt-BR number', async () => {
    const { setLocaleOverride } =
      await import('@/locale/format')
    setLocaleOverride('pt-BR')

    expect(amountText(123_456)).toBe('1234,56')
  })

  it('parses back to the same centavos', () => {
    expect(parseAmount(amountText(98_765)))
      .toBe(98_765)
  })
})
