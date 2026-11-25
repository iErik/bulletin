<script setup lang="ts">
// The Month Pace Widget: loads the Selected Date's month
// Transactions and Budget, computes pace and projection,
// and composes MonthPaceChart above MonthPaceBars.
import { computed, ref, shallowRef, watch } from 'vue'
import { endOfMonth, format, startOfMonth } from 'date-fns'
import { localDate } from '@shared/dates'
import type { Budget, Transaction } from '@shared/expenses'
import MonthPaceBars
  from '@/components/MonthPaceBars/MonthPaceBars.vue'
import MonthPaceChart
  from '@/components/MonthPaceChart/MonthPaceChart.vue'
import Widget from '@/components/Widget/Widget.vue'
import { useDataVersion }
  from '@/composables/use-data-version'
import { formatAmount } from '@/expenses/money'
import { monthPace } from '@/expenses/month-pace'
import { useSelectedDateStore }
  from '@/stores/selected-date'

const store = useSelectedDateStore()
const version = useDataVersion('transactions', 'budget')

/** The first of the Selected Date's month. */
const month = computed(() => startOfMonth(store.day))

const transactions =
  shallowRef<readonly Transaction[]>([])
const budget = shallowRef<Budget | null>(null)
const loaded = ref(false)
const failed = ref(false)

// Bumped by each load, so a load a newer one overtook is
// dropped.
let generation = 0

const load = async (from: Date): Promise<void> => {
  const asked = ++generation
  const { expenses } = window.bulletin
  const [listed, got] = await Promise.all([
    expenses.list({
      from: localDate(from),
      to: localDate(endOfMonth(from))
    }),
    expenses.getBudget(format(from, 'yyyy-MM'))
  ])
  if (asked !== generation) return
  if (!listed.ok || !got.ok) {
    failed.value = true
    return
  }
  failed.value = false
  transactions.value = listed.value
  budget.value = got.value
  loaded.value = true
}

watch(
  [() => month.value.getTime(), version],
  () => { void load(month.value) },
  { immediate: true }
)

const pace = computed(() =>
  monthPace(transactions.value, budget.value, store.day)
)

const projected = computed(() => {
  const amount = formatAmount(
    Math.round(pace.value.projection)
  )
  if (!pace.value.pace) return `Projected ${amount}`
  const limit = formatAmount(pace.value.pace.end.amount)
  return `Projected ${amount} / ${limit}`
})
</script>

<template>
  <Widget
    class="month-pace-widget"
    title="Month Pace"
    icon="dollar"
  >
    <template v-if="loaded && !failed" #actions>
      <p class="projected">
        {{ projected }}
      </p>
    </template>

    <p v-if="failed" class="message" role="alert">
      Couldn’t load this month.
    </p>
    <template v-else-if="loaded">
      <div class="chart">
        <MonthPaceChart
          :pace="pace"
          :selected-date="store.day"
          :is-today="store.isToday"
        />
      </div>
      <MonthPaceBars :pace="pace" />
    </template>
  </Widget>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

.widget-frame.month-pace-widget {
  // Figma's 24k line sits at y=64 (26px below the 28px
  // header); MonthPaceChart's top padding is 18px.
  --widget-gap: #{rem(8px)};
}

.month-pace-widget {
  > .header > .actions > .projected {
    padding-right: rem(4px);
    font-size: rem(13px);
    font-weight: 700;
    text-transform: uppercase;
    white-space: nowrap;
    color: var(--color-widget-title);
  }

  > .body {
    display: flex;
    flex-direction: column;
    gap: rem(14px);
    padding-bottom: rem(6px);
  }

  > .body > .chart {
    flex: 1;
    min-height: 0;

    // MonthPaceChart's left/right margins are measured
    // from the card edges; bleed past the 10px Widget
    // inset so both charts share the exact day x-axis.
    margin: 0 calc(var(--widget-inset) * -1);
  }

  > .body > .month-pace-bars { flex: none; }

  > .body > .message {
    font-size: rem(11px);
    color: var(--color-text-muted);
  }
}
</style>
