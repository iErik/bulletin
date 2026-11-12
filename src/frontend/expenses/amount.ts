/**
 * Amounts typed into the Expenses Widget, kept pure.
 * Amounts are signed centavos (see `CONTEXT.md`).
 */
import { formatNumber } from '@/locale/format'

// An optional leading minus (some Locales write the
// minus sign), then digits, commas and dots.
const AMOUNT = /^([-−]?)([\d.,]+)$/

// A final comma or dot with one or two digits after it.
const DECIMALS = /[.,](\d{1,2})$/

/**
 * Typed money as signed centavos, or null. A leading
 * minus makes it negative. A comma or dot followed by
 * one or two final digits is the decimal separator,
 * and other commas and dots are ignored, so
 * "-1.234,56", "-1234.56", "30" and "30,5" all parse.
 */
export const parseAmount = (text: string): number | null => {
  const match = AMOUNT.exec(text.trim())
  if (!match) return null
  const [, minus, body] = match
  const decimals = DECIMALS.exec(body)
  const whole = (decimals
    ? body.slice(0, decimals.index)
    : body).replace(/[.,]/g, '')
  const cents = (decimals?.[1] ?? '').padEnd(2, '0')
  if (!whole && !decimals) return null
  const centavos = Number(whole || '0') * 100
    + Number(cents)
  if (!Number.isSafeInteger(centavos)) return null
  // Avoids -0 for "-0".
  return minus ? -centavos || 0 : centavos
}

/**
 * Centavos as an input starts with: a plain Locale
 * number with two decimals and no grouping or
 * currency, such as "1234,56" in pt-BR.
 */
export const amountText = (centavos: number): string =>
  formatNumber(centavos / 100, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false
  })
