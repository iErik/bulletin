<script setup lang="ts">
// Mood Overview (Figma 3889:7449, without its Insight
// card): three stat tiles, this month's Mood mix against
// the same span last month, and the Patterns rows. The
// figures come from `@/mood/overview`; a row that can't
// be computed is left out.
import { computed, ref, shallowRef, watch } from 'vue'
import { parseISO } from 'date-fns'
import { localDate } from '@shared/dates'
import {
  MOODS,
  type Mood,
  type MoodEntry,
  type MoodKey
} from '@shared/mood'
import type { DateRange, LocalDate } from '@shared/storage'
import Icon from '@/components/Icon/Icon.vue'
import Widget from '@/components/Widget/Widget.vue'
import { useDataVersion }
  from '@/composables/use-data-version'
import {
  firstDayOfWeek,
  formatDate,
  locale
} from '@/locale/format'
import {
  bestWeekday,
  goodStreak,
  logged,
  longestAnxiousRun,
  moodMix,
  mostCommon,
  mostImproved,
  stressedDays,
  toughestWeekday,
  wholePercent,
  type MoodMixBar,
  type Weekday,
  type WeekdayMood
} from '@/mood/overview'
import { useSelectedDateStore }
  from '@/stores/selected-date'
import { moodColour } from '@/theme/semantic'

const EMPTY = '—'
const MINUS = '−'

const selected = useSelectedDateStore()
const version = useDataVersion('mood')
const entries = shallowRef<MoodEntry[]>([])
const failed = ref(false)
// Bumped by each load, so a load it overtook is dropped.
let generation = 0

const date = computed(() => localDate(selected.day))

const load = async (): Promise<void> => {
  const asked = ++generation
  // The Good streak may run back past any year, so the
  // whole history up to the Selected Date is read.
  const result = await window.bulletin.mood.list({
    from: '1970-01-01',
    to: date.value
  })
  if (asked !== generation) return
  failed.value = !result.ok
  entries.value = result.ok ? result.value : []
}

watch(
  () => [date.value, version.value] as const,
  () => { void load() },
  { immediate: true }
)

const moodOf = (key: MoodKey): Mood =>
  MOODS.find(mood => mood.key === key)!

const percent = (share: number): string =>
  `${wholePercent(share)}%`

const monthShort = (day: LocalDate): string =>
  formatDate(parseISO(day), 'monthShort')

// Jan 4th 2026 is a Sunday, weekday 0.
const weekdayName = (weekday: Weekday): string =>
  formatDate(new Date(2026, 0, 4 + weekday, 12), 'weekday')

const rangeLabel = ({ from, to }: DateRange): string =>
  new Intl.DateTimeFormat(locale(), {
    month: 'short',
    day: 'numeric'
  })
    .formatRange(parseISO(from), parseISO(to))
    .replace(/\s*–\s*/, '–')

interface Stat {
  readonly icon: string
  readonly label: string
  readonly value: string
  readonly colour?: string
}

const stats = computed((): Stat[] => {
  const common = mostCommon(entries.value, date.value)
  const streak = goodStreak(entries.value, date.value)
  const streakValue = !common && streak === 0
    ? EMPTY
    : streak === 1 ? '1 day' : `${streak} days`
  if (!common) {
    return [
      { icon: 'mood', label: 'Most common', value: EMPTY },
      {
        icon: 'task-square',
        label: 'Good streak',
        value: streakValue
      },
      { icon: 'receipt-add', label: 'Logged', value: EMPTY }
    ]
  }
  const mood = moodOf(common.mood)
  const progress = logged(entries.value, date.value)
  return [
    {
      icon: 'mood',
      label: 'Most common',
      value: `${mood.label} ${percent(common.share)}`,
      colour: moodColour(mood)
    },
    {
      icon: 'task-square',
      label: 'Good streak',
      value: streakValue
    },
    {
      icon: 'receipt-add',
      label: 'Logged',
      value: percent(progress.share)
    }
  ]
})

const mix = computed(() => {
  const { current, previous } = moodMix(entries.value, date.value)
  return [current, previous].map((bar: MoodMixBar) => ({
    month: monthShort(bar.range.from),
    segments: bar.segments.map(segment => ({
      ...segment,
      colour: moodColour(moodOf(segment.mood))
    }))
  }))
})

interface Row {
  readonly name: string
  readonly mid: string
  readonly value: string
  readonly colour?: string
  readonly tone?: 'better' | 'worse'
}

const weekdayRow = (
  name: string,
  found: WeekdayMood | null
): Row | null => {
  if (!found) return null
  const mood = moodOf(found.mood)
  return {
    name,
    mid: weekdayName(found.weekday),
    value: `${percent(found.share)} ${mood.label.toLowerCase()}`,
    colour: moodColour(mood)
  }
}

const stressedRow = (): Row | null => {
  const days = stressedDays(entries.value, date.value)
  if (!days) return null
  const { count, delta } = days
  const arrow = delta < 0
    ? `  ↓${-delta}`
    : delta > 0 ? `  ↑${delta}` : ''
  return {
    name: 'Stressed days',
    mid: 'this month',
    value: `${count}${arrow}`,
    tone: delta < 0
      ? 'better'
      : delta > 0 ? 'worse' : undefined
  }
}

const anxiousRow = (): Row | null => {
  const run = longestAnxiousRun(entries.value, date.value)
  return run && {
    name: 'Longest anxious run',
    mid: rangeLabel(run),
    value: `${run.days} days`
  }
}

const improvedRow = (): Row | null => {
  const found = mostImproved(entries.value, date.value)
  if (!found) return null
  const points = wholePercent(found.delta)
  const sign = points > 0 ? '+' : MINUS
  return {
    name: 'Most improved',
    mid: `vs ${monthShort(found.comparedTo.from)}`,
    value: `${sign}${Math.abs(points)}% `
      + moodOf(found.mood).label.toLowerCase(),
    tone: 'better'
  }
}

const rows = computed((): Row[] => {
  const week = firstDayOfWeek()
  return [
    weekdayRow(
      'Best weekday',
      bestWeekday(entries.value, date.value, week)
    ),
    weekdayRow(
      'Toughest weekday',
      toughestWeekday(entries.value, date.value, week)
    ),
    stressedRow(),
    anxiousRow(),
    improvedRow()
  ].filter((row): row is Row => row !== null)
})
</script>

<template>
  <Widget
    class="mood-overview"
    title="Overview"
    icon="activity"
  >
    <p v-if="failed" class="error" role="alert">
      Couldn’t load Overview.
    </p>
    <div v-else class="body-inner">
      <div class="stats">
        <section
          v-for="stat in stats"
          :key="stat.label"
          class="stat"
        >
          <h3 class="label">
            <Icon class="icon" :name="stat.icon" />
            {{ stat.label }}
          </h3>
          <p
            class="value"
            :style="stat.colour && { color: stat.colour }"
          >
            {{ stat.value }}
          </p>
        </section>
      </div>
      <section class="mix">
        <h3 class="heading">
          <span>Mood mix</span>
          <span>vs last month</span>
        </h3>
        <div
          v-for="bar in mix"
          :key="bar.month"
          class="mix-row"
        >
          <span class="month">{{ bar.month }}</span>
          <div class="track">
            <span
              v-for="segment in bar.segments"
              :key="segment.mood"
              class="segment"
              :data-mood="segment.mood"
              :style="{
                flexGrow: segment.share,
                '--mood': segment.colour
              }"
            >
              <template v-if="segment.showPercent">
                {{ percent(segment.share) }}
              </template>
            </span>
          </div>
        </div>
      </section>
      <section v-if="rows.length" class="patterns">
        <h3 class="heading">
          Patterns
        </h3>
        <ul class="rows">
          <li
            v-for="row in rows"
            :key="row.name"
            class="row"
          >
            <span class="name">{{ row.name }}</span>
            <span class="mid">{{ row.mid }}</span>
            <span
              class="val"
              :class="row.tone && `-${row.tone}`"
              :style="row.colour && { color: row.colour }"
            >{{ row.value }}</span>
          </li>
        </ul>
      </section>
    </div>
  </Widget>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

.widget-frame.mood-overview { --widget-gap: #{rem(10px)}; }

.mood-overview > .body > .error {
  font-size: rem(11px);
  color: var(--color-text-muted);
}

.mood-overview > .body > .body-inner {
  display: flex;
  flex-direction: column;
}

// Figma's "Expense Total" cards, as on the Expenses
// and Sleep Pages.
.mood-overview .stats {
  display: flex;
  gap: rem(8px);
  padding: 0 rem(3px) 0 rem(4px);

  > .stat {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    min-height: rem(67px);
    padding: rem(8px) rem(7px) rem(12px);
    background: color-mix(
      in sRGB, var(--color-text) 3%, transparent
    );
    border-radius: rem(5px);
  }

  > .stat > .label {
    display: flex;
    gap: rem(7px);
    align-items: center;
    margin-bottom: auto;
    padding-left: rem(2px);
    font-size: rem(10px);
    font-weight: 700;
    text-transform: uppercase;
    color: var(--color-tile-icon);
  }

  > .stat > .label > .icon {
    flex-shrink: 0;
    width: rem(11px);
    height: rem(11px);
  }

  > .stat > .value {
    overflow: hidden;
    font-family: $font-family-mono;
    font-size: rem(11px);
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-stat-value);
  }
}

.mood-overview .heading {
  font-size: rem(10px);
  font-weight: 700;
  line-height: rem(11px);
  text-transform: uppercase;
  color: var(--color-widget-title);
}

.mood-overview .mix {
  display: flex;
  flex-direction: column;
  gap: rem(10px);
  margin-top: rem(16px);
  padding: 0 rem(6px) 0 rem(4px);

  > .heading {
    display: flex;
    justify-content: space-between;
  }
}

.mood-overview .mix-row {
  display: grid;
  grid-template-columns: rem(32px) minmax(0, 1fr);
  align-items: center;

  > .month {
    font-size: rem(10px);
    font-weight: 700;
    text-transform: uppercase;
    color: color-mix(
      in sRGB, var(--color-tile-icon) 60%, transparent
    );
  }

  // A month without Moods keeps its empty track.
  > .track {
    display: flex;
    gap: rem(2px);
    height: rem(22px);
    background: color-mix(
      in sRGB, var(--color-text) 3%, transparent
    );
    border-radius: rem(4px);
  }

  > .track:has(> .segment) { background: none; }
}

.mood-overview .segment {
  flex-basis: 0;
  min-width: 0;
  overflow: hidden;
  font-family: $font-family-mono;
  font-size: rem(9px);
  font-weight: 500;
  line-height: rem(22px);
  text-indent: rem(6px);
  white-space: nowrap;
  color: rgb(26 26 26 / 85%);
  background: color-mix(in sRGB, var(--mood) 85%, transparent);
  border-radius: rem(4px);
}

.mood-overview .patterns {
  display: flex;
  flex-direction: column;
  gap: rem(7px);
  margin-top: rem(26px);

  > .heading { padding-left: rem(4px); }
}

.mood-overview .rows {
  display: flex;
  flex-direction: column;
  gap: rem(4px);
  margin: 0;
  padding: 0;
  list-style: none;
}

.mood-overview .row {
  display: grid;
  grid-template-columns: rem(170px) minmax(0, 1fr) auto;
  gap: rem(8px);
  align-items: center;
  min-height: rem(34px);
  padding: 0 rem(12px);
  background: color-mix(
    in sRGB, var(--color-text) 3%, transparent
  );
  border-radius: rem(5px);

  > .name {
    overflow: hidden;
    font-size: rem(13px);
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text);
  }

  > .mid {
    overflow: hidden;
    font-size: rem(10px);
    font-weight: 700;
    text-overflow: ellipsis;
    text-transform: uppercase;
    white-space: nowrap;
    color: color-mix(
      in sRGB, var(--color-tile-icon) 50%, transparent
    );
  }

  > .val {
    justify-self: end;
    font-family: $font-family-mono;
    font-size: rem(11px);
    font-weight: 500;
    white-space: pre;
    color: var(--color-stat-value);
    &.-better { color: var(--color-improvement); }
    &.-worse { color: var(--color-danger); }
  }
}
</style>
