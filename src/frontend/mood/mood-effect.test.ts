import { describe, expect, it } from 'vitest'
import type { MoodKey } from '@shared/mood'
import {
  compareStrength,
  moodEffect,
  type EffectTone
} from './mood-effect'

/** `n` copies of each Mood, in order. */
const days = (
  ...groups: readonly [number, MoodKey][]
): MoodKey[] => groups.flatMap(([n, mood]) =>
  Array.from({ length: n }, () => mood))

describe('moodEffect', () => {
  it('finds the Mood whose share changes most', () => {
    const effect = moodEffect(
      days([21, 'happy'], [29, 'okay']),
      days([4, 'happy'], [16, 'okay'])
    )
    expect(effect).toMatchObject({
      mood: 'happy',
      onTrue: { count: 21, days: 50 },
      onFalse: { count: 4, days: 20 },
      tone: 'good'
    })
    expect(effect?.ratio).toBeCloseTo(2.1, 10)
  })

  it('compares a ratio below 1 by its inverse', () => {
    const effect = moodEffect(
      days([1, 'anxious'], [6, 'okay']),
      days([3, 'anxious'], [4, 'okay'])
    )
    expect(effect?.mood).toBe('anxious')
    expect(effect?.tone).toBe('good')
  })

  it('needs at least 7 days on each side', () => {
    const six = days([3, 'happy'], [3, 'okay'])
    const seven = days([4, 'happy'], [3, 'okay'])
    expect(moodEffect(six, seven)).toBeNull()
    expect(moodEffect(seven, six)).toBeNull()
    expect(moodEffect(seven, seven)).not.toBeNull()
  })

  it('skips a Mood missing from either side', () => {
    const effect = moodEffect(
      days([4, 'angry'], [3, 'happy']),
      days([3, 'happy'], [4, 'okay'])
    )
    expect(effect?.mood).toBe('happy')
    expect(effect?.ratio).toBe(1)
  })

  it('is null when no Mood is on both sides', () => {
    expect(moodEffect(days([7, 'angry']), days([7, 'okay'])))
      .toBeNull()
  })

  it('breaks ties by the display order', () => {
    const effect = moodEffect(
      days([2, 'stressed'], [2, 'neutral'], [3, 'okay']),
      days([1, 'stressed'], [1, 'neutral'], [5, 'okay'])
    )
    expect(effect?.mood).toBe('neutral')
  })

  it('takes the tone from Good and Hard', () => {
    const tone = (
      mood: MoodKey,
      up: boolean
    ): EffectTone | undefined => moodEffect(
      days([up ? 4 : 2, mood], [up ? 3 : 5, 'okay']),
      days([up ? 2 : 4, mood], [up ? 5 : 3, 'okay'])
    )?.tone
    expect(tone('neutral', true)).toBe('neutral')
    expect(tone('happy', false)).toBe('bad')
    expect(tone('stressed', true)).toBe('bad')
    expect(tone('stressed', false)).toBe('good')
  })
})

describe('compareStrength', () => {
  it('ranks 2× and 0.5× the same', () => {
    const up = moodEffect(
      days([4, 'happy'], [4, 'okay']),
      days([2, 'happy'], [6, 'okay'])
    )
    const down = moodEffect(
      days([2, 'angry'], [6, 'okay']),
      days([4, 'angry'], [4, 'okay'])
    )
    if (!up || !down) throw new Error('expected effects')
    expect(up.ratio).toBe(2)
    expect(down.ratio).toBe(0.5)
    expect(compareStrength(up, down)).toBe(0)
  })
})
