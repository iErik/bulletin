// Weight values, stored in grams and shown in kg with
// one decimal place, in the Locale.
import { formatNumber } from '@/locale/format'

export const GRAMS_PER_KG = 1000

/** "63.4 kg" in en-US, "63,4 kg" in pt-BR. */
export const formatWeight = (grams: number): string =>
  `${formatNumber(grams / GRAMS_PER_KG, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  })} kg`

/** A y-axis label, such as "60 kg". */
export const formatAxisKg = (kg: number): string =>
  `${formatNumber(kg)} kg`

/** The lightest and heaviest weights the form takes. */
export const MIN_KG = 20
export const MAX_KG = 300

// Whole kg, then at most one decimal after a comma or
// a dot, whatever the Locale.
const KG_PATTERN = /^(\d+)(?:[.,](\d))?$/

/**
 * Typed kg ("63,4", "63.4", "63") as grams, or null
 * when it isn't a number from 20 to 300 kg with at
 * most one decimal place.
 */
export const parseKg = (text: string): number | null => {
  const match = KG_PATTERN.exec(text.trim())
  if (!match) return null
  const grams = Number(match[1]) * GRAMS_PER_KG
    + Number(match[2] ?? 0) * 100
  const kg = grams / GRAMS_PER_KG
  return kg >= MIN_KG && kg <= MAX_KG ? grams : null
}
