<script setup lang="ts">
// The Sleep Widget's body: one Timeline row per day
// (ADR 0002), oldest first, with the rest of the
// current month dimmed below today. Months load as the
// list nears either edge, and the Selected Date's row
// scrolls to the centre whenever it changes. Scrolling
// never changes the Selected Date.
import {
  computed,
  nextTick,
  onMounted,
  useTemplateRef,
  watch
} from 'vue'
import { addDays, isAfter, isSameDay } from 'date-fns'
import type { SleepPeriod } from '@shared/sleep'
import { localDate } from '@shared/dates'
import { formatDate, formatTime } from '@/locale/format'
import { caption } from '@/sleep/caption'
import {
  axisTicks,
  rowOf,
  segmentsOf
} from '@/sleep/timeline'
import { useSleepMonths } from '@/sleep/use-sleep-months'
import { useSelectedDateStore }
  from '@/stores/selected-date'

const store = useSelectedDateStore()
const months = useSleepMonths(() => store.today)
const scroller = useTemplateRef<HTMLElement>('scroller')

// Each row's own Periods, by the row of their Head.
const byRow = computed(() => {
  const rows = new Map<string, SleepPeriod[]>()
  for (const period of months.periods.value) {
    const key = localDate(rowOf(period.start))
    rows.set(key, [...rows.get(key) ?? [], period])
  }
  return rows
})

const rows = computed(() =>
  months.days.value.map(day => {
    const key = localDate(day)
    const own = byRow.value.get(key) ?? []
    const before = byRow.value
      .get(localDate(addDays(day, -1))) ?? []
    return {
      key,
      label: formatDate(day, 'short'),
      caption: caption(own),
      segments: segmentsOf([...before, ...own], day),
      future: isAfter(day, store.today),
      selected: isSameDay(day, store.day)
    }
  })
)

const ticks = axisTicks().map(tick => ({
  ...tick,
  label: formatTime(new Date(tick.time))
}))

const percent = (fraction: number): string =>
  `${fraction * 100}%`

/** Scrolls the Selected Date's row to the centre. */
const centre = (): void => {
  const list = scroller.value
  const row = list?.querySelector<HTMLElement>(
    `[data-day="${localDate(store.day)}"]`
  )
  if (!list || !row) return
  list.scrollTop = row.offsetTop
    - (list.clientHeight - row.offsetHeight) / 2
}

// Loads one month when within half a view of an edge.
// Rows added above push the content down by exactly
// their height, so the scroll position follows it.
let loading = false
const loadNearEdges = async (): Promise<void> => {
  const list = scroller.value
  if (!list || loading) return
  const edge = list.clientHeight / 2
  const below = list.scrollHeight - list.scrollTop
    - list.clientHeight
  loading = true
  try {
    if (list.scrollTop < edge) {
      const height = list.scrollHeight
      if (await months.loadEarlier()) {
        await nextTick()
        list.scrollTop += list.scrollHeight - height
      }
    } else if (below < edge)
      await months.loadLater()
  } finally {
    loading = false
  }
}

const follow = async (day: Date): Promise<void> => {
  if (!months.contains(day)) await months.reset(day)
  await nextTick()
  centre()
}

onMounted(() => follow(store.day))
watch(() => store.day, follow)

// A new month at midnight: a past Selected Date stays
// put, so today's month is added here instead.
watch(() => store.today, today => {
  if (store.isToday || months.contains(today)) return
  if (months.contains(addDays(today, -1)))
    void months.loadLater()
})
</script>

<template>
  <div class="sleep-timeline">
    <p v-if="months.failed.value" class="error" role="alert">
      Couldn't load sleep.
    </p>
    <ol
      ref="scroller"
      class="rows"
      @scroll.passive="loadNearEdges"
    >
      <li
        v-for="row in rows"
        :key="row.key"
        class="day-row"
        :class="{
          '-future': row.future,
          '-selected': row.selected
        }"
        :data-day="row.key"
        :aria-disabled="row.future || undefined"
      >
        <div class="label">
          <span class="date">{{ row.label }}</span>
          <span v-if="row.caption" class="caption">
            {{ row.caption }}
          </span>
        </div>
        <div class="track">
          <div
            v-for="segment in row.segments"
            :key="segment.period.id"
            class="period"
            :class="{
              '-head': segment.head,
              '-tail': segment.tail
            }"
            :style="{
              left: percent(segment.from),
              width: percent(segment.to - segment.from)
            }"
          />
        </div>
      </li>
    </ol>
    <div class="axis" aria-hidden="true">
      <div class="track">
        <span
          v-for="tick in ticks"
          :key="tick.fraction"
          class="tick"
          :style="{ left: percent(tick.fraction) }"
        >
          {{ tick.label }}
        </span>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

// The label column and the track's inset, shared by
// the rows and the axis so their times line up.
$label-width: rem(112px);
$track-inset: space(6);
$dot: rem(7px);

@mixin columns {
  display: grid;
  grid-template-columns: $label-width 1fr;

  > .track {
    position: relative;
    grid-column: 2;
    margin: 0 $track-inset;
  }
}

@mixin glow {
  background: var(--color-text);
  box-shadow: 0 0 rem(6px) var(--color-text);
}

.sleep-timeline {
  display: flex;
  flex-direction: column;
  height: 100%;

  > .error {
    font-size: rem(12px);
    color: var(--color-text-muted);
  }

  > .rows {
    position: relative; // Rows' offsetTop is from here
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-anchor: none; // We keep the position
    scrollbar-gutter: stable;
  }

  // The same gutter as the rows' scrollbar, so the
  // ticks line up where scrollbars take up space.
  > .axis {
    @include columns;

    overflow-y: hidden;
    scrollbar-gutter: stable;
    padding-top: space(2);
    font-size: rem(11px);
    color: var(--color-text-muted);
  }

  > .axis > .track {
    height: space(5);
    border-top: 1px dotted var(--color-border);
  }

  > .axis > .track > .tick {
    position: absolute;
    top: space(1);
    white-space: nowrap;
    transform: translateX(-50%);
  }
}

.day-row {
  @include columns;

  align-items: center;
  min-height: rem(52px);

  > .label {
    display: flex;
    flex-direction: column;
    font-size: rem(14px);
    color: var(--color-text-muted);
  }

  > .label > .caption {
    font-size: rem(10px);
  }

  > .track {
    height: 0;
    border-top: 1px dotted var(--color-border);
  }

  // Centred on the dotted line above the track's box.
  > .track > .period {
    position: absolute;
    top: -0.5px;
    height: 2px;
    border-radius: 1px;
    transform: translateY(-50%);
    @include glow;
  }

  // The Head and Tail circles.
  > .track > .period.-head::before,
  > .track > .period.-tail::after {
    position: absolute;
    top: 50%;
    width: $dot;
    height: $dot;
    content: '';
    border-radius: 50%;
    @include glow;
  }

  > .track > .period.-head::before {
    left: 0;
    transform: translate(-50%, -50%);
  }

  > .track > .period.-tail::after {
    right: 0;
    transform: translate(50%, -50%);
  }

  &.-selected > .label {
    color: var(--color-text);
  }

  // The rest of the month: shown, but not usable.
  &.-future {
    pointer-events: none;
    opacity: 0.35;
  }
}
</style>
