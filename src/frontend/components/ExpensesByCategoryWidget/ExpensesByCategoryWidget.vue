<script setup lang="ts">
// The By Category Widget (Figma 3889:8855): each
// Category's spend this month against the comparison
// period, from `@/expenses/by-category`, as a
// square-root bar, an amount and a change. The rows
// scroll under the overlay scrollbar; the footnote
// stays below them.
import {
  computed,
  ref,
  shallowRef,
  useTemplateRef,
  watch
} from 'vue'
import { parseISO } from 'date-fns'
import { localDate } from '@shared/dates'
import type {
  Category,
  Transaction
} from '@shared/expenses'
import OverlayScrollbar
  from '@/components/OverlayScrollbar/OverlayScrollbar.vue'
import Widget from '@/components/Widget/Widget.vue'
import { useDataVersion }
  from '@/composables/use-data-version'
import {
  categoryRows,
  spendPeriods,
  type CategoryChange
} from '@/expenses/by-category'
import { formatAmount } from '@/expenses/money'
import { formatDate } from '@/locale/format'
import { useSelectedDateStore }
  from '@/stores/selected-date'

interface Data {
  readonly transactions: readonly Transaction[]
  readonly categories: readonly Category[]
}

const store = useSelectedDateStore()
const version = useDataVersion('transactions', 'categories')
const scroller = useTemplateRef<HTMLElement>('scroller')

const periods = computed(() => spendPeriods(store.day))

const data = shallowRef<Data | null>(null)
const failed = ref(false)

// Bumped by each load, so a load a newer one overtook is
// dropped.
let generation = 0

const load = async (): Promise<void> => {
  const asked = ++generation
  const { expenses } = window.bulletin
  const { period, comparison } = periods.value
  const [listed, categories] = await Promise.all([
    expenses.list({ from: comparison.from, to: period.to }),
    expenses.listCategories()
  ])
  if (asked !== generation) return
  if (!listed.ok || !categories.ok) {
    failed.value = true
    data.value = null
    return
  }
  failed.value = false
  data.value = {
    transactions: listed.value,
    categories: categories.value
  }
}

watch(
  [() => localDate(store.day), version],
  () => { void load() },
  { immediate: true }
)

const versus = computed(() => `vs ${formatDate(
  parseISO(periods.value.comparison.from),
  'monthShort'
)}`)

type Tone = 'rise' | 'fall' | 'muted'

const changeOf = (
  change: CategoryChange
): { text: string; tone: Tone } => {
  if (change.kind === 'new')
    return { text: 'new', tone: 'muted' }
  const { percent } = change
  if (percent > 0) return { text: `↑${percent}%`, tone: 'rise' }
  if (percent < 0)
    return { text: `↓${-percent}%`, tone: 'fall' }
  return { text: '0%', tone: 'muted' }
}

const rows = computed(() => {
  if (!data.value) return []
  const found = categoryRows(
    data.value.transactions,
    data.value.categories,
    store.day
  )
  const top = found[0]?.spend ?? 0
  return found.map(row => ({
    id: row.category.id,
    name: row.category.name,
    spend: formatAmount(row.spend),
    bar: row.bar,
    top: row.spend === top,
    ...changeOf(row.change)
  }))
})
</script>

<template>
  <Widget
    class="expenses-by-category"
    title="By Category"
    icon="wallet"
  >
    <template #actions>
      <p class="versus">
        {{ versus }}
      </p>
    </template>

    <p v-if="failed" class="message" role="alert">
      Couldn’t load By Category.
    </p>
    <p v-else-if="data && !rows.length" class="message">
      No spending this month
    </p>
    <template v-else-if="data">
      <div class="view">
        <ul
          ref="scroller"
          class="rows"
          aria-label="Spend by Category"
        >
          <li v-for="row in rows" :key="row.id" class="row">
            <span class="name">{{ row.name }}</span>
            <span class="track">
              <span
                v-if="row.bar > 0"
                class="bar"
                :class="{ '-top': row.top }"
                :style="{ width: `${row.bar * 100}%` }"
              />
            </span>
            <span class="spend">{{ row.spend }}</span>
            <span class="change" :data-tone="row.tone">
              {{ row.text }}
            </span>
          </li>
        </ul>
        <OverlayScrollbar :target="scroller" />
      </div>
      <p class="note">
        Bar length on a square-root scale
      </p>
    </template>
  </Widget>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

// Figma's rows start 14px below the header; the list
// starts 5px higher, with 5px of padding, so the top
// bar's glow isn't clipped by the scroller.
$glow-room: rem(5px);

.widget-frame.expenses-by-category {
  --widget-gap: calc(#{rem(14px)} - #{$glow-room});

  > .header > .actions > .versus {
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
  }

  > .body > .message {
    margin-top: $glow-room;
    font-size: rem(11px);
    color: var(--color-text-muted);
  }

  // The view runs into the right inset, so the overlay
  // scrollbar sits clear of the change column.
  > .body > .view {
    position: relative;
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    margin-right: calc(var(--widget-inset) * -1);
  }

  > .body > .view > .rows {
    display: flex;
    flex-direction: column;
    gap: rem(17px);
    min-height: 0;
    margin: 0;
    padding: $glow-room 0;
    list-style: none;
    @include scroller(y);
  }

  // Name 78px, bar up to 100px, the spend right-aligned
  // 95px past it and the change 55px past that, at
  // Figma's minimum width.
  .row {
    display: grid;
    flex: none;
    grid-template-rows: rem(12px);
    grid-template-columns:
      rem(78px) rem(100px) minmax(0, 1fr) rem(55px);
    align-items: center;
    padding:
      0 calc(#{rem(4px)} + var(--widget-inset)) 0 rem(4px);
    line-height: normal;
  }

  .row > .name {
    overflow: hidden;
    font-size: rem(10px);
    font-weight: 700;
    text-overflow: ellipsis;
    text-transform: uppercase;
    white-space: nowrap;
    color: var(--color-category-label);
  }

  .row > .track {
    display: flex;
    height: rem(12px);
  }

  .row > .track > .bar {
    height: 100%;
    background: var(--color-category-bar);
    border-radius: rem(3px);

    &.-top {
      background: var(--color-category-bar-top);
      box-shadow: 0 0 rem(5px) var(--color-category-bar-glow);
    }
  }

  // Figma tops the amount's taller line box with the
  // bar, rather than centring it.
  .row > .spend {
    align-self: start;
    font-family: $font-family-mono;
    font-size: rem(10px);
    font-weight: 500;
    text-align: right;
    white-space: nowrap;
    color: var(--color-spend-value);
  }

  .row > .change {
    font-size: rem(9px);
    font-weight: 700;
    text-align: right;
    text-transform: uppercase;
    white-space: nowrap;
    color: var(--color-spend-caption);

    &[data-tone='rise'] { color: var(--color-spend-rise); }

    // Figma's green is the improvement colour at 90%.
    &[data-tone='fall'] {
      color: color-mix(
        in sRGB, var(--color-improvement) 90%, transparent
      );
    }
  }

  > .body > .note {
    flex: none;

    // Figma's footnote line box ends 8px from the
    // card's bottom edge, 2px into the inset.
    margin: calc(#{rem(10px)} - #{$glow-room}) 0 rem(-2px);
    padding-left: rem(4px);
    font-size: rem(8px);
    font-weight: 700;
    line-height: normal;
    text-transform: uppercase;
    white-space: nowrap;
    color: var(--color-category-note);
  }
}
</style>
