/** Sleep & Mood: Night ↔ wake-day Mood (ADR 0004). */
import {
  MOODS,
  type MoodEntry,
  type MoodKey
} from '@shared/mood'
import type { Stretch } from '@/sleep/stretches'

const HOUR_MS = 60 * 60 * 1000

/** Figma's four rows, shorter first. */
export const SLEEP_MOOD_BUCKETS = [
  { id: 'under-6', label: '<6h', minMs: 0, maxMs: 6 * HOUR_MS },
  { id: '6-7', label: '6–7h', minMs: 6 * HOUR_MS, maxMs: 7 * HOUR_MS },
  { id: '7-8', label: '7–8h', minMs: 7 * HOUR_MS, maxMs: 8 * HOUR_MS },
  { id: '8-plus', label: '8h+', minMs: 8 * HOUR_MS, maxMs: Infinity }
] as const

export type SleepMoodBucketId =
  (typeof SLEEP_MOOD_BUCKETS)[number]['id']

/** Legend order in Figma (≠ `MOODS` / bar order). */
export const SLEEP_MOOD_LEGEND = [
  'happy', 'okay', 'neutral', 'stressed', 'anxious', 'angry'
] as const satisfies readonly MoodKey[]

export interface SleepMoodSegment {
  readonly mood: MoodKey
  readonly count: number
  readonly share: number
  readonly percent: number
  readonly showLabel: boolean
}
export interface SleepMoodBucket {
  readonly id: SleepMoodBucketId
  readonly label: string
  readonly total: number
  readonly segments: readonly SleepMoodSegment[]
}
export interface SleepMoodHeadline {
  readonly mood: MoodKey
  readonly bucketId: SleepMoodBucketId
  readonly bucketLabel: string
  readonly percent: number
}
export interface SleepMoodView {
  readonly buckets: readonly SleepMoodBucket[]
  readonly headline: SleepMoodHeadline | null
}

export const roundedPercent = (share: number): number =>
  Math.round(share * 100)

const bucketOf = (asleepMs: number): SleepMoodBucketId => {
  for (const b of SLEEP_MOOD_BUCKETS)
    if (asleepMs >= b.minMs && asleepMs < b.maxMs) return b.id
  return '8-plus'
}

/**
 * Buckets paired Nights by asleep time and builds the
 * headline. Unpaired Nights and Moods are left out.
 */
export const sleepMood = (
  nights: readonly Stretch[],
  moods: readonly MoodEntry[]
): SleepMoodView => {
  const byDay = new Map<string, MoodKey>()
  for (const e of moods) byDay.set(e.date, e.mood)

  const overall = new Map<MoodKey, number>()
  const byBucket = new Map(
    SLEEP_MOOD_BUCKETS.map(b => [b.id, new Map<MoodKey, number>()])
  )

  for (const night of nights) {
    const mood = byDay.get(night.day)
    if (!mood) continue
    const id = bucketOf(night.asleepMs)
    const counts = byBucket.get(id)!
    counts.set(mood, (counts.get(mood) ?? 0) + 1)
    overall.set(mood, (overall.get(mood) ?? 0) + 1)
  }

  const buckets = SLEEP_MOOD_BUCKETS.map(b => {
    const counts = byBucket.get(b.id)!
    let total = 0
    for (const n of counts.values()) total += n
    const segments: SleepMoodSegment[] = []
    if (total > 0) {
      for (const { key } of MOODS) {
        const count = counts.get(key) ?? 0
        if (count === 0) continue
        const share = count / total
        const percent = roundedPercent(share)
        segments.push({
          mood: key, count, share, percent,
          showLabel: percent >= 15
        })
      }
    }
    return { id: b.id, label: b.label, total, segments }
  })

  let mood: MoodKey | null = null
  let bestCount = 0
  for (const { key } of MOODS) {
    const n = overall.get(key) ?? 0
    if (n > bestCount) {
      mood = key
      bestCount = n
    }
  }

  let headline: SleepMoodHeadline | null = null
  if (mood) {
    let bestShare = -1
    for (const b of buckets) {
      const seg = b.segments.find(s => s.mood === mood)
      if (!seg || seg.share <= bestShare) continue
      bestShare = seg.share
      headline = {
        mood,
        bucketId: b.id,
        bucketLabel: b.label,
        percent: seg.percent
      }
    }
  }

  return { buckets, headline }
}
