import { describe, expect, it } from 'vitest'
import type { MoodEntry, MoodKey } from '@shared/mood'
import type { Stretch } from '@/sleep/stretches'
import {
  roundedPercent,
  sleepMood,
  type SleepMoodBucket,
  type SleepMoodBucketId
} from './sleep-mood'

const HOUR = 3_600_000
const night = (day: string, h: number): Stretch => ({
  day, start: 0, end: h * HOUR, asleepMs: h * HOUR,
  periods: [], wakeUps: 0
})
const mood = (date: string, key: MoodKey): MoodEntry =>
  ({ date, mood: key })
const bucket = (
  view: ReturnType<typeof sleepMood>,
  id: SleepMoodBucketId
): SleepMoodBucket => view.buckets.find(b => b.id === id)!

describe('sleepMood', () => {
  it('pairs, buckets, orders, labels and headlines', () => {
    expect(roundedPercent(0.146)).toBe(15)
    expect(roundedPercent(0.144)).toBe(14)

    const paired = sleepMood(
      [night('2026-11-08', 8), night('2026-11-09', 7.5)],
      [
        mood('2026-11-07', 'angry'),
        mood('2026-11-08', 'happy'),
        mood('2026-11-10', 'okay')
      ]
    )
    expect(bucket(paired, '8-plus').segments[0]).toMatchObject({
      mood: 'happy', percent: 100, showLabel: true
    })
    expect(paired.headline?.bucketId).toBe('8-plus')
    expect(bucket(paired, '7-8').total).toBe(0)

    const bounds = sleepMood(
      [
        night('2026-11-01', 5.9), night('2026-11-02', 6),
        night('2026-11-03', 7), night('2026-11-04', 8)
      ],
      [
        mood('2026-11-01', 'happy'), mood('2026-11-02', 'okay'),
        mood('2026-11-03', 'neutral'),
        mood('2026-11-04', 'stressed')
      ]
    )
    expect(bucket(bounds, 'under-6').segments[0].mood)
      .toBe('happy')
    expect(bucket(bounds, '6-7').segments[0].mood).toBe('okay')
    expect(bucket(bounds, '7-8').segments[0].mood)
      .toBe('neutral')
    expect(bucket(bounds, '8-plus').segments[0].mood)
      .toBe('stressed')

    const moods: MoodEntry[] = [
      mood('2026-11-01', 'anxious'), mood('2026-11-02', 'happy'),
      mood('2026-11-03', 'angry'), mood('2026-11-04', 'okay'),
      mood('2026-11-05', 'happy')
    ]
    const segs = bucket(sleepMood(
      moods.map((_, i) => night(`2026-11-0${i + 1}`, 7.2)),
      moods
    ), '7-8').segments
    expect(segs.map(s => s.mood))
      .toEqual(['happy', 'okay', 'angry', 'anxious'])
    expect(segs.reduce((n, s) => n + s.share, 0)).toBeCloseTo(1)

    const seven: MoodEntry[] = [
      mood('2026-11-01', 'happy'), mood('2026-11-02', 'okay'),
      mood('2026-11-03', 'okay'), mood('2026-11-04', 'stressed'),
      mood('2026-11-05', 'neutral'), mood('2026-11-06', 'angry'),
      mood('2026-11-07', 'anxious')
    ]
    const labeled = bucket(sleepMood(
      seven.map((_, i) => night(`2026-11-0${i + 1}`, 7.5)),
      seven
    ), '7-8').segments
    expect(labeled.find(s => s.mood === 'happy'))
      .toMatchObject({ percent: 14, showLabel: false })
    expect(labeled.find(s => s.mood === 'okay'))
      .toMatchObject({ percent: 29, showLabel: true })

    expect(sleepMood(
      [
        night('2026-11-01', 5), night('2026-11-02', 5.5),
        night('2026-11-03', 7.5), night('2026-11-04', 7.6),
        night('2026-11-05', 7.7), night('2026-11-06', 8.5)
      ],
      [
        mood('2026-11-01', 'happy'), mood('2026-11-02', 'okay'),
        mood('2026-11-03', 'happy'), mood('2026-11-04', 'happy'),
        mood('2026-11-05', 'okay'), mood('2026-11-06', 'okay')
      ]
    ).headline).toMatchObject({
      mood: 'happy', bucketId: '7-8', percent: 67
    })

    expect(sleepMood(
      [night('2026-11-01', 7.2), night('2026-11-02', 7.3)],
      [mood('2026-11-01', 'anxious'), mood('2026-11-02', 'okay')]
    ).headline?.mood).toBe('okay')
    expect(sleepMood(
      [
        night('2026-11-01', 5), night('2026-11-02', 7.5),
        night('2026-11-03', 5.5), night('2026-11-04', 7.6)
      ],
      [
        mood('2026-11-01', 'happy'), mood('2026-11-02', 'happy'),
        mood('2026-11-03', 'okay'), mood('2026-11-04', 'okay')
      ]
    ).headline).toMatchObject({
      mood: 'happy', bucketId: 'under-6', percent: 50
    })
    expect(sleepMood([], []).headline).toBeNull()
    expect(sleepMood(
      [night('2026-11-08', 7)], [mood('2026-11-09', 'happy')]
    ).headline).toBeNull()
  })
})
