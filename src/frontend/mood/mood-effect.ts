/**
 * Which Mood changes most when a condition holds: the
 * comparison behind the cross-tracker Widgets ("What
 * moves your mood", Habit effects). Only arithmetic on
 * counts: each Widget formats the result its own way.
 *
 * A Mood's share on one side is its days ÷ that side's
 * days. Its ratio is its share on true days ÷ its share
 * on false days, and its strength is the ratio's
 * distance from 1, a ratio below 1 compared by its
 * inverse. Comparisons cross-multiply counts, so they
 * are exact.
 */
import {
  MOOD_DISPLAY_ORDER,
  isGoodMood,
  isHardMood,
  type MoodKey
} from '@shared/mood'

/** The fewest days with a Mood each side needs. */
export const MIN_SIDE_DAYS = 7

/**
 * `good` when a Good Mood rises or a Hard Mood falls,
 * `bad` the other way round, `neutral` for a Mood that
 * is neither.
 */
export type EffectTone = 'good' | 'bad' | 'neutral'

/** A Mood's days on one side, out of that side's days. */
export interface MoodTally {
  readonly count: number
  readonly days: number
}

export interface MoodEffect {
  readonly mood: MoodKey
  /** Share on true days ÷ share on false days. */
  readonly ratio: number
  readonly onTrue: MoodTally
  readonly onFalse: MoodTally
  readonly tone: EffectTone
}

interface Fraction {
  readonly num: number
  readonly den: number
}

/** The ratio as an exact fraction of counts. */
export const ratioFraction = (
  effect: MoodEffect
): Fraction => ({
  num: effect.onTrue.count * effect.onFalse.days,
  den: effect.onFalse.count * effect.onTrue.days
})

/** The ratio, or its inverse below 1, as a fraction. */
const strengthOf = (effect: MoodEffect): Fraction => {
  const { num, den } = ratioFraction(effect)
  return num >= den
    ? { num, den }
    : { num: den, den: num }
}

/**
 * Compares two effects by strength: positive when `a`
 * is stronger, negative when `b` is, 0 when they tie.
 */
export const compareStrength = (
  a: MoodEffect,
  b: MoodEffect
): number => {
  const sa = strengthOf(a)
  const sb = strengthOf(b)
  return sa.num * sb.den - sb.num * sa.den
}

const toneOf = (mood: MoodKey, ratio: number): EffectTone => {
  if (!isGoodMood(mood) && !isHardMood(mood)) return 'neutral'
  return (ratio > 1) === isGoodMood(mood) ? 'good' : 'bad'
}

const countMoods = (
  moods: readonly MoodKey[]
): Map<MoodKey, number> => {
  const counts = new Map<MoodKey, number>()
  for (const mood of moods)
    counts.set(mood, (counts.get(mood) ?? 0) + 1)
  return counts
}

/**
 * The strongest Mood effect, from the Mood of each true
 * day and of each false day (days without a Mood left
 * out). Null when a side has fewer than 7 days, or no
 * Mood appears on both sides. Only a Mood seen at least
 * once on each side is a candidate. Ties go to the
 * first Mood in `MOOD_DISPLAY_ORDER`.
 */
export const moodEffect = (
  trueMoods: readonly MoodKey[],
  falseMoods: readonly MoodKey[]
): MoodEffect | null => {
  const trueDays = trueMoods.length
  const falseDays = falseMoods.length
  if (trueDays < MIN_SIDE_DAYS || falseDays < MIN_SIDE_DAYS)
    return null
  const onTrue = countMoods(trueMoods)
  const onFalse = countMoods(falseMoods)
  let best: MoodEffect | null = null
  for (const mood of MOOD_DISPLAY_ORDER) {
    const t = onTrue.get(mood) ?? 0
    const f = onFalse.get(mood) ?? 0
    if (t === 0 || f === 0) continue
    const ratio = (t * falseDays) / (f * trueDays)
    const effect: MoodEffect = {
      mood,
      ratio,
      onTrue: { count: t, days: trueDays },
      onFalse: { count: f, days: falseDays },
      tone: toneOf(mood, ratio)
    }
    if (best === null || compareStrength(effect, best) > 0)
      best = effect
  }
  return best
}
