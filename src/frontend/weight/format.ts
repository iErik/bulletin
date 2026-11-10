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
