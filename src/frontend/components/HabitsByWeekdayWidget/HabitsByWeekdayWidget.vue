<script setup lang="ts">
// Habits by Weekday (Figma 3889:9521): 12-week Completion Rates.
import {
  computed,
  ref,
  shallowRef,
  useTemplateRef,
  watch,
  type CSSProperties
} from 'vue'
import { localDate } from '@shared/dates'
import type { Habit, HabitEntry } from '@shared/habits'
import OverlayScrollbar
  from '@/components/OverlayScrollbar/OverlayScrollbar.vue'
import Widget from '@/components/Widget/Widget.vue'
import {
  useDataVersion
} from '@/composables/use-data-version'
import {
  byWeekdayRange,
  cellOpacity,
  habitsByWeekday
} from '@/habits/by-weekday'
import type { Weekday } from '@/habits/overview'
import { firstDayOfWeek, formatDate } from '@/locale/format'
import { weekdays } from '@/month-grid/layout'
import {
  useSelectedDateStore
} from '@/stores/selected-date'

const store = useSelectedDateStore()
const version = useDataVersion('habits', 'habitEntries')
const date = computed(() => localDate(store.day))
const habits = shallowRef<Habit[]>([])
const entries = shallowRef<HabitEntry[]>([])
const loaded = ref(false)
const failed = ref(false)
const scroller = useTemplateRef<HTMLElement>('scroller')
let generation = 0

const load = async (): Promise<void> => {
  const asked = ++generation
  const [habitRes, entryRes] = await Promise.all([
    window.bulletin.habits.list('all'),
    window.bulletin.habits.listEntries(byWeekdayRange(date.value))
  ])
  if (asked !== generation) return
  failed.value = !habitRes.ok || !entryRes.ok
  if (habitRes.ok && entryRes.ok) {
    habits.value = habitRes.value
    entries.value = entryRes.value
  }
  loaded.value = true
}

watch([date, version], () => void load(), { immediate: true })

const weekStart = computed(() => firstDayOfWeek())
const selectedWeekday = computed(() => store.day.getDay() as Weekday)
const headers = computed(() => weekdays(weekStart.value).map(day => ({
  weekday: day.getDay() as Weekday,
  narrow: formatDate(day, 'weekdayNarrow').toLocaleUpperCase(),
  short: formatDate(day, 'weekday')
})))
const rows = computed(() => habitsByWeekday(
  habits.value, entries.value, date.value, weekStart.value
))

const cellStyle = (rate: number): CSSProperties => ({
  '--cell-alpha': `${Math.round(cellOpacity(rate) * 1000) / 10}%`
})

const tip = ref<{ text: string; style: CSSProperties } | null>(null)
const showTip = (event: Event): void => {
  const el = event.currentTarget
  const text = el instanceof HTMLElement ? el.getAttribute('aria-label') : null
  if (!text || !(el instanceof HTMLElement)) return
  const { top, left, width } = el.getBoundingClientRect()
  tip.value = { text, style: { top: `${top}px`, left: `${left + width / 2}px` } }
}
const hideTip = (): void => {
  tip.value = null
}
</script>

<template>
  <Widget class="habits-by-weekday" title="By Weekday" icon="checklist">
    <template #actions>
      <p class="subtitle">
        Completion
      </p>
    </template>
    <p v-if="failed" class="message" role="alert">
      Couldn’t load By Weekday.
    </p>
    <p v-else-if="loaded && !rows.length" class="message">
      No habits in the last 12 weeks
    </p>
    <div v-else-if="rows.length" class="content">
      <div class="weekdays" aria-hidden="true">
        <span />
        <span
          v-for="col in headers"
          :key="col.weekday"
          class="day"
          :class="{ '-active': col.weekday === selectedWeekday }"
        >{{ col.narrow }}</span>
      </div>
      <div class="view">
        <div ref="scroller" class="scroller" @scroll="hideTip">
          <div v-for="row in rows" :key="row.habit.id" class="row">
            <span class="name" :title="row.habit.name">
              {{ row.habit.name }}
            </span>
            <span
              v-for="(cell, i) in row.cells"
              :key="cell.weekday"
              class="cell"
              :class="{ '-blank': cell.rate === null, '-low': cell.low }"
              :role="cell.rate === null ? undefined : 'img'"
              :tabindex="cell.rate === null ? undefined : 0"
              :aria-hidden="cell.rate === null || undefined"
              :style="cell.rate === null ? undefined : cellStyle(cell.rate)"
              :aria-label="cell.rate === null
                ? undefined
                : `${row.habit.name} · ${headers[i].short} · ${cell.percent}%`"
              @pointerenter="showTip"
              @pointerleave="hideTip"
              @focus="showTip"
              @blur="hideTip"
              @keydown.escape="hideTip"
            />
          </div>
        </div>
        <OverlayScrollbar :target="scroller" />
      </div>
      <p class="footnote">
        Red outline: done under 35% of the time
      </p>
      <span v-if="tip" class="tooltip" :style="tip.style" aria-hidden="true">
        {{ tip.text }}
      </span>
    </div>
  </Widget>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

.widget-frame.habits-by-weekday {
  --widget-gap: #{rem(6px)};

  padding-bottom: rem(6px);

  > .header > .actions > .subtitle {
    margin: 0 rem(4px) 0 0;
    font-size: rem(13px);
    font-weight: 700;
    text-transform: uppercase;
    color: var(--color-widget-title);
  }
}

.habits-by-weekday {
  .message {
    padding: space(2) rem(4px) 0;
    font-size: rem(11px);
    color: var(--color-text-muted);
  }

  .content,
  .view,
  .scroller {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .content { height: 100%; }

  .view,
  .scroller { flex: 1; }

  .view { position: relative; }

  .scroller {
    gap: rem(6px);
    @include scroller(y);
  }

  .weekdays,
  .row {
    display: grid;
    flex: none;
    grid-template-columns: rem(85px) repeat(7, minmax(0, 1fr));
    column-gap: rem(5px);
    align-items: center;
    padding: 0 rem(16px) 0 rem(4px);
  }

  .weekdays { margin-bottom: rem(3px); }

  .weekdays > .day,
  .row > .name {
    font-size: rem(9px);
    font-weight: 700;
    line-height: rem(11px);
    text-transform: uppercase;
  }

  .weekdays > .day {
    text-align: center;
    color: var(--color-widget-title);

    &.-active {
      color: color-mix(in sRGB, var(--color-tile-icon) 80%, transparent);
    }
  }

  .row > .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: color-mix(in sRGB, var(--color-tile-icon) 60%, transparent);
  }

  .cell {
    height: rem(16px);
    cursor: default;
    background: color-mix(
      in sRGB, var(--color-weekday-cell) var(--cell-alpha), transparent
    );
    border-radius: rem(4px);
    @include colour-transition;
    @include focus-ring;

    &.-blank { background: transparent; }
    &.-low { border: 1px solid var(--color-weekday-low); }
  }

  .footnote {
    flex: none;
    padding: rem(8px) rem(4px) 0;
    font-size: rem(8px);
    font-weight: 700;
    line-height: rem(10px);
    text-transform: uppercase;
    color: color-mix(in sRGB, var(--color-tile-icon) 30%, transparent);
  }

  .tooltip {
    position: fixed;
    z-index: 10;
    padding: space(1) space(2);
    font-size: rem(11px);
    white-space: nowrap;
    color: var(--color-text);
    pointer-events: none;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: $radius-small;
    transform: translate(-50%, calc(-100% - #{space(1)}));
  }
}
</style>
