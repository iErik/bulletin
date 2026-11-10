/**
 * The renderer's only place that formats dates, numbers
 * and money, in the Locale (see `CONTEXT.md`). The
 * Locale follows the OS; `setLocaleOverride` lets a
 * user setting replace it without callers changing.
 */
import {
  format,
  type Locale as DateLocale
} from 'date-fns'
import { enGB, enUS, pt, ptBR } from 'date-fns/locale'
import { ref } from 'vue'

/** date-fns locales bundled, by BCP 47 tag. */
const DATE_LOCALES: Readonly<
  Record<string, DateLocale>
> = {
  en: enUS,
  'en-US': enUS,
  'en-GB': enGB,
  pt,
  'pt-BR': ptBR
}

/** Reactive, so formatted text updates on a change. */
const override = ref<string | null>(null)

/** Replaces the OS Locale; `null` restores it. */
export const setLocaleOverride = (
  tag: string | null
): void => {
  override.value = tag
}

/** The Locale's BCP 47 tag, such as `pt-BR`. */
export const locale = (): string =>
  override.value ?? navigator.language ?? 'en-US'

/**
 * The date-fns locale for the Locale: an exact match,
 * then its language, then en-US.
 */
const dateLocale = (): DateLocale => {
  const tag = locale()
  return DATE_LOCALES[tag]
    ?? DATE_LOCALES[tag.split('-')[0]]
    ?? enUS
}

/**
 * - `long`: "September 1st, 2026", "1 de setembro de
 *   2026" (the date header);
 * - `short`: "Sep 12", "12 de set.";
 * - `month`: "September", "setembro";
 * - `weekday`: "Mon", "seg.".
 */
export type DateStyle =
  'long' | 'short' | 'month' | 'weekday'

const INTL_STYLES: Readonly<Record<
  Exclude<DateStyle, 'long'>,
  Intl.DateTimeFormatOptions
>> = {
  short: { month: 'short', day: 'numeric' },
  month: { month: 'long' },
  weekday: { weekday: 'short' }
}

export const formatDate = (
  date: Date,
  style: DateStyle
): string =>
  // Intl has no ordinals ("1st"), so `long` uses the
  // date-fns locale's long date.
  style === 'long'
    ? format(date, 'PPP', { locale: dateLocale() })
    : new Intl.DateTimeFormat(
        locale(),
        INTL_STYLES[style]
      ).format(date)

export const formatNumber = (
  value: number,
  options?: Intl.NumberFormatOptions
): string =>
  new Intl.NumberFormat(locale(), options).format(value)

/** Money is always in Brazilian reais. */
export const formatMoney = (value: number): string =>
  formatNumber(value, {
    style: 'currency',
    currency: 'BRL'
  })

/** The day weeks start on: 0 is Sunday, 1 Monday. */
export const firstDayOfWeek = (): number =>
  dateLocale().options?.weekStartsOn ?? 0
