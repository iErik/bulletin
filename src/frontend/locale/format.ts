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
 * - `monthShort`: "Sep", "set.";
 * - `monthYear`: "September 2026", "setembro de 2026";
 * - `weekday`: "Mon", "seg.";
 * - `weekdayNarrow`: "M", "S";
 * - `weekdayDay`: "Sat 14";
 * - `ordinal`: the day of the month alone, "8th",
 *   "8º".
 */
export type DateStyle =
  | 'long'
  | 'short'
  | 'month'
  | 'monthShort'
  | 'monthYear'
  | 'weekday'
  | 'weekdayNarrow'
  | 'weekdayDay'
  | 'ordinal'

const INTL_STYLES: Readonly<Record<
  Exclude<DateStyle, 'long' | 'weekdayDay' | 'ordinal'>,
  Intl.DateTimeFormatOptions
>> = {
  short: { month: 'short', day: 'numeric' },
  month: { month: 'long' },
  monthShort: { month: 'short' },
  monthYear: { month: 'long', year: 'numeric' },
  weekday: { weekday: 'short' },
  weekdayNarrow: { weekday: 'narrow' }
}

/** Weekday then day, even when Intl swaps them. */
const weekdayDay = (date: Date): string => {
  const parts = new Intl.DateTimeFormat(locale(), {
    weekday: 'short', day: 'numeric'
  }).formatToParts(date)
  const w = parts.find(p => p.type === 'weekday')?.value
  const d = parts.find(p => p.type === 'day')?.value
  return [w, d].filter(Boolean).join(' ')
}

export const formatDate = (
  date: Date,
  style: DateStyle
): string => {
  // Intl has no ordinals ("1st"), so `long` and
  // `ordinal` use the date-fns locale.
  if (style === 'long')
    return format(date, 'PPP', { locale: dateLocale() })
  if (style === 'ordinal')
    return format(date, 'do', { locale: dateLocale() })
  if (style === 'weekdayDay') return weekdayDay(date)
  return new Intl.DateTimeFormat(
    locale(),
    INTL_STYLES[style]
  ).format(date)
}

/**
 * A time of day on the Locale's clock: "2:10 AM" in
 * en-US, "02:10" in pt-BR.
 */
export const formatTime = (date: Date): string =>
  new Intl.DateTimeFormat(locale(), {
    hour: 'numeric',
    minute: '2-digit'
  }).format(date)

/**
 * An hour on the Locale's clock without its AM or PM,
 * as the Sleep Timeline's scales show it: 13 is "1:00"
 * in en-US and "13:00" in pt-BR. 24 is the midnight
 * ending a day: "12:00" on a 12-hour clock and "24:00"
 * on a 24-hour one.
 */
export const formatHour = (hour: number): string => {
  const parts = new Intl.DateTimeFormat(locale(), {
    hour: 'numeric',
    minute: '2-digit'
  }).formatToParts(new Date(2026, 0, 1, hour % 24))
  const twelve = parts.some(p => p.type === 'dayPeriod')
  return parts
    .filter(p => p.type !== 'dayPeriod')
    .map(p => p.type === 'hour' && hour === 24 && !twelve
      ? '24'
      : p.value)
    .join('')
    .trim()
}

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

/**
 * The day of January the Locale's week 1 must contain,
 * which numbers the weeks: 1 in en-US, 4 in en-GB.
 */
export const firstWeekContainsDate = (): number =>
  dateLocale().options?.firstWeekContainsDate ?? 1
