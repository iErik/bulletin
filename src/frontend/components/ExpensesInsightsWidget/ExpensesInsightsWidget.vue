<script setup lang="ts">
// Insights (Figma 3889:8871): five fixed rows of
// month-to-date findings about spend. The rows come from
// `@/expenses/insights`; a row it leaves out is hidden.
import { computed, ref, shallowRef, watch } from 'vue'
import { parseISO } from 'date-fns'
import type {
  Budget,
  Category,
  Transaction
} from '@shared/expenses'
import type { MoodEntry } from '@shared/mood'
import Widget from '@/components/Widget/Widget.vue'
import { useDataVersion }
  from '@/composables/use-data-version'
import {
  categoryRows,
  spendPeriods
} from '@/expenses/by-category'
import {
  extraText,
  insightRows,
  periodExpenses,
  ratioText,
  type InsightRow
} from '@/expenses/insights'
import { formatDate } from '@/locale/format'
import { useSelectedDateStore }
  from '@/stores/selected-date'

interface Data {
  /** The Selected Date this was loaded for. */
  readonly day: Date
  readonly transactions: Transaction[]
  readonly budget: Budget | null
  readonly categories: Category[]
  readonly moods: MoodEntry[]
}

/** How a row's value is coloured. */
type Tone = 'good' | 'bad' | 'neutral' | 'stressed'

interface Row {
  readonly kind: InsightRow['kind']
  readonly label: string
  readonly caption: string
  readonly value: string
  readonly tone: Tone
}

const store = useSelectedDateStore()
const version = useDataVersion(
  'transactions', 'budget', 'categories', 'mood'
)
const data = shallowRef<Data | null>(null)
const failed = ref(false)
// Bumped by each load, so a load it overtook is dropped.
let generation = 0

const periods = computed(() => spendPeriods(store.day))

const load = async (): Promise<void> => {
  const asked = ++generation
  const { expenses, mood } = window.bulletin
  const day = store.day
  const { period, comparison } = spendPeriods(day)
  const [listed, budget, categories, moods] =
    await Promise.all([
      expenses.list({ from: comparison.from, to: period.to }),
      expenses.getBudget(period.from.slice(0, 7)),
      expenses.listCategories(),
      mood.list(period)
    ])
  if (asked !== generation) return
  if (!listed.ok || !budget.ok || !categories.ok || !moods.ok) {
    failed.value = true
    data.value = null
    return
  }
  failed.value = false
  data.value = {
    day,
    transactions: listed.value,
    budget: budget.value,
    categories: categories.value,
    moods: moods.value
  }
}

watch(
  () => [periods.value.period.to, version.value] as const,
  () => { void load() },
  { immediate: true }
)

/** A signed whole % with a typographic minus. */
const signed = (percent: number): string =>
  `${percent < 0 ? '−' : ''}${Math.abs(percent)}%`

/** Rises are bad and falls good, as spend goes. */
const spendTone = (percent: number): Tone =>
  percent > 0 ? 'bad' : percent < 0 ? 'good' : 'neutral'

const rowOf = (found: InsightRow, vsMonth: string): Row => {
  switch (found.kind) {
    case 'category': {
      const { category, percent } = found.value
      const arrow = percent > 0 ? '↑' : percent < 0 ? '↓' : ''
      return {
        kind: found.kind,
        label: category.name,
        caption: `vs ${vsMonth}`,
        value: `${arrow}${Math.abs(percent)}%`,
        tone: spendTone(percent)
      }
    }
    case 'weekends':
      return {
        kind: found.kind,
        label: 'Weekends',
        caption: 'vs weekdays',
        value: ratioText(found.value),
        tone: 'neutral'
      }
    case 'savings':
      return {
        kind: found.kind,
        label: 'Savings rate',
        caption: 'income − expenses',
        value: signed(found.value),
        tone: spendTone(-found.value)
      }
    case 'without': {
      const { largest, others, percent } = found.value
      const more = others ? ` +${others}` : ''
      return {
        kind: found.kind,
        label: `Without ${largest.description}${more}`,
        caption: 'budget used',
        value: `${percent}%`,
        tone: 'neutral'
      }
    }
    case 'stressed':
      return {
        kind: found.kind,
        label: 'Stressed days',
        caption: 'avg extra spend',
        value: extraText(found.value),
        tone: 'stressed'
      }
  }
}

const rows = computed((): Row[] => {
  const d = data.value
  if (!d) return []
  const { day } = d
  const vsMonth = formatDate(
    parseISO(spendPeriods(day).comparison.from), 'monthShort'
  )
  return insightRows({
    categories: categoryRows(d.transactions, d.categories, day),
    transactions: d.transactions,
    budget: d.budget,
    moods: d.moods,
    day
  }).map(found => rowOf(found, vsMonth))
})

/** The empty state's copy, once loaded with no rows. */
const empty = computed((): string | null => {
  const d = data.value
  if (!d || rows.value.length) return null
  return periodExpenses(d.transactions, d.day).length
    ? 'No insights yet'
    : 'No spending this month'
})
</script>

<template>
  <Widget
    class="expenses-insights-widget"
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
      {{ empty }}
    </p>
    <ul v-else class="rows">
      <li
        v-for="row in rows"
        :key="row.kind"
        class="row"
        :data-kind="row.kind"
        :data-tone="row.tone"
      >
        <span class="label">
          <span
            v-if="row.kind === 'stressed'"
            class="dot"
            aria-hidden="true"
          />
          <span class="text" :title="row.label">
            {{ row.label }}
          </span>
        </span>
        <span class="caption">{{ row.caption }}</span>
        <span class="value">{{ row.value }}</span>
      </li>
    </ul>
  </Widget>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

.widget-frame.expenses-insights-widget {
  // Figma's first row starts 8px below the header.
  --widget-gap: #{rem(8px)};

  > .header > .actions > .subtitle {
    margin: 0;
    font-size: rem(13px);
    font-weight: 700;
    text-transform: uppercase;
    white-space: nowrap;
    color: var(--color-widget-title);
  }
}

.expenses-insights-widget > .body > .message {
  padding: space(2) rem(4px) 0;
  font-size: rem(11px);
  color: var(--color-text-muted);
}

.expenses-insights-widget .rows {
  display: flex;
  flex-direction: column;
  gap: rem(4px);
  margin: 0;
  padding: 0;
  list-style: none;
}

// Figma's columns: the label at 12px, the caption at
// 190px from the row's left edge, and the value
// right-aligned 12px from its right edge.
.expenses-insights-widget .row {
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

  &[data-tone='stressed'] {
    --tone: var(--color-mood-stressed);
  }

  > .label {
    display: flex;
    gap: rem(8px);
    align-items: center;
    min-width: 0;
    padding-right: rem(8px);
  }

  > .label > .dot {
    flex: none;
    width: rem(6px);
    height: rem(6px);
    background: var(--tone);
    border-radius: 50%;
  }

  > .label > .text,
  > .caption {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  > .label > .text {
    font-size: rem(12px);
    font-weight: 500;
    color: var(--color-text);
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
