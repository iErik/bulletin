<script setup lang="ts">
// Task Insights (Figma 3889:8169): five fixed rows drawn
// from `@/tasks/insights`; any row returning null is hidden.
import { computed, ref, shallowRef, watch } from 'vue'
import { localDate } from '@shared/dates'
import type { Weekday } from '@shared/recurring-tasks'
import type { LocalDate } from '@shared/storage'
import Widget from '@/components/Widget/Widget.vue'
import { useDataVersion }
  from '@/composables/use-data-version'
import { firstDayOfWeek, formatDate } from '@/locale/format'
import { useSelectedDateStore }
  from '@/stores/selected-date'
import {
  busiestWeekAhead,
  completion,
  eveningSlip,
  formatEveningSlip,
  formatProductiveAvg,
  formatTaskCount,
  formatWeekRange,
  insightsRange,
  mostProductiveDay,
  rescheduledCount,
  type InsightTask
} from '@/tasks/insights'

const ALL_DAYS = {
  from: '1970-01-01',
  to: '9999-12-31'
} as const

interface Data {
  /** The Selected Date this snapshot was loaded for. */
  readonly date: LocalDate
  readonly weekStartsOn: number
  readonly items: readonly InsightTask[]
}

type RowKind =
  | 'completion'
  | 'productive'
  | 'evening'
  | 'rescheduled'
  | 'busiest'

type Tone = 'good' | 'bad' | 'neutral'

interface Row {
  readonly kind: RowKind
  readonly label: string
  readonly caption: string
  readonly value: string
  readonly tone: Tone
}

const store = useSelectedDateStore()
const version = useDataVersion('tasks')
const data = shallowRef<Data | null>(null)
const failed = ref(false)
// Bumped by each load, so an overtaken load is dropped.
let generation = 0

const load = async (): Promise<void> => {
  const asked = ++generation
  const day = localDate(store.day)
  const weekStartsOn = firstDayOfWeek()
  const { tasks, recurringTasks } = window.bulletin
  const [planned, someday, occurrences] = await Promise.all([
    tasks.list(ALL_DAYS),
    tasks.listSomeday(),
    recurringTasks.listOccurrences(
      insightsRange(day, weekStartsOn)
    )
  ])
  if (asked !== generation) return
  if (!planned.ok || !someday.ok || !occurrences.ok) {
    failed.value = true
    data.value = null
    return
  }
  failed.value = false
  data.value = {
    date: day,
    weekStartsOn,
    items: [
      ...planned.value,
      ...someday.value,
      ...occurrences.value
    ]
  }
}

watch(
  () => [
    localDate(store.day),
    firstDayOfWeek(),
    version.value
  ] as const,
  () => { void load() },
  { immediate: true }
)

// Jan 4th 2026 is a Sunday, weekday 0.
const weekdayName = (weekday: Weekday): string =>
  formatDate(new Date(2026, 0, 4 + weekday, 12), 'weekday')

const rows = computed((): Row[] => {
  const d = data.value
  if (!d) return []
  const { items, date, weekStartsOn } = d
  const comp = completion(items, date)
  const prod = mostProductiveDay(items, date, weekStartsOn)
  const slip = eveningSlip(items, date)
  const moved = rescheduledCount(items)
  const busy = busiestWeekAhead(items, date, weekStartsOn)
  const list: (Row | null)[] = [
    comp && {
      kind: 'completion',
      label: 'Completion',
      caption: `on time ${comp.onTimePercent}%`,
      value: `${comp.percent}%`,
      tone: 'good'
    },
    prod && {
      kind: 'productive',
      label: 'Most productive day',
      caption: formatProductiveAvg(prod.average),
      value: weekdayName(prod.weekday),
      tone: 'neutral'
    },
    slip && {
      kind: 'evening',
      label: 'Evening tasks slip',
      caption: 'planned after 20:00',
      value: formatEveningSlip(slip),
      tone: slip.more ? 'bad' : 'good'
    },
    moved !== null
      ? {
          kind: 'rescheduled',
          label: 'Rescheduled 3+ times',
          caption: 'break them down?',
          value: formatTaskCount(moved),
          tone: 'neutral'
        }
      : null,
    busy && {
      kind: 'busiest',
      label: 'Busiest week ahead',
      caption: formatWeekRange(busy),
      value: formatTaskCount(busy.count),
      tone: 'neutral'
    }
  ]
  return list.filter((row): row is Row => row !== null)
})

const empty = computed((): boolean =>
  data.value !== null && rows.value.length === 0)
</script>

<template>
  <Widget
    class="task-insights-widget"
    title="Insights"
    icon="activity"
  >
    <template #actions>
      <p class="subtitle">
        This month
      </p>
    </template>
    <p v-if="failed" class="message" role="alert">
      Couldn’t load Insights.
    </p>
    <p v-else-if="empty" class="message">
      No insights yet
    </p>
    <ul v-else class="rows">
      <li
        v-for="row in rows"
        :key="row.kind"
        class="row"
        :data-kind="row.kind"
        :data-tone="row.tone"
      >
        <span class="label" :title="row.label">
          {{ row.label }}
        </span>
        <span class="caption">{{ row.caption }}</span>
        <span class="value">{{ row.value }}</span>
      </li>
    </ul>
  </Widget>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

.widget-frame.task-insights-widget {
  // Figma's first row starts 8px below the header.
  --widget-gap: #{rem(8px)};

  > .header > .actions > .subtitle {
    margin: 0;
    padding-right: rem(4px);
    font-size: rem(13px);
    font-weight: 700;
    text-transform: uppercase;
    white-space: nowrap;
    color: var(--color-widget-title);
  }
}

.task-insights-widget > .body > .message {
  padding: space(2) rem(4px) 0;
  font-size: rem(11px);
  color: var(--color-text-muted);
}

.task-insights-widget .rows {
  display: flex;
  flex-direction: column;
  gap: rem(4px);
  margin: 0;
  padding: 0;
  list-style: none;
}

// Figma's columns: label at 12px, caption at 190px from
// the row's left edge, value right-aligned 12px from right.
.task-insights-widget .row {
  --tone: var(--color-stat-value);

  display: grid;
  grid-template-columns:
    rem(178px) minmax(0, 1fr) auto;
  align-items: center;
  height: rem(28px);
  padding: 0 rem(12px);
  background: color-mix(
    in sRGB, var(--color-text) 3%, transparent
  );
  border-radius: rem(5px);

  &[data-tone='good'] { --tone: var(--color-improvement); }
  &[data-tone='bad'] { --tone: var(--color-worsening); }

  > .label,
  > .caption {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  > .label {
    padding-right: rem(8px);
    font-size: rem(12px);
    font-weight: 500;
    color: var(--color-tasks-text);
  }

  > .caption {
    font-size: rem(9px);
    font-weight: 700;
    text-transform: uppercase;
    color: color-mix(
      in sRGB, var(--color-tile-icon) 50%, transparent
    );
  }

  > .value {
    padding-left: rem(8px);
    font-family: $font-family-mono;
    font-size: rem(11px);
    font-weight: 500;
    white-space: nowrap;
    color: var(--tone);
  }
}
</style>
