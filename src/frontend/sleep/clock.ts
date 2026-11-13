/**
 * Times typed into the Sleep Timeline's tooltip: read
 * on a 12- or 24-hour clock, and placed on the
 * Timeline, free of rendering.
 */
import { addDays } from 'date-fns'
import type { EpochMs } from '@shared/sleep'

/** A time of day. */
export interface Clock {
  readonly hours: number
  readonly minutes: number
}

const TIME =
  /^(\d{1,2})(?:[:.h](\d{2}))?\s*(?:([ap])\.?\s*m\.?)?$/i

/**
 * "2:15", "14:20", "2:15 PM" or "2 a.m." as a time of
 * day, or null. Without AM or PM it's 24-hour.
 */
export const parseClock = (text: string): Clock | null => {
  const match = TIME.exec(text.trim())
  if (!match) return null
  const [, h, m = '0', half] = match
  const minutes = Number(m)
  let hours = Number(h)
  if (minutes > 59) return null
  if (half) {
    if (hours < 1 || hours > 12) return null
    hours = hours % 12
      + (half.toLowerCase() === 'p' ? 12 : 0)
  } else if (hours > 23) return null
  return { hours, minutes }
}

/**
 * `clock` on the calendar day `day`, where a Period
 * typed for that day starts: 2:15 AM on Nov 7 is
 * Nov 7, 2:15 AM (ADR 0003).
 */
export const startOn = (day: Date, clock: Clock): EpochMs =>
  new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    clock.hours,
    clock.minutes
  ).getTime()

/**
 * The first `clock` after `start`: a day on when
 * they're equal, as a Period can't be empty.
 */
export const endFrom = (
  start: EpochMs,
  clock: Clock
): EpochMs => {
  const day = new Date(start)
  const end = startOn(day, clock)
  return end > start
    ? end
    : startOn(addDays(day, 1), clock)
}
