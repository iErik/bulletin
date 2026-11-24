<script setup lang="ts">
// Sleep Overview (Figma 3859:6822). `revision` reloads after Timeline edits.
import { computed, ref, shallowRef, watch } from 'vue'
import {
  SLEEP_GOAL_MAX_MINUTES,
  SLEEP_GOAL_MIN_MINUTES
} from '@shared/sleep'
import { localDate } from '@shared/dates'
import GoalLine from '@/components/GoalLine/GoalLine.vue'
import Icon from '@/components/Icon/Icon.vue'
import Widget from '@/components/Widget/Widget.vue'
import {
  firstDayOfWeek,
  formatDate,
  formatNumber
} from '@/locale/format'
import {
  avgSleepMs,
  barHeightPx,
  formatGoalLabel,
  formatNapAvg,
  formatSleepDebt,
  formatSleepDuration,
  longestNight,
  naps,
  nightBars,
  shortestNight,
  sleepDebtMs,
  streak,
  wakeUpsPerNight,
  type NightBar,
  type NightStat
} from '@/sleep/overview'
import {
  sleepDays,
  sleepFetchRange,
  type SleepDay
} from '@/sleep/stretches'
import { useSelectedDateStore }
  from '@/stores/selected-date'
import { useSleepGoalStore }
  from '@/stores/sleep-goal'

const GOAL_STEP = 15
const CHART_H = 208
const Y_TICKS = [12, 10, 8, 6, 4] as const
const EMPTY = '—'

const props = defineProps<{ revision?: number }>()
const selected = useSelectedDateStore()
const goalStore = useSleepGoalStore()
const days = shallowRef<SleepDay[]>([])
const failed = ref(false)
const draftGoal = ref(goalStore.minutes)
let generation = 0

const date = computed(() => localDate(selected.day))

const load = async (): Promise<void> => {
  const asked = ++generation
  const to = date.value
  const range = { from: '1970-01-01' as const, to }
  const [periods] = await Promise.all([
    window.bulletin.sleep.list(sleepFetchRange(range)),
    goalStore.load()
  ])
  if (asked !== generation) return
  draftGoal.value = goalStore.minutes
  if (!periods.ok) {
    failed.value = true
    days.value = []
    return
  }
  failed.value = false
  days.value = sleepDays(periods.value, range)
}

watch(
  () => [date.value, props.revision ?? 0] as const,
  () => { void load() },
  { immediate: true }
)
watch(
  () => goalStore.minutes,
  m => { draftGoal.value = m }
)

const bars = computed(() =>
  nightBars(days.value, date.value, draftGoal.value))
const nightCount = computed(() =>
  streak(days.value, date.value, draftGoal.value))
const debt = computed(() =>
  sleepDebtMs(days.value, date.value, draftGoal.value))
const napStat = computed(() =>
  naps(days.value, date.value, firstDayOfWeek()))
const wakeUps = computed(() =>
  wakeUpsPerNight(days.value, date.value))

const nightMeta = (
  night: NightStat | null
): { mid: string; value: string } =>
  night
    ? {
        mid: formatDate(
          new Date(`${night.day}T12:00:00`),
          'weekdayDay'
        ),
        value: formatSleepDuration(night.asleepMs)
      }
    : { mid: EMPTY, value: EMPTY }

const stats = computed(() => {
  const avg = avgSleepMs(days.value, date.value)
  return [
    {
      icon: 'moon',
      label: 'Avg sleep',
      value: avg === null
        ? EMPTY
        : formatSleepDuration(avg),
      debt: false
    },
    {
      icon: 'receipt-minus',
      label: 'Sleep debt',
      value: debt.value === null
        ? EMPTY
        : formatSleepDebt(debt.value),
      debt: debt.value !== null && debt.value < 0
    },
    {
      icon: 'task-square',
      label: 'Streak',
      value: nightCount.value === 1
        ? '1 night'
        : `${nightCount.value} nights`,
      debt: false
    }
  ]
})

const rows = computed(() => {
  const long = nightMeta(
    longestNight(days.value, date.value)
  )
  const short = nightMeta(
    shortestNight(days.value, date.value)
  )
  return [
    { name: 'Longest night', ...long },
    { name: 'Shortest night', ...short },
    {
      name: 'Naps',
      mid: `${napStat.value.count} this week`,
      value: napStat.value.avgMs === null
        ? EMPTY
        : formatNapAvg(napStat.value.avgMs)
    },
    {
      name: 'Wake-ups',
      mid: 'per night',
      value: wakeUps.value === null
        ? EMPTY
        : formatNumber(wakeUps.value, {
            maximumFractionDigits: 1,
            minimumFractionDigits: 1
          })
    }
  ]
})

const goalLabel = computed(() => formatGoalLabel(draftGoal.value))
const goalAria = computed(() => {
  const h = Math.floor(draftGoal.value / 60)
  const m = draftGoal.value % 60
  return m === 0
    ? `${h} hours`
    : `${h} hours ${m} minutes`
})

const onPreview = (m: number): void => {
  draftGoal.value = m
}
const onCommit = (m: number): void => {
  draftGoal.value = m
  void goalStore.set(m)
}
const dayNum = (day: string): string =>
  String(Number(day.slice(8, 10)))
const barStyle = (bar: NightBar): Record<string, string> =>
  bar.asleepMs === null
    ? { height: '0' }
    : { height: `${barHeightPx(bar.asleepMs, CHART_H)}px` }
</script>

<template>
  <Widget
    class="sleep-overview"
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
            :class="{ '-debt': stat.debt }"
          >
            {{ stat.value }}
          </p>
        </section>
      </div>
      <div class="chart-block">
        <div class="chart-head">
          <span>Hours per night</span>
          <span>Last 14 nights</span>
        </div>
        <div
          class="chart"
          :style="{ '--chart-h': `${CHART_H}px` }"
        >
          <div
            class="y-axis"
            aria-hidden="true"
          >
            <span
              v-for="h in Y_TICKS"
              :key="h"
              class="tick"
            >{{ h }}h</span>
          </div>
          <div class="plot">
            <div
              class="grid"
              aria-hidden="true"
            >
              <span
                v-for="h in Y_TICKS"
                :key="h"
                class="line"
              />
            </div>
            <div class="bars">
              <div
                v-for="bar in bars"
                :key="bar.day"
                class="col"
              >
                <div
                  v-if="bar.asleepMs !== null"
                  class="bar"
                  :class="{ '-met': bar.meetsGoal }"
                  :style="barStyle(bar)"
                />
                <span class="day">
                  {{ dayNum(bar.day) }}
                </span>
              </div>
            </div>
            <GoalLine
              :value="goalStore.minutes"
              :min="SLEEP_GOAL_MIN_MINUTES"
              :max="SLEEP_GOAL_MAX_MINUTES"
              :step="GOAL_STEP"
              :scale-min="SLEEP_GOAL_MIN_MINUTES"
              :scale-max="SLEEP_GOAL_MAX_MINUTES"
              :label="goalLabel"
              v-bind="{
                ariaLabel: 'Sleep Goal',
                ariaValueText: goalAria
              }"
              @preview="onPreview"
              @commit="onCommit"
            />
          </div>
        </div>
      </div>
      <ul class="rows">
        <li v-for="row in rows" :key="row.name" class="row">
          <span class="name">{{ row.name }}</span>
          <span class="mid">{{ row.mid }}</span>
          <span class="val">{{ row.value }}</span>
        </li>
      </ul>
    </div>
  </Widget>
</template>

<style lang="scss">
@use '@/styles/utils' as *;
.widget-frame.sleep-overview { --widget-gap: #{rem(14px)}; }

.sleep-overview > .body > .error {
  font-size: rem(11px);
  color: var(--color-text-muted);
}

.sleep-overview > .body > .body-inner {
  display: flex;
  flex-direction: column;
  gap: rem(16px);
}

.sleep-overview .stats {
  display: flex;
  gap: rem(8px);

  > .stat {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: rem(8px);
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
    font-size: rem(10px);
    font-weight: 700;
    text-transform: uppercase;
    color: var(--color-text-muted);
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
    color: var(--color-text);
    &.-debt { color: var(--color-danger); }
  }
}

.sleep-overview .chart-block {
  display: flex;
  flex-direction: column;
  gap: rem(6px);
}

.sleep-overview .chart-head {
  display: flex;
  justify-content: space-between;
  font-size: rem(10px);
  font-weight: 700;
  text-transform: uppercase;
  color: var(--color-widget-title);
}

.sleep-overview .chart {
  display: grid;
  grid-template-columns: rem(32px) minmax(0, 1fr);
  gap: rem(4px);
}

.sleep-overview .y-axis {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: var(--chart-h);
  font-size: rem(10px);
  font-weight: 700;
  color: var(--color-widget-title);

  > .tick {
    line-height: 1;
    transform: translateY(-50%);
    &:first-child { transform: none; }
    &:last-child { transform: translateY(-100%); }
  }
}

.sleep-overview .plot {
  position: relative;
  height: var(--chart-h);
  margin-bottom: rem(14px);
}

.sleep-overview .grid {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  pointer-events: none;

  > .line {
    display: block;
    height: 0;
    border-top: 1px solid color-mix(
      in sRGB, var(--color-text) 9%, transparent
    );
  }
}

.sleep-overview .bars {
  position: absolute;
  inset: 0;
  display: flex;
  gap: rem(12.5px);
  align-items: flex-end;
  justify-content: space-between;
  padding: 0 rem(6px);
  pointer-events: none;
}

.sleep-overview .col {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
  height: 100%;
}

.sleep-overview .bar {
  width: rem(12px);
  border-radius: rem(4px);
  background: linear-gradient(
    to bottom, rgb(255 255 255 / 45%), rgb(255 255 255 / 4%)
  );

  &.-met {
    background: linear-gradient(
      to bottom, rgb(255 255 255 / 90%), rgb(255 255 255 / 4%)
    );
    box-shadow: 0 0 6px 0 rgb(255 255 255 / 35%);
  }
}

.sleep-overview .day {
  position: absolute;
  bottom: rem(-14px);
  font-size: rem(9px);
  font-weight: 700;
  color: var(--color-widget-title);
}
.sleep-overview .plot > .goal-line { z-index: 1; }

.sleep-overview .rows {
  display: flex;
  flex-direction: column;
  gap: rem(4px);
  margin: 0;
  padding: 0;
  list-style: none;
}

.sleep-overview .row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: rem(8px);
  align-items: center;
  min-height: rem(34px);
  padding: 0 rem(12px);
  background: color-mix(
    in sRGB, var(--color-text) 3%, transparent
  );
  border-radius: rem(5px);

  > .name {
    font-size: rem(13px);
    font-weight: 500;
    color: var(--color-text);
  }

  > .mid {
    justify-self: center;
    font-size: rem(10px);
    font-weight: 700;
    text-transform: uppercase;
    color: rgb(165 165 165 / 50%);
  }

  > .val {
    justify-self: end;
    font-family: $font-family-mono;
    font-size: rem(11px);
    font-weight: 500;
    color: var(--color-text);
  }
}
</style>
