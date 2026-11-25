<script setup lang="ts">
// Habit Overview (Figma 3889:9401; Best day replaces
// "Usually done by" per BLT-117).
import { computed, ref, shallowRef, watch } from 'vue'
import { localDate } from '@shared/dates'
import { HABIT_GOAL } from '@shared/habits'
import type { Habit, HabitEntry } from '@shared/habits'
import GoalLine from '@/components/GoalLine/GoalLine.vue'
import Icon from '@/components/Icon/Icon.vue'
import Widget from '@/components/Widget/Widget.vue'
import { useDataVersion }
  from '@/composables/use-data-version'
import * as ov from '@/habits/overview'
import { ratePercent, shiftDay } from '@/habits/rules'
import * as fmt from '@/locale/format'
import { useSelectedDateStore }
  from '@/stores/selected-date'

const Y_TICKS = [100, 75, 50, 25] as const
const EMPTY = '—'
const selected = useSelectedDateStore()
const version = useDataVersion('habits', 'habitEntries', 'habitGoal')
const habits = shallowRef<Habit[]>([])
const entries = shallowRef<HabitEntry[]>([])
const savedGoal = ref<number>(HABIT_GOAL.default)
const draftGoal = ref<number>(HABIT_GOAL.default)
const failed = ref(false)
let generation = 0
let goalCommit = 0
const date = computed(() => localDate(selected.day))

const load = async (): Promise<void> => {
  const asked = ++generation
  const to = date.value
  const [hs, es, g] = await Promise.all([
    window.bulletin.habits.list('all'),
    window.bulletin.habits.listEntries({
      from: shiftDay(to, 1 - ov.WEEKDAY_DAYS), to
    }),
    window.bulletin.habits.getGoal()
  ])
  if (asked !== generation) return
  if (!hs.ok || !es.ok || !g.ok) {
    failed.value = true
    habits.value = entries.value = []
    return
  }
  failed.value = false
  habits.value = hs.value
  entries.value = es.value
  savedGoal.value = draftGoal.value = g.value
}
watch(
  () => [date.value, version.value] as const,
  () => void load(),
  { immediate: true }
)

const stats = computed(() => {
  const [all, done, day] = [habits.value, entries.value, date.value]
  const now = ov.today(all, done, day)
  const m = ov.thisMonth(all, done, day)
  return [
    { icon: 'task-square', label: 'Today',
      value: now ? `${now.done} / ${now.counted}` : EMPTY },
    { icon: 'mood', label: 'Perfect days',
      value: m === null ? EMPTY : String(ov.perfectDays(all, done, day)) },
    { icon: 'receipt-add', label: 'This month',
      value: m === null ? EMPTY : `${ratePercent(m)}%` }
  ]
})

const weeks = computed(() => ov.weeklyCompletion(
  habits.value, entries.value, date.value,
  {
    weekStartsOn: fmt.firstDayOfWeek(),
    firstWeekContainsDate: fmt.firstWeekContainsDate()
  }
))
const meetsGoal = (rate: number): boolean =>
  Number((rate * 100).toPrecision(12)) >= draftGoal.value
const goalProps = computed(() => ({
  value: draftGoal.value, min: HABIT_GOAL.min, max: HABIT_GOAL.max,
  step: HABIT_GOAL.step, scaleMin: 0, scaleMax: 100,
  label: `${draftGoal.value}% goal`, labelPosition: 'above' as const,
  ariaLabel: 'Habit Goal', ariaValueText: `${draftGoal.value}%`
}))
const onCommit = async (next: number): Promise<void> => {
  const commit = ++goalCommit
  draftGoal.value = next
  const res = await window.bulletin.habits.setGoal(next)
  if (commit !== goalCommit) return
  if (res.ok) savedGoal.value = draftGoal.value = res.value
  else draftGoal.value = savedGoal.value
}
interface Row { name: string; mid: string; value: string; tone: string }
const wday = (d: ov.Weekday): string =>
  fmt.formatDate(new Date(2026, 0, 4 + d, 12), 'weekday')
const rows = computed((): Row[] => {
  const [all, done, day] = [habits.value, entries.value, date.value]
  const start = fmt.firstDayOfWeek()
  const top = ov.strongest(all, done, day)
  const drop = ov.slipping(all, done, day)
  const best = ov.bestDay(all, done, day, start)
  const skip = ov.mostSkippedDay(all, done, day, start)
  const diff = ov.trend(all, done, day)
  const p = diff?.points ?? 0
  return [
    top && { name: 'Strongest', mid: top.habit.name,
      value: `${ratePercent(top.rate)}%`, tone: 'good' },
    drop && { name: 'Slipping', mid: `${drop.habit.name} · 2 weeks`,
      value: `↓${drop.points}%`, tone: 'bad' },
    best && { name: 'Best day', mid: 'all habits',
      value: wday(best.weekday), tone: 'neutral' },
    skip && { name: 'Most skipped day', mid: 'all habits',
      value: wday(skip.weekday), tone: 'neutral' },
    diff && {
      name: 'Trend', mid: 'vs last month',
      value: p > 0 ? `+${p}%` : p < 0 ? `−${Math.abs(p)}%` : '0%',
      tone: p > 0 ? 'good' : p < 0 ? 'bad' : 'neutral'
    }
  ].filter((r): r is Row => Boolean(r))
})
</script>

<template>
  <Widget class="habit-overview" title="Overview" icon="activity">
    <p v-if="failed" class="error" role="alert">
      Couldn’t load Overview.
    </p>
    <div v-else class="body-inner">
      <div class="stats">
        <section v-for="stat in stats" :key="stat.label" class="stat">
          <h3 class="label">
            <Icon class="icon" :name="stat.icon" />
            {{ stat.label }}
          </h3>
          <p class="value">
            {{ stat.value }}
          </p>
        </section>
      </div>
      <div class="chart-block">
        <div class="chart-head">
          <span>Completion per week</span>
          <span>Last 12 weeks</span>
        </div>
        <div class="chart">
          <div class="y-axis" aria-hidden="true">
            <span
              v-for="(tick, i) in Y_TICKS"
              :key="tick"
              class="tick"
              :style="{ top: `${i * 25}%` }"
            >{{ tick }}%</span>
          </div>
          <div class="plot">
            <div class="grid" aria-hidden="true">
              <span
                v-for="(tick, i) in Y_TICKS"
                :key="tick"
                class="line"
                :style="{ top: `${i * 25}%` }"
              />
            </div>
            <div class="bars">
              <div v-for="bar in weeks" :key="bar.from" class="col">
                <div
                  v-if="bar.rate !== null"
                  class="bar"
                  :class="{ '-met': meetsGoal(bar.rate) }"
                  :style="{ height: `${bar.rate * 100}%` }"
                />
                <span class="week">W{{ bar.week }}</span>
              </div>
            </div>
            <GoalLine
              v-bind="goalProps"
              @preview="draftGoal = $event"
              @commit="onCommit"
            />
          </div>
        </div>
      </div>
      <ul v-if="rows.length" class="rows">
        <li v-for="row in rows" :key="row.name" class="row">
          <span class="name">{{ row.name }}</span>
          <span class="mid">{{ row.mid }}</span>
          <span class="val" :class="`-${row.tone}`">{{ row.value }}</span>
        </li>
      </ul>
    </div>
  </Widget>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

$card-bg: color-mix(in sRGB, var(--color-text) 3%, transparent);

.widget-frame.habit-overview { --widget-gap: #{rem(10px)}; }

.habit-overview {
  > .body > .error {
    font-size: rem(11px);
    color: var(--color-text-muted);
  }

  > .body > .body-inner,
  .chart-block,
  .rows,
  .stat,
  .col {
    display: flex;
    flex-direction: column;
  }

  > .body > .body-inner { gap: rem(16px); }

  .label,
  .chart-head,
  .mid { font-size: rem(10px); }

  .label,
  .chart-head,
  .y-axis,
  .week,
  .mid {
    font-weight: 700;
    text-transform: uppercase;
  }

  .chart-head,
  .y-axis,
  .week { color: var(--color-widget-title); }

  .value,
  .val {
    font-family: $font-family-mono;
    font-size: rem(11px);
    font-weight: 500;
    color: var(--color-stat-value);
  }

  .value,
  .mid {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .stats,
  .stat > .label,
  .chart-head,
  .bars { display: flex; }

  .stats {
    gap: rem(8px);
    padding: 0 rem(3px) 0 rem(4px);
  }

  .stat,
  .row {
    background: $card-bg;
    border-radius: rem(5px);
  }

  .stat,
  .col {
    flex: 1;
    min-width: 0;
  }

  .stat {
    min-height: rem(67px);
    padding: rem(8px) rem(7px) rem(12px);

    > .label {
      gap: rem(7px);
      align-items: center;
      margin-bottom: auto;
      padding-left: rem(2px);
      color: var(--color-tile-icon);
    }

    > .label > .icon {
      flex-shrink: 0;
      width: rem(11px);
      height: rem(11px);
    }
  }

  .chart-block {
    gap: rem(11px);
    padding: 0 rem(8px) 0 rem(4px);
  }

  .chart-head {
    justify-content: space-between;
    line-height: rem(12px);
  }

  .chart {
    display: grid;
    grid-template-columns: rem(32px) minmax(0, 1fr);
  }

  .y-axis,
  .plot,
  .col { position: relative; }

  .y-axis,
  .plot { height: rem(176px); }

  .y-axis { font-size: rem(9px); }

  .tick,
  .week,
  .grid > .line { position: absolute; }

  .tick {
    left: 0;
    line-height: 1;
    transform: translateY(-50%);
  }

  .plot {
    margin-bottom: rem(16px);

    > .goal-line { z-index: 1; }
  }

  .grid,
  .bars {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .grid > .line {
    right: 0;
    left: 0;
    height: 0;
    border-top: 1px solid color-mix(in sRGB, var(--color-text) 5%, transparent);
  }

  .bars { align-items: flex-end; }

  .col {
    align-items: center;
    justify-content: flex-end;
    height: 100%;
  }

  .bar {
    width: rem(14px);
    border-radius: rem(4px);
    background: linear-gradient(
      to bottom, rgb(255 255 255 / 50%), rgb(255 255 255 / 4%)
    );

    &.-met {
      background: linear-gradient(
        to bottom, rgb(255 255 255 / 90%), rgb(255 255 255 / 4%)
      );
      box-shadow: 0 0 6px 0 rgb(255 255 255 / 35%);
    }
  }

  .week {
    bottom: rem(-16px);
    font-size: rem(8px);
    line-height: rem(10px);
  }

  .rows { gap: rem(4px); }

  .row {
    display: grid;
    grid-template-columns: minmax(0, 47%) minmax(0, 1fr) auto;
    gap: rem(8px);
    align-items: center;
    min-height: rem(34px);
    padding: 0 rem(12px);

    > .name {
      font-size: rem(13px);
      font-weight: 500;
      color: var(--color-text);
    }

    > .mid {
      color: color-mix(in sRGB, var(--color-tile-icon) 50%, transparent);
    }

    > .val {
      justify-self: end;

      &.-good { color: var(--color-improvement); }
      &.-bad { color: var(--color-danger); }
    }
  }
}
</style>
