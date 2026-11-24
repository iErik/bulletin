import { describe, expect, it } from 'vitest'
import { MOODS, isGoodMood, isHardMood } from './mood'

describe('Mood classification', () => {
  it('classifies Good, Hard and Neutral on MOODS', () => {
    expect(Object.fromEntries(
      MOODS.map(mood => [mood.key, mood.kind])
    )).toEqual({
      happy: 'good',
      okay: 'good',
      stressed: 'hard',
      neutral: 'neither',
      angry: 'hard',
      anxious: 'hard'
    })
  })

  it('reads Good and Hard Moods via helpers', () => {
    expect(MOODS.filter(isGoodMood).map(m => m.key))
      .toEqual(['happy', 'okay'])
    expect(MOODS.filter(isHardMood).map(m => m.key))
      .toEqual(['stressed', 'angry', 'anxious'])
    expect(isGoodMood('happy')).toBe(true)
    expect(isHardMood('anxious')).toBe(true)
    expect(isGoodMood('neutral')).toBe(false)
    expect(isHardMood('neutral')).toBe(false)
  })
})
